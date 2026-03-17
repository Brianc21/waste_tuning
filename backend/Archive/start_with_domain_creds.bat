@echo off
REM Start the backend API using domain credentials (like SSMS does)
echo Starting Azure SQL Dashboard API with domain credentials...
echo.
echo You will be prompted for your ri-team\brian.c password
echo.

runas /netonly /user:ri-team\brian.c "cmd /k cd /d %~dp0 && uv run python main.py"

pause
