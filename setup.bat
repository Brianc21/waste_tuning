@echo off
echo.
echo ========================================
echo    Azure SQL Dashboard Setup
echo ========================================
echo.
echo This will install all dependencies.
echo Please ensure you have Python and Node.js installed.
echo.
pause

echo.
echo [1/3] Setting up backend...
cd backend
echo Installing Python packages...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ERROR: Failed to install Python dependencies!
    pause
    exit /b 1
)
cd ..

echo.
echo [2/3] Setting up frontend...
cd frontend
echo Installing Node packages (this may take a minute)...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install Node dependencies!
    pause
    exit /b 1
)
cd ..

echo.
echo [3/3] Configuration check...
echo.
echo IMPORTANT: Edit backend/.env and set your SQL_DATABASE name!
echo.
echo Current config:
type backend\.env
echo.

echo.
echo ========================================
echo    Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Edit backend/.env and set SQL_DATABASE=YourDatabaseName
echo 2. Run start.bat to launch the dashboard
echo.
pause
