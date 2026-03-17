@echo off
REM Start Main Dashboard API
echo ======================================================================
echo AZURE SQL DASHBOARD API
echo ======================================================================
echo.
echo Starting dashboard API on: http://localhost:8000
echo Make sure SQL Proxy Service is running first!
echo.
pause

cd /d %~dp0
uv run python main.py
