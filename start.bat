@echo off
echo.
echo ========================================
echo    Azure SQL Dashboard Launcher
echo ========================================
echo.
echo This will guide you through starting all three services:
echo   1. SQL Proxy (port 8001) - requires domain password
echo   2. Backend API (port 8000)
echo   3. Frontend Dashboard (port 5173)
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
echo  Look for: "Uvicorn running on http://0.0.0.0:8001"
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
echo Step 3: Starting Frontend Dashboard...
cd /d "%~dp0frontend"
start "Frontend Dashboard" cmd /k "npm run dev"

echo.
echo ========================================
echo  SUCCESS! All services are starting.
echo ========================================
echo.
echo  Open your browser to: http://localhost:5173
echo.
echo  (Wait a few seconds for the frontend to compile)
echo.
echo ========================================
echo.
pause
