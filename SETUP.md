# CAPTCHA Intelligence & Web Automation Framework — Setup Guide

## Prerequisites

- **Python** 3.10 or higher
- **Node.js** 18+ and npm (for the frontend)
- **Git** (optional, for version control)
- A valid **OpenAI API key** (or compatible LLM endpoint)

---

## Installation

### 1. Clone / Download the project

```bash
git clone <your-repo-url>
cd "Kauvery V2"
```

### 2. Create and activate a virtual environment

```bash
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate
```

### 3. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 4. Install Playwright browsers

```bash
playwright install chromium
```

### 5. Install frontend dependencies

```bash
npm install
```

---

## Optional Packages

These packages enable enhanced features but are **not required** for core functionality.

| Package | Feature | Install Command |
|---------|---------|-----------------|
| `paddlepaddle` + `paddleocr` | OCR-based text CAPTCHA analysis (test envs only) | `pip install paddlepaddle paddleocr` |
| `opencv-python` | Image CAPTCHA grid analysis | `pip install opencv-python` |
| `aiomysql` | MySQL export backend | `pip install aiomysql` |

> [!NOTE]
> PaddleOCR and OpenCV are **heavy dependencies**. Only install if you need image/text CAPTCHA analysis in test environments.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

### Required variables

```dotenv
OPENAI_API_KEY=sk-...          # Your OpenAI API key
# or
GEMINI_API_KEY=...             # Google Gemini API key
```

### MySQL export (optional)

Add these to your `.env` if you want to export scraped data to MySQL:

```dotenv
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=kauvery_scraper
```

### SQLite (default — no extra config needed)

By default the framework uses an embedded SQLite database (`framework.db`) stored in the project directory. No additional configuration is required.

---

## One-Click Windows Launch (Recommended)

Simply double-click:
```bash
run_kauvery.bat
```
This batch script automatically:
1. Verifies Python 3.10+ and Node.js.
2. Clears any stuck or lingering processes on Port 8000 and Port 5173.
3. Launches the FastAPI backend (`python server.py`), Vite dev server, and Electron desktop application.

---

## Running Manually

### Running the Backend

```bash
cd "e:\Kauvery V2"
python server.py
```

The FastAPI server starts on **http://localhost:8000** and also serves the built Web Studio static frontend directly.

### Running the Frontend

```bash
npm run dev
```

The Vite/Electron frontend starts on **http://localhost:5173** and opens the Electron desktop overlay window (press **Alt+K** to toggle).

---

## Project Structure (Consolidated 4-5 File Core)

```
Kauvery V2/
├── run_kauvery.bat         # 1-Click Windows Launcher (cleans ports + runs backend & frontend)
├── server.py               # Consolidated FastAPI Backend + SQLite DB + All API Endpoints
├── agents.py               # Autonomous AI Brain (Planner, State Machine, Groq/OpenRouter LLM)
├── browser_tools.py        # Playwright RPA Engine (25 tools, DOM tagging, CAPTCHA Intel, Scraping)
├── main.js                 # Electron Desktop Application & Overlay Window
├── src/                    # Frontend React/TypeScript UI (Autonomous Browser Studio)
├── dist/                   # Production-built static assets (served by server.py on :8000)
├── requirements.txt        # Python dependencies
├── package.json            # Node.js dependencies & scripts
└── .env                    # Groq, OpenRouter & OpenAI API keys
```

---

## Security Notes

> [!CAUTION]
> **Never commit your `.env` file** to version control. It contains API keys and credentials. The `.gitignore` should already exclude it; verify before pushing.

> [!IMPORTANT]
> **CAPTCHA Policy**: This framework detects and classifies CAPTCHAs only. It does **NOT** solve, bypass, or automate any third-party CAPTCHA challenge. For live third-party sites, the framework issues a **human handoff** signal and stops automation. Only test environments (localhost, trycap.dev, hcaptcha.com/playground, etc.) receive analytical adapter processing.

> [!WARNING]
> **robots.txt & Rate Limits**: The scraping engine is designed to respect `robots.txt` and configured rate limits (`delay_between_pages`). Ensure you have permission to scrape any target site. Misconfigured delays or scraping protected sites without authorization may violate terms of service or applicable law.

> [!NOTE]
> **MySQL Credentials**: If using MySQL export, use a dedicated database user with minimal required privileges (`INSERT`, `SELECT`, `CREATE TABLE` on the target database only). Never use the MySQL root account in production.

---

## Troubleshooting

### `ModuleNotFoundError: No module named 'aiosqlite'`
Run `pip install -r requirements.txt` to install all dependencies.

### `playwright._impl._errors.Error: Executable doesn't exist`
Run `playwright install chromium` to download the browser.

### Port 8000 already in use
Change the port: `uvicorn server:app --port 8001`

### PaddleOCR install fails on Windows
PaddleOCR requires specific Visual C++ redistributables. See the [PaddlePaddle Windows installation guide](https://www.paddlepaddle.org.cn/en/install/quick).
