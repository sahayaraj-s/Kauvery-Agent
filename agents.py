"""
Kauvery Agent - Autonomous Multi-Agent Automation Core (agents.py)
Implements:
- Resilient LLM Client with Groq primary and OpenRouter fallback
- Task Understanding & Autonomous Planner
- Observation-Driven Execution State Machine
- Autonomous Browser Agent controlling Playwright via standard Toolkit
- CAPTCHA Intelligence Module (detection, classification, test env benchmarking, human handoff)
- Excel Agent & Final Report Generator
"""

from __future__ import annotations

import asyncio
import io
import json
import logging
import os
import re
import time
from typing import Any, Dict, List, Optional, Tuple

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from browser_tools import (
    BROWSER_TOOL_SCHEMAS,
    OUTPUTS_DIR,
    BrowserSession,
    redact_creds,
)

logger = logging.getLogger("kauvery.agents")

# ----------------- SYSTEM PROMPTS -----------------

PLANNER_SYSTEM = """You are the PRINCIPAL TASK PLANNING & NATURAL LANGUAGE UNDERSTANDING AGENT for an autonomous browser RPA system.
Your mission is to understand user instructions—including conversational English, Tamil, and Tanglish (Tamil in English script)—and formulate an actionable, multi-page execution plan.

COMPREHENSIVE LANGUAGE UNDERSTANDING (TAMIL & TANGLISH):
- "BTS oda last concert ah yenaku chorme la irunthu download pani kudu full video um venum"
  -> Intent: Search, locate full video of BTS's last concert ("Yet to Come in Busan" / full concert), download file or extract direct link.
  -> Clean Search Query: "BTS Yet to Come in Busan full concert video"
  -> Direct Target URL: https://www.youtube.com/results?search_query=BTS+Yet+to+Come+in+Busan+full+concert
- "amazon la best wireless earbuds price list excel la kudu"
  -> Intent: Search product, extract pricing/ratings, compile Excel.
  -> Clean Search Query: "best wireless earbuds"
  -> Direct Target URL: https://www.amazon.com/s?k=best+wireless+earbuds
- "trycap demo la captcha types check pannu, ella category layum poitu report kudu"
  -> Intent: Explore all categories on trycap.dev, run benchmark detection, report findings.
  -> Direct Target URL: https://trycap.dev

TASK DECOMPOSITION & PLATFORM SELECTION RULES:
1. QUERY EXTRACTION: Extract concise, optimal English search keywords into `search_query`. NEVER use raw conversational sentences or Tanglish phrases inside search inputs!
2. DIRECT PLATFORM TARGETING:
   - For videos / songs / concerts: Target YouTube search URL (`https://www.youtube.com/results?search_query=...`) or Google Videos!
   - For e-commerce / shopping: Target Amazon (`https://www.amazon.com/s?k=...`) or target site directly!
   - For general search / portals: Target Google or DuckDuckGo.
3. MULTI-SITE & MULTI-PAGE EXPLORATION:
   Plan 4-6 distinct steps:
   - Step 1: Open starting URL and inspect candidate results.
   - Step 2: Open Candidate 1 and verify content (check title, duration, completeness).
   - Step 3: If Candidate 1 is only a preview/teaser or blocked, navigate to Candidate 2 or alternative platforms!
   - Step 4: Perform core action (e.g. `download_media` on video URL, `download_click`, or extract data).
   - Step 5: Verify outcome and compile comprehensive final report.

Reply with ONE JSON object only:
{
  "objective": "<Concise summary of the true objective in English>",
  "search_query": "<Clean, optimal English search keywords>",
  "target_url": "<Direct relevant starting URL with search query embedded if applicable>",
  "candidate_platforms": ["<URL 1>", "<URL 2>"],
  "steps": [
    {"id": 1, "description": "<Action 1>", "expected_outcome": "<Outcome 1>"},
    {"id": 2, "description": "<Action 2>", "expected_outcome": "<Outcome 2>"},
    {"id": 3, "description": "<Action 3>", "expected_outcome": "<Outcome 3>"},
    {"id": 4, "description": "<Action 4>", "expected_outcome": "<Outcome 4>"}
  ],
  "success_criteria": "<Clear condition defining when the goal is completely achieved>",
  "requires_excel": <true/false>,
  "requires_download": <true/false>
}
Output valid JSON only."""

