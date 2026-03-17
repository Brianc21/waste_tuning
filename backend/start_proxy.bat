@echo off
REM Start SQL Proxy Service with domain credentials
echo ======================================================================
echo SQL PROXY SERVICE LAUNCHER
echo ======================================================================
echo.
echo This will start the SQL Proxy Service with your domain credentials.
echo.
echo The proxy will run on: http://localhost:8001
echo.
echo ======================================================================
echo.

REM Prompt for username
set /p DOMAIN_USER="Enter your ri-team username (e.g., john.d): "

REM Check if user entered anything
if "%DOMAIN_USER%"=="" (
    echo ERROR: Username cannot be empty.
    pause
    exit /b 1
)

echo.
echo Starting proxy as ri-team\%DOMAIN_USER%...
echo You will be prompted for your password.
echo.

runas /netonly /user:ri-team\%DOMAIN_USER% "cmd /k cd /d %~dp0 && python sql_proxy.py"
