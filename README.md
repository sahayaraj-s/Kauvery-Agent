# Kauvery Agent v2.0

> Autonomous Agentic AI Browser & Web Task Execution Engine

Kauvery Agent is a production-grade autonomous browser RPA AI engine that plans, navigates, interacts, observes, verifies, and executes multi-step web workflows using Playwright, Groq, and OpenRouter.

## Key Features

- **Autonomous Agent Brain**: Observation-driven state machine (Observe -> Reason -> Act -> Verify).
- **Natural Language & Multilingual Understanding**: Understands English, Tamil, and Tanglish queries, converting them into optimized search terms.
- **25 Standard Browser Tools**: Full Playwright automation (click, fill, select, scroll, wait, DOM inspection, tab handling).
- **CAPTCHA Intelligence Engine**: Detects, audits, and classifies challenges (reCAPTCHA, hCaptcha, Turnstile, xCaptcha, "I'm not a robot" widgets).
- **Autonomous Media & Video Downloader**: Integrated `yt-dlp` tool for downloading video and audio into `outputs/`.
- **Excel & Report Generator**: Formats structured data into styled Excel spreadsheets (`openpyxl`).
- **Desktop Overlay & Web Studio**: Modern Electron assistant with floating avatar (`Alt+K`) + responsive web dashboard.

## Quick Start (Windows)

### 1. Initial Setup
Double-click `setup_new_system.bat` or run:
```bash
pip install -r requirements.txt
playwright install chromium
npm install
copy .env.example .env
```

### 2. Configure API Keys
Edit `.env` and add your API keys:
```dotenv
GROQ_API_KEY=your_groq_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
```

### 3. Launch Application
Double-click `run_kauvery.bat` or run:
```bash
npm run dev
```

- **Backend API**: `http://localhost:8000`
- **Frontend Studio**: `http://localhost:5173`
- **Toggle Desktop Window**: `Alt + K`

## Project Architecture

- `server.py`: FastAPI server, SQLite database, SSE streaming, static hosting.
- `agents.py`: Multi-agent brain, Planner, observation loop, Challenge agent.
- `browser_tools.py`: Playwright RPA engine, DOM semantic tagging, 25 tools, CAPTCHA intelligence.
- `main.js`: Electron desktop application.
- `src/`: React 19 + TypeScript + Tailwind CSS UI.
