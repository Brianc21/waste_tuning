@echo off
echo ======================================================================
echo   HEB Waste Dashboard - Build Script (SQL Preview Mode)
echo ======================================================================
echo.

cd /d "%~dp0.."

REM Use system Python (must match architecture: 64-bit)
set PYTHON_EXE=python

REM Check for required tools
echo [1/5] Checking prerequisites...
where npm >nul 2>&1 || (echo ERROR: npm not found. Install Node.js first. && pause && exit /b 1)
"%PYTHON_EXE%" --version >nul 2>&1 || (echo ERROR: Python not found. Install Python and add it to PATH. && pause && exit /b 1)
for /f "tokens=2" %%v in ('"%PYTHON_EXE%" --version 2^>^&1') do set PY_VER=%%v
echo      Using Python: %PY_VER%

REM Build Preview React frontend
echo.
echo [2/5] Building SQL Preview Mode frontend...
cd frontend-preview
call npm install
call npm run build
if errorlevel 1 (
    echo ERROR: Frontend build failed!
    pause
    exit /b 1
)
cd ..

REM Verify static files were created
if not exist "backend\static-preview\index.html" (
    echo ERROR: Frontend build did not create static files!
    pause
    exit /b 1
)
echo      Frontend built successfully to backend\static-preview\

REM Create distribution folder (only clears the preview subfolder, not the full dist\)
echo.
echo [3/5] Creating distribution package...
if exist "dist\Waste-Tuning-Dashboard-Preview" rmdir /s /q "dist\Waste-Tuning-Dashboard-Preview"
mkdir "dist\Waste-Tuning-Dashboard-Preview"

REM Download and extract the Python embeddable package
echo.
echo [4/5] Setting up Python environment...
set PYTHON_URL=https://www.python.org/ftp/python/%PY_VER%/python-%PY_VER%-embed-amd64.zip
set PYTHON_ZIP=%TEMP%\python-embed-%PY_VER%.zip
echo      Downloading Python %PY_VER% embeddable from python.org...
powershell -NoProfile -Command "Invoke-WebRequest -Uri '%PYTHON_URL%' -OutFile '%PYTHON_ZIP%'"
if errorlevel 1 (
    echo ERROR: Failed to download Python embeddable package.
    echo        Check your internet connection, or verify that Python %PY_VER%
    echo        has an embeddable package at:
    echo        %PYTHON_URL%
    pause
    exit /b 1
)
echo      Extracting Python...
powershell -NoProfile -Command "Expand-Archive -Path '%PYTHON_ZIP%' -DestinationPath 'dist\Waste-Tuning-Dashboard-Preview\python' -Force"
del "%PYTHON_ZIP%" >nul 2>&1

REM Enable site-packages in the embeddable Python
REM  - The ._pth file controls sys.path; by default 'import site' is commented out
REM  - We uncomment it so installed packages are found, and add our site-packages path
echo      Configuring Python paths...
powershell -NoProfile -Command "$pth = Get-ChildItem 'dist\Waste-Tuning-Dashboard-Preview\python\python3*._pth' | Select-Object -First 1; $content = Get-Content $pth.FullName; $content = $content -replace '#import site', 'import site'; Set-Content $pth.FullName $content; Add-Content $pth.FullName 'Lib\site-packages'; Add-Content $pth.FullName '..'"
if errorlevel 1 (
    echo ERROR: Failed to configure Python paths.
    pause
    exit /b 1
)

REM Install Python packages using the build machine's pip, targeting the bundled site-packages
REM NOTE: The build machine's Python version must match %PY_VER% (same major.minor) for
REM       binary packages like pyodbc to work correctly on the target machines.
echo      Installing packages (this may take a minute)...
mkdir "dist\Waste-Tuning-Dashboard-Preview\python\Lib\site-packages"
"%PYTHON_EXE%" -m pip install -r backend\requirements.txt --target "dist\Waste-Tuning-Dashboard-Preview\python\Lib\site-packages" --no-user --quiet
if errorlevel 1 (
    echo ERROR: Package installation failed!
    pause
    exit /b 1
)
echo      Python environment ready.

REM Copy Python scripts
echo.
echo [5/5] Packaging distribution files...
copy "backend\sql_proxy.py" "dist\Waste-Tuning-Dashboard-Preview\"
copy "backend\main.py"      "dist\Waste-Tuning-Dashboard-Preview\"
copy "backend\db_proxy.py"  "dist\Waste-Tuning-Dashboard-Preview\"

