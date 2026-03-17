# SQL Proxy Setup Guide

## Overview

Your SQL Server only accepts Windows Authentication from domain-joined machines. Since your local computer is in WORKGROUP (not domain-joined), we've created a **proxy architecture**:

```
[Frontend] ←→ [Main API :8000] ←→ [SQL Proxy :8001] ←→ [SQL Server]
                                    (runs with domain creds)
```

## Architecture

### SQL Proxy Service (Port 8001)
- **File:** `sql_proxy.py`
- **Purpose:** Runs with your domain credentials using `runas /netonly`
- **Auth:** Windows Integrated Authentication to SQL Server
- **Exposes:** REST API for SQL operations

### Main Dashboard API (Port 8000)
- **File:** `main.py`
- **Purpose:** Your main application API
- **Connects:** To SQL Proxy via HTTP (localhost:8001)
- **Exposes:** Full dashboard REST API for frontend

## Quick Start

### Step 1: Install Dependencies
```powershell
cd Documents\azure-sql-dashboard\backend
uv pip install -r requirements.txt
```

### Step 2: Start SQL Proxy (WITH DOMAIN CREDENTIALS)
**Double-click:** `start_proxy.bat`

OR run manually:
```powershell
start_proxy.bat
```

When prompted:
- Enter your `ri-team\brian.c` password
- A new window will open with the proxy running
- You should see: `[STARTING] Proxy service on http://localhost:8001`

**Keep this window open!**

### Step 3: Start Main API (NORMAL - NO SPECIAL CREDENTIALS)
Open a **NEW** PowerShell window:

**Double-click:** `start_api.bat`

OR run manually:
```powershell
cd Documents\azure-sql-dashboard\backend
uv run python main.py
```

You should see:
```
[*] Starting up Azure SQL Dashboard API...
[*] Connecting to SQL Proxy at http://localhost:8001...
[OK] Connected to hebwmddev-sqlvm.ri-team.net/HEB_WASTE
[OK] Using Windows Authentication via proxy
```

### Step 4: Test It!

Open browser to: http://localhost:8000

You should see:
```json
{
  "status": "ok",
  "message": "Azure SQL Dashboard API is running!",
  "version": "1.0.0"
}
```

Test database connectivity: http://localhost:8000/api/health

## Troubleshooting

### "Cannot connect to SQL Proxy Service"
- **Problem:** Main API can't reach the proxy
- **Solution:** Make sure `start_proxy.bat` is running in another window
- **Check:** Open http://localhost:8001 in browser - should show proxy status

### "Login failed. The login is from an untrusted domain"
- **Problem:** Proxy is not running with domain credentials
- **Solution:** Make sure you used `start_proxy.bat` (or `runas /netonly`)
- **Check:** The proxy window should say "Enter password for ri-team\brian.c"

### "Connection refused" on port 8001
- **Problem:** Proxy service crashed or not started
- **Solution:** Check the proxy window for error messages
- **Restart:** Close proxy window and run `start_proxy.bat` again

### Wrong password
- **Problem:** You entered the wrong password when starting proxy
- **Solution:** Close the proxy window and restart `start_proxy.bat`

## Files Overview

### New Files (Proxy System)
- `sql_proxy.py` - The proxy service (runs with domain creds)
- `db_proxy.py` - HTTP client that talks to proxy
- `start_proxy.bat` - Launch proxy with domain credentials
- `start_api.bat` - Launch main API normally

### Modified Files
- `main.py` - Now imports `db_proxy` instead of `db`
- `requirements.txt` - Added `requests` library

### Original Files (Still There)
- `db.py` - Original direct SQL connection (not used anymore)
- `config.py` - Configuration (not used by proxy)
- `.env` - Environment variables (not used by proxy)

## How It Works

1. **SQL Proxy** runs with `runas /netonly /user:ri-team\brian.c`
   - This makes Windows use your domain credentials for network connections
   - When proxy connects to SQL Server, it uses Windows Auth
   - SQL Server sees: "ri-team\brian.c is connecting" ✓

2. **Main API** connects to proxy via HTTP
   - No special credentials needed
   - Makes HTTP requests like: `POST http://localhost:8001/query`
   - Proxy executes SQL and returns results

3. **Frontend** connects to Main API
   - Everything works normally from frontend perspective
   - `http://localhost:8000/api/...`

## Security Notes

✓ Proxy only listens on localhost (127.0.0.1)
✓ Not exposed to network
✓ Only your local machine can access it
✓ Same security as SSMS (uses Windows Auth)

## Development Workflow

**Every time you work on this project:**

1. Open PowerShell #1: Run `start_proxy.bat` (enter password)
2. Open PowerShell #2: Run `start_api.bat`
3. Develop as normal!

**When done:**
- Press CTRL+C in both windows to stop services

## Future Improvements

If you get tired of running two services, ask your DBA to enable SQL Server Authentication (Mixed Mode). Then you can go back to a single service without the proxy!