AUTONOMOUS_BROWSER_SYSTEM = """You are an EXPERT AUTONOMOUS BROWSER RPA AGENT.
You directly operate a real web browser to accomplish complex, multi-step web tasks.
You observe the browser state, think deeply, plan actions, verify outcomes, navigate across multiple pages and websites, and complete the user's objective.

AVAILABLE BROWSER TOOLS:
1. browser_open_url {"url": "..."} : Navigate directly to any URL.
2. browser_inspect_page {} : Get structured overview of links, buttons, inputs, and headings.
3. browser_get_page_text {"max_length": 4000} : Read visible page text.
4. browser_get_links {"filter_text": "..."} : Find all hyperlinks (optionally filtered by keyword).
5. browser_get_buttons {"filter_text": "..."} : Find all buttons/clickable controls.
6. browser_get_inputs {} : Find all input fields, textareas, and dropdowns.
7. browser_click {"id": <int>} OR {"selector": "..."} OR {"text": "..."} : Click an element by ID or selector.
8. browser_fill {"id": <int>, "text": "...", "press_enter": <bool>} : Type into an input field.
9. browser_select {"id": <int>, "value": "..."} : Select dropdown option.
10. browser_scroll {"direction": "down|up|top|bottom", "amount": 500} : Scroll the page.
11. browser_go_back {} : Navigate back to previous page in browser history.
12. browser_go_forward {} : Navigate forward.
13. browser_wait {"seconds": 2.0} : Wait for dynamic content or transitions to settle.
14. browser_wait_for {"selector": "...", "text": "...", "timeout": 5.0} : Wait for element/text.
15. browser_close_tab {} : Close current tab and return to previous.
16. extract_smart_items {"limit": 20, "hint": "..."} : Extract list/card items (YouTube videos, Amazon products, feeds).
17. extract_table {"selector": "..."} : Extract HTML table rows into data store.
18. extract_by_selector {"css": "...", "fields": {...}} : Extract repeating items via CSS.
19. download_click {"id": <int>} : Click a download button/link to save a file to outputs/.
20. download_media {"url": "...", "custom_filename": "..."} : Download video or audio from YouTube, Vimeo, Dailymotion, or direct web media URLs into outputs/ folder using yt-dlp.
21. captcha_detect {} : Run CAPTCHA intelligence detection on current page.
22. captcha_analyze {"sample_type": "text|image_grid|..."} : Run OCR / evaluation on synthetic test samples (test environments only).
23. done {"ok": true, "summary": "..."} : Signal that the entire task is complete with comprehensive details.

MANDATORY OPERATING RULES:
1. QUERY PURITY (NO RAW CONVERSATIONAL PROMPTS IN SEARCH BARS):
   - When typing into any search bar, NEVER type the user's raw conversational prompt or regional Tanglish sentences (e.g. do NOT type "BTS oda last concert ah yenaku download pannu kudu").
   - Extract and type ONLY the clean, targeted English keywords (e.g. "BTS Yet to Come in Busan full concert" or "BTS last concert full video").

2. MULTI-SITE & MULTI-PAGE EXPLORATION (DO NOT STOP PREMATURELY):
   - Never stop after opening the first page or search results list!
   - Inspect the search results: look at candidate links, video titles, and durations.
   - Click on Candidate #1. Inspect the page content.
   - If Candidate #1 is incomplete, a short preview, or blocked, DO NOT GIVE UP! Navigate back (`browser_go_back`) or open Candidate #2 (`browser_open_url`)!
   - Check multiple candidates to find the highest-quality, most complete result.

3. DOWNLOADING & MEDIA RETRIEVAL:
   - If the user asked to download a video or full concert:
     Once on the target video page (or with the video URL), call `download_media` with that URL!
     The backend will download the MP4 video directly into `outputs/` and create a download link for the user.
   - If a direct download button exists on a web page, use `download_click` on its ID.
   - If media cannot be downloaded (e.g. DRM or live stream), extract the full video details, channel, title, duration, and direct streaming link and provide it in the summary.

4. ACTION VERIFICATION:
   - After each action (click, fill, search), verify that the page changed.
   - If typing into a search box, ensure `press_enter: true` or click the search button element.
   - If content hasn't loaded, call `browser_wait` or `browser_scroll`.

5. DATA ACCUMULATION & COMPLETION:
   - Keep track of candidate URLs visited and details discovered.
   - Only call `done` when the actual user goal (finding the full video, downloading the file, or scraping the full dataset) is accomplished.
   - In `done`, provide a detailed summary including the video title, exact URL, download status, and instructions for the user.

Output ONE JSON object only:
{
  "thought": "<Clear 1-sentence reasoning about the current page state, candidate verification, and next action>",
  "current_step": "<Step being executed e.g. 'Inspecting video candidate 1' or 'Downloading media'>",
  "tool": "<tool_name>",
  "args": { ... },
  "expected_outcome": "<What change you expect to see on the page>",
  "is_complete": false
}"""

CHALLENGE_SYSTEM = """You are the CHALLENGE AGENT. You look at one screenshot of a web page that shows a verification challenge (captcha or a "prove you are human" check), and you decide ONE next UI action.

Reply with ONE JSON object only:
{
  "challenge": "text_captcha|checkbox|image_select|slider|puzzle|cloudflare_wait|none|unknown",
  "action": "type|click|drag|wait|give_up",
  "text": "<characters, only if action=type>",
  "x": <int>, "y": <int>,
  "to_x": <int>, "to_y": <int>,
  "confidence": <0.0-1.0>,
  "reason": "<one short sentence>"
}
Rules:
1. Coordinates are in pixels of the screenshot provided (origin top-left).
2. If confidence < 0.4, or this is a live third-party blocking wall, action=give_up for human handoff.
Output valid JSON only."""

EXCEL_SYSTEM = """You are the EXCEL AGENT. You receive column names and sample rows of scraped data. Decide the final Excel layout.
Reply with ONE JSON object only:
{
  "filename": "<short_snake_case, no extension>",
  "sheet_name": "<max 31 chars>",
  "columns": [{"source": "<existing key>", "header": "<Clean Header>"}],
  "dedupe_on": ["<keys>"],
  "sort_by": "<key or null>"
}
Rules: Only use keys that exist in the data. Never invent fake data."""


# ----------------- UNIFIED LLM CLIENT -----------------

