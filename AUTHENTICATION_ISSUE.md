# SQL Server Authentication Issue - Diagnosis & Solutions

## Problem Summary
The SQL Server `hebwmddev-sqlvm.ri-team.net` **only accepts Windows Authentication** and **does not allow SQL Server Authentication**.

## What We Tried
1. ✗ Azure AD Token Authentication - SSL cert issues, wrong auth method
2. ✗ SQL Authentication with username/password - Error 18456 (login failed)
3. ✗ Windows Integrated Auth with `runas /netonly` - Error 18452 (untrusted domain)
4. ✗ Multiple username formats - All failed

## Root Cause
- SQL Server is configured for **Windows Authentication Only**
- Your local computer is likely NOT domain-joined to `ri-team` domain
- `runas /netonly` works for SSMS but not for Python's pyodbc library
- Error 18452 = "login is from an untrusted domain"

## Why SSMS Works But Python Doesn't
SSMS has special Windows networking capabilities that allow it to work with `runas /netonly`. Python's pyodbc uses standard ODBC drivers which don't have the same magic.

## Solutions (Pick One)

### Solution A: Enable SQL Server Authentication (RECOMMENDED)
**Requirements:** Database Administrator access

**Steps:**
1. Ask your DBA to enable "Mixed Mode" authentication on the SQL Server
2. Ask them to create a SQL Server Login (not Windows login) for you
3. Update `.env` with:
   ```
   USE_WINDOWS_AUTH=False
   SQL_USERNAME=your_sql_username
   SQL_PASSWORD=your_sql_password
   ```

**Pros:** Simple, works from any machine
**Cons:** Requires DBA assistance

---

### Solution B: Deploy on Domain-Joined Machine
**Requirements:** Access to a Windows machine joined to `ri-team` domain

**Steps:**
1. Deploy the backend application to a domain-joined server
2. Set `.env` to use Windows Auth:
   ```
   USE_WINDOWS_AUTH=True
   ```
3. Run normally - Windows Auth will work automatically

**Pros:** Secure, uses existing infrastructure
**Cons:** Need access to domain-joined machine

---

### Solution C: Use Remote Desktop / Jump Box
**Requirements:** RDP access to a domain-joined machine

**Steps:**
1. Connect via RDP to a domain-joined Windows server
2. Run the application from there
3. Access via localhost or server IP

**Pros:** Works with existing setup
**Cons:** Must stay connected to RDP

---

### Solution D: SQL Proxy Service (Advanced)
**Requirements:** Python expertise

Create a small proxy service that:
1. Runs with domain credentials (using `runas /netonly`)
2. Accepts REST API calls
3. Forwards queries to SQL Server
4. Returns results

**Pros:** Works around the limitation
**Cons:** Complex, additional layer

---

## Current Configuration

**Server:** hebwmddev-sqlvm.ri-team.net
**Database:** HEB_WASTE
**Required Auth:** Windows Authentication Only
**Your Credentials:** ri-team\brian.c

## Test Commands

Check if your computer is domain-joined:
```powershell
systeminfo | findstr /B /C:"Domain"
```

If it shows `Domain: WORKGROUP` - you're NOT domain-joined (this is likely the case).
If it shows `Domain: ri-team.net` - you ARE domain-joined (Solution B might work).

## Files Modified
- `backend/config.py` - Added authentication options
- `backend/db.py` - Added multi-auth support
- `backend/.env` - Configuration file
- `backend/test_connection.py` - Connection test script
- `backend/diagnose_auth.py` - Authentication diagnostics

## Next Steps
1. Run `systeminfo | findstr /B /C:"Domain"` to check domain status
2. Choose one of the solutions above
3. Implement and test
