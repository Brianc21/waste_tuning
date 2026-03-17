"""
SQL Proxy Service - Runs with domain credentials to access SQL Server.

This service must be run with domain credentials using:
    runas /netonly /user:ri-team\\YOUR_USERNAME "cmd /k cd /d [PATH] && python sql_proxy.py"

It connects to SQL Server using Windows Authentication and exposes a REST API
that the main application can call.
"""
import os
import sys
import time
import configparser
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import pyodbc
import uvicorn


def get_base_path():
    """Get the base path for config files."""
    if getattr(sys, 'frozen', False):
        # Running as packaged exe
        return os.path.dirname(sys.executable)
    else:
        # Running in development
        return os.path.dirname(os.path.abspath(__file__))


def load_config():
    """Load configuration from config.ini file."""
    base_path = get_base_path()
    config_path = os.path.join(base_path, 'config.ini')
    
    # Default values
    defaults = {
        'server': 'hebwmddev-sqlvm.ri-team.net',
        'database': 'WASTE_HEB',
        'port': '1433'
    }
    
    if os.path.exists(config_path):
        config = configparser.ConfigParser()
        config.read(config_path)
        
        if 'database' in config:
            return {
                'server': config.get('database', 'server', fallback=defaults['server']),
                'database': config.get('database', 'database', fallback=defaults['database']),
                'port': config.get('database', 'port', fallback=defaults['port'])
            }
    
    print(f"[WARNING] Config file not found at {config_path}")
    print(f"[WARNING] Using default values: {defaults['server']}/{defaults['database']}")
    return defaults


# Load configuration
CONFIG = load_config()
SQL_SERVER = CONFIG['server']
SQL_DATABASE = CONFIG['database']
SQL_PORT = CONFIG['port']

# Connection string using Windows Authentication
CONNECTION_STRING = (
    f"DRIVER={{ODBC Driver 17 for SQL Server}};"
    f"SERVER={SQL_SERVER},{SQL_PORT};"
    f"DATABASE={SQL_DATABASE};"
    f"Encrypt=yes;"
    f"TrustServerCertificate=yes;"
    f"Trusted_Connection=yes;"  # Windows Authentication
)