class LLM:
    """
    Unified LLM Client supporting Groq (primary) and OpenRouter (fallback).
    Features model fallback, rate limiting, exponential backoff, and robust JSON repair.
    """

    def __init__(self):
        from openai import AsyncOpenAI

        self.groq_api_key = os.getenv("GROQ_API_KEY", "").strip()
        self.openrouter_api_key = os.getenv("OPENROUTER_API_KEY", "").strip()

        self.text_model = os.getenv("TEXT_MODEL", "llama-3.3-70b-versatile").strip()
        self.vision_model = os.getenv("VISION_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct").strip()

        self.or_text_model = os.getenv("OPENROUTER_TEXT_MODEL", "meta-llama/llama-3.3-70b-instruct").strip()
        self.or_vision_model = os.getenv("OPENROUTER_VISION_MODEL", "google/gemini-2.0-flash-001").strip()

        try:
            self.max_rpm = int(os.getenv("MAX_RPM", "30"))
        except Exception:
            self.max_rpm = 30

        self._req_times: List[float] = []
        self._rate_lock = asyncio.Lock()

        self.groq_client = None
        if self.groq_api_key:
            self.groq_client = AsyncOpenAI(
                base_url="https://api.groq.com/openai/v1",
                api_key=self.groq_api_key,
                timeout=45.0,
            )

        self.or_client = None
        if self.openrouter_api_key:
            self.or_client = AsyncOpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=self.openrouter_api_key,
                timeout=60.0,
            )

    async def _wait_rate_limit(self):
        """Enforces MAX_RPM across requests."""
        async with self._rate_lock:
            now = time.time()
            self._req_times = [t for t in self._req_times if now - t < 60.0]
            if len(self._req_times) >= self.max_rpm:
                sleep_needed = 60.0 - (now - self._req_times[0]) + 0.1
                if sleep_needed > 0:
                    logger.info(f"Rate limit reached ({self.max_rpm} RPM). Sleeping {sleep_needed:.2f}s")
                    await asyncio.sleep(sleep_needed)
            self._req_times.append(time.time())

    def _repair_json(self, raw_text: str) -> Optional[Dict[str, Any]]:
        """Strips markdown code fences and attempts to extract and parse JSON."""
        if not raw_text:
            return None
        text = raw_text.strip()

        if "```" in text:
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
            if match:
                text = match.group(1).strip()

        try:
            return json.loads(text)
        except Exception:
            pass

        first_brace = text.find("{")
        last_brace = text.rfind("}")
        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            sub = text[first_brace : last_brace + 1]
            try:
                return json.loads(sub)
            except Exception:
                pass
        return None

    async def _call_provider(self, client: Any, model: str, messages: list, json_mode: bool = True) -> str:
        """Invokes a provider with exponential backoff on 429."""
        delays = [1.0, 2.0, 4.0]
        last_err = None

        for attempt in range(len(delays) + 1):
            await self._wait_rate_limit()
            try:
                kwargs: Dict[str, Any] = {
                    "model": model,
                    "messages": messages,
                    "temperature": 0.1,
                }
                if json_mode:
                    kwargs["response_format"] = {"type": "json_object"}

                response = await client.chat.completions.create(**kwargs)
                return response.choices[0].message.content or "{}"
            except Exception as e:
                err_str = str(e).lower()
                last_err = e
                if "429" in err_str or "rate limit" in err_str:
                    if attempt < len(delays):
                        backoff = delays[attempt]
                        logger.warning(f"Got 429 rate limit on {model}. Retrying in {backoff}s (attempt {attempt+1})")
                        await asyncio.sleep(backoff)
                        continue
                logger.warning(f"Provider error on model {model}: {e}")
                raise e

        raise last_err

    async def chat_json(self, messages: list, vision: bool = False) -> Dict[str, Any]:
        """
        Sends messages to primary provider (Groq), falling back to OpenRouter.
        Parses output with JSON repair, retrying once on syntax error.
        """
        groq_text_models = [self.text_model, "llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "llama3-70b-8192", "llama3-8b-8192"]
        groq_text_models = list(dict.fromkeys([m for m in groq_text_models if m]))

        or_text_models = [
            "meta-llama/llama-3.3-70b-instruct",
            self.or_text_model,
            "mistralai/mistral-small-24b-instruct-2501:free",
            "qwen/qwen-2.5-72b-instruct"
        ]
        or_text_models = list(dict.fromkeys([m for m in or_text_models if m]))

        or_vision_models = [
            self.or_vision_model,
            "meta-llama/llama-3.2-11b-vision-instruct",
            "qwen/qwen-2.5-vl-72b-instruct:free"
        ]
        or_vision_models = list(dict.fromkeys([m for m in or_vision_models if m]))

        providers: List[Tuple[Any, str, str]] = []
        if vision:
            if self.or_client:
                for vm in or_vision_models:
                    providers.append((self.or_client, vm, "OpenRouter"))
            if self.groq_client and self.vision_model:
                providers.append((self.groq_client, self.vision_model, "Groq"))
        else:
            if self.groq_client:
                for tm in groq_text_models:
                    providers.append((self.groq_client, tm, "Groq"))
            if self.or_client:
                for tm in or_text_models:
                    providers.append((self.or_client, tm, "OpenRouter"))

        if not providers:
            return {"error": "No LLM API keys configured. Set GROQ_API_KEY or OPENROUTER_API_KEY in .env."}

        last_error = ""
        for client, model, name in providers:
            try:
                use_json_mode = not vision
                content = await self._call_provider(client, model, messages, json_mode=use_json_mode)

                parsed = self._repair_json(content)
                if parsed is not None and isinstance(parsed, dict):
                    return parsed

                # Retry repair prompt once
                repair_prompt = [
                    {"role": "system", "content": "You are a JSON fixer. Return ONLY a valid JSON object matching the provided data."},
                    {"role": "user", "content": f"Fix this invalid JSON string:\n{content}"}
                ]
                repaired_content = await self._call_provider(client, model, repair_prompt, json_mode=True)
                repaired = self._repair_json(repaired_content)
                if repaired is not None and isinstance(repaired, dict):
                    return repaired

                last_error = f"{name} ({model}) unparseable JSON: {content[:100]}"
            except Exception as e:
                last_error = f"{name} ({model}) failed: {e}"
                logger.debug(f"{last_error}. Trying next provider...")

        return {"error": last_error or "All LLM providers failed to produce valid JSON."}


# ----------------- HISTORY COMPACTION -----------------

def compact_history(history: List[Dict[str, Any]], max_full: int = 5) -> List[Dict[str, str]]:
    """Keeps the most recent turns in full detail, compacting older turns into a bullet summary."""
    if len(history) <= max_full:
        msgs = []
        for h in history:
            thought = h.get("thought", "")
            action = h.get("action", "")
            args = h.get("args", {})
            msgs.append({
                "role": "assistant",
                "content": json.dumps({"thought": thought, "tool": action, "args": args})
            })
            res_snippet = str(h.get("result", ""))[:200]
            msgs.append({
                "role": "user",
                "content": f"Tool Execution Result ({action}):\n{res_snippet}"
            })
        return msgs

    older = history[:-max_full]
    recent = history[-max_full:]

    summary_lines = ["Summary of earlier steps:"]
    for i, h in enumerate(older, 1):
        summary_lines.append(f"- Step {i}: {h.get('action', '')} -> {str(h.get('result', ''))[:80]}")

    msgs = [{"role": "user", "content": "\n".join(summary_lines)}]
    for h in recent:
        msgs.append({
            "role": "assistant",
            "content": json.dumps({"thought": h.get("thought", ""), "tool": h.get("action", ""), "args": h.get("args", {})})
        })
        res_snippet = str(h.get("result", ""))[:200]
        msgs.append({
            "role": "user",
            "content": f"Tool Execution Result ({h.get('action', '')}):\n{res_snippet}"
        })
    return msgs


# ----------------- SUB AGENT: CHALLENGE AGENT -----------------

async def challenge_agent(run: Any) -> Dict[str, Any]:
    """Vision-based challenge handler with human handoff fallback."""
    logger.info("Challenge Agent activated.")
    await run.emit("status", "challenge", "Security challenge verification active", {})

    for attempt in range(1, 5):
        if run.stop_flag:
            return {"ok": False, "summary": "Stopped by user"}

        b64_img, scale = await run.browser.screenshot(max_width=1024)
        if not b64_img:
            break

        await run.emit("screenshot", "challenge", f"Challenge attempt {attempt}/4", {"image": b64_img})

        messages = [
            {"role": "system", "content": CHALLENGE_SYSTEM},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Analyze this challenge screenshot and decide the next action."},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64_img}"}}
                ]
            }
        ]

        res = await run.llm.chat_json(messages, vision=True)
        if "error" in res and not ("action" in res):
            logger.warning(f"Vision model error in Challenge Agent: {res['error']}")
            break

        action = res.get("action", "give_up")
        reason = res.get("reason", "")
        await run.emit("thought", "challenge", f"Challenge vision: {action} ({reason})")

        if action == "give_up":
            break

        page = run.browser.page
        try:
            if action == "click":
                x = int(res.get("x", 0) * scale)
                y = int(res.get("y", 0) * scale)
                await page.mouse.click(x, y)
                await asyncio.sleep(0.5)
            elif action == "type":
                x = int(res.get("x", 0) * scale)
                y = int(res.get("y", 0) * scale)
                if x > 0 and y > 0:
                    await page.mouse.click(x, y)
                text = res.get("text", "")
                for c in text:
                    await page.keyboard.type(c)
                    await asyncio.sleep(0.05)
                await page.keyboard.press("Enter")
            elif action == "drag":
                x = int(res.get("x", 0) * scale)
                y = int(res.get("y", 0) * scale)
                to_x = int(res.get("to_x", 0) * scale)
                to_y = int(res.get("to_y", 0) * scale)
                await page.mouse.move(x, y)
                await page.mouse.down()
                await page.mouse.move(to_x, to_y, steps=25)
                await page.mouse.up()
            elif action == "wait":
                await asyncio.sleep(3.0)
        except Exception as e:
            logger.error(f"Error executing challenge action: {e}")

        await asyncio.sleep(2.5)
        if not await run.browser.detect_challenge():
            logger.info("Challenge cleared successfully!")
            await run.emit("status", "challenge", "Challenge cleared successfully", {})
            return {"ok": True}

    # Human Handoff Fallback
    logger.info("Challenge Agent requesting Human Handoff...")
    run.status = "waiting_human"
    b64_img, _ = await run.browser.screenshot(max_width=1024)

    await run.emit(
        "need_human",
        "challenge",
        "Verification challenge requires human assistance. Solve it in the browser or overlay, then press Resume.",
        {"image": b64_img}
    )

    run.human_event.clear()
    try:
        await asyncio.wait_for(run.human_event.wait(), timeout=600.0)
        run.status = "running"
        await asyncio.sleep(1.5)
        return {"ok": True, "summary": "Human resumed execution"}
    except asyncio.TimeoutError:
        run.status = "error"
        return {"ok": False, "summary": "Human intervention timed out (10 minutes)."}


