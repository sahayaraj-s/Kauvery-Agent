"""
Kauvery Agent - Autonomous Backend API Server (server.py)
Consolidated Server containing:
- FastAPI Application with Lifespan management
- Embedded DatabaseManager (SQLite with aiosqlite / sqlite3)
- Multi-Agent Orchestration & Real-time SSE Streaming (/api/run/*)
- Autonomous Browser Tools API (/api/browser/tools)
- CAPTCHA Intelligence Endpoints (/api/captcha/*)
- Web Scraping Task Endpoints (/api/scrape/*)
- Static Frontend Hosting (serves dist/ on port 8000)
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import sqlite3
import sys
import time
import urllib.parse
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

import aiosqlite
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from agents import LLM, main_agent
from browser_tools import (
    BROWSER_TOOL_SCHEMAS,
    OUTPUTS_DIR,
    BrowserSession,
    CaptchaDetectionEngine,
    ScrapingConfig,
    WebScrapingEngine,
    redact_creds,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("kauvery.server")

# ----------------- DATABASE MANAGER (SQLITE) -----------------

_DDL_SQLITE = """
CREATE TABLE IF NOT EXISTS automation_tasks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id          TEXT NOT NULL UNIQUE,
    prompt_redacted TEXT,
    start_url       TEXT,
    status          TEXT    DEFAULT 'pending',
    rows_scraped    INTEGER DEFAULT 0,
    output_files    TEXT,
    created_at      TEXT    DEFAULT (datetime('now')),
    updated_at      TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS captcha_detection_logs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    captcha_type    TEXT,
    provider        TEXT,
    confidence      REAL,
    is_test_env     INTEGER,
    page_url        TEXT,
    dom_indicators  TEXT,
    timestamp       TEXT    DEFAULT (datetime('now')),
    raw_signals     TEXT
);

