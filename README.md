# Azure SQL Dashboard (HEB Waste Tuning)

A full-stack dashboard for interacting with Azure SQL Server, specifically designed for the HEB Waste Management tuning workflow. Supports Windows Integrated Authentication via a proxy service.

## Architecture

```
React Dashboard (Port 5173 dev / Port 8000 packaged)
    ↓ HTTP/REST
FastAPI Backend (Port 8000)
    ↓ HTTP/REST
SQL Proxy Service (Port 8001)
    ↓ Windows Auth (via runas /netonly)
Azure SQL Server (hebwmddev-sqlvm.ri-team.net)
```

## Features

### Backend (Python + FastAPI)
- Windows Integrated Authentication via proxy service
- Prompts for domain username at startup (no hardcoded credentials)
- Secure connection to Azure SQL Server
- RESTful API endpoints for queries and updates
- **Batch query support** for complex scripts (temp tables, variables, stored procedures)
- **Performance monitoring** with timing diagnostics for connections and queries
- Parameterized queries to prevent SQL injection
- Auto-generated API documentation at `/docs`

### Frontend (React + Vite)
- Clean, modern dashboard UI tailored for HEB Waste Tuning
- **Config Version Management**: View active and max config versions
- **Tuning Actions**: One-click buttons for common operations
  - Clone Config Version (with direct execution)
  - Tune Default Percentages (with direct execution)
  - Activate Config Version (with confirmation dialog)
- **Preset query library** with categorized queries
- **Execute SELECT queries** with real-time results (protected - SELECT only)
- **Settings Modal** with database configuration (auto-populates even on connection failure)
- Quick example queries for reference

### Security Features
- **Dynamic authentication**: Prompts for username at startup (format: `firstname.lastinitial`, e.g., `john.d`)
- **Execute Query protection**: Only SELECT and WITH...SELECT queries allowed
- **Blocked operations**: INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER, CREATE, EXEC, EXECUTE, MERGE, GRANT, REVOKE
- **Active version protection**: Warning confirmation when tuning the active config version
- **Activation confirmation**: Required confirmation before activating a config version

### MarkdownTable Component (Excel-style data grid)
- **Freeze panes**: First 5 columns frozen (hierarchy fields always visible)
- **Sticky header**: Header row always visible when scrolling
- **Color-coded D columns** by DaysToExpiry group:
  - D0 = green, D1 = blue, D2 = orange, D3 = purple, D4 = red, D5 = cyan, D6 = amber, D7 = lime
- **Smart headers**: D columns display parsed info (Days to Expiry, Hours to Sell, Minimum Qty)
- **Filtering**:
  - Dropdown filters for all hierarchy levels (4, 3, 2, 1)
  - Text search for PPGClusterID
  - Clear Filters button
- **Tuning workflow**:
  - Action column with **Leave/Change/Reset** buttons per row
  - Reset button enabled only for rows with existing config (non-zero D values)
  - **Operation column**: Select Subtract/Add/Multiply/Divide/Override (enabled when Change selected)
  - **Value column**: Enter config value (enabled when Change selected)
  - Decision summary showing **Leave/Change/Reset/Undecided** counts
  - "Hide Leave rows" checkbox to hide rows marked as Leave
  - "Hide Change rows" checkbox to hide rows marked as Change
  - "Hide Reset rows" checkbox to hide rows marked as Reset
  - "Show Only Change rows" checkbox to see only rows marked for tuning
  - "Show Only Reset rows" checkbox to see only rows marked for reset
  - "Reset Planned Changes" button to clear all decisions
- **Sortable columns**:
  - Click any column header to sort
  - Toggle between ascending and descending
  - D columns default to descending (highest values first)
  - Visual indicators on sorted column
  - "Clear Sort" button to reset
- D column and DTE1_Scalar values rounded to whole numbers

## Prerequisites

### For Development
- Python 3.8 or higher
- Node.js 16 or higher
- ODBC Driver 17 for SQL Server ([Download here](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server))
- Windows domain account (ri-team) with database access
- VPN connection to HEB network (if working remotely)

### For End Users (Packaged Version)
- Windows 10/11
- ODBC Driver 17 for SQL Server
- VPN connection to HEB network
- ri-team domain account

## Quick Start (Development)

Use the one-click launcher:
```bash
start.bat
```

This will:
1. Open `start_proxy.bat` which prompts for your ri-team username (e.g., `john.d`)
2. Windows will prompt for your domain password
3. **Wait** for the proxy to show "Uvicorn running on http://0.0.0.0:8001"
4. Press any key in the launcher to continue
5. The API and Frontend will start automatically
6. Open your browser to: **http://localhost:5173**

## Manual Setup Instructions

### 1. Configure Backend

Navigate to the backend directory:
```bash
cd Documents/azure-sql-dashboard/backend
```

Edit the `.env` file and set your database name:
```env
SQL_DATABASE=YourActualDatabaseName
```

Install Python dependencies:
```bash
pip install -r requirements.txt
```

### 2. Start SQL Proxy Service

Start the SQL Proxy Service with your domain credentials:
```bash
start_proxy.bat
```

