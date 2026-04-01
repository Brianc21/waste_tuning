# Building the HEB Waste Dashboard Distribution

This folder contains the build scripts for creating a distributable package of the HEB Waste Dashboard.

## Prerequisites (on the build machine only)

- Python 3.9+ with pip (64-bit — must match the architecture of end-user machines)
- Node.js 16+ with npm
- Internet connection (downloads the Python embeddable package from python.org during the build)

> **Note:** PyInstaller is no longer required. The build bundles the official Python embeddable package instead of compiling executables.

## Building

There are two separate build scripts — one for each frontend version.

### Live (Write-Mode) Build

1. Open a Command Prompt in this folder
2. Run:
   ```
   build_all.bat
   ```
3. Wait for the build to complete (2-4 minutes)
4. The distribution package will be in: `dist\Waste-Tuning-Dashboard\`

### SQL Preview Mode Build

1. Open a Command Prompt in this folder
2. Run:
   ```
   build_preview.bat
   ```
3. Wait for the build to complete (2-4 minutes)
4. The distribution package will be in: `dist\Waste-Tuning-Dashboard-Preview\`

Both builds can coexist in the `dist\` folder at the same time — they output to separate subfolders.

## What Gets Built

Both build scripts follow the same steps:
1. Build the React frontend to static files
2. Download the Python embeddable package matching the build machine's Python version
3. Configure the Python runtime's path file (`._pth`) so bundled packages and local scripts are found
4. Install all Python dependencies into the bundled runtime
5. Copy the Python scripts and static assets into the distribution folder
6. Generate `run_proxy.bat` and `run_dashboard.bat` helper scripts

## Distribution Package Contents

### Live Build (`dist\Waste-Tuning-Dashboard\`)

```
Waste-Tuning-Dashboard/
├── Start Dashboard.bat    ← Users double-click this
├── run_proxy.bat          ← Launches SQL Proxy with bundled Python (called by launcher)
├── run_dashboard.bat      ← Launches Dashboard with bundled Python (called by launcher)
├── python/                ← Bundled Python runtime (no install needed)
│   ├── python.exe
│   ├── python3xx._pth     ← Configured to find bundled packages and local scripts
│   └── Lib/
│       └── site-packages/ ← All pip dependencies
├── sql_proxy.py           ← Database authentication service
├── main.py                ← API + Frontend server
├── db_proxy.py            ← Database proxy client
├── static/                ← Web interface files
│   ├── index.html
│   └── assets/
├── queries.json           ← Built-in SQL queries for the Query Editor
└── README.txt             ← Quick start guide for users
```

### SQL Preview Mode Build (`dist\Waste-Tuning-Dashboard-Preview\`)

```
Waste-Tuning-Dashboard-Preview/
├── Start Dashboard.bat    ← Users double-click this
├── run_proxy.bat          ← Launches SQL Proxy with bundled Python (called by launcher)
├── run_dashboard.bat      ← Launches Dashboard with bundled Python (called by launcher)
├── python/                ← Bundled Python runtime (no install needed)
│   ├── python.exe
│   ├── python3xx._pth     ← Configured to find bundled packages and local scripts
│   └── Lib/
│       └── site-packages/ ← All pip dependencies
├── sql_proxy.py           ← Database authentication service
├── main.py                ← API + Frontend server
├── db_proxy.py            ← Database proxy client
├── static/                ← SQL Preview Mode web interface files
│   ├── index.html
│   └── assets/
├── queries.json           ← Built-in SQL queries for the Query Editor
└── README.txt             ← Quick start guide for users
```

Note: `config.ini` is NOT included in either build — it is created automatically on first run.

## End User Requirements

Users do NOT need to install:
- Python
- Node.js
- Any development tools

Users DO need:
- VPN connection to HEB network
- ri-team domain account with database access
- Windows 10/11
- ODBC Driver 17 or 18 for SQL Server (Driver 18 is included with SSMS 21; Driver 17 available separately)

## Distributing

**Live build:**
1. Zip the `dist\Waste-Tuning-Dashboard` folder
2. Send to users
3. Users extract to a local drive and double-click "Start Dashboard.bat"

**SQL Preview Mode build:**
1. Zip the `dist\Waste-Tuning-Dashboard-Preview` folder
2. Send to users
3. Users extract to a local drive and double-click "Start Dashboard.bat"

No certificate import or other first-time setup steps are required for either build.

## Build Files

- `build_all.bat` — Builds the **live / write-mode** distribution from `frontend/` → `dist\Waste-Tuning-Dashboard\`
- `build_preview.bat` — Builds the **SQL Preview Mode** distribution from `frontend-preview/` → `dist\Waste-Tuning-Dashboard-Preview\`
- `launcher_template.bat` — Template copied to `Start Dashboard.bat` in both dist folders
- `config_template.ini` — Reference for default database connection values (not copied by the build; `config.ini` is created at runtime by the launcher)
- `dashboard.spec` *(legacy)* — PyInstaller spec kept for reference; not used since v1.7
- `sql_proxy.spec` *(legacy)* — PyInstaller spec kept for reference; not used since v1.7

## Troubleshooting Build Issues

### "Frontend build failed"
- Make sure Node.js is installed
- Run `npm install` in the frontend folder manually to see the full error

### "Failed to download Python embeddable package"
- Check your internet connection
- Verify the URL is reachable: `https://www.python.org/ftp/python/`
- If your build machine uses a proxy, configure it with `set HTTPS_PROXY=http://your-proxy:port` before running the build

### "Package installation failed"
- Ensure pip is up to date: `python -m pip install --upgrade pip`
- Check that you're running a 64-bit Python (run `python -c "import struct; print(struct.calcsize('P')*8)"` — should print `64`)
- Try installing manually: `python -m pip install -r ..\backend\requirements.txt`

### "pyodbc fails on end-user machines"
- The build machine's Python version (major.minor) must match the bundled embeddable version
- Both must be 64-bit to run on standard 64-bit Windows machines
- Confirm the version with: `python --version`
