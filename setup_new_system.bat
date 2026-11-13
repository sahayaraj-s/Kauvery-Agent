@echo off
setlocal
title Kauvery Autonomous Agent v2.0 - New System Setup

echo ======================================================================
echo           KAUVERY AUTONOMOUS AGENT v2.0 - INITIAL SETUP
echo ======================================================================
echo.

cd /d "%~dp0."

echo [*] Step 1/5: Checking Python...
python --version
if errorlevel 1 (
    echo.
    echo [ERROR] Python 3.10+ is required but not found in PATH.
    echo Please install Python from https://www.python.org/ and check "Add Python to PATH".
    echo.
    pause
    exit /b 1
)

echo.
echo [*] Step 2/5: Checking Node.js and npm...
call npm --version
if errorlevel 1 (
    echo.
    echo [ERROR] Node.js 18+ is required but not found in PATH.
    echo Please install Node.js from https://nodejs.org/.
    echo.
    pause
    exit /b 1
)

echo.
echo [*] Step 3/5: Installing Python packages from requirements.txt...
pip install -r requirements.txt
if errorlevel 1 (
    echo [WARNING] Some python packages failed to install. Continuing...
)

echo.
echo [*] Step 4/5: Installing Playwright Chromium browser...
playwright install chromium

echo.
echo [*] Step 5/5: Installing Node.js packages (npm install)...
call npm install

echo.
if not exist .env (
    echo [*] Creating .env from .env.example...
    copy .env.example .env >nul
    echo [NOTE] Created .env file. Please edit .env to insert your GROQ_API_KEY or OPENROUTER_API_KEY!
) else (
    echo [*] .env file already exists.
)

echo.
echo ======================================================================
echo   SETUP COMPLETED SUCCESSFULLY!
echo ======================================================================
echo.
echo Next steps:
echo 1. Open .env and ensure your GROQ_API_KEY or OPENROUTER_API_KEY is set.
echo 2. Double-click "run_kauvery.bat" to start both Backend and Frontend!
echo.
pause