CREATE TABLE IF NOT EXISTS scraping_results (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    url             TEXT,
    records_count   INTEGER,
    export_format   TEXT,
    export_path     TEXT,
    duration_s      REAL,
    logged_at       TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS execution_history (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id          TEXT,
    event_type      TEXT,
    event_data      TEXT,
    occurred_at     TEXT    DEFAULT (datetime('now'))
);
"""

class DatabaseManager:
    """Manages SQLite storage for automation logs, CAPTCHA metrics, and scrape results."""

    def __init__(self, db_path: str = "kauvery_automation.db"):
        self.db_path = db_path
        self._lock = asyncio.Lock()
        self._init_done = False

    async def init_db(self):
        async with self._lock:
            if self._init_done:
                return
            try:
                async with aiosqlite.connect(self.db_path) as db:
                    await db.executescript(_DDL_SQLITE)
                    await db.commit()
                self._init_done = True
                logger.info(f"DatabaseManager initialized SQLite at {self.db_path}")
            except Exception as e:
                logger.warning(f"aiosqlite init note: {e}")

    async def log_captcha_detection(self, captcha_type: str, provider: str, confidence: float, is_test_env: bool, page_url: str, dom_indicators: list):
        await self.init_db()
        try:
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute(
                    "INSERT INTO captcha_detection_logs (captcha_type, provider, confidence, is_test_env, page_url, dom_indicators) VALUES (?, ?, ?, ?, ?, ?)",
                    (captcha_type, provider, confidence, 1 if is_test_env else 0, page_url, json.dumps(dom_indicators))
                )
                await db.commit()
        except Exception as e:
            logger.debug(f"DB log error: {e}")

    async def get_captcha_logs(self, limit: int = 50) -> List[Dict[str, Any]]:
        await self.init_db()
        try:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = aiosqlite.Row
                async with db.execute("SELECT * FROM captcha_detection_logs ORDER BY id DESC LIMIT ?", (limit,)) as cur:
                    rows = await cur.fetchall()
                    return [dict(r) for r in rows]
        except Exception:
            return []

    async def log_task(self, run_id: str, prompt: str, start_url: str, status: str, rows: int = 0, files: list = None):
        await self.init_db()
        try:
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute(
                    "INSERT OR REPLACE INTO automation_tasks (run_id, prompt_redacted, start_url, status, rows_scraped, output_files) VALUES (?, ?, ?, ?, ?, ?)",
                    (run_id, prompt, start_url, status, rows, json.dumps(files or []))
                )
                await db.commit()
        except Exception as e:
            logger.debug(f"Task log error: {e}")


# ----------------- RUN STATE & DATA STRUCTURES -----------------

class RunRequest(BaseModel):
    prompt: str = Field(..., description="User automation instructions")
    url: Optional[str] = Field(None, description="Starting target URL (optional)")
    username: Optional[str] = Field(None, description="Optional login username")
    password: Optional[str] = Field(None, description="Optional login password")

class HumanInputRequest(BaseModel):
    type: str = Field("click", description="Action type: click, type, key")
    x: Optional[int] = Field(0, description="X coordinate")
    y: Optional[int] = Field(0, description="Y coordinate")
    text: Optional[str] = Field("", description="Text for type action")
    key: Optional[str] = Field("Enter", description="Key for keyboard action")

def resolve_target_url(prompt: str, provided_url: Optional[str] = None) -> str:
    """Smartly resolves the target starting URL from the user prompt or domain names."""
    if provided_url and provided_url.strip() and "quotes.toscrape.com" not in provided_url:
        u = provided_url.strip()
        if not u.startswith("http://") and not u.startswith("https://"):
            return "https://" + u
        return u

    url_match = re.search(r"https?://[^\s,;\"'<>]+", prompt, re.IGNORECASE)
    if url_match:
        return url_match.group(0).strip()

    domain_match = re.search(r"\b([a-zA-Z0-9-]+\.(?:com|org|dev|net|in|io|co|ai|edu|gov|app|me)(?:/[^\s]*)?)\b", prompt, re.IGNORECASE)
    if domain_match:
        return "https://" + domain_match.group(1).strip()

    prompt_lower = prompt.lower()
    site_map = {
        "trycap": "https://trycap.dev/",
        "youtube": "https://www.youtube.com/",
        "yt": "https://www.youtube.com/",
        "amazon": "https://www.amazon.in/",
        "flipkart": "https://www.flipkart.com/",
        "kauvery": "https://www.kauveryhospital.com/",
        "quotes": "https://quotes.toscrape.com/",
        "wikipedia": "https://www.wikipedia.org/",
        "google": "https://www.google.com/"
    }
    for k, u in site_map.items():
        if k in prompt_lower:
            return u

    clean_q = re.sub(r"\b(open|search|site|la|po|clear|check|in|to|for|the|run)\b", "", prompt, flags=re.IGNORECASE).strip()
    return f"https://www.google.com/search?q={urllib.parse.quote_plus(clean_q or prompt)}"


class Run:
    """Represents the active state of an automation workflow."""
    def __init__(self, run_id: str, prompt: str, url: str, creds: Dict[str, str], llm: LLM):
        self.id = run_id
        self.prompt = prompt
        self.url = url
        self.creds = creds
        self.status = "running"
        self.events: asyncio.Queue = asyncio.Queue()
        self.data_store: List[Dict[str, Any]] = []
        self.files: List[str] = []
        self.human_event: asyncio.Event = asyncio.Event()
        self.pause_event: asyncio.Event = asyncio.Event()
        self.pause_event.set()
        self.stop_flag: bool = False
        self.created_at: float = time.time()
        self.browser: Optional[BrowserSession] = None
        self.llm: LLM = llm
        self.task: Optional[asyncio.Task] = None

    async def emit(self, event_type: str, agent: str, message: str, data: Optional[Dict[str, Any]] = None):
        clean_msg = redact_creds(message, self.creds)
        clean_data = data or {}
        redacted_data = {}
        for k, v in clean_data.items():
            if isinstance(v, str):
                redacted_data[k] = redact_creds(v, self.creds)
            else:
                redacted_data[k] = v

        event = {
            "type": event_type,
            "agent": agent,
            "message": clean_msg,
            "data": redacted_data,
            "ts": int(time.time())
        }
        await self.events.put(event)


class RunManager:
    def __init__(self):
        self.runs: Dict[str, Run] = {}
        try:
            self.max_concurrent = int(os.getenv("MAX_CONCURRENT_RUNS", "2"))
        except Exception:
            self.max_concurrent = 2

    def clean_old_runs(self):
        now = time.time()
        expired = [rid for rid, r in self.runs.items() if now - r.created_at > 3600 and r.status in ("done", "error", "stopped")]
        for rid in expired:
            del self.runs[rid]

    def active_count(self) -> int:
        return sum(1 for r in self.runs.values() if r.status in ("running", "waiting_human", "paused"))

    def create_run(self, prompt: str, url: str, creds: Dict[str, str], llm: LLM) -> Run:
        self.clean_old_runs()
        if self.active_count() >= self.max_concurrent:
            raise HTTPException(status_code=429, detail=f"Maximum concurrent runs reached ({self.max_concurrent}). Please wait for an existing run to complete.")

        run_id = f"run_{uuid.uuid4().hex[:12]}"
        run = Run(run_id=run_id, prompt=prompt, url=url, creds=creds, llm=llm)
        self.runs[run_id] = run
        return run

    def get(self, run_id: str) -> Optional[Run]:
        return self.runs.get(run_id)


# Singletons
llm_client = LLM()
run_manager = RunManager()
db_manager = DatabaseManager()

# ----------------- FASTAPI LIFESPAN & APP -----------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await db_manager.init_db()
    except Exception as e:
        logger.warning(f"Database init note: {e}")
    yield

app = FastAPI(
    title="Kauvery Agent - Autonomous Multi-Agent API",
    description="Python backend powering the Kauvery Agent desktop AI overlay",
    version="2.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------- CORE MULTI-AGENT RUN ENDPOINTS -----------------

@app.get("/api/health")
async def health_check():
    return {
        "ok": True,
        "active_runs": run_manager.active_count(),
        "max_concurrent": run_manager.max_concurrent,
        "timestamp": int(time.time())
    }


@app.get("/api/browser/tools")
async def list_browser_tools():
    """Returns available autonomous browser tools and schemas."""
    return {"tools": BROWSER_TOOL_SCHEMAS, "total": len(BROWSER_TOOL_SCHEMAS)}


@app.post("/api/run")
async def start_run(req: RunRequest):
    creds = {}
    if req.username:
        creds["username"] = req.username
    if req.password:
        creds["password"] = req.password

    resolved_url = resolve_target_url(req.prompt, req.url)
    run = run_manager.create_run(
        prompt=req.prompt,
        url=resolved_url,
        creds=creds,
        llm=llm_client
    )

    async def task_wrapper():
        try:
            await asyncio.wait_for(
                main_agent(run, user_prompt=req.prompt, start_url=resolved_url),
                timeout=1200.0
            )
            await db_manager.log_task(run.id, run.prompt, run.url, run.status, len(run.data_store), run.files)
        except asyncio.TimeoutError:
            run.status = "error"
            await run.emit("error", "main", "Execution timed out (20-minute limit).", {})
            if run.browser:
                await run.browser.close()
        except Exception as e:
            logger.exception(f"Run exception: {e}")
            run.status = "error"
            await run.emit("error", "main", f"Fatal error: {str(e)}", {})
            if run.browser:
                await run.browser.close()

    run.task = asyncio.create_task(task_wrapper())
    logger.info(f"Created run {run.id} for prompt '{redact_creds(req.prompt, creds)}'")

    return {
        "ok": True,
        "run_id": run.id,
        "status": run.status
    }


@app.get("/api/run/{id}/events")
async def stream_events(id: str):
    run = run_manager.get(id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    async def event_generator():
        yield f": connected to {id}\n\n"
        while True:
            try:
                event = await asyncio.wait_for(run.events.get(), timeout=15.0)
                yield f"data: {json.dumps(event)}\n\n"
                if event.get("type") in ("final", "error"):
                    await asyncio.sleep(0.5)
                    break
            except asyncio.TimeoutError:
                yield ": heartbeat\n\n"
                if run.status in ("done", "error", "stopped") and run.events.empty():
                    break
            except Exception as e:
                logger.error(f"SSE stream error: {e}")
                break

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.post("/api/run/{id}/pause")
async def pause_run(id: str):
    run = run_manager.get(id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    run.status = "paused"
    run.pause_event.clear()
    await run.emit("status", "main", "Execution paused by user.", {})
    return {"ok": True, "status": "paused"}


@app.post("/api/run/{id}/resume")
async def resume_run(id: str):
    run = run_manager.get(id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    run.status = "running"
    run.pause_event.set()
    run.human_event.set()
    await run.emit("status", "main", "Execution resumed.", {})
    return {"ok": True, "status": "running"}


@app.post("/api/run/{id}/input")
async def post_human_input(id: str, input_data: HumanInputRequest):
    run = run_manager.get(id)
    if not run or not run.browser or not run.browser.page:
        raise HTTPException(status_code=400, detail="Browser page not available")

    page = run.browser.page
    try:
        if input_data.type == "click":
            await page.mouse.click(int(input_data.x or 0), int(input_data.y or 0))
        elif input_data.type == "type":
            await page.keyboard.type(input_data.text or "")
        elif input_data.type == "key":
            await page.keyboard.press(input_data.key or "Enter")

        await asyncio.sleep(0.5)
        b64_img, _ = await run.browser.screenshot(max_width=1024)
        if b64_img:
            await run.emit("screenshot", "challenge", "User interaction forwarded", {"image": b64_img})

        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/run/{id}/stop")
async def stop_run(id: str):
    run = run_manager.get(id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    run.stop_flag = True
    run.status = "stopped"
    run.human_event.set()
    run.pause_event.set()

    if run.task and not run.task.done():
        run.task.cancel()

    if run.browser:
        await run.browser.close()

    await run.emit("status", "main", "Run stopped by user.", {})
    return {"ok": True, "status": "stopped"}


@app.get("/api/run/{id}")
async def get_run_status(id: str):
    run = run_manager.get(id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    return {
        "id": run.id,
        "status": run.status,
        "rows_scraped": len(run.data_store),
        "files": run.files,
        "created_at": run.created_at,
        "prompt": redact_creds(run.prompt, run.creds),
        "url": run.url
    }


@app.get("/api/files/{name}")
async def download_file(name: str):
    safe_name = os.path.basename(name)
    file_path = os.path.abspath(os.path.join(OUTPUTS_DIR, safe_name))

    if not file_path.startswith(OUTPUTS_DIR) or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    media_type = "application/octet-stream"
    if file_path.endswith(".xlsx"):
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    elif file_path.endswith(".csv"):
        media_type = "text/csv"

    return FileResponse(path=file_path, media_type=media_type, filename=safe_name)


# ----------------- CAPTCHA INTELLIGENCE ENDPOINTS -----------------

class CaptchaDetectRequest(BaseModel):
    url: str
    run_id: Optional[str] = None

@app.post("/api/captcha/detect")
async def detect_captcha(req: CaptchaDetectRequest):
    run = run_manager.get(req.run_id) if req.run_id else None
    temp_browser = None
    try:
        if run and run.browser and run.browser.page:
            engine = CaptchaDetectionEngine()
            result = await engine.detect(run.browser.page)
        else:
            temp_browser = BrowserSession(run=None, headless=True)
            await temp_browser.start(req.url)
            engine = CaptchaDetectionEngine()
            result = await engine.detect(temp_browser.page)

        await db_manager.log_captcha_detection(
            captcha_type=result.captcha_type.value,
            provider=result.provider,
            confidence=result.confidence,
            is_test_env=result.is_test_env,
            page_url=result.page_url,
            dom_indicators=result.dom_indicators
        )

        return {
            "captcha_type": result.captcha_type.value,
            "provider": result.provider,
            "confidence": result.confidence,
            "is_test_env": result.is_test_env,
            "dom_indicators": result.dom_indicators,
            "page_url": result.page_url,
            "timestamp": result.timestamp
        }
    finally:
        if temp_browser:
            await temp_browser.close()


@app.get("/api/captcha/logs")
async def get_captcha_logs(limit: int = 50):
    logs = await db_manager.get_captcha_logs(limit)
    return {"logs": logs, "total": len(logs)}


@app.get("/api/captcha/providers")
async def get_captcha_providers():
    return {
        "providers": [
            {"type": "recaptcha_v2", "name": "Google reCAPTCHA v2", "adapter": "RecaptchaV2Adapter"},
            {"type": "recaptcha_v3", "name": "Google reCAPTCHA v3", "adapter": "RecaptchaV3Adapter"},
            {"type": "hcaptcha", "name": "hCaptcha", "adapter": "HcaptchaAdapter"},
            {"type": "cloudflare_turnstile", "name": "Cloudflare Turnstile", "adapter": "CloudflareTurnstileAdapter"},
            {"type": "text", "name": "Distorted Text CAPTCHA", "adapter": "TextCaptchaAdapter"},
            {"type": "image_grid", "name": "Image Selection Grid", "adapter": "ImageGridAdapter"},
            {"type": "slider_puzzle", "name": "Slider Puzzle", "adapter": "SliderPuzzleAdapter"}
        ]
    }


# ----------------- WEB SCRAPING ENDPOINTS -----------------

class ScrapeStartRequest(BaseModel):
    url: str
    selectors: Optional[Dict[str, str]] = None
    max_pages: int = 5
    pagination_selector: Optional[str] = None
    export_format: str = "json"
    table_selector: Optional[str] = None

_scrape_tasks: Dict[str, Dict[str, Any]] = {}

@app.post("/api/scrape/start")
async def start_scrape(req: ScrapeStartRequest):
    task_id = f"scrape_{uuid.uuid4().hex[:8]}"
    _scrape_tasks[task_id] = {
        "id": task_id,
        "status": "running",
        "url": req.url,
        "records_count": 0,
        "page_count": 0,
        "errors": []
    }

    async def scrape_worker():
        browser = BrowserSession(run=None, headless=True)
        try:
            await browser.start(req.url)
            engine = WebScrapingEngine(browser_session=browser, db_manager=db_manager)
            cfg = ScrapingConfig(
                url=req.url,
                selectors=req.selectors or {},
                pagination_selector=req.pagination_selector,
                max_pages=req.max_pages,
                export_format=req.export_format,
                table_selector=req.table_selector
            )
            res = await engine.scrape(cfg)
            _scrape_tasks[task_id]["status"] = "done"
            _scrape_tasks[task_id]["records_count"] = res.total_records
            _scrape_tasks[task_id]["page_count"] = res.page_count
            _scrape_tasks[task_id]["export_path"] = res.exported_to
            _scrape_tasks[task_id]["records"] = res.records[:100]
        except Exception as e:
            _scrape_tasks[task_id]["status"] = "error"
            _scrape_tasks[task_id]["errors"].append(str(e))
        finally:
            await browser.close()

    asyncio.create_task(scrape_worker())
    return {"task_id": task_id, "status": "running"}


@app.get("/api/scrape/status/{task_id}")
async def get_scrape_status(task_id: str):
    t = _scrape_tasks.get(task_id)
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    return {
        "id": t["id"],
        "status": t["status"],
        "records_count": t["records_count"],
        "page_count": t["page_count"],
        "errors": t.get("errors", [])
    }


@app.get("/api/scrape/results/{task_id}")
async def get_scrape_results(task_id: str):
    t = _scrape_tasks.get(task_id)
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"task_id": task_id, "records": t.get("records", [])}


# ----------------- STATIC FRONTEND SERVING -----------------
dist_dir = os.path.join(BASE_DIR, "dist")
if os.path.exists(dist_dir):
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="static_frontend")


def _free_port_if_occupied(port: int = 8000) -> None:
    """Terminates any stale/orphaned processes listening on target port to prevent WinError 10048."""
    import subprocess
    try:
        res = subprocess.run(["netstat", "-ano"], capture_output=True, text=True)
        my_pid = str(os.getpid())
        for line in res.stdout.splitlines():
            if f":{port}" in line and "LISTENING" in line:
                parts = line.strip().split()
                if len(parts) >= 5:
                    pid = parts[-1]
                    if pid != my_pid and pid != "0":
                        subprocess.run(["taskkill", "/F", "/PID", pid], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass


if __name__ == "__main__":
    _free_port_if_occupied(8000)
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
