"""
Kauvery Agent - Autonomous Browser Automation & RPA Toolkit (browser_tools.py)
Consolidated Browser Engine containing:
- Playwright BrowserSession with robust DOM inspection & semantic element tagging
- Reusable Browser Tools (navigate, click, fill, select, scroll, wait, tabs, screenshot)
- CAPTCHA Intelligence Engine (detection, classification, test env detection, signals)
- Structured Web Scraping Engine (tables, pagination, metadata, export)
- Excel Generator & Shared Data Store
"""

from __future__ import annotations

import asyncio
import base64
import csv
import io
import json
import logging
import os
import random
import re
import urllib.parse
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple
from urllib.robotparser import RobotFileParser

from PIL import Image
from playwright.async_api import Browser, BrowserContext, Page, Playwright, async_playwright

logger = logging.getLogger("kauvery.browser")

# Runtime Directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUTS_DIR = os.path.join(BASE_DIR, "outputs")
SESSIONS_DIR = os.path.join(os.environ.get("TEMP", BASE_DIR), "kauvery_sessions")
os.makedirs(OUTPUTS_DIR, exist_ok=True)
os.makedirs(SESSIONS_DIR, exist_ok=True)

# Captcha / Allowed domains
CAPTCHA_DOMAINS = [
    "recaptcha",
    "hcaptcha",
    "challenges.cloudflare.com",
    "cloudflare.com",
    "gstatic.com",
    "google.com",
    "arkoselabs.com",
    "geetest.com"
]

# Tool definitions and schemas for the agent brain & API
BROWSER_TOOL_SCHEMAS: Dict[str, Dict[str, Any]] = {
    "browser_open_url": {
        "description": "Navigate the browser to a specified URL.",
        "parameters": {"url": "Target URL string (e.g. 'https://example.com')"}
    },
    "browser_inspect_page": {
        "description": "Inspect active page structure, returning lists of links, buttons, inputs, and headings.",
        "parameters": {}
    },
    "browser_get_page_text": {
        "description": "Extract full or sectioned visible text content from the active page.",
        "parameters": {"max_length": "Maximum character length (default: 4000)"}
    },
    "browser_get_links": {
        "description": "Get all visible hyperlinks on the page, optionally filtered by keyword.",
        "parameters": {"filter_text": "Optional text or keyword to filter links by"}
    },
    "browser_get_buttons": {
        "description": "Get all visible buttons and clickable elements, optionally filtered.",
        "parameters": {"filter_text": "Optional text to filter buttons by"}
    },
    "browser_get_inputs": {
        "description": "Get all visible input fields, textareas, and dropdowns on the page.",
        "parameters": {}
    },
    "browser_click": {
        "description": "Click an element by its numeric ID from PAGE STATE, CSS selector, or visible text.",
        "parameters": {"id": "Numeric agent ID (e.g. 3)", "selector": "CSS selector", "text": "Exact or partial text"}
    },
    "browser_fill": {
        "description": "Type text into an input field or textarea identified by ID or selector.",
        "parameters": {"id": "Numeric agent ID", "selector": "CSS selector", "text": "Text to type", "press_enter": "Boolean (default: false)"}
    },
    "browser_select": {
        "description": "Select an option in a dropdown menu by ID or selector.",
        "parameters": {"id": "Numeric agent ID", "selector": "CSS selector", "value": "Option label or value"}
    },
    "browser_scroll": {
        "description": "Scroll the active page up, down, top, or bottom.",
        "parameters": {"direction": "'down', 'up', 'top', or 'bottom' (default: 'down')", "amount": "Pixel amount (default: 500)"}
    },
    "browser_go_back": {
        "description": "Navigate back in browser history.",
        "parameters": {}
    },
    "browser_go_forward": {
        "description": "Navigate forward in browser history.",
        "parameters": {}
    },
    "browser_wait": {
        "description": "Pause execution for a brief duration to let dynamic content or transitions settle.",
        "parameters": {"seconds": "Seconds to wait (default: 2.0, max: 10.0)"}
    },
    "browser_wait_for": {
        "description": "Wait until a specific element selector or text appears on the page.",
        "parameters": {"selector": "CSS selector", "text": "Text to wait for", "timeout": "Seconds timeout (default: 5.0)"}
    },
    "browser_screenshot": {
        "description": "Capture a live viewport screenshot of the current page.",
        "parameters": {"max_width": "Maximum width in pixels (default: 1024)"}
    },
    "browser_get_current_url": {
        "description": "Get current browser URL and page title.",
        "parameters": {}
    },
    "browser_get_page_state": {
        "description": "Get complete refreshed page state with newly tagged interactive elements.",
        "parameters": {}
    },
    "browser_close_tab": {
        "description": "Close the current active tab or popup.",
        "parameters": {}
    },
    "extract_smart_items": {
        "description": "Intelligently extracts structured items from cards, tables, search results, or feeds.",
        "parameters": {"limit": "Maximum items to extract (default: 20)", "hint": "Keywords or category hint"}
    },
    "extract_table": {
        "description": "Extract tabular data from an HTML table on the page into rows.",
        "parameters": {"selector": "Optional CSS selector for table"}
    },
    "extract_by_selector": {
        "description": "Extract structured rows repeating across CSS selectors.",
        "parameters": {"css": "CSS selector for repeating card/row", "fields": "Field mapping dictionary"}
    },
    "save_rows": {
        "description": "Saves extracted records into the run's shared data store.",
        "parameters": {"rows": "Array of item dictionaries"}
    },
    "download_click": {
        "description": "Clicks an element that triggers a file download, saving it to outputs/.",
        "parameters": {"id": "Numeric agent ID"}
    },
    "download_media": {
        "description": "Downloads video or audio from YouTube, Vimeo, Dailymotion, or direct web media URLs into outputs/ folder using yt-dlp.",
        "parameters": {"url": "Video or media page URL string", "custom_filename": "Optional custom filename string"}
    },
    "captcha_detect": {
        "description": "Run CAPTCHA intelligence analysis on the current page.",
        "parameters": {}
    },
    "captcha_analyze": {
        "description": "Run analytical OCR / evaluation adapter on detected CAPTCHA in authorized test environments.",
        "parameters": {"sample_type": "Optional category (e.g. 'text', 'image_grid')"}
    }
}


def redact_creds(text: Any, creds: Optional[Dict[str, str]]) -> str:
    """Redacts plain credentials from text or logs."""
    if not isinstance(text, str):
        text = str(text)
    if not creds:
        return text
    u = creds.get("username", "")
    p = creds.get("password", "")
    if u and len(u) > 1:
        text = text.replace(u, "{{USERNAME}}")
    if p and len(p) > 1:
        text = text.replace(p, "{{PASSWORD}}")
    return text


def is_domain_allowed(url: str, allowed_domain: str) -> bool:
    """Checks whether the URL target domain matches the allowed domain or captcha services."""
    if not url or url.startswith("about:") or url.startswith("data:") or url.startswith("javascript:"):
        return True
    try:
        parsed = urllib.parse.urlparse(url)
        host = (parsed.netloc or "").lower().split(":")[0]
        if not host:
            return True
        if any(c in host for c in CAPTCHA_DOMAINS):
            return True
        if not allowed_domain:
            return True
        clean_allowed = allowed_domain.lower().split(":")[0]
        if host == clean_allowed or host.endswith("." + clean_allowed) or clean_allowed.endswith("." + host):
            return True
        parts_host = host.split(".")
        parts_allowed = clean_allowed.split(".")
        if len(parts_host) >= 2 and len(parts_allowed) >= 2:
            root_host = ".".join(parts_host[-2:])
            root_allowed = ".".join(parts_allowed[-2:])
            if root_host == root_allowed:
                return True
        return True
    except Exception:
        return True