You will be prompted for:
1. Your ri-team username (format: `firstname.lastinitial`, e.g., `john.d`)
2. Your domain password

Wait for the message: `Uvicorn running on http://0.0.0.0:8001`

### 3. Start Backend Server

In a new terminal:
```bash
start_api.bat
```

Wait for: `Uvicorn running on http://0.0.0.0:8000`

The API will be available at:
- Main API: `http://localhost:8000`
- Interactive docs: `http://localhost:8000/docs`

### 4. Setup Frontend

Open a new terminal and navigate to the frontend directory:
```bash
cd Documents/azure-sql-dashboard/frontend
```

Install dependencies:
```bash
npm install
```

### 5. Start Frontend

```bash
npm run dev
```

The dashboard will be available at `http://localhost:5173`

## Usage

### Tuning Workflow

The main tuning interface displays markdown percentages across all PPG Clusters:

1. **View Data**: The Current Default Markdowns table loads automatically with freeze panes and color-coded columns
2. **Filter**: Use hierarchy dropdowns or search by PPGClusterID
3. **Sort**: Click any column header to sort (great for finding highest markdown values)
4. **Make Decisions**: Click "Leave", "Change", or "Reset" for each row
   - **Leave**: Keep current config (no changes)
   - **Change**: Modify the config value with selected operation
   - **Reset**: Remove existing config from DefaultPercentage table (only available for rows with existing config)
5. **Configure Changes**: For rows marked "Change", select Operation (Subtract/Add/Multiply/Divide/Override) and enter Value directly in the table
6. **Focus View**: Use filter checkboxes to show/hide rows by decision type
7. **Track Progress**: Watch the decision summary counts update in real-time
8. **Execute Tuning**: Click "Tune Default Percentages" button to open the tuning modal
9. **Review & Execute**: Review your selections in the modal (separate tables for Change and Reset rows) and click "Tune" to execute

### Tuning Actions

The Tuning Actions section provides quick access to common operations:

- **Clone Config Version**: Create a new config version by cloning an existing one
- **Tune Default Percentages**: Apply tuning changes to rows marked as "Change" and delete configs for rows marked as "Reset"
- **Activate Config Version**: Set a config version as the active version (requires confirmation)

**Safety Features:**
- Tuning the active version shows a warning confirmation dialog
- Activating a version requires explicit confirmation

### Execute Queries (SELECT)

1. Enter your SQL query in the "Execute Query" panel
2. Click "Run Query"
3. View results in a formatted table

**Note:** This panel only allows SELECT queries. Dangerous operations (INSERT, UPDATE, DELETE, etc.) are blocked for safety.

**Example:**
```sql
SELECT * FROM [WASTE_HEB].[config].[ConfigVersions]
```

### Settings

Click the **Settings** button (⚙️) to:
- **Database Connection**: View/edit server, database, and port settings
- **Query Editor**: Modify the built-in SQL queries

The Settings modal will pre-populate with current values even if the database connection is failing, making it easy to fix connection issues.

## API Endpoints

The backend exposes these endpoints:

- `GET /` - Health check (or serves frontend in packaged mode)
- `GET /api/health` - Detailed health with DB connectivity
- `GET /api/config` - Get current database configuration
- `POST /api/config` - Update database configuration
- `GET /api/tables` - List all tables
- `GET /api/tables/{table_name}/schema` - Get table schema
- `POST /api/query` - Execute SELECT query
- `POST /api/query/batch` - Execute batch queries (temp tables, variables, stored procedures)
- `POST /api/update` - Execute INSERT/UPDATE/DELETE
- `GET /api/queries` - Get saved queries
- `PUT /api/queries/{id}` - Update a saved query
- `POST /api/queries/reset` - Reset queries to defaults

Full API documentation available at `http://localhost:8000/docs`

## Performance Monitoring

The SQL Proxy includes built-in performance diagnostics. Watch the proxy console for timing information:

```
[PERF] Connection took 2.06s (SLOW!)     ← First connection (Kerberos auth)
[PERF] Batch query started...
[PERF] Batch execute: 9.92s              ← SQL Server execution time
[PERF] Batch complete: 10.39s (rows=105) ← Total time including fetch
```

**Understanding the timings:**
- **Connection slow (>1s)**: Normal for first connection due to Windows Authentication
- **Execute slow**: Query performance issue on database side
- **Fetch slow**: Large result set or network latency

## Security Notes

**Authentication:** Uses Windows domain credentials via `runas /netonly`. Username is entered at startup (not hardcoded).

**SQL Injection Prevention:** All queries use parameterized statements.

**Query Protection:** Execute Query panel only allows SELECT statements; dangerous operations are blocked at the frontend.

**No Credentials in Code:** Database connection uses Windows auth tokens passed via runas.

**Confirmation Dialogs:** Critical operations (activate version, tune active version) require user confirmation.

**Development Use:** This is designed for development/admin use. For production, add:
- API authentication/authorization
- Rate limiting
- Input validation
- Audit logging
- Read-only database user for queries

## Troubleshooting

### "ODBC Driver not found"
Install [ODBC Driver 17 for SQL Server](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server)

