# 🚀 Quick Start Guide

Get your Azure SQL Dashboard up and running in 3 steps!

## Step 1: Install Dependencies

**Prerequisites:**
- Python 3.8+ installed
- Node.js 16+ installed  
- ODBC Driver 17 for SQL Server ([Download](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server))

**Run the setup script:**
```bash
setup.bat
```

Or manually:
```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

## Step 2: Configure Database

Edit `backend/.env` and set your database name:

```env
SQL_DATABASE=YourActualDatabaseName
```

Keep the rest as-is - it's already configured for your server!

## Step 3: Launch!

**Easy way:**
```bash
start.bat
```

**Manual way:**
```bash
# Terminal 1 - Backend
cd backend
python main.py

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## First Run

1. Backend starts and opens a browser for Azure AD login
2. Sign in with your Microsoft account
3. Backend connects to the database
4. Open `http://localhost:3000` in your browser
5. Start running queries! 🎉

## Example Query

Try this in the Query panel:
```sql
SELECT TABLE_NAME 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_TYPE = 'BASE TABLE'
```

This will show all your database tables!

## Troubleshooting

**"Module not found"** → Run `setup.bat` again

**"ODBC Driver not found"** → Install ODBC Driver 17

**"Authentication failed"** → Make sure your Microsoft account has database access

**"Connection refused"** → Check if backend is running on port 8000

---

**That's it!** Check the full README.md for detailed documentation.
