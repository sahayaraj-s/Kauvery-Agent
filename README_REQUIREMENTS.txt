================================================================================
KAUVERY AUTONOMOUS AGENT v2.0 - SYSTEM REQUIREMENTS & SETUP GUIDE
================================================================================

1. SYSTEM PREREQUISITES
--------------------------------------------------------------------------------
- Operating System: Windows 10 / Windows 11 (64-bit)
- Python Version:   Python 3.10 or higher (Python 3.11 / 3.12 recommended)
                    * Crucial: Check "Add Python to PATH" during Python install.
- Node.js Version:  Node.js 18.0.0 or higher (comes with npm)
                    Download from: https://nodejs.org/
- Internet Access:  Required for Playwright web automation, Groq & OpenRouter APIs.


2. REQUIRED PYTHON PACKAGES (requirements.txt)
--------------------------------------------------------------------------------
fastapi             -> Modern async web framework for API endpoints & SSE
uvicorn[standard]   -> High-performance ASGI server
playwright          -> Headless / Headful browser automation & RPA engine
openai              -> Unified client for Groq & OpenRouter API completions
openpyxl            -> Excel spreadsheet generator with professional styling
pillow              -> Screenshot processing & image analysis
python-dotenv       -> Loads environment variables from .env file
pydantic            -> Data validation & API schemas
aiosqlite           -> Asynchronous SQLite database driver
beautifulsoup4      -> HTML parsing & fallback DOM extraction
lxml                -> High-speed XML/HTML parsing backend
yt-dlp              -> Autonomous video/audio downloader engine
httpx               -> Asynchronous HTTP client for network calls


3. REQUIRED NODE.JS DEPENDENCIES (package.json)
--------------------------------------------------------------------------------
Dependencies:
- react & react-dom (v19)
- lucide-react (Modern UI icons)
- framer-motion (Smooth animations)
- tailwindcss & @tailwindcss/vite (Styling)
- three (3D effects)
- canvas-confetti (Task completion celebrations)

Dev Dependencies:
- electron (v34) (Desktop application & overlay window)
- vite (v6) (Ultra-fast frontend dev server & bundler)
- concurrently (Runs backend, vite, and electron simultaneously)
- typescript


4. HOW TO SETUP ON A NEW COMPUTER (IN ANOTHER SYSTEM)
--------------------------------------------------------------------------------
METHOD A - AUTOMATIC ONE-CLICK SETUP (RECOMMENDED):
--------------------------------------------------
1. Extract the ZIP file into any folder (e.g., C:\Kauvery or D:\Kauvery).
2. Double-click "setup_new_system.bat".
   This script will automatically:
   - Verify Python and Node.js
   - Install all Python libraries from requirements.txt
   - Download the Playwright Chromium browser
   - Run npm install for frontend dependencies
   - Create a clean .env file
3. Open the newly created ".env" file in Notepad:
   Add your GROQ_API_KEY or OPENROUTER_API_KEY:
     GROQ_API_KEY=gsk_...
     OPENROUTER_API_KEY=sk-or-...
4. Double-click "run_kauvery.bat" to launch the agent!


METHOD B - MANUAL COMMAND-LINE SETUP:
------------------------------------
Open Command Prompt (cmd) inside the project folder:

1. Install Python packages:
   pip install -r requirements.txt

2. Install Playwright browser:
   playwright install chromium

3. Install Node.js packages:
   npm install

4. Configure environment:
   copy .env.example .env
   (Open .env in Notepad and paste your GROQ_API_KEY or OPENROUTER_API_KEY)

5. Start the application:
   run_kauvery.bat
   (or run: npm run dev)


5. APPLICATION PORTS & SHORTCUTS
--------------------------------------------------------------------------------
- Backend API Server:     http://localhost:8000
- Production Web Studio:  http://localhost:8000
- Vite Hot-Reload Studio: http://localhost:5173
- Electron Desktop App:   Launches automatically
- Toggle Overlay Window:  Press Alt + K  or  Ctrl + Shift + K
================================================================================