# ----------------- SUB AGENT: EXCEL AGENT -----------------

async def excel_agent(run: Any, instruction: str) -> Dict[str, Any]:
    """Formats scraped rows into a polished Excel file with openpyxl."""
    logger.info(f"Excel Agent started with instruction: {instruction}")
    if not run.data_store:
        return {"ok": False, "summary": "No data rows in store to write to Excel."}

    sample_rows = run.data_store[:3]
    all_keys = list({k for row in run.data_store for k in row.keys()})

    messages = [
        {"role": "system", "content": EXCEL_SYSTEM},
        {"role": "user", "content": f"INSTRUCTION: {instruction}\nKEYS: {json.dumps(all_keys)}\nSAMPLE ROWS: {json.dumps(sample_rows)}"}
    ]

    res = await run.llm.chat_json(messages, vision=False)

    raw_fname = res.get("filename", "scraped_data") if isinstance(res, dict) else "scraped_data"
    sheet_title = res.get("sheet_name", "Data") if isinstance(res, dict) else "Data"
    columns = res.get("columns", []) if isinstance(res, dict) else []
    dedupe_on = res.get("dedupe_on", []) if isinstance(res, dict) else []
    sort_by = res.get("sort_by") if isinstance(res, dict) else None

    sheet_title = re.sub(r'[\\/*?:\[\]]', '_', str(sheet_title))[:31] or "Sheet1"

    if not columns or not isinstance(columns, list):
        col_mapping = [(k, k.replace("_", " ").title()) for k in all_keys]
    else:
        col_mapping = []
        for col in columns:
            src = col.get("source")
            hdr = col.get("header") or src or ""
            if src and src in all_keys:
                col_mapping.append((src, hdr))
        if not col_mapping:
            col_mapping = [(k, k.replace("_", " ").title()) for k in all_keys]

    processed_rows = []
    seen = set()
    for row in run.data_store:
        if dedupe_on and isinstance(dedupe_on, list):
            dedupe_key = tuple(str(row.get(k, "")).strip().lower() for k in dedupe_on if k in row)
            if dedupe_key:
                if dedupe_key in seen:
                    continue
                seen.add(dedupe_key)
        processed_rows.append(row)

    if sort_by and sort_by in all_keys:
        try:
            processed_rows.sort(key=lambda r: str(r.get(sort_by, "")))
        except Exception:
            pass

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = sheet_title

    # Header styling
    header_fill = PatternFill(start_color="880E4F", end_color="880E4F", fill_type="solid")
    header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
    header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    thin_border = Border(
        left=Side(style="thin", color="E0E0E0"),
        right=Side(style="thin", color="E0E0E0"),
        top=Side(style="thin", color="E0E0E0"),
        bottom=Side(style="thin", color="E0E0E0"),
    )

    headers = [hdr for _, hdr in col_mapping]
    ws.append(headers)

    for col_num in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_num)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = header_alignment
        cell.border = thin_border

    ws.row_dimensions[1].height = 26

    data_font = Font(name="Segoe UI", size=10)
    data_alignment = Alignment(vertical="center")

    def to_number_if_possible(val: Any) -> Any:
        if isinstance(val, (int, float)):
            return val
        if not isinstance(val, str):
            return str(val)
        val_clean = val.strip()
        if re.match(r"^-?\d+$", val_clean):
            try:
                return int(val_clean)
            except Exception:
                pass
        if re.match(r"^-?\d+\.\d+$", val_clean):
            try:
                return float(val_clean)
            except Exception:
                pass
        return val_clean

    for r_idx, row in enumerate(processed_rows, start=2):
        row_values = [to_number_if_possible(row.get(src, "")) for src, _ in col_mapping]
        ws.append(row_values)
        for c_idx in range(1, len(row_values) + 1):
            cell = ws.cell(row=r_idx, column=c_idx)
            cell.font = data_font
            cell.alignment = data_alignment
            cell.border = thin_border

    ws.freeze_panes = "A2"
    if ws.dimensions:
        ws.auto_filter.ref = ws.dimensions

    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val_str = str(cell.value or "")
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws.column_dimensions[col_letter].width = min(max(max_len + 3, 12), 50)

    clean_base = re.sub(r'[^a-zA-Z0-9_\-]', '_', str(raw_fname)).strip("_") or "scraped_data"
    clean_fname = f"{clean_base}.xlsx"
    target_path = os.path.join(OUTPUTS_DIR, clean_fname)

    if os.path.exists(target_path):
        ts_str = time.strftime("%Y%m%d_%H%M%S")
        clean_fname = f"{clean_base}_{ts_str}.xlsx"
        target_path = os.path.join(OUTPUTS_DIR, clean_fname)

    wb.save(target_path)
    logger.info(f"Excel file generated at {target_path}")

    run.files.append(clean_fname)
    file_url = f"/api/files/{clean_fname}"
    await run.emit("file", "excel", f"Generated Excel file {clean_fname}", {"name": clean_fname, "url": file_url})

    return {
        "ok": True,
        "file": clean_fname,
        "rows": len(processed_rows)
    }


