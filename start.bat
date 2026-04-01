@echo off
echo.
echo ========================================
echo    Waste Tuning Dashboard - Dev Launcher
echo ========================================
echo.
echo This will guide you through starting all three services:
echo   1. SQL Proxy (port 8001) - requires domain password
echo   2. Backend API (port 8000)
echo   3. Frontend Dashboard - SQL Preview Mode (port 5174)
echo.
echo ========================================
echo.

echo Step 1: Starting SQL Proxy Service...
echo.
echo *** A new window will open asking for your domain password ***
echo.
cd /d "%~dp0backend"
start "" start_proxy.bat

echo.
echo ========================================
echo  WAIT for the SQL Proxy to fully start!
echo.
echo  Look for: "Uvicorn running on http://127.0.0.1:8001"
echo.
echo  Once you see that message, press any key here...
echo ========================================
pause

echo.
echo Step 2: Starting Backend API Server...
cd /d "%~dp0backend"
start "Backend API" cmd /k "python main.py"

echo.
echo Waiting for API to initialize (5 seconds)...
timeout /t 5 /nobreak > nul

echo.
echo Step 3: Starting Frontend Dashboard (SQL Preview Mode)...
cd /d "%~dp0frontend-preview"
start "Frontend Dashboard" cmd /k "npm run dev"

echo.
echo ========================================
echo  SUCCESS! All services are starting.
echo ========================================
echo.
echo  Open your browser to: http://localhost:5174
echo.
echo  (Wait a few seconds for the frontend to compile)
echo.
echo ========================================
echo.
pause