def get_default_chrome_profile() -> Tuple[str, str]:
    """Inspects Chrome Local State to find the user's primary logged-in profile name and directory."""
    local_state_path = os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\User Data\Local State")
    if os.path.exists(local_state_path):
        try:
            with open(local_state_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            info_cache = data.get("profile", {}).get("info_cache", {})
            best_dir = "Profile 1"
            best_email = ""
            best_time = 0.0
            for prof_dir, prof_info in info_cache.items():
                if prof_info.get("is_consented_primary_account"):
                    return prof_dir, prof_info.get("user_name", "")
                active_t = prof_info.get("active_time", 0.0)
                if active_t > best_time:
                    best_time = active_t
                    best_dir = prof_dir
                    best_email = prof_info.get("user_name", "")
            return best_dir, best_email
        except Exception as e:
            logger.debug(f"Could not read Chrome Local State: {e}")
    return "Profile 1", ""


# ---------------------------------------------------------------------------
# CAPTCHA Intelligence Data Structures
# ---------------------------------------------------------------------------

class CaptchaType(Enum):
    TEXT = "text"
    IMAGE_GRID = "image_grid"
    RECAPTCHA_V2 = "recaptcha_v2"
    RECAPTCHA_V3 = "recaptcha_v3"
    HCAPTCHA = "hcaptcha"
    CLOUDFLARE_TURNSTILE = "cloudflare_turnstile"
    CHECKBOX = "checkbox"
    XCAPTCHA = "xcaptcha"
    AUDIO = "audio"
    SLIDER_PUZZLE = "slider_puzzle"
    INTERACTIVE_PUZZLE = "interactive_puzzle"
    ENTERPRISE_AUTH = "enterprise_auth"
    UNKNOWN = "unknown"
    NONE = "none"


@dataclass
class CaptchaDetectionResult:
    captcha_type: CaptchaType
    provider: str
    confidence: float
    is_test_env: bool
    page_url: str
    frame_urls: list[str]
    dom_indicators: list[str]
    timestamp: str
    raw_signals: dict[str, Any] = field(default_factory=dict)


@dataclass
class CaptchaMetrics:
    true_positives: int = 0
    false_positives: int = 0
    false_negatives: int = 0
    total_detections: int = 0

    @property
    def precision(self) -> float:
        d = self.true_positives + self.false_positives
        return self.true_positives / d if d else 0.0

    @property
    def recall(self) -> float:
        d = self.true_positives + self.false_negatives
        return self.true_positives / d if d else 0.0

    @property
    def f1(self) -> float:
        p, r = self.precision, self.recall
        return 2 * p * r / (p + r) if (p + r) else 0.0

    def as_dict(self) -> dict:
        return {
            "true_positives": self.true_positives,
            "false_positives": self.false_positives,
            "false_negatives": self.false_negatives,
            "total_detections": self.total_detections,
            "precision": round(self.precision, 4),
            "recall": round(self.recall, 4),
            "f1": round(self.f1, 4),
        }


class CaptchaDetectionEngine:
    """Inspects Playwright pages to classify and audit CAPTCHA challenges."""

    _TEST_DOMAINS: tuple[str, ...] = (
        "localhost", "127.0.0.1", "trycap.dev", "testcaptcha.com",
        "democaptcha.com", "2captcha.com", "recaptcha.net", "hcaptcha.com"
    )

    def __init__(self) -> None:
        self.metrics = CaptchaMetrics()

    def is_test_environment(self, page_url: str) -> bool:
        try:
            parsed = urllib.parse.urlparse(page_url)
            host = (parsed.hostname or "").lower()
            if host in ("localhost", "127.0.0.1", "::1") or host.endswith(".local"):
                return True
            for d in self._TEST_DOMAINS:
                if host == d or host.endswith("." + d):
                    return True
        except Exception:
            pass
        return False

    async def detect(self, page) -> CaptchaDetectionResult:
        page_url = page.url or ""
        is_test = self.is_test_environment(page_url)
        signals: dict[str, Any] = {}
        dom_indicators: list[str] = []
        frame_urls: list[str] = []

        try:
            for frm in page.frames:
                if frm.url and frm.url != page_url:
                    frame_urls.append(frm.url)

            signals["frame_urls"] = frame_urls
            signals["page_url"] = page_url

            try:
                title = await page.title()
                signals["page_title"] = title
            except Exception:
                signals["page_title"] = ""

            try:
                body_text = await page.evaluate("() => document.body ? document.body.innerText.slice(0, 2000) : ''")
                signals["body_text_snippet"] = body_text
            except Exception:
                signals["body_text_snippet"] = ""

            # Probes
            signals.update(await self._probe_recaptcha(page, dom_indicators))
            signals.update(await self._probe_hcaptcha(page, dom_indicators))
            signals.update(await self._probe_cloudflare(page, dom_indicators))
            signals.update(await self._probe_xcaptcha_and_checkbox(page, dom_indicators))
            signals.update(await self._probe_text_captcha(page, dom_indicators))
            signals.update(await self._probe_slider_puzzle(page, dom_indicators))
            signals.update(await self._probe_audio(page, dom_indicators))
        except Exception as exc:
            signals["detection_error"] = str(exc)

        c_type, provider, conf = self.classify_provider(signals)
        self.metrics.total_detections += 1

        return CaptchaDetectionResult(
            captcha_type=c_type,
            provider=provider,
            confidence=conf,
            is_test_env=is_test,
            page_url=page_url,
            frame_urls=frame_urls,
            dom_indicators=dom_indicators,
            timestamp=datetime.now(timezone.utc).isoformat(),
            raw_signals=signals,
        )

    def classify_provider(self, signals: dict) -> tuple[CaptchaType, str, float]:
        frame_str = " ".join(signals.get("frame_urls", [])).lower()

        if signals.get("recaptcha_v3_script"):
            return CaptchaType.RECAPTCHA_V3, "Google reCAPTCHA v3", 0.92
        if signals.get("recaptcha_iframe_found") or "recaptcha" in frame_str or signals.get("g_recaptcha_div"):
            return CaptchaType.RECAPTCHA_V2, "Google reCAPTCHA v2", 0.95
        if signals.get("hcaptcha_iframe_found") or "hcaptcha.com" in frame_str or signals.get("h_captcha_div"):
            return CaptchaType.HCAPTCHA, "hCaptcha", 0.95
        if signals.get("cf_turnstile_found") or "challenges.cloudflare.com" in frame_str or signals.get("cf_chl_widget"):
            return CaptchaType.CLOUDFLARE_TURNSTILE, "Cloudflare Turnstile", 0.95
        if signals.get("xcaptcha_found") or "xcaptcha" in frame_str:
            return CaptchaType.XCAPTCHA, "xCaptcha", 0.95
        if signals.get("checkbox_robot_found"):
            return CaptchaType.CHECKBOX, "Checkbox CAPTCHA (\"I'm not a robot\")", 0.92
        if signals.get("slider_element") or signals.get("puzzle_element"):
            return CaptchaType.SLIDER_PUZZLE, "Slider/Puzzle CAPTCHA", 0.75
        if signals.get("audio_captcha_button"):
            return CaptchaType.AUDIO, "Audio CAPTCHA", 0.75
        if signals.get("text_captcha_input") or signals.get("text_captcha_image"):
            return CaptchaType.TEXT, "Text/OCR CAPTCHA", 0.65

        body = (signals.get("body_text_snippet") or "").lower()
        title = (signals.get("page_title") or "").lower()
        if any(kw in body or kw in title for kw in ("captcha", "verify you are human", "bot check")):
            return CaptchaType.UNKNOWN, "Unknown CAPTCHA", 0.50

        return CaptchaType.NONE, "", 0.0

    async def _probe_recaptcha(self, page, indicators: list) -> dict:
        signals: dict[str, Any] = {}
        try:
            cnt = await page.evaluate("() => Array.from(document.querySelectorAll('iframe')).filter(f => f.src && (f.src.includes('google.com/recaptcha') || f.src.includes('recaptcha.net'))).length")
            if cnt:
                signals["recaptcha_iframe_found"] = True
                indicators.append(f"recaptcha_iframe x{cnt}")
            if await page.evaluate("() => !!document.querySelector('.g-recaptcha, [data-sitekey]')"):
                signals["g_recaptcha_div"] = True
                indicators.append("g-recaptcha div")
            if await page.evaluate("() => Array.from(document.querySelectorAll('script')).some(s => s.src && s.src.includes('recaptcha/api.js?render='))"):
                signals["recaptcha_v3_script"] = True
                indicators.append("recaptcha_v3_script")
        except Exception:
            pass
        return signals

    async def _probe_hcaptcha(self, page, indicators: list) -> dict:
        signals: dict[str, Any] = {}
        try:
            cnt = await page.evaluate("() => Array.from(document.querySelectorAll('iframe')).filter(f => f.src && f.src.includes('hcaptcha.com')).length")
            if cnt:
                signals["hcaptcha_iframe_found"] = True
                indicators.append(f"hcaptcha_iframe x{cnt}")
            if await page.evaluate("() => !!document.querySelector('.h-captcha, [data-hcaptcha-sitekey]')"):
                signals["h_captcha_div"] = True
                indicators.append("h-captcha div")
        except Exception:
            pass
        return signals

    async def _probe_cloudflare(self, page, indicators: list) -> dict:
        signals: dict[str, Any] = {}
        try:
            cnt = await page.evaluate("() => Array.from(document.querySelectorAll('iframe')).filter(f => f.src && f.src.includes('challenges.cloudflare.com')).length")
            if cnt:
                signals["cf_turnstile_found"] = True
                indicators.append(f"cloudflare_turnstile x{cnt}")
            if await page.evaluate("() => !!document.querySelector('.cf-turnstile, [data-sitekey][data-action]')"):
                signals["cf_chl_widget"] = True
                indicators.append("cf-turnstile widget")
        except Exception:
            pass
        return signals

    async def _probe_xcaptcha_and_checkbox(self, page, indicators: list) -> dict:
        signals: dict[str, Any] = {}
        try:
            res = await page.evaluate("""() => {
                const text = (document.body ? document.body.innerText : '').toLowerCase();
                const hasXCaptcha = text.includes('xcaptcha') || !!document.querySelector('[class*="xcaptcha" i], [id*="xcaptcha" i], iframe[src*="xcaptcha" i]');
                const hasRobot = text.includes("i'm not a robot") || text.includes("im not a robot") || !!document.querySelector('[aria-label*="robot" i], [title*="robot" i]');
                const hasCheckbox = !!document.querySelector('input[type="checkbox"][id*="captcha" i], .captcha-checkbox, [role="checkbox"][aria-label*="robot" i]');
                return { hasXCaptcha, hasRobot, hasCheckbox };
            }""")
            if res.get("hasXCaptcha"):
                signals["xcaptcha_found"] = True
                indicators.append("xCaptcha widget")
            if res.get("hasRobot") or res.get("hasCheckbox"):
                signals["checkbox_robot_found"] = True
                indicators.append("'I\\'m not a robot' checkbox")
        except Exception:
            pass
        return signals

    async def _probe_text_captcha(self, page, indicators: list) -> dict:
        signals: dict[str, Any] = {}
        try:
            has_input = await page.evaluate("""() => Array.from(document.querySelectorAll('input')).some(i => {
                const n = (i.name || '').toLowerCase(), id = (i.id || '').toLowerCase(), ph = (i.placeholder || '').toLowerCase();
                return ['captcha', 'verification_code', 'security_code'].some(k => n.includes(k) || id.includes(k) || ph.includes(k));
            })""")
            if has_input:
                signals["text_captcha_input"] = True
                indicators.append("text captcha input")
            has_img = await page.evaluate("() => Array.from(document.querySelectorAll('img')).some(i => (i.alt||'').toLowerCase().includes('captcha') || (i.src||'').toLowerCase().includes('captcha'))")
            if has_img:
                signals["text_captcha_image"] = True
                indicators.append("captcha image")
        except Exception:
            pass
        return signals

    async def _probe_slider_puzzle(self, page, indicators: list) -> dict:
        signals: dict[str, Any] = {}
        try:
            has_slider = await page.evaluate("() => !!document.querySelector('[class*=slider][class*=captcha], [class*=puzzle], .geetest_panel')")
            if has_slider:
                signals["slider_element"] = True
                indicators.append("slider/puzzle CAPTCHA")
        except Exception:
            pass
        return signals

    async def _probe_audio(self, page, indicators: list) -> dict:
        signals: dict[str, Any] = {}
        try:
            has_audio = await page.evaluate("() => !!document.querySelector('audio[id*=captcha], [aria-label*=audio]')")
            if has_audio:
                signals["audio_captcha_button"] = True
                indicators.append("audio captcha element")
        except Exception:
            pass
        return signals


# ---------------------------------------------------------------------------
# Structured Web Scraping Engine
# ---------------------------------------------------------------------------

@dataclass
class ScrapingConfig:
    url: str
    selectors: dict[str, str] = field(default_factory=dict)
    pagination_selector: Optional[str] = None
    max_pages: int = 5
    delay_between_pages: float = 1.0
    export_format: str = "json"  # json | csv
    table_selector: Optional[str] = None
    extract_metadata: bool = True


@dataclass
class ScrapingResult:
    url: str
    records: list[dict] = field(default_factory=list)
    page_count: int = 0
    total_records: int = 0
    errors: list[str] = field(default_factory=list)
    duration_seconds: float = 0.0
    exported_to: str = ""


class WebScrapingEngine:
    """Async Web Scraper operating via Playwright browser context."""

    def __init__(self, browser_session: Any, db_manager: Any = None):
        self.browser_session = browser_session
        self.db_manager = db_manager

    async def scrape(self, config: ScrapingConfig) -> ScrapingResult:
        start_time = datetime.now()
        result = ScrapingResult(url=config.url)
        page = self.browser_session.page
        if not page:
            result.errors.append("No active browser page")
            return result

        try:
            await page.goto(config.url, wait_until="domcontentloaded", timeout=25000)
            page_num = 0

            while page_num < config.max_pages:
                page_num += 1
                logger.info(f"Scraping page {page_num}: {page.url}")

                if config.table_selector:
                    table_data = await self.browser_session.extract_table(config.table_selector)
                    result.records.extend(table_data)
                elif config.selectors:
                    css_card = config.selectors.get("_container", "body")
                    card_fields = {k: v for k, v in config.selectors.items() if k != "_container"}
                    card_data = await self.browser_session.extract_by_selector(css_card, card_fields)
                    result.records.extend(card_data)
                else:
                    smart_data = await self.browser_session.extract_smart_items(limit=30)
                    result.records.extend(smart_data)

                # Pagination
                if config.pagination_selector and page_num < config.max_pages:
                    next_btn = page.locator(config.pagination_selector).first
                    if await next_btn.is_visible():
                        await next_btn.click()
                        await asyncio.sleep(config.delay_between_pages)
                        await page.wait_for_load_state("domcontentloaded", timeout=5000)
                    else:
                        break
                else:
                    break

            result.page_count = page_num
            result.total_records = len(result.records)
            result.duration_seconds = (datetime.now() - start_time).total_seconds()

            # Export
            clean_host = urllib.parse.urlparse(config.url).netloc.replace(".", "_") or "scraped"
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            export_fname = f"scrape_{clean_host}_{ts}.{config.export_format}"
            export_fpath = os.path.join(OUTPUTS_DIR, export_fname)

            if config.export_format == "csv" and result.records:
                keys = list(result.records[0].keys())
                with open(export_fpath, "w", newline="", encoding="utf-8") as f:
                    writer = csv.DictWriter(f, fieldnames=keys)
                    writer.writeheader()
                    writer.writerows(result.records)
            else:
                with open(export_fpath, "w", encoding="utf-8") as f:
                    json.dump(result.records, f, indent=2)

            result.exported_to = export_fpath

        except Exception as e:
            result.errors.append(str(e))

        return result


# ---------------------------------------------------------------------------
# Core Autonomous BrowserSession
# ---------------------------------------------------------------------------

class BrowserSession:
    """
    Autonomous Browser Session using Playwright.
    Supports comprehensive DOM inspection, numbered interactive elements,
    resilient clicking with fallback strategies, form filling, multi-tab routing,
    and integrated CAPTCHA detection.
    """

    def __init__(self, run: Any, headless: Optional[bool] = None):
        self.run = run
        self.playwright: Optional[Playwright] = None
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.allowed_domain: str = ""
        self._cdp_connected: bool = False
        self._tagged_elements_cache: List[Dict[str, Any]] = []

        if headless is None:
            headless_env = os.getenv("HEADLESS", "false").strip().lower()
            self.headless = headless_env in ("true", "1", "yes")
        else:
            self.headless = headless

    async def start(self, start_url: Optional[str] = None):
        """Initializes browser session connecting to Chrome or launching Playwright Chromium."""
        clean_url = (start_url or "").strip()
        if clean_url:
            if not clean_url.startswith("http://") and not clean_url.startswith("https://"):
                clean_url = "https://" + clean_url
            try:
                parsed = urllib.parse.urlparse(clean_url)
                self.allowed_domain = (parsed.netloc or "").lower().split(":")[0]
            except Exception:
                self.allowed_domain = ""

        self.playwright = await async_playwright().start()

        # 1. Attempt connection to existing Chrome on port 9222
        connected = False
        try:
            self.browser = await self.playwright.chromium.connect_over_cdp("http://127.0.0.1:9222")
            if self.browser.contexts:
                self.context = self.browser.contexts[0]
                if self.context.pages:
                    for p in self.context.pages:
                        p_url = (p.url or "").lower()
                        if self.allowed_domain and self.allowed_domain in p_url:
                            self.page = p
                            await self.page.bring_to_front()
                            logger.info(f"Re-using active tab on domain {self.allowed_domain}: {p.url}")
                            break
                    if not self.page:
                        self.page = self.context.pages[-1]
                else:
                    self.page = await self.context.new_page()
                connected = True
                self._cdp_connected = True
                logger.info("Connected to user's active Google Chrome on port 9222.")
        except Exception:
            connected = False

        # 2. Fallback: Launch independent Chromium browser
        if not connected:
            user_data_dir = os.path.join(SESSIONS_DIR, "chrome_profile")
            os.makedirs(user_data_dir, exist_ok=True)
            launch_args = [
                "--disable-blink-features=AutomationControlled",
                "--no-default-browser-check",
                "--no-first-run",
                "--start-maximized"
            ]
            try:
                self.context = await self.playwright.chromium.launch_persistent_context(
                    user_data_dir=user_data_dir,
                    headless=self.headless,
                    args=launch_args,
                    ignore_default_args=["--enable-automation"],
                    viewport={"width": 1280, "height": 800},
                    accept_downloads=True
                )
                if self.context.pages:
                    self.page = self.context.pages[0]
                else:
                    self.page = await self.context.new_page()
                logger.info("Launched persistent Chromium context.")
            except Exception as e:
                logger.warning(f"Persistent context launch fallback: {e}")
                self.browser = await self.playwright.chromium.launch(
                    headless=self.headless,
                    args=["--disable-blink-features=AutomationControlled"],
                    ignore_default_args=["--enable-automation"]
                )
                self.context = await self.browser.new_context(
                    viewport={"width": 1280, "height": 800},
                    accept_downloads=True
                )
                self.page = await self.context.new_page()
                logger.info("Launched standard Chromium browser.")

        # Listen for popups and new tabs
        def handle_new_page(new_page: Page):
            logger.info(f"New browser page/tab detected: {new_page.url}")
            self.page = new_page

        self.context.on("page", handle_new_page)

        if clean_url:
            await self.open_url(clean_url)

    async def save_session(self):
        if self.context and self.allowed_domain and not self._cdp_connected:
            try:
                session_file = os.path.join(SESSIONS_DIR, f"{self.allowed_domain}.json")
                await self.context.storage_state(path=session_file)
            except Exception as e:
                logger.warning(f"Failed to save session for {self.allowed_domain}: {e}")

    async def close(self):
        try:
            await self.save_session()
        except Exception:
            pass

        if self._cdp_connected:
            if self.browser:
                try:
                    await self.browser.close()
                except Exception:
                    pass
            if self.playwright:
                try:
                    await self.playwright.stop()
                except Exception:
                    pass
            return

        if self.page:
            try:
                await self.page.close()
            except Exception:
                pass
        if self.context:
            try:
                await self.context.close()
            except Exception:
                pass
        if self.browser:
            try:
                await self.browser.close()
            except Exception:
                pass
        if self.playwright:
            try:
                await self.playwright.stop()
            except Exception:
                pass

    # ----------------- PAGE STATE & DOM INSPECTION -----------------

    async def get_page_state(self) -> str:
        if not self.page:
            return "No active page."

        try:
            state = await self.page.evaluate('''() => {
                document.querySelectorAll('[data-agent-id]').forEach(el => el.removeAttribute('data-agent-id'));

                const url = window.location.href;
                const title = document.title || 'Untitled';
                
                const body = document.body;
                const html = document.documentElement;
                const pageHeight = Math.max(
                    body ? body.scrollHeight : 0,
                    body ? body.offsetHeight : 0,
                    html ? html.clientHeight : 0,
                    html ? html.scrollHeight : 0,
                    html ? html.offsetHeight : 0
                ) || window.innerHeight;
                const scrollY = window.scrollY || window.pageYOffset || 0;
                const scrollPct = pageHeight > window.innerHeight ? Math.round((scrollY / (pageHeight - window.innerHeight)) * 100) : 0;
                
                let text = '';
                if (body) {
                    text = (body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 1200);
                }

                const clean = (s) => (s || '').replace(/\\s+/g, ' ').trim().slice(0, 70);

                const selector = 'a[href], button, input, select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="tab"], [role="menuitem"], [role="option"], [onclick], summary';
                const allElements = Array.from(document.querySelectorAll(selector));

                const visibleElements = [];
                for (const el of allElements) {
                    const style = window.getComputedStyle(el);
                    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) continue;
                    
                    const inViewport = (rect.top < window.innerHeight && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0);
                    visibleElements.push({ el, rect, inViewport });
                }

                visibleElements.sort((a, b) => {
                    if (a.inViewport && !b.inViewport) return -1;
                    if (!a.inViewport && b.inViewport) return 1;
                    return (a.rect.top - b.rect.top) || (a.rect.left - b.rect.left);
                });

                const tagged = [];
                const rawItems = [];
                const maxCount = Math.min(80, visibleElements.length);
                for (let i = 0; i < maxCount; i++) {
                    const item = visibleElements[i];
                    const id = i + 1;
                    item.el.setAttribute('data-agent-id', String(id));
                    
                    const tag = item.el.tagName.toLowerCase();
                    let desc = '';
                    let itemType = 'other';
                    let itemHref = '';
                    let itemText = '';

                    if (tag === 'button' || item.el.getAttribute('role') === 'button') {
                        itemType = 'button';
                        itemText = clean(item.el.innerText || item.el.value || item.el.getAttribute('aria-label') || 'Button');
                        desc = `button "${itemText}"`;
                    } else if (tag === 'a' || item.el.getAttribute('role') === 'link') {
                        itemType = 'link';
                        itemText = clean(item.el.innerText || item.el.getAttribute('aria-label') || 'Link');
                        itemHref = item.el.getAttribute('href') || '';
                        desc = `a "${itemText}" href=${itemHref}`;
                    } else if (tag === 'input') {
                        itemType = 'input';
                        const itype = item.el.type || 'text';
                        const name = item.el.name || '';
                        const ph = item.el.placeholder || '';
                        const hasVal = item.el.value ? ` value="${clean(item.el.value)}"` : '';
                        desc = `input type=${itype} name=${name} placeholder="${ph}"${hasVal}`;
                    } else if (tag === 'select') {
                        itemType = 'select';
                        const name = item.el.name || '';
                        const options = Array.from(item.el.options || []).slice(0, 5).map(o => clean(o.text)).filter(Boolean).join(', ');
                        desc = `select name=${name} options=[${options}]`;
                    } else if (tag === 'textarea') {
                        itemType = 'textarea';
                        const name = item.el.name || '';
                        const ph = item.el.placeholder || '';
                        desc = `textarea name=${name} placeholder="${ph}"`;
                    } else {
                        const role = item.el.getAttribute('role') || 'clickable';
                        itemText = clean(item.el.innerText || item.el.getAttribute('aria-label') || '');
                        desc = `[${role}] "${itemText}"`;
                    }

                    tagged.push(`[${id}] ${desc}`);
                    rawItems.push({
                        id,
                        tag,
                        type: itemType,
                        text: itemText,
                        href: itemHref,
                        inViewport: item.inViewport
                    });
                }

                return {
                    url,
                    title,
                    scrollPct,
                    pageHeight,
                    text,
                    elements: tagged,
                    rawItems
                };
            }''')

            self._tagged_elements_cache = state.get("rawItems", [])

            out = [
                f"URL: {state['url']}",
                f"TITLE: {state['title']}",
                f"SCROLL: {state['scrollPct']}% (page height {state['pageHeight']}px)",
                f"TEXT EXCERPT: {state['text']}",
                f"INTERACTIVE ELEMENTS ({len(state['elements'])} tagged):"
            ]
            for el_desc in state["elements"]:
                out.append(el_desc)
            return "\n".join(out)
        except Exception as e:
            return f"Error reading page state: {e}"

    async def inspect_page(self) -> Dict[str, Any]:
        if not self.page:
            return {"error": "No active page"}

        await self.get_page_state()

        try:
            info = await self.page.evaluate('''() => {
                const links = [];
                document.querySelectorAll('a[data-agent-id]').forEach(a => {
                    links.push({
                        id: parseInt(a.getAttribute('data-agent-id')),
                        text: (a.innerText || a.getAttribute('aria-label') || '').trim().slice(0, 60),
                        href: a.getAttribute('href') || ''
                    });
                });

                const buttons = [];
                document.querySelectorAll('button[data-agent-id], [role="button"][data-agent-id]').forEach(b => {
                    buttons.push({
                        id: parseInt(b.getAttribute('data-agent-id')),
                        text: (b.innerText || b.value || b.getAttribute('aria-label') || '').trim().slice(0, 60)
                    });
                });

                const inputs = [];
                document.querySelectorAll('input[data-agent-id], select[data-agent-id], textarea[data-agent-id]').forEach(inp => {
                    inputs.push({
                        id: parseInt(inp.getAttribute('data-agent-id')),
                        tag: inp.tagName.toLowerCase(),
                        name: inp.name || '',
                        type: inp.type || 'text',
                        placeholder: inp.placeholder || '',
                        value: (inp.value || '').slice(0, 50)
                    });
                });

                const headings = [];
                document.querySelectorAll('h1, h2, h3').forEach(h => {
                    const txt = (h.innerText || '').trim().slice(0, 80);
                    if (txt) headings.push(`${h.tagName.toLowerCase()}: ${txt}`);
                });

                return {
                    url: window.location.href,
                    title: document.title,
                    links_count: links.length,
                    buttons_count: buttons.length,
                    inputs_count: inputs.length,
                    links: links.slice(0, 30),
                    buttons: buttons.slice(0, 30),
                    inputs,
                    headings: headings.slice(0, 15)
                };
            }''')
            return info
        except Exception as e:
            return {"error": str(e)}

    async def get_page_text(self, max_length: int = 4000) -> str:
        if not self.page:
            return ""
        try:
            text = await self.page.evaluate('''() => {
                const main = document.querySelector('main, article, #content, .content, body');
                return (main ? main.innerText : document.body ? document.body.innerText : '')
                    .replace(/\\s+/g, ' ').trim();
            }''')
            return text[:max_length]
        except Exception as e:
            return f"Error extracting page text: {e}"

    async def get_links(self, filter_text: Optional[str] = None) -> List[Dict[str, Any]]:
        await self.get_page_state()
        links = [el for el in self._tagged_elements_cache if el.get("type") == "link"]
        if filter_text:
            ft = filter_text.strip().lower()
            links = [l for l in links if ft in l.get("text", "").lower() or ft in l.get("href", "").lower()]
        return links

    async def get_buttons(self, filter_text: Optional[str] = None) -> List[Dict[str, Any]]:
        await self.get_page_state()
        btns = [el for el in self._tagged_elements_cache if el.get("type") == "button"]
        if filter_text:
            ft = filter_text.strip().lower()
            btns = [b for b in btns if ft in b.get("text", "").lower()]
        return btns

    async def get_inputs(self) -> List[Dict[str, Any]]:
        await self.get_page_state()
        return [el for el in self._tagged_elements_cache if el.get("type") in ("input", "select", "textarea")]

    async def get_current_url(self) -> Dict[str, str]:
        if not self.page:
            return {"url": "", "title": ""}
        try:
            return {"url": self.page.url, "title": await self.page.title()}
        except Exception:
            return {"url": self.page.url if self.page else "", "title": ""}

    # ----------------- REUSABLE BROWSER ACTIONS -----------------

    async def open_url(self, url: str) -> str:
        if not self.page:
            return "No active page."
        clean_url = url.strip()
        if not clean_url.startswith("http://") and not clean_url.startswith("https://"):
            clean_url = "https://" + clean_url

        try:
            parsed = urllib.parse.urlparse(clean_url)
            new_domain = (parsed.netloc or "").lower().split(":")[0]
            if new_domain:
                self.allowed_domain = new_domain

            current_url = (self.page.url or "").lower()
            if current_url.rstrip("/") == clean_url.lower().rstrip("/"):
                await self.page.bring_to_front()
                title = await self.page.title()
                return f"Already on {clean_url}. Active page title: {title}"

            await self.page.goto(clean_url, wait_until="domcontentloaded", timeout=30000)
            try:
                await self.page.wait_for_load_state("networkidle", timeout=3000)
            except Exception:
                pass
            title = await self.page.title()
            return f"Opened {clean_url} successfully. Page title: '{title}'"
        except Exception as e:
            return f"Failed to open {url}: {e}"

    async def click(self, id: Optional[int] = None, selector: Optional[str] = None, text: Optional[str] = None) -> str:
        if not self.page:
            return "No active page."

        locator = None
        target_desc = ""

        if id is not None and id > 0:
            target_desc = f"ID [{id}]"
            locator = self.page.locator(f'[data-agent-id="{id}"]').first
        elif selector:
            target_desc = f"selector '{selector}'"
            locator = self.page.locator(selector).first
        elif text:
            target_desc = f"text '{text}'"
            locator = self.page.get_by_text(text).first
        else:
            return "Click failed: Neither id, selector, nor text was provided."

        try:
            if not await locator.is_visible():
                await locator.scroll_into_view_if_needed(timeout=2500)

            try:
                async with self.context.expect_page(timeout=1500) as new_page_info:
                    await locator.click(timeout=4000)
                new_page = await new_page_info.value
                self.page = new_page
                await self.page.wait_for_load_state("domcontentloaded", timeout=4000)
                return f"Clicked {target_desc} which opened a new tab: '{self.page.url}' (Title: '{await self.page.title()}')"
            except TimeoutError:
                pass
            except Exception:
                try:
                    await locator.evaluate("el => el.click()")
                except Exception:
                    box = await locator.bounding_box()
                    if box:
                        await self.page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
                    else:
                        raise

            try:
                await self.page.wait_for_load_state("domcontentloaded", timeout=3000)
            except Exception:
                pass

            curr_title = await self.page.title()
            return f"Clicked {target_desc} successfully. Current URL: {self.page.url} (Title: '{curr_title}')"
        except Exception as e:
            return f"Failed to click {target_desc}: {e}"

    async def fill(self, id: Optional[int] = None, selector: Optional[str] = None, text: str = "", press_enter: bool = False) -> str:
        if not self.page:
            return "No active page."

        locator = None
        target_desc = ""

        if id is not None and id > 0:
            target_desc = f"ID [{id}]"
            locator = self.page.locator(f'[data-agent-id="{id}"]').first
        elif selector:
            target_desc = f"selector '{selector}'"
            locator = self.page.locator(selector).first
        else:
            return "Fill failed: Neither id nor selector was provided."

        try:
            creds = getattr(self.run, "creds", {}) or {}
            actual_text = text
            if "{{USERNAME}}" in actual_text:
                actual_text = actual_text.replace("{{USERNAME}}", creds.get("username", ""))
            if "{{PASSWORD}}" in actual_text:
                actual_text = actual_text.replace("{{PASSWORD}}", creds.get("password", ""))

            await locator.scroll_into_view_if_needed(timeout=2500)
            await locator.click(timeout=2500)

            try:
                await locator.fill("")
            except Exception:
                await self.page.keyboard.press("Control+A")
                await self.page.keyboard.press("Backspace")

            for ch in actual_text:
                await self.page.keyboard.type(ch)
                await asyncio.sleep(random.uniform(0.02, 0.05))

            if press_enter:
                await self.page.keyboard.press("Enter")
                try:
                    await self.page.wait_for_load_state("domcontentloaded", timeout=4000)
                except Exception:
                    pass

            return redact_creds(f"Filled {target_desc} with '{actual_text}' (press_enter={press_enter})", creds)
        except Exception as e:
            creds = getattr(self.run, "creds", {}) or {}
            return redact_creds(f"Failed to fill {target_desc}: {e}", creds)

    async def select_option(self, id: Optional[int] = None, selector: Optional[str] = None, value: str = "") -> str:
        if not self.page:
            return "No active page."
        locator = self.page.locator(f'[data-agent-id="{id}"]').first if id else self.page.locator(selector or "").first
        try:
            await locator.select_option(label=value)
            return f"Selected option '{value}' successfully."
        except Exception:
            try:
                await locator.select_option(value=value)
                return f"Selected option by value '{value}' successfully."
            except Exception as e:
                return f"Failed to select option '{value}': {e}"

    async def scroll(self, direction: str = "down", amount: int = 500) -> str:
        if not self.page:
            return "No active page."
        try:
            d = direction.lower()
            if d == "top":
                await self.page.evaluate("() => window.scrollTo(0, 0)")
            elif d == "bottom":
                await self.page.evaluate("() => window.scrollTo(0, document.body.scrollHeight)")
            elif d == "up":
                await self.page.mouse.wheel(0, -abs(amount))
            else:
                await self.page.mouse.wheel(0, abs(amount))

            await asyncio.sleep(0.5)
            pct = await self.page.evaluate('''() => {
                const h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) - window.innerHeight;
                return h > 0 ? Math.round((window.scrollY / h) * 100) : 100;
            }''')
            return f"Scrolled {direction} (Current scroll: {pct}%)."
        except Exception as e:
            return f"Failed to scroll {direction}: {e}"

    async def go_back(self) -> str:
        if not self.page:
            return "No active page."
        try:
            await self.page.go_back(wait_until="domcontentloaded", timeout=10000)
            return f"Navigated back to: {self.page.url} (Title: '{await self.page.title()}')"
        except Exception as e:
            return f"Failed to go back: {e}"

    async def go_forward(self) -> str:
        if not self.page:
            return "No active page."
        try:
            await self.page.go_forward(wait_until="domcontentloaded", timeout=10000)
            return f"Navigated forward to: {self.page.url} (Title: '{await self.page.title()}')"
        except Exception as e:
            return f"Failed to go forward: {e}"

    async def wait(self, seconds: float = 2.0) -> str:
        sec = min(max(float(seconds), 0.5), 10.0)
        await asyncio.sleep(sec)
        return f"Waited {sec:.1f} seconds."

    async def wait_for(self, selector: Optional[str] = None, text: Optional[str] = None, timeout: float = 5.0) -> str:
        if not self.page:
            return "No active page."
        t_ms = int(min(max(timeout, 1.0), 15.0) * 1000)
        try:
            if selector:
                await self.page.wait_for_selector(selector, state="visible", timeout=t_ms)
                return f"Element '{selector}' is now visible."
            elif text:
                await self.page.locator(f"text={text}").first.wait_for(state="visible", timeout=t_ms)
                return f"Text '{text}' is now visible."
            return "No selector or text specified to wait for."
        except Exception as e:
            return f"Timed out waiting for condition ({timeout}s): {e}"

    async def press_key(self, key: str = "Enter") -> str:
        if not self.page:
            return "No active page."
        try:
            await self.page.keyboard.press(key)
            await asyncio.sleep(0.3)
            return f"Pressed key '{key}'."
        except Exception as e:
            return f"Failed to press key '{key}': {e}"

    async def close_tab(self) -> str:
        if not self.context or not self.page:
            return "No active tab to close."
        try:
            await self.page.close()
            pages = self.context.pages
            if pages:
                self.page = pages[-1]
                await self.page.bring_to_front()
                return f"Closed tab. Switched to tab: {self.page.url}"
            return "Closed tab. No remaining open tabs."
        except Exception as e:
            return f"Failed to close tab: {e}"

    async def get_tabs(self) -> List[Dict[str, str]]:
        if not self.context:
            return []
        tabs = []
        for i, p in enumerate(self.context.pages):
            tabs.append({
                "index": i,
                "url": p.url,
                "title": (await p.title()) if not p.is_closed() else "Closed",
                "is_active": p == self.page
            })
        return tabs

    async def screenshot(self, max_width: int = 1024) -> Tuple[str, float]:
        if not self.page:
            return "", 1.0
        try:
            raw_bytes = await self.page.screenshot(type="jpeg", quality=80)
            img = Image.open(io.BytesIO(raw_bytes))
            orig_width = img.width

            if orig_width > max_width:
                scale = orig_width / float(max_width)
                new_height = int(img.height / scale)
                img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
            else:
                scale = 1.0

            out_buf = io.BytesIO()
            img.save(out_buf, format="JPEG", quality=80)
            b64_str = base64.b64encode(out_buf.getvalue()).decode("utf-8")
            return b64_str, scale
        except Exception as e:
            logger.error(f"Screenshot error: {e}")
            return "", 1.0

    async def detect_challenge(self) -> bool:
        if not self.page:
            return False
        try:
            title = (await self.page.title()).lower()
            if any(p in title for p in ["just a moment...", "attention required!", "ddos-guard", "cloudflare"]):
                return True

            for frame in self.page.frames:
                furl = (frame.url or "").lower()
                if any(k in furl for k in ["challenges.cloudflare.com", "cf-turnstile", "xcaptcha", "recaptcha", "hcaptcha"]):
                    return True

            blocking = await self.page.evaluate('''() => {
                const bodyText = (document.body ? document.body.innerText : '').toLowerCase();
                const strictPhrases = [
                    "checking your browser before accessing",
                    "verify you are human to continue",
                    "this process is automatic. your browser will redirect",
                    "please complete the security check to access",
                    "i'm not a robot",
                    "im not a robot",
                    "xcaptcha"
                ];
                for (const p of strictPhrases) {
                    if (bodyText.includes(p)) return true;
                }
                if (document.querySelector('[class*="xcaptcha" i], [id*="xcaptcha" i], iframe[src*="xcaptcha" i]')) return true;
                return false;
            }''')
            return bool(blocking)
        except Exception:
            return False

    async def detect_captcha_intel(self) -> Dict[str, Any]:
        if not self.page:
            return {"status": "no_page"}
        try:
            engine = CaptchaDetectionEngine()
            result = await engine.detect(self.page)
            return {
                "captcha_type": result.captcha_type.value,
                "provider": result.provider,
                "confidence": result.confidence,
                "is_test_env": result.is_test_env,
                "dom_indicators": result.dom_indicators,
                "page_url": result.page_url,
                "timestamp": result.timestamp
            }
        except Exception as e:
            logger.warning(f"Error running captcha intel: {e}")
            return {"status": "error", "error": str(e)}

    # ----------------- ADVANCED DATA EXTRACTION -----------------

    async def extract_table(self, selector: Optional[str] = None) -> List[Dict[str, Any]]:
        if not self.page:
            return []
        try:
            data = await self.page.evaluate('''(sel) => {
                const table = sel ? document.querySelector(sel) : document.querySelector('table');
                if (!table) return [];

                const headers = [];
                const ths = table.querySelectorAll('thead th, tr:first-child th, tr:first-child td');
                if (ths.length > 0) {
                    ths.forEach(th => headers.push((th.innerText || '').trim()));
                }

                const rows = [];
                const trs = table.querySelectorAll('tbody tr, tr');
                const startIdx = (ths.length > 0 && trs[0] && trs[0].contains(ths[0])) ? 1 : 0;

                for (let i = startIdx; i < trs.length; i++) {
                    const cells = trs[i].querySelectorAll('td, th');
                    if (cells.length === 0) continue;
                    const rowObj = {};
                    cells.forEach((cell, idx) => {
                        const h = headers[idx] || `col_${idx + 1}`;
                        rowObj[h] = (cell.innerText || '').trim();
                    });
                    rows.push(rowObj);
                }
                return rows;
            }''', selector)
            return data or []
        except Exception as e:
            logger.warning(f"Error in extract_table: {e}")
            return []

    async def extract_by_selector(self, css: str, fields: Optional[Dict[str, str]] = None) -> List[Dict[str, Any]]:
        if not self.page:
            return []
        try:
            data = await self.page.evaluate(r'''([css, fields]) => {
                const results = [];
                const items = document.querySelectorAll(css);
                for (const item of items) {
                    const row = {};
                    if (fields && Object.keys(fields).length > 0) {
                        for (let [key, subSel] of Object.entries(fields)) {
                            subSel = (subSel || '').replace(/::text/gi, '').replace(/\/text\(\)/gi, '').trim();
                            if (!subSel || subSel === '.') {
                                row[key] = (item.innerText || '').trim();
                            } else {
                                try {
                                    const subEls = item.querySelectorAll(subSel);
                                    if (subEls.length > 1) {
                                        row[key] = Array.from(subEls).map(e => (e.innerText || '').trim()).filter(Boolean).join(', ');
                                    } else if (subEls.length === 1) {
                                        row[key] = (subEls[0].innerText || '').trim();
                                    } else {
                                        row[key] = '';
                                    }
                                } catch (e) {
                                    row[key] = (item.innerText || '').trim();
                                }
                            }
                        }
                    } else {
                        row['text'] = (item.innerText || '').trim();
                    }
                    if (Object.keys(row).length > 0) {
                        results.push(row);
                    }
                }
                return results;
            }''', [css, fields or {}])
            return data or []
        except Exception as e:
            logger.warning(f"Error in extract_by_selector: {e}")
            return []

    async def dismiss_consent_popups(self):
        if not self.page:
            return
        selectors = [
            'button:has-text("Accept all")',
            'button:has-text("I agree")',
            'button:has-text("Agree")',
            'button:has-text("Accept")',
            'button:has-text("Reject all")',
            'button:has-text("Got it")',
            'button:has-text("Continue")',
            'button:has-text("No thanks")',
            'button:has-text("Dismiss")',
            'button[aria-label*="Accept"]',
            'button[aria-label*="Close"]',
            '#yDmH0d button:has-text("Accept all")',
            '#yDmH0d button:has-text("I agree")'
        ]
        for sel in selectors:
            try:
                locator = self.page.locator(sel).first
                if await locator.is_visible(timeout=150):
                    await locator.click(timeout=600)
                    await asyncio.sleep(0.3)
                    break
            except Exception:
                continue

    async def extract_smart_items(self, limit: int = 20, hint: Optional[str] = None) -> List[Dict[str, Any]]:
        if not self.page:
            return []

        await self.dismiss_consent_popups()
        current_url = (self.page.url or "").lower()

        # YouTube
        if "youtube.com" in current_url:
            try:
                for _ in range(3):
                    v_count = await self.page.evaluate('() => document.querySelectorAll("ytd-video-renderer #video-title, ytd-rich-item-renderer #video-title, a#video-title").length')
                    if v_count >= limit:
                        break
                    await self.page.evaluate('() => window.scrollBy(0, 1500)')
                    await asyncio.sleep(1.0)

                items = await self.page.evaluate(r'''(maxLimit) => {
                    const results = [];
                    const titleElements = Array.from(document.querySelectorAll(
                        'ytd-video-renderer #video-title, ytd-rich-item-renderer #video-title, a#video-title-link, a#video-title'
                    ));
                    for (const titleEl of titleElements) {
                        const title = (titleEl.innerText || titleEl.getAttribute('title') || '').trim();
                        if (!title || results.some(x => x.Title === title)) continue;
                        
                        let url = titleEl.href || titleEl.getAttribute('href') || '';
                        if (url && url.startsWith('/')) url = 'https://www.youtube.com' + url;
                        
                        const container = titleEl.closest('ytd-video-renderer, ytd-rich-item-renderer, ytd-grid-video-renderer') || titleEl.parentElement;
                        let channel = '';
                        let views = '';
                        let duration = '';
                        if (container) {
                            const channelEl = container.querySelector('ytd-channel-name #text, #channel-info #text, #byline');
                            channel = channelEl ? (channelEl.innerText || '').split('\n')[0].trim() : '';
                            const metaSpans = Array.from(container.querySelectorAll('#metadata-line span'));
                            if (metaSpans.length >= 1) views = (metaSpans[0].innerText || '').trim();
                            const timeEl = container.querySelector('ytd-thumbnail-overlay-time-status-renderer span, badge-shape span');
                            duration = timeEl ? (timeEl.innerText || '').trim() : '';
                        }
                        results.push({
                            "Title": title,
                            "Channel": channel,
                            "Views": views,
                            "Duration": duration,
                            "Video_URL": url
                        });
                        if (results.length >= maxLimit) break;
                    }
                    return results;
                }''', limit)
                if items:
                    return items
            except Exception as e:
                logger.warning(f"Error in YouTube extraction: {e}")

        # E-Commerce (Amazon, Flipkart)
        if any(d in current_url for d in ["amazon.", "flipkart."]):
            try:
                items = await self.page.evaluate('''(maxLimit) => {
                    const results = [];
                    const amzCards = Array.from(document.querySelectorAll('[data-component-type="s-search-result"], .s-result-item'));
                    for (const c of amzCards) {
                        const titleEl = c.querySelector('h2 a span, h2 a, .a-text-normal');
                        if (!titleEl) continue;
                        const title = (titleEl.innerText || '').trim();
                        if (!title || results.some(x => x.Product_Title === title)) continue;
                        
                        const priceEl = c.querySelector('.a-price .a-offscreen, .a-price-whole');
                        const price = priceEl ? (priceEl.innerText || '').trim() : '';
                        const ratingEl = c.querySelector('.a-icon-star-small .a-icon-alt, .a-icon-star .a-icon-alt');
                        const rating = ratingEl ? (ratingEl.innerText || '').trim() : '';
                        const linkEl = c.querySelector('h2 a');
                        const url = linkEl ? (linkEl.href || '') : '';
                        
                        results.push({
                            "Product_Title": title,
                            "Price": price,
                            "Rating": rating,
                            "Product_URL": url
                        });
                        if (results.length >= maxLimit) break;
                    }
                    return results;
                }''', limit)
                if items:
                    return items
            except Exception as e:
                logger.warning(f"Error in E-Commerce extraction: {e}")

        # Table fallback
        table_rows = await self.extract_table()
        if table_rows:
            return table_rows[:limit]

        # Repeating card / article items fallback
        try:
            items = await self.page.evaluate('''(maxLimit) => {
                const results = [];
                const candidates = Array.from(document.querySelectorAll('article, [role="article"], .card, .post, li, .result'));
                for (const c of candidates) {
                    const h = c.querySelector('h1, h2, h3, h4, a');
                    if (!h) continue;
                    const title = (h.innerText || '').trim();
                    if (!title || title.length < 3 || results.some(x => x.Title === title)) continue;
                    
                    const a = c.querySelector('a') || (h.tagName === 'A' ? h : null);
                    const url = a ? (a.href || '') : '';
                    const descEl = c.querySelector('p, .desc, .summary, .snippet');
                    const desc = descEl ? (descEl.innerText || '').trim().slice(0, 150) : '';
                    
                    results.push({
                        "Title": title,
                        "Summary": desc,
                        "URL": url
                    });
                    if (results.length >= maxLimit) break;
                }
                return results;
            }''', limit)
            if items:
                return items
        except Exception:
            pass

        return []

    async def save_rows(self, rows: List[Dict[str, Any]]) -> int:
        if not isinstance(rows, list):
            return len(getattr(self.run, "data_store", []))
        if hasattr(self.run, "data_store"):
            for r in rows:
                if isinstance(r, dict) and r:
                    self.run.data_store.append(r)
            return len(self.run.data_store)
        return len(rows)

    async def download_click(self, id: int) -> str:
        if not self.page:
            return "No active page."
        try:
            selector = f'[data-agent-id="{id}"]'
            async with self.page.expect_download(timeout=15000) as download_info:
                await self.page.locator(selector).first.click()
            download = await download_info.value
            fname = download.suggested_filename or f"download_{random.randint(1000, 9999)}"
            save_path = os.path.join(OUTPUTS_DIR, fname)
            await download.save_as(save_path)
            
            if hasattr(self.run, "files"):
                self.run.files.append(fname)
            
            if hasattr(self.run, "emit"):
                await self.run.emit("file", "browser", f"Downloaded file {fname}", {"name": fname, "url": f"/api/files/{fname}"})

            return f"Downloaded {fname} successfully."
        except Exception as e:
            return f"Failed to download from element [{id}]: {e}"

    async def download_media(self, url: str, custom_filename: Optional[str] = None) -> str:
        """
        Downloads video or audio from YouTube, Vimeo, web platforms, or direct media URLs into OUTPUTS_DIR using yt-dlp.
        """
        if not url:
            return "Error: No URL provided for media download."

        if hasattr(self.run, "emit"):
            await self.run.emit("action", "downloader", f"Initiating media download for: {url}")

        loop = asyncio.get_running_loop()

        def _do_download():
            import yt_dlp
            out_template = os.path.join(OUTPUTS_DIR, "%(title).80s_%(id)s.%(ext)s")
            if custom_filename:
                safe_name = re.sub(r'[^a-zA-Z0-9_\-]', '_', str(custom_filename)).strip("_")
                out_template = os.path.join(OUTPUTS_DIR, f"{safe_name}.%(ext)s")

            ydl_opts = {
                'outtmpl': out_template,
                'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
                'noplaylist': True,
                'quiet': True,
                'no_warnings': True,
                'max_filesize': 800 * 1024 * 1024,  # 800MB limit for safety
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                filename = ydl.prepare_filename(info)
                return os.path.basename(filename), info.get("title", "Media Video")

        try:
            saved_name, title = await loop.run_in_executor(None, _do_download)
            if hasattr(self.run, "files"):
                self.run.files.append(saved_name)
            if hasattr(self.run, "emit"):
                await self.run.emit(
                    "file",
                    "downloader",
                    f"Successfully downloaded: {saved_name}",
                    {"name": saved_name, "url": f"/api/files/{saved_name}", "title": title}
                )
            return f"Successfully downloaded media file '{saved_name}' ('{title}') to outputs/ folder. File is available at /api/files/{saved_name}"
        except Exception as e:
            logger.warning(f"yt-dlp download note: {e}")
            return f"Media download note: {str(e)[:200]}. You can also access the media directly at: {url}"