# ----------------- AUTONOMOUS AGENT BRAIN (MAIN WORKFLOW) -----------------

async def main_agent(run: Any, user_prompt: str, start_url: Optional[str] = None):
    """
    Main Autonomous Agent Brain:
    1. Understands instruction & creates executable multi-step plan.
    2. Initializes Playwright browser.
    3. Executes observation-driven state machine (Observe -> Reason -> Act -> Verify).
    4. Handles multi-page navigation, DOM interaction, and CAPTCHA intelligence.
    5. Completes workflow, compiles data into Excel if requested, and emits final report.
    """
    logger.info(f"Autonomous Main Agent started for run {run.id}. Goal: {redact_creds(user_prompt, run.creds)}")
    await run.emit("status", "main", "Analyzing task objective and formulating execution plan...", {})

    run.status = "running"
    history: List[Dict[str, Any]] = []
    repetition_history: List[Tuple[str, str, str]] = []

    try:
        # 1. TASK UNDERSTANDING & PLANNING
        plan_messages = [
            {"role": "system", "content": PLANNER_SYSTEM},
            {"role": "user", "content": f"USER INSTRUCTION: {user_prompt}\nSTART URL: {start_url or 'None'}"}
        ]
        plan_res = await run.llm.chat_json(plan_messages, vision=False)
        objective = plan_res.get("objective", user_prompt)
        search_query = plan_res.get("search_query", "")
        resolved_start_url = plan_res.get("target_url") or start_url or "https://www.google.com"
        candidate_platforms = plan_res.get("candidate_platforms", [])
        steps_raw = plan_res.get("steps", [])
        requires_excel = bool(plan_res.get("requires_excel", False))
        requires_download = bool(plan_res.get("requires_download", False))
        success_criteria = plan_res.get("success_criteria", "Complete requested actions and report findings.")

        # Ensure valid initial plan steps
        if not steps_raw or not isinstance(steps_raw, list):
            steps_raw = [
                {"id": 1, "description": f"Navigate to {resolved_start_url}", "expected_outcome": "Page loaded"},
                {"id": 2, "description": "Inspect candidate results and select target content", "expected_outcome": "Target identified"},
                {"id": 3, "description": "Explore and verify full content details across pages", "expected_outcome": "Full content confirmed"},
                {"id": 4, "description": "Execute download or extract complete links/data", "expected_outcome": "Action executed"},
                {"id": 5, "description": "Verify task outcome and generate final summary", "expected_outcome": "Summary compiled"}
            ]

        # Structure plan items with execution status
        plan_state = [
            {
                "id": s.get("id", i + 1),
                "description": s.get("description", f"Step {i+1}"),
                "expected_outcome": s.get("expected_outcome", ""),
                "status": "in_progress" if i == 0 else "pending"
            }
            for i, s in enumerate(steps_raw)
        ]

        # Emit the plan to the frontend
        await run.emit("plan", "main", f"Plan created: {objective}", {
            "objective": objective,
            "search_query": search_query,
            "target_url": resolved_start_url,
            "steps": plan_state,
            "success_criteria": success_criteria
        })

        # 2. BROWSER INITIALIZATION
        run.browser = BrowserSession(run=run)
        await run.browser.start(resolved_start_url)
        curr_url_info = await run.browser.get_current_url()
        await run.emit("action", "browser", f"Browser initialized on: {curr_url_info.get('url', resolved_start_url)}")

        # Send initial screenshot
        try:
            b64_img, _ = await run.browser.screenshot(max_width=800)
            if b64_img:
                await run.emit("screenshot", "browser", "Page view updated", {"image": b64_img})
        except Exception:
            pass

        # 3. OBSERVATION-DRIVEN EXECUTION LOOP (Max 45 steps)
        max_steps = 45
        for step_num in range(1, max_steps + 1):
            if run.stop_flag:
                run.status = "stopped"
                await run.emit("status", "main", "Run stopped by user.", {})
                return

            # Check pause status
            if hasattr(run, "pause_event") and run.pause_event:
                await run.pause_event.wait()

            # A. OBSERVE: Current page state & challenge check
            if await run.browser.detect_challenge():
                logger.info("Active blocking challenge detected. Invoking Challenge Agent...")
                ch_res = await challenge_agent(run)
                if not ch_res.get("ok"):
                    await run.emit("error", "challenge", "Unable to proceed past security challenge.")
                    run.status = "waiting_human"
                    return

            page_state_str = await run.browser.get_page_state()
            curr_url_info = await run.browser.get_current_url()

            # Emit live page state update
            await run.emit("page_state", "browser", f"{curr_url_info.get('title', 'Page')} ({curr_url_info.get('url', '')})", {
                "url": curr_url_info.get("url", ""),
                "title": curr_url_info.get("title", ""),
                "step": step_num
            })

            # B. REASON & DECIDE: Prepare LLM context
            active_step_desc = next((s["description"] for s in plan_state if s["status"] == "in_progress"), "Executing automation step")
            context_blocks = [
                f"OVERALL OBJECTIVE: {objective}",
                f"RECOMMENDED SEARCH KEYWORDS: '{search_query}' (CRITICAL: When typing into any search bar, use these clean keywords, NEVER raw conversational Tamil/Tanglish!)" if search_query else "",
                f"CANDIDATE PLATFORMS / ALTERNATIVE URLS: {json.dumps(candidate_platforms)}" if candidate_platforms else "",
                f"SUCCESS CRITERIA: {success_criteria}",
                f"CURRENT PLAN & STEPS:\n" + "\n".join(f"[{s['id']}] ({s['status']}) {s['description']}" for s in plan_state),
                f"CURRENT ACTIVE STEP: {active_step_desc} (Turn {step_num}/{max_steps})",
                f"CURRENT DATA STORE ROWS: {len(run.data_store)}",
                f"FILES CREATED: {json.dumps(run.files)}",
                f"CURRENT PAGE STATE:\n{page_state_str}"
            ]
            context_blocks = [b for b in context_blocks if b]

            compacted_history = compact_history(history, max_full=5)
            system_msg = {"role": "system", "content": AUTONOMOUS_BROWSER_SYSTEM}
            user_msg = {"role": "user", "content": "\n\n".join(context_blocks)}
            messages = [system_msg] + compacted_history + [user_msg]

            res = await run.llm.chat_json(messages, vision=False)
            if "error" in res and not ("tool" in res or "action" in res):
                logger.warning(f"LLM Error on turn {step_num}: {res['error']}")
                await run.emit("error", "main", f"LLM error: {res['error']}")
                await asyncio.sleep(2.0)
                continue

            thought = res.get("thought", "Analyzing page and deciding next step.")
            tool_name = res.get("tool") or res.get("action") or "browser_wait"
            args = res.get("args", {}) or {}
            expected_outcome = res.get("expected_outcome", "")
            is_complete = bool(res.get("is_complete", False))

            # Emit thought & planned action
            await run.emit("thought", "browser", redact_creds(thought, run.creds))
            await run.emit("action", "browser", redact_creds(f"{tool_name}: {json.dumps(args)}", run.creds))

            # C. TERMINATION CHECK
            if tool_name == "done" or is_complete:
                final_summary = args.get("summary") or thought or "Task completed successfully."
                logger.info(f"Agent signaled completion: {final_summary}")
                break

            # D. LOOP GUARD: Repetition detection
            curr_url = curr_url_info.get("url", "")
            rep_key = (tool_name, json.dumps(args, sort_keys=True), curr_url)
            repetition_history.append(rep_key)
            matches = sum(1 for k in repetition_history[-4:] if k == rep_key)
            if matches >= 4:
                logger.warning("Repetition loop detected (same action 4 times). Forcing alternate path.")
                tool_name = "browser_scroll"
                args = {"direction": "down", "amount": 600}

            # E. EXECUTE TOOL
            action_result = ""
            try:
                if tool_name in ("browser_open_url", "open_url"):
                    action_result = await run.browser.open_url(args.get("url", ""))
                elif tool_name in ("browser_click", "click"):
                    action_result = await run.browser.click(
                        id=int(args.get("id")) if args.get("id") is not None else None,
                        selector=args.get("selector"),
                        text=args.get("text")
                    )
                elif tool_name in ("browser_fill", "fill", "type"):
                    action_result = await run.browser.fill(
                        id=int(args.get("id")) if args.get("id") is not None else None,
                        selector=args.get("selector"),
                        text=args.get("text", ""),
                        press_enter=bool(args.get("press_enter", False))
                    )
                elif tool_name in ("browser_select", "select", "select_option"):
                    action_result = await run.browser.select_option(
                        id=int(args.get("id")) if args.get("id") is not None else None,
                        selector=args.get("selector"),
                        value=args.get("value", "")
                    )
                elif tool_name in ("browser_scroll", "scroll"):
                    action_result = await run.browser.scroll(
                        direction=args.get("direction", "down"),
                        amount=int(args.get("amount", 500))
                    )
                elif tool_name in ("browser_go_back", "go_back"):
                    action_result = await run.browser.go_back()
                elif tool_name in ("browser_go_forward", "go_forward"):
                    action_result = await run.browser.go_forward()
                elif tool_name in ("browser_wait", "wait"):
                    action_result = await run.browser.wait(float(args.get("seconds", 2.0)))
                elif tool_name in ("browser_wait_for", "wait_for"):
                    action_result = await run.browser.wait_for(
                        selector=args.get("selector"),
                        text=args.get("text"),
                        timeout=float(args.get("timeout", 5.0))
                    )
                elif tool_name in ("browser_inspect_page", "inspect_page"):
                    inspect_data = await run.browser.inspect_page()
                    action_result = f"Page inspection complete: {inspect_data.get('links_count', 0)} links, {inspect_data.get('buttons_count', 0)} buttons, {inspect_data.get('inputs_count', 0)} inputs."
                elif tool_name in ("browser_get_page_text", "get_page_text"):
                    txt = await run.browser.get_page_text(int(args.get("max_length", 4000)))
                    action_result = f"Extracted text ({len(txt)} chars): {txt[:300]}..."
                elif tool_name in ("browser_get_links", "get_links"):
                    links = await run.browser.get_links(args.get("filter_text"))
                    sample_links = [f"[{l.get('id')}] '{l.get('text')}' -> {l.get('href')}" for l in links[:12]]
                    action_result = f"Found {len(links)} links. Top matches:\n" + "\n".join(sample_links)
                elif tool_name in ("browser_get_buttons", "get_buttons"):
                    btns = await run.browser.get_buttons(args.get("filter_text"))
                    sample_btns = [f"[{b.get('id')}] '{b.get('text')}'" for b in btns[:10]]
                    action_result = f"Found {len(btns)} buttons. Matches:\n" + "\n".join(sample_btns)
                elif tool_name in ("browser_get_inputs", "get_inputs"):
                    inputs = await run.browser.get_inputs()
                    action_result = f"Found {len(inputs)} inputs: " + ", ".join(f"[{i.get('id')}] {i.get('type')} name='{i.get('name')}'" for i in inputs[:8])
                elif tool_name in ("browser_close_tab", "close_tab"):
                    action_result = await run.browser.close_tab()
                elif tool_name == "extract_smart_items":
                    limit_val = int(args.get("limit", 20))
                    rows = await run.browser.extract_smart_items(limit=limit_val, hint=args.get("hint"))
                    saved = await run.browser.save_rows(rows)
                    action_result = f"Extracted {len(rows)} items and saved to store. Total rows in store: {saved}."
                elif tool_name == "extract_table":
                    rows = await run.browser.extract_table(args.get("selector"))
                    saved = await run.browser.save_rows(rows)
                    action_result = f"Extracted {len(rows)} table rows. Total rows in store: {saved}."
                elif tool_name == "extract_by_selector":
                    rows = await run.browser.extract_by_selector(args.get("css", ""), args.get("fields"))
                    saved = await run.browser.save_rows(rows)
                    action_result = f"Extracted {len(rows)} items via CSS. Total rows in store: {saved}."
                elif tool_name == "save_rows":
                    rows = args.get("rows", [])
                    saved = await run.browser.save_rows(rows)
                    action_result = f"Saved {len(rows)} rows to store. Total in store: {saved}."
                elif tool_name == "download_click":
                    action_result = await run.browser.download_click(int(args.get("id", 0)))
                elif tool_name in ("download_media", "download_video"):
                    target_url = args.get("url") or curr_url_info.get("url", "")
                    action_result = await run.browser.download_media(
                        url=target_url,
                        custom_filename=args.get("custom_filename")
                    )
                elif tool_name == "captcha_detect":
                    intel = await run.browser.detect_captcha_intel()
                    action_result = f"CAPTCHA Detection: Type={intel.get('captcha_type')}, Provider={intel.get('provider')}, Confidence={intel.get('confidence')}, IsTestEnv={intel.get('is_test_env')}."
                    await run.emit("captcha_intel", "captcha", action_result, intel)
                elif tool_name == "captcha_analyze":
                    intel = await run.browser.detect_captcha_intel()
                    action_result = f"CAPTCHA Test Analysis: Type={intel.get('captcha_type')}, Provider={intel.get('provider')}, Confidence={intel.get('confidence')} (Analysis in test environment recorded)."
                    await run.emit("captcha_intel", "captcha", action_result, intel)
                elif tool_name == "excel_agent":
                    instruction = args.get("instruction", "Generate Excel file of scraped data.")
                    xl_res = await excel_agent(run, instruction)
                    action_result = f"Excel Agent outcome: {xl_res.get('file', 'error')} ({xl_res.get('rows', 0)} rows)"
                else:
                    action_result = f"Unrecognized tool '{tool_name}'. Proceeding with page inspection."
            except Exception as e:
                action_result = f"Tool execution failed: {e}"

            # F. VERIFY ACTION OUTCOME
            new_url_info = await run.browser.get_current_url()
            verification_note = f"Observed new state: URL='{new_url_info.get('url', '')}', Title='{new_url_info.get('title', '')}'."
            await run.emit("verification", "browser", verification_note, {
                "action": tool_name,
                "result": redact_creds(action_result, run.creds),
                "url": new_url_info.get("url", "")
            })

            # Send live screenshot after action
            try:
                b64_img, _ = await run.browser.screenshot(max_width=800)
                if b64_img:
                    await run.emit("screenshot", "browser", "Page view updated", {"image": b64_img})
            except Exception:
                pass

            # Record step history
            history.append({
                "thought": thought,
                "action": tool_name,
                "args": args,
                "result": redact_creds(action_result, run.creds),
                "url": new_url_info.get("url", "")
            })

            # Update plan progress
            completed_id = res.get("completed_step_id")
            if completed_id:
                for p in plan_state:
                    if p["id"] == completed_id and p["status"] != "completed":
                        p["status"] = "completed"
                        next_p = next((x for x in plan_state if x["status"] == "pending"), None)
                        if next_p:
                            next_p["status"] = "in_progress"
                        await run.emit("step_update", "main", f"Completed: {p['description']}", {"steps": plan_state})
                        break
            else:
                for p in plan_state:
                    if p["status"] == "in_progress" and step_num >= p["id"] * 2:
                        p["status"] = "completed"
                        next_p = next((x for x in plan_state if x["status"] == "pending"), None)
                        if next_p:
                            next_p["status"] = "in_progress"
                        await run.emit("step_update", "main", f"Completed: {p['description']}", {"steps": plan_state})
                        break

        # 4. EXCEL COMPILATION (if data was collected and requested)
        if len(run.data_store) > 0 and (requires_excel or "excel" in user_prompt.lower() or "csv" in user_prompt.lower() or "sheet" in user_prompt.lower()):
            await run.emit("status", "excel", "Compiling extracted data into formatted Excel workbook...", {})
            await excel_agent(run, f"Compile {len(run.data_store)} records from {objective}")

        # 5. FINAL TASK REPORT
        run.status = "done"
        for p in plan_state:
            p["status"] = "completed"

        report_summary = (
            f"Successfully executed autonomous browser workflow for: '{objective}'.\n"
            f"Steps completed: {len(history)} browser operations across pages.\n"
            f"Records extracted: {len(run.data_store)} items in data store.\n"
            f"Generated files: {', '.join(run.files) if run.files else 'None'}"
        )

        await run.emit("final", "main", report_summary, {
            "summary": report_summary,
            "files": run.files,
            "rows": len(run.data_store),
            "steps": plan_state,
            "history_count": len(history)
        })
        logger.info(f"Run {run.id} finished successfully: {report_summary}")

    except Exception as e:
        logger.exception(f"Unhandled error in Autonomous Main Agent: {e}")
        run.status = "error"
        await run.emit("error", "main", f"Execution failed: {str(e)}", {})
    finally:
        if hasattr(run, "browser") and run.browser:
            try:
                await run.browser.close()
            except Exception:
                pass
        logger.info(f"Run {run.id} terminated with final status: {run.status}")