REM Create run_proxy.bat helper
(
    echo @echo off
    echo cd /d "%%~dp0"
    echo python\python.exe sql_proxy.py
) > "dist\Waste-Tuning-Dashboard-Preview\run_proxy.bat"

REM Create run_dashboard.bat helper
(
    echo @echo off
    echo cd /d "%%~dp0"
    echo python\python.exe main.py
) > "dist\Waste-Tuning-Dashboard-Preview\run_dashboard.bat"

REM Copy static files (SQL Preview Mode React frontend)
REM main.py always serves from a folder named "static", so we copy to static\ here.
REM The two dist packages are completely separate, so this does not conflict with
REM the live build's static\ folder.
xcopy "backend\static-preview" "dist\Waste-Tuning-Dashboard-Preview\static\" /E /I /Q

REM Copy queries
copy "backend\queries.json" "dist\Waste-Tuning-Dashboard-Preview\"

REM Copy launcher
copy "build\launcher_template.bat" "dist\Waste-Tuning-Dashboard-Preview\Start Dashboard.bat"

REM Create README for users
(
echo Waste Tuning Dashboard - SQL Preview Mode
echo ==========================================
echo.
echo This is the SQL Preview Mode build. The Clone Config Version,
echo Tune Default Percentages, Activate Config Version, and Reset All
echo Planned Changes actions display the SQL that would be run rather
echo than executing it directly against the database.
echo.
echo Use this build to review and share proposed changes with leadership
echo before applying them to the database.
echo.
echo.
echo FIRST TIME SETUP
echo -----------------
echo On first run, a config.ini file is created automatically with default
echo settings ^(server: hebwmddev-sqlvm.ri-team.net, database: WASTE_HEB^).
echo To connect to a different database, use the Settings button in the
echo dashboard after it starts.
echo.
echo.
echo TO START THE DASHBOARD
echo ----------------------
echo   1. Double-click "Start Dashboard.bat"
echo   2. Enter your ri-team username ^(e.g., john.d^)
echo   3. Enter your domain password when prompted
echo   4. Wait for the proxy to start, then press any key
echo   5. Your browser will open automatically to the dashboard
echo.
echo.
echo REQUIREMENTS
echo ------------
echo   - VPN connection to HEB network
echo   - ri-team domain account with database access
echo   - ODBC Driver 17 or 18 for SQL Server ^(auto-detected; Driver 18 included with SSMS 21^)
echo.
echo.
echo FILES
echo -----
echo   - Start Dashboard.bat    : Double-click this to launch
echo   - config.ini             : Database settings ^(created on first run^)
echo   - python\                : Bundled Python runtime ^(no installation required^)
echo   - sql_proxy.py           : Database authentication service
echo   - main.py                : Main dashboard application
echo   - static\                : SQL Preview Mode web interface files
echo   - queries.json           : Built-in SQL queries for the Query Editor
echo.
echo.
echo CHANGING DATABASE CONNECTION
echo ----------------------------
echo To connect to a different database, use the Settings button in the dashboard:
echo   1. Launch the dashboard and open it in your browser
echo   2. Click the Settings button ^(top right^)
echo   3. Go to the "Database Connection" tab
echo   4. Update the server, database, or port values
echo   5. Click Save - the dashboard will reconnect and update all queries automatically
echo.
echo IMPORTANT: Do not edit config.ini directly to change the database name.
echo The SQL queries reference the database name internally, and must be updated
echo through the Settings menu to stay in sync. Direct edits to config.ini will
echo break all queries.
echo.
echo.
echo TROUBLESHOOTING
echo ---------------
echo   - Make sure you're connected to VPN
echo   - Username format is firstname.lastinitial ^(e.g., john.d^)
echo   - Wait for proxy to show "running" before continuing
echo   - Open the Settings menu in the dashboard to verify or correct the database connection
echo.
echo For detailed help, see the Training Guide documentation.
) > "dist\Waste-Tuning-Dashboard-Preview\README.txt"

echo.
echo ======================================================================
echo   DONE!
echo ======================================================================
echo.
echo Distribution package created in: dist\Waste-Tuning-Dashboard-Preview\
echo.
echo Contents:
dir /b "dist\Waste-Tuning-Dashboard-Preview\"
echo.
echo NOTE: config.ini is NOT included - it is auto-created with default settings on first run.
echo.
echo You can now zip and distribute the Waste-Tuning-Dashboard-Preview folder.
echo.
pause
