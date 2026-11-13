@echo off
setlocal
title Kauvery Autonomous Agent v2.0 - Launcher

echo ======================================================================
echo           KAUVERY AUTONOMOUS AGENT v2.0 - LAUNCHER
echo      Autonomous Browser RPA ^| Multi-Agent Engine ^| CAPTCHA Intel
echo ======================================================================
echo.

cd /d "%~dp0."

echo [*] Checking Python installation...
python --version
if errorlevel 1 (
    echo.
    echo [ERROR] Python is not installed or not in your PATH.
    echo Please install Python 3.10+ and add it to PATH.
    echo.
    pause
    exit /b 1
)

echo [*] Checking Node.js installation...
call npm --version
if errorlevel 1 (
    echo.
    echo [ERROR] Node.js or npm is not installed or not in your PATH.
    echo Please install Node.js 18+ and try again.
    echo.
    pause
    exit /b 1
)

echo.
echo [*] Freeing port 8000 and 5173 if occupied...
python -c "import subprocess; [subprocess.run(['taskkill', '/F', '/PID', l.split()[-1]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) for p in (8000, 5173) for l in subprocess.run(['netstat', '-ano'], capture_output=True, text=True).stdout.splitlines() if f':{p}' in l and 'LISTENING' in l]"

echo [*] Starting Kauvery Backend, Vite Dev Server, and Electron Desktop Studio...
echo.
echo ======================================================================
echo   Backend is live at: http://localhost:8000
echo   Web Studio is available at: http://localhost:8000
echo   Desktop Overlay UI: Press Alt+K or Ctrl+Shift+K to toggle!
echo ======================================================================
echo.

call npm run dev

echo.
echo [*] Kauvery Agent stopped.
pause
