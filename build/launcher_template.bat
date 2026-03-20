@echo off
setlocal enabledelayedexpansion

echo ======================================================================
echo   HEB Waste Tuning Dashboard
echo ======================================================================
echo.

cd /d "%~dp0"

REM Check if config.ini exists - if not, create with defaults
if not exist "config.ini" (
    echo  First Time Setup
    echo ======================================================================
    echo.
    echo  Creating config.ini with default settings:
    echo    Server:   hebwmddev-sqlvm.ri-team.net
    echo    Database: WASTE_HEB
    echo    Port:     1433
    echo.

    REM Create config.ini with defaults
    (
        echo [database]
        echo # SQL Server hostname or IP address
        echo server = hebwmddev-sqlvm.ri-team.net
        echo.
        echo # Database name
        echo database = WASTE_HEB
        echo.
        echo # Port ^(default: 1433^)
        echo port = 1433
    ) > config.ini

    echo  Config file created!
    echo.
    echo  NOTE: To connect to a different database, use the Settings button
    echo        in the dashboard after it starts.
    echo.
    echo ======================================================================
    echo.
) else (
    echo  Using existing config.ini
    echo.
)

echo  This will start the dashboard with your domain credentials.
echo.
echo  Requirements:
echo    - VPN connection to HEB network
echo    - ri-team domain account
echo.
echo ======================================================================
echo.

REM Prompt for username
set /p DOMAIN_USER="Enter your ri-team username (e.g., john.d): "

if "%DOMAIN_USER%"=="" (
    echo ERROR: Username cannot be empty.
    pause
    exit /b 1
)

echo.
echo Starting SQL Proxy as ri-team\%DOMAIN_USER%...
echo You will be prompted for your password.
echo.

REM Start SQL Proxy with domain credentials using bundled Python
REM run_proxy.bat keeps the command string to a single path (matching the original
REM EXE launcher approach), avoiding CMD quoting issues with two embedded paths.
start "SQL Proxy" runas /netonly /user:ri-team\%DOMAIN_USER% "cmd /k \"%~dp0run_proxy.bat\""

echo.
echo ======================================================================
echo  WAIT for the SQL Proxy window to show:
echo  "Uvicorn running on http://127.0.0.1:8001"
echo.
echo  Once you see that, press any key here to continue...
echo ======================================================================
pause

echo.
echo Starting Dashboard...
start "Dashboard" cmd /k "%~dp0run_dashboard.bat"

echo.
echo Waiting for dashboard to be ready...
powershell -NoProfile -Command "$timeout=60; $i=0; Write-Host -NoNewline '     '; while($i -lt $timeout){ try{ Invoke-WebRequest -Uri 'http://localhost:8000' -TimeoutSec 1 -UseBasicParsing -ErrorAction Stop | Out-Null; Write-Host ' Ready!'; exit 0 }catch{ Write-Host -NoNewline '.'; Start-Sleep 1; $i++ } }; Write-Host ' Timed out.'"

echo.
echo ======================================================================
echo  SUCCESS! Dashboard is running.
echo.
echo  Open your browser to: http://localhost:8000
echo.
echo  TIP: Click the Settings button to change database connection.
echo ======================================================================
echo.

REM Open browser only once the server has confirmed it is ready
start "" "http://localhost:8000"

echo Press any key to close this launcher...
echo (The dashboard will keep running in its own windows)
pause >nul
