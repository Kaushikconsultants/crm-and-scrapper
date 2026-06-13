@echo off
echo ===================================================
echo     Starting GMB Scraper Control Panel...
echo ===================================================
echo.

cd /d "%~dp0"

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please download and install the LTS version from: https://nodejs.org/
    echo Once installed, double-click this file again.
    pause
    exit /b
)

echo Installing dependencies (if needed)...
call npm install

echo Starting the application...
call npm run dev
pause