app = FastAPI(
    title="SQL Proxy Service",
    description="Proxy service for SQL Server with Windows Authentication",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class QueryRequest(BaseModel):
    query: str
    params: Optional[List[Any]] = None


class QueryResponse(BaseModel):
    success: bool
    data: Optional[List[Dict[str, Any]]] = None
    rows: Optional[int] = None
    error: Optional[str] = None


def get_connection():
    """Get a database connection."""
    start = time.time()
    try:
        conn = pyodbc.connect(CONNECTION_STRING)
        elapsed = time.time() - start
        if elapsed > 1.0:
            print(f"[PERF] Connection took {elapsed:.2f}s (SLOW!)")
        return conn
    except pyodbc.Error as e:
        raise HTTPException(
            status_code=500,
            detail=f"Database connection failed: {str(e)}"
        )


@app.get("/")
async def root():
    """Health check."""
    return {
        "status": "ok",
        "service": "SQL Proxy",
        "message": "Running with Windows Authentication"
    }


@app.get("/health")
async def health_check():
    """Check database connectivity."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1 AS health_check")
        cursor.fetchone()
        cursor.close()
        conn.close()
        
        return {
            "status": "healthy",
            "database": "connected",
            "server": SQL_SERVER,
            "database_name": SQL_DATABASE
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e)
        }


@app.get("/config")
async def get_config():
    """Return current configuration (for display in UI)."""
    return {
        "server": SQL_SERVER,
        "database": SQL_DATABASE,
        "port": SQL_PORT
    }


@app.post("/query")
async def execute_query(request: QueryRequest) -> QueryResponse:
    """
    Execute a SELECT query and return results.
    
    Example:
    {
        "query": "SELECT * FROM users WHERE id = ?",
        "params": [1]
    }
    """
    total_start = time.time()
    
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Execute query
        exec_start = time.time()
        if request.params:
            cursor.execute(request.query, request.params)
        else:
            cursor.execute(request.query)
        exec_time = time.time() - exec_start
        
        # Get column names
        columns = [column[0] for column in cursor.description] if cursor.description else []
        
        # Fetch all rows and convert to list of dicts
        fetch_start = time.time()
        results = []
        for row in cursor.fetchall():
            results.append(dict(zip(columns, row)))
        fetch_time = time.time() - fetch_start
        
        cursor.close()
        conn.close()
        
        total_time = time.time() - total_start
        if total_time > 1.0:
            query_preview = request.query[:80].replace('\n', ' ')
            print(f"[PERF] Query: {total_time:.2f}s (exec={exec_time:.2f}s, fetch={fetch_time:.2f}s, rows={len(results)})")
            print(f"       SQL: {query_preview}...")
        
        return QueryResponse(
            success=True,
            data=results,
            rows=len(results)
        )
    except Exception as e:
        return QueryResponse(
            success=False,
            error=str(e)
        )


@app.post("/query/batch")
async def execute_batch_query(request: QueryRequest) -> QueryResponse:
    """
    Execute a batch query with multiple statements (temp tables, variables, dynamic SQL).
    
    This endpoint handles complex scripts that use:
    - Temp tables (#, ##)
    - Variables (@var)
    - Dynamic SQL (EXEC sp_executesql)
    - Stored procedures with transactions
    
    It navigates through all result sets to return the final one.
    """
    total_start = time.time()
    print("[PERF] Batch query started...")
    
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Execute the batch query
        exec_start = time.time()
        if request.params:
            cursor.execute(request.query, request.params)
        else:
            cursor.execute(request.query)
        exec_time = time.time() - exec_start
        print(f"[PERF] Batch execute: {exec_time:.2f}s")
        
        # Navigate through result sets to find the last one with data
        results = []
        columns = []
        
        # Keep navigating while there are more result sets
        fetch_start = time.time()
        while True:
            # Check if this result set has columns (i.e., it's a SELECT)
            if cursor.description:
                columns = [column[0] for column in cursor.description]
                results = []
                for row in cursor.fetchall():
                    results.append(dict(zip(columns, row)))
            
            # Try to move to next result set
            if not cursor.nextset():
                break
        fetch_time = time.time() - fetch_start
        
        # Commit any changes made by the batch (e.g., stored procedures with INSERT/UPDATE)
        conn.commit()
        cursor.close()
        conn.close()
        
        total_time = time.time() - total_start
        print(f"[PERF] Batch complete: {total_time:.2f}s (exec={exec_time:.2f}s, fetch={fetch_time:.2f}s, rows={len(results)})")
        
        return QueryResponse(
            success=True,
            data=results,
            rows=len(results)
        )
    except Exception as e:
        print(f"[PERF] Batch failed after {time.time() - total_start:.2f}s: {str(e)[:100]}")
        return QueryResponse(
            success=False,
            error=str(e)
        )


@app.post("/update")
async def execute_update(request: QueryRequest) -> QueryResponse:
    """
    Execute an INSERT, UPDATE, or DELETE query.
    
    Example:
    {
        "query": "INSERT INTO users (name, email) VALUES (?, ?)",
        "params": ["John Doe", "john@example.com"]
    }
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Execute query
        if request.params:
            cursor.execute(request.query, request.params)
        else:
            cursor.execute(request.query)
        
        conn.commit()
        rows_affected = cursor.rowcount
        
        cursor.close()
        conn.close()
        
        return QueryResponse(
            success=True,
            rows=rows_affected
        )
    except Exception as e:
        return QueryResponse(
            success=False,
            error=str(e)
        )


@app.get("/tables")
async def get_tables() -> QueryResponse:
    """Get list of all tables in the database."""
    query = """
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_NAME
    """
    
    request = QueryRequest(query=query)
    return await execute_query(request)


@app.get("/tables/{table_name}/schema")
async def get_table_schema(table_name: str) -> QueryResponse:
    """Get schema information for a specific table."""
    query = """
        SELECT 
            COLUMN_NAME,
            DATA_TYPE,
            IS_NULLABLE,
            CHARACTER_MAXIMUM_LENGTH
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
    """
    
    request = QueryRequest(query=query, params=[table_name])
    return await execute_query(request)


if __name__ == "__main__":
    print("=" * 70)
    print("SQL PROXY SERVICE")
    print("=" * 70)
    print(f"\n[CONFIG] Server: {SQL_SERVER}")
    print(f"[CONFIG] Database: {SQL_DATABASE}")
    print(f"[CONFIG] Port: {SQL_PORT}")
    print(f"[CONFIG] Auth: Windows Integrated Authentication")
    print("\n[IMPORTANT] This service MUST be run with domain credentials!")
    print("            Use: runas /netonly /user:ri-team\\YOUR_USERNAME \"cmd /k ...\"")
    print("\n[STARTING] Proxy service on http://localhost:8001")
    print("=" * 70)
    print()
    
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8001,
        log_level="info"
    )