### "Server is not found or not accessible"
- Ensure you're connected to VPN
- Verify the database server is running
- Check network connectivity: `ping hebwmddev-sqlvm.ri-team.net`

### "Authentication failed"
- Verify you entered the correct username format (e.g., `john.d`)
- Check that your password is correct
- Verify your domain account has database access
- See `AUTHENTICATION_ISSUE.md` for detailed troubleshooting

### "Connection refused"
- Verify the SQL Proxy Service is running on port 8001
- Verify the backend is running on port 8000
- Check firewall settings
- Ensure database server is accessible from your network

### "Proxy slow to respond" or timeout errors
- The first database connection can take 10-30 seconds
- The API will retry automatically up to 3 times
- If it keeps failing, check the SQL Proxy window for errors

### Dashboard loads slowly
- Check the SQL Proxy console for `[PERF]` timing messages
- First load after restart is slower due to Kerberos authentication
- Subsequent loads should be faster (connection caching)

### "Query blocked" error
- The Execute Query panel only allows SELECT queries
- Use the Tuning Actions buttons for INSERT/UPDATE/DELETE operations
- For testing queries, they will be written to the textbox (Tune Default Percentages)

### Settings form is empty
- Open Settings and it will attempt to fetch current config from the API
- If API is unreachable, you can manually enter the connection details

### "Module not found" errors
Backend: `pip install -r requirements.txt`
Frontend: `npm install`

## Project Structure

```
azure-sql-dashboard/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── db_proxy.py          # Database proxy client (talks to sql_proxy)
│   ├── sql_proxy.py         # SQL Proxy Service (runs with domain creds)
│   ├── config.py            # Configuration settings
│   ├── config.ini           # Database connection settings
│   ├── queries.json         # Saved query definitions
│   ├── requirements.txt     # Python dependencies
│   ├── start_api.bat        # Start main API server
│   ├── start_proxy.bat      # Start SQL proxy (prompts for username)
│   └── static/              # Built frontend files (for packaged version)
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main React component with modals
│   │   ├── MarkdownTable.jsx # Interactive data grid with tuning workflow
│   │   ├── SettingsModal.jsx # Settings dialog for config & queries
│   │   ├── queries.js       # Preset query library
│   │   ├── main.jsx         # React entry point
│   │   └── index.css        # Styles
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── build/                   # Build scripts for distribution
│   ├── build_all.bat        # Main build script
│   ├── sql_proxy.spec       # PyInstaller config for SQL Proxy
│   ├── dashboard.spec       # PyInstaller config for Dashboard
│   └── launcher_template.bat # Template for user launcher
├── dist/                    # Distribution output folder
├── setup.bat                # One-click dependency setup
├── start.bat                # One-click launch script
├── README.md                # This file
├── TRAINING_GUIDE.md        # User training documentation
├── QUICKSTART.md            # Quick setup guide
├── PROXY_SETUP.md           # Proxy configuration guide
└── AUTHENTICATION_ISSUE.md  # Auth troubleshooting guide
```

## Building for Distribution

The dashboard can be packaged into standalone executables that end users can run without installing Python or Node.js.

### Build Requirements (on build machine only)
- Python 3.8+ with pip
- Node.js 16+ with npm
- PyInstaller (`pip install pyinstaller`)

### Building

1. Navigate to the `build` folder
2. Run `build_all.bat`
3. Wait for the build to complete (5-10 minutes)
4. Distribution package will be in `dist/HEB-Waste-Dashboard/`

### Distribution Package

The build creates a folder containing:
```
HEB-Waste-Dashboard/
├── Start Dashboard.bat    ← Users double-click this
├── sql_proxy.exe          ← Database authentication service
├── dashboard.exe          ← API + Frontend combined
├── static/                ← Web interface files
└── README.txt             ← Quick start for users
```

### End User Requirements
- Windows 10/11
- ODBC Driver 17 for SQL Server (usually pre-installed)
- VPN connection to HEB network
- ri-team domain account

### End User Experience

1. Extract the zip file
2. Double-click "Start Dashboard.bat"
3. Enter ri-team username (e.g., `john.d`)
4. Enter domain password
5. Wait for proxy to start, press any key
6. Browser opens to `http://localhost:8000`

See `build/BUILD_README.md` for detailed build instructions.

## Tech Stack

**Backend:**
- FastAPI - Modern Python web framework
- pyodbc - SQL Server connectivity
- uvicorn - ASGI server
- pydantic-settings - Configuration management
- requests - HTTP client for proxy communication
- PyInstaller - Executable packaging

**Frontend:**
- React 18 - UI library
- Vite - Build tool and dev server
- Axios - HTTP client

## Recent Updates

### Version 1.4 (March 2026)
- **Performance monitoring**: SQL Proxy now logs timing for connections and queries
- **Fixed double query execution**: Removed React StrictMode to prevent queries running twice in development
- **Settings modal improvement**: Form now pre-populates even when database connection fails
- **Better error handling**: More informative error messages throughout

## License

Internal tool for Retail Insight / HEB Waste Management team.

---

**Questions?** Check the API docs at `http://localhost:8000/docs` or review the inline code comments!
