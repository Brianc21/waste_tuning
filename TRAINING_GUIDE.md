# Waste Tuning Dashboard
## Training Guide

---

**Version:** 1.7
**Last Updated:** March 2026
**Internal Use Only** - Retail Insight / HEB Waste Management Team

---

# Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [Dashboard Overview](#3-dashboard-overview)
4. [The Tuning Workflow](#4-the-tuning-workflow)
5. [Tuning Actions](#5-tuning-actions)
6. [Executing Custom Queries](#6-executing-custom-queries)
7. [Settings & Configuration](#7-settings--configuration)
8. [Best Practices](#8-best-practices)
9. [Troubleshooting](#9-troubleshooting)

---

# 1. Introduction

The **Waste Tuning Dashboard** is a web-based tool designed to streamline the process of managing and tuning waste markdown configurations. It provides:

- **Real-time visibility** into current markdown percentages across all PPG Clusters
- **Interactive tuning** with Leave/Change/Reset decisions per row
- **Safe execution** of config changes with confirmation dialogs
- **Version management** for cloning, activating, and tracking config versions
- **Performance monitoring** with timing diagnostics

### Who Should Use This Tool?

- Waste Management Analysts
- Configuration Managers
- Data Analysts working with markdown tuning

---

# 2. Getting Started

## 2.1 Prerequisites

Before using the dashboard, ensure you have:

- ✅ Access to the HEB network (VPN required if working remotely)
- ✅ A **ri-team** domain account with database permissions
- ✅ The dashboard files on your machine

### For Packaged Version (Recommended for End Users)
- ✅ Just extract the zip file - no additional software needed!
- ✅ ODBC Driver 17 or 18 for SQL Server (auto-detected; Driver 18 included with SSMS 21, Driver 17 available separately)

### For Development Version
- ✅ Node.js installed (for the frontend)
- ✅ Python installed (for the backend)

## 2.2 Your Domain Credentials

You will need your **ri-team** domain username and password to connect.

**Username format:** `firstname.lastinitial`

**Examples:**
- John Doe → `john.d`
- Jane Smith → `jane.s`
- Bob Johnson → `bob.j`

## 2.3 Starting the Dashboard

### Option A: Packaged Version (Recommended for End Users)

If you received the dashboard as a zip file (HEB-Waste-Dashboard.zip):

1. Extract the zip and copy the `HEB-Waste-Dashboard` folder to a **local drive** (e.g. `C:\Apps\WasteDashboard\`) — do not run from OneDrive or a network share
2. **Double-click `Start Dashboard.bat`**
3. Enter your **ri-team username** (e.g., `john.d`)
4. Windows will prompt for your **domain password** - enter it
5. **Wait** for the SQL Proxy window to show: `Uvicorn running on http://127.0.0.1:8001`
6. Press any key in the launcher to continue
7. Your browser will automatically open to: **http://localhost:8000**

**That's it!** No Python, Node.js, or any other installation required.

---

### Option B: Development Version (One-Click Start)

If you have the full source code and development tools installed:

The dashboard requires **three services** to be running:

| Service | Port | Purpose |
|---------|------|---------|
| SQL Proxy | 8001 | Handles database authentication |
| Backend API | 8000 | Serves data and executes queries |
| Frontend | 5173 | The web interface you interact with |

1. Navigate to the `azure-sql-dashboard` folder
2. Double-click **`start.bat`**
3. A window will open asking for your **ri-team username**
   - Enter your username (e.g., `john.d`)
   - Press Enter
4. Windows will prompt for your **domain password**
   - Enter your password
   - Press Enter
5. **Wait** for the SQL Proxy window to show: `Uvicorn running on http://127.0.0.1:8001`
6. Press any key in the launcher window to continue
7. The API and Frontend will start automatically
8. Open your browser to: **http://localhost:5173**

### Option C: Manual Start (If above options fail)

**Step 1: Start the SQL Proxy**

Open a Command Prompt in the `azure-sql-dashboard\backend` folder:
```
start_proxy.bat
```
- Enter your ri-team username when prompted (e.g., `john.d`)
- Enter your domain password when Windows prompts
- Wait for: `Uvicorn running on http://127.0.0.1:8001`
- Keep this window open

**Step 2: Start the API Server**

Open another Command Prompt in the `azure-sql-dashboard\backend` folder:
```
start_api.bat
```
- Wait for: `Uvicorn running on http://0.0.0.0:8000`
- Keep this window open

**Step 3: Start the Frontend**

Open PowerShell in the `azure-sql-dashboard\frontend` folder:
```powershell
npm run dev
```
- Wait for: `Local: http://localhost:5173`
- Keep this window open

**Step 4: Open the Dashboard**

Open your browser and navigate to:
```
http://localhost:5173
```

## 2.4 Verifying Connection

When the dashboard loads successfully, you should see:

- ✅ "Active Config Version" displaying a version number
- ✅ "Max Config Version" displaying a version number  
- ✅ The "Current Default Markdowns" table populated with data

If you see error messages, refer to the [Troubleshooting](#9-troubleshooting) section.

## 2.5 Shutting Down

**Packaged Version:**
- Close both console windows (SQL Proxy and Dashboard)

**Development Version:**
- Close each of the three command/PowerShell windows
- Or press `Ctrl+C` in each window to stop the service

---

# 3. Dashboard Overview

## 3.1 Main Sections

The dashboard is divided into several key areas:

```
┌─────────────────────────────────────────────────────────┐
│  HEADER: Waste Tuning Dashboard                         │
│  [Settings ⚙️]                                          │
├─────────────────────────────────────────────────────────┤
│  ACTIVE CONFIG VERSION                                  │
│  • Shows current active version details                 │
│  • Shows MAX version if different from active           │
├─────────────────────────────────────────────────────────┤
│  CURRENT DEFAULT MARKDOWNS (Main Data Table)            │
│  • Filters & Checkboxes                                 │
│  • Decision Summary: Leave | Change | Reset | Undecided │
│  • Interactive Data Grid                                │
│  • [Refresh Data] [Load Proposed Changes]               │
│  • [Save Session] [Reset Unsaved Session Changes]       │
│  • [Reset ALL Planned Changes]                          │
├─────────────────────────────────────────────────────────┤
│  TUNING ACTIONS                                         │
│  [Clone Config] [Tune Default %] [Activate Config]      │
├─────────────────────────────────────────────────────────┤
│  EXECUTE QUERY (SELECT)                                 │
│  • SQL text box for custom SELECT queries               │
├─────────────────────────────────────────────────────────┤
│  QUICK EXAMPLES                                         │
│  • Sample SQL queries for reference                     │
└─────────────────────────────────────────────────────────┘
```

## 3.2 Active Config Version Panel

Displays the currently active configuration version with details:

- **VersionID**: The numeric identifier
- **VersionName**: Human-readable name
- **Comment**: Description of the version
- **CreatedBy / CreatedOnUTC**: Who created it and when
- **IsActive**: Should always be 1 (true) for this panel

If the MAX version is different from the active version, it will also be displayed below.

## 3.3 Current Default Markdowns Table

The main data grid showing all PPG Clusters and their markdown configurations:

| Column Type | Description |
|-------------|-------------|
| **Hierarchy Columns** (Frozen) | Level 4, 3, 2, 1 names and PPGClusterID - always visible |
| **Default Scalar** | The baseline scalar value |
| **Generated Scalar** | The system-generated scalar value |
| **Configured Scalar** | The current configured scalar value |
| **Configured Value** | The config value currently applied |
| **Configured Type** | The operation type for the current config |
| **DTE1 Scalar** | Days-to-Expiry 1 scalar value |
| **D Columns** (Color-coded) | Markdown values by Days-to-Expiry group |
| **Action Column** | Leave/Change/Reset buttons |
| **Operation Column** | Subtract/Add/Multiply/Divide/Override |
| **Value Column** | The config value to apply |

### Understanding D Columns

D columns represent markdown percentages for different Days-to-Expiry (DTE) groups:

| Column | Color | Meaning |
|--------|-------|---------|
| D0_xxx | 🟢 Green | 0 days to expiry |
| D1_xxx | 🔵 Blue | 1 day to expiry |
| D2_xxx | 🟠 Orange | 2 days to expiry |
| D3_xxx | 🟣 Purple | 3 days to expiry |
| D4_xxx | 🔴 Red | 4 days to expiry |
| D5_xxx | 🔵 Cyan | 5 days to expiry |
| D6_xxx | 🟡 Amber | 6 days to expiry |
| D7_xxx | 🟢 Lime | 7 days to expiry |

## 3.4 Tuning Actions Panel

Three action buttons for common operations:

- **Clone Config Version**: Create a copy of a version for editing
- **Tune Default Percentages**: Apply your tuning decisions
- **Activate Config Version**: Make a version the active one

## 3.5 Execute Query Panel

Allows you to run custom SELECT queries against the database.

## 3.6 Quick Examples Panel

Shows sample SQL queries you can copy and use.

---

# 4. The Tuning Workflow

## 4.1 Overview

The tuning workflow follows these steps:

```
1. FILTER → 2. REVIEW → 3. DECIDE → 4. CONFIGURE → 5. EXECUTE
```

## 4.2 Step 1: Filter the Data

Use the filter controls to narrow down to the PPG Clusters you want to tune:

**Dropdown Filters:**
- Hierarchy Level 4 (e.g., Department)
- Hierarchy Level 3 (e.g., Category)
- Hierarchy Level 2 (e.g., Subcategory)
- Hierarchy Level 1 (e.g., Segment)

**Text Search:**
- PPGClusterID: Enter a specific cluster ID

**Quick Actions:**
- Click **"Clear Filters"** to reset all filters

## 4.3 Step 2: Review Current Values

- **Sort columns** by clicking the header (click again to reverse)
- D columns default to descending (highest values first)
- Look for outliers or values that need adjustment

## 4.4 Step 3: Make Decisions

For each row, click one of three buttons:

| Button | When to Use | Effect |
|--------|-------------|--------|
| **Leave** | Keep current config | No changes made |
| **Change** | Modify the value | Enables Operation & Value fields |
| **Reset** | Remove existing config | Deletes from DefaultPercentage table |

**Note:** The Reset button is only enabled for rows that have at least one non-zero D column value. This is used as a proxy for rows that have active markdown data worth resetting. Rows where all D columns are zero or null will have Reset disabled.

## 4.5 Step 4: Configure Changes

For rows marked as **"Change"**:

1. **Select Operation:**
   - **Subtract**: Reduce by the value
   - **Add**: Increase by the value
   - **Multiply**: Multiply by the value
   - **Divide**: Divide by the value
   - **Override**: Replace with the exact value

2. **Enter Value:**
   - Type the numeric value in the Value field

**Pro Tip:** Use "Apply to All" in the Tune modal to set the same operation/value for all Change rows.

## 4.6 Step 5: Execute Tuning

1. Click **"Tune Default Percentages"** button
2. Review your selections in the modal:
   - **Change table** (blue header): Rows to be modified
   - **Reset table** (red header): Rows to be deleted
3. Verify the Version ID
4. Add/edit comments if needed (max 214 characters)
5. Click **"Tune"** to execute

**⚠️ Warning:** If tuning the active version, you'll see a confirmation dialog. It's recommended to tune a cloned version instead.

## 4.7 Session Management

Your tuning decisions can be saved and resumed across browser sessions using the buttons below the table.

| Button | What It Does |
|--------|--------------|
| **Refresh Data** | Reloads the markdown data from the database |
| **Load Proposed Changes** | Fetches your previously saved decisions from the database. If any rows differ between your saved session and the current database config, a conflict resolution dialog appears so you can choose which values to keep row-by-row |
| **Save Session** | Saves all current decisions (Leave/Change/Reset, operation, and value) to the database for the max config version |
| **Reset Unsaved Session Changes** | Discards any decisions you have made since your last save and reverts to the last saved session state |
| **Reset ALL Planned Changes** | Permanently deletes all saved session data for the max version **and** resets its config entries to match the active version. Requires confirmation. Cannot be undone |

**When is Load Proposed Changes available?**

The Load Proposed Changes button is only meaningful when the Max Version differs from the Active Version. If they are the same, the button will alert you that there are no proposed changes to load.

**Conflict Resolution**

If your saved session decisions conflict with what is currently in the database (for example, the database config was updated by someone else since you last saved), a conflict dialog appears. For each conflicting row you must choose:
- **Use Previous Session Data** — keep your saved decision
- **Use Database Data** — use the current database state instead

You can apply the same choice to all rows at once, or resolve them one at a time. The **Confirm** button is disabled until all rows are resolved.

---

# 5. Tuning Actions

## 5.1 Clone Config Version

Creates a copy of an existing config version for safe editing.

**Steps:**
1. Click **"Clone Config Version"**
2. The Source Version defaults to the current active version
3. Modify the New Version Name if desired
4. Add a Comment describing the purpose
5. Click **"Clone"**

**Best Practice:** Always clone before tuning to preserve the original.

## 5.2 Tune Default Percentages

Applies your tuning decisions to the database.

**What it does:**
- **Change rows**: Executes `config.csp_BulkConfigUpsertDefaultPercentage`
- **Reset rows**: Deletes from `config.DefaultPercentage` table

**The Modal:**
- Shows separate tables for Change and Reset rows
- Allows editing Operation, Value, and Comment per row
- "Apply to All" section for bulk updates
- Version ID selector (defaults to Max Version)

## 5.3 Activate Config Version

Makes a version the active production configuration.

**Steps:**
1. Click **"Activate Config Version"**
2. Select the version from the table or enter the ID
3. Click **"Activate"**
4. Confirm the action in the dialog

**⚠️ Caution:** This immediately affects production. Double-check the version number!

---

# 6. Executing Custom Queries

## 6.1 The Execute Query Panel

Located near the bottom of the dashboard, this panel allows you to run SELECT queries.

**Security Note:** Only SELECT queries are allowed. The following are blocked:
- INSERT, UPDATE, DELETE
- DROP, TRUNCATE, ALTER, CREATE
- EXEC, EXECUTE
- MERGE, GRANT, REVOKE

## 6.2 Running a Query

1. Enter your SQL in the text box
2. Click **"Run Query"**
3. View results in the table below

**Example Queries:**

```sql
-- View all config versions
SELECT * FROM [WASTE_HEB].[config].[ConfigVersions]

-- View recent scalar percentages
SELECT TOP 10 * FROM [WASTE_HEB].wmd.ScalarFinalPercentage
```

---

# 7. Settings & Configuration

## 7.1 Accessing Settings

Click the **Settings** button (⚙️) in the header to open the Settings modal.

## 7.2 Database Connection Tab

View and modify your database connection settings:

- **SQL Server**: The server hostname (e.g., `hebwmddev-sqlvm.ri-team.net`)
- **Database**: The database name (e.g., `WASTE_HEB`)
- **Port**: Usually `1433`

**Note:** After saving changes, you must restart the dashboard for them to take effect.

**Tip:** If the dashboard fails to connect, open Settings - it will still show the current configuration so you can fix any errors.

## 7.3 Query Editor Tab

View and modify the built-in SQL queries used by the dashboard.

### Editing a Query

1. Select a query from the **Select Query** dropdown
2. Edit the SQL in the text area — the label shows **(modified)** when there are unsaved changes
3. Use the buttons at the bottom to save or discard your changes

### Button Reference

| Button | Description |
|--------|-------------|
| **Reset All to Defaults** | Restores every query to its original built-in version |
| **Reset This Query** | Restores only the selected query to its default |
| **Close** | Closes the Settings modal without saving |
| **Save Query** | Saves your changes to disk (persists across dashboard restarts) |

### Saving a Query as the New Default

When you want your edited query to become the permanent default (so "Reset This Query" restores to your version instead of the original):

1. Make your edits to the SQL
2. Check the **"Also save as default"** checkbox (right-aligned beneath the Save Query button)
3. The Save button will turn green and read **"Save as Default"**
4. Click **"Save as Default"**

The checkbox is only enabled when there are unsaved changes. It clears automatically after a successful save.

---

# 8. Best Practices

## 8.1 Before Tuning

✅ **Always clone first** - Never tune the active version directly  
✅ **Filter carefully** - Make sure you're looking at the right data  
✅ **Review decisions** - Check the summary counts before executing  
✅ **Document changes** - Use meaningful comments  

## 8.2 During Tuning

✅ **Work in batches** - Don't try to tune everything at once  
✅ **Use "Show Only 'Change' rows"** - Focus on what you're modifying
✅ **Double-check Reset rows** - These delete existing configs  

## 8.3 After Tuning

✅ **Verify changes** - Run a SELECT query to confirm  
✅ **Test before activating** - Ensure the new version works correctly  
✅ **Communicate** - Let the team know before activating a new version  

---

# 9. Troubleshooting

## 9.1 Dashboard Won't Load

**Symptom:** Browser shows error or blank page

**Solutions:**

*Packaged Version:*
1. Check that both windows are open (SQL Proxy and Dashboard)
2. Verify you're connected to VPN
3. Try refreshing the browser (Ctrl+F5)
4. Close both windows and restart via "Start Dashboard.bat"

*Development Version:*
1. Check that all three services are running (proxy, API, frontend)
2. Verify you're connected to VPN
3. Try refreshing the browser (Ctrl+F5)
4. Restart all services

## 9.2 "Server is not found or not accessible"

**Symptom:** Cannot connect to database server

**Solutions:**
1. **Check VPN connection** - You must be connected to access the database
2. Test connectivity: Open Command Prompt and run `ping hebwmddev-sqlvm.ri-team.net`
3. If ping fails, reconnect to VPN and try again

## 9.3 "Connection Refused" Error

**Symptom:** Red error messages about connection

**Solutions:**
1. Verify the SQL Proxy is running on port 8001
2. Verify the API/Dashboard is running on port 8000
3. Check Windows Firewall settings
4. Ensure database server is accessible

## 9.4 "Authentication Failed" Error

**Symptom:** Cannot connect to database

**Solutions:**
1. Verify you entered the correct username format (e.g., `john.d`)
2. Check that your password is correct
3. Verify your ri-team account has database permissions
4. Contact IT if permissions need to be granted

## 9.5 Dashboard Loads Slowly

**Symptom:** Takes a long time to see data

**Understanding the timing:**
- **First load after starting**: Slower due to Windows Authentication (Kerberos)
- **Subsequent loads**: Should be faster (connections are cached)
- **The markdown query**: Takes ~10 seconds due to complex joins - this is normal

**Check the SQL Proxy window** for timing information:
```
[PERF] Connection took 2.06s (SLOW!)     ← First connection
[PERF] Batch execute: 9.92s              ← Query execution
[PERF] Batch complete: 10.39s (rows=105) ← Total time
```

## 9.6 "Query Blocked" Error

**Symptom:** Error when running a query in Execute Query panel

**Solutions:**
1. The Execute Query panel only allows SELECT statements
2. Use the Tuning Actions buttons for modifications
3. Ensure your query starts with SELECT or WITH

## 9.7 Table Data Not Loading

**Symptom:** "Current Default Markdowns" table is empty

**Solutions:**
1. Check the browser console for errors (F12)
2. Verify the Dashboard window is showing no errors
3. Click the **"Refresh Data"** button below the table
4. Restart the dashboard

## 9.8 Settings Form is Empty

**Symptom:** Opening Settings shows blank fields

**Solutions:**
1. The Settings modal will attempt to fetch config from the API
2. If successful, fields will populate automatically
3. If the API is unreachable, enter the values manually
4. Enter the connection values manually in the Settings form — do not edit `config.ini` directly, as doing so bypasses the query database-name update and will break all SQL queries

## 9.9 Services Won't Start

**Symptom:** Error when running start scripts

*Packaged Version:*
1. **"ODBC Driver not found"**: Install ODBC Driver 17 or 18 for SQL Server from Microsoft (Driver 18 is included with SSMS 21)
2. **Antivirus blocking**: The dashboard uses a bundled `python.exe` rather than custom executables, which avoids most antivirus false positives. If Windows Defender still blocks it, the folder may need to be added as an exclusion by IT.
3. **Port in use**: Another application may be using port 8000 or 8001

*Development Version:*
1. **Proxy won't start**: Check Python is installed, run `pip install -r requirements.txt`
2. **API won't start**: Same as above, check for port conflicts on 8000
3. **Frontend won't start**: Check Node.js is installed, run `npm install` in frontend folder

## 9.10 Getting Help

If you encounter issues not covered here:

1. Check the `AUTHENTICATION_ISSUE.md` file for auth problems
2. Review the API docs at `http://localhost:8000/docs`
3. Contact the development team with:
   - Screenshot of the error
   - Steps to reproduce
   - Contents of the command prompt windows

---

# Quick Reference Card

## Username Format

**Format:** `firstname.lastinitial`

| Name | Username |
|------|----------|
| John Doe | `john.d` |
| Jane Smith | `jane.s` |
| Bob Johnson | `bob.j` |

## Starting the Dashboard

### Packaged Version (End Users)
```
1. Extract HEB-Waste-Dashboard.zip to a local drive
2. Double-click "Start Dashboard.bat"
3. Enter username (e.g., john.d)
4. Enter password
5. Wait for proxy to show "running"
6. Press any key - browser opens automatically
```

### Development Version
```
1. Double-click start.bat
2. Enter username (e.g., john.d)
3. Enter password
4. Wait for proxy to show "running"
5. Press any key to continue
6. Open http://localhost:5173
```

## Service URLs

| Version | Dashboard URL |
|---------|---------------|
| Packaged | http://localhost:8000 |
| Development | http://localhost:5173 |

| Service | URL |
|---------|-----|
| API Docs | http://localhost:8000/docs |
| API Health | http://localhost:8000/api/health |

## Decision Button Colors

| Button | Inactive | Active |
|--------|----------|--------|
| Leave | Gray | Green |
| Change | Gray | Red |
| Reset | Gray (disabled) | Dark Gray |

Note: When a row is marked Change, the entire Action cell background turns yellow. The Change button itself turns red.

## Operation Types

| Code | Operation | Example |
|------|-----------|---------|
| S | Subtract | Value - X |
| A | Add | Value + X |
| M | Multiply | Value × X |
| D | Divide | Value ÷ X |
| O | Override | Value = X |

## Query Editor — Save Options

| Action | How |
|--------|-----|
| Save query (persists across restarts) | Edit SQL → click **Save Query** |
| Save as new permanent default | Edit SQL → check **"Also save as default"** → click **Save as Default** |
| Restore this query to default | Click **Reset This Query** |
| Restore all queries to defaults | Click **Reset All to Defaults** |

## File Locations

### Packaged Version
| Item | Path |
|------|------|
| Start Script | `HEB-Waste-Dashboard\Start Dashboard.bat` |
| Python Runtime | `HEB-Waste-Dashboard\python\` |
| SQL Proxy | `HEB-Waste-Dashboard\sql_proxy.py` |
| Dashboard | `HEB-Waste-Dashboard\main.py` |
| Config | `HEB-Waste-Dashboard\config.ini` |

### Development Version
| Item | Path |
|------|------|
| Start Script | `azure-sql-dashboard\start.bat` |
| Proxy Script | `azure-sql-dashboard\backend\start_proxy.bat` |
| API Script | `azure-sql-dashboard\backend\start_api.bat` |
| Config | `azure-sql-dashboard\backend\config.ini` |
| Frontend | `azure-sql-dashboard\frontend\` |

## Performance Monitoring

Watch the SQL Proxy console for timing:
```
[PERF] Connection took 2.06s (SLOW!)  ← Normal for first connection
[PERF] Batch execute: 9.92s           ← Database query time
[PERF] Batch complete: 10.39s         ← Total including network
```

---

*End of Training Guide*

**Document Version:** 1.7
**For questions or updates, contact the Retail Insight team.**
