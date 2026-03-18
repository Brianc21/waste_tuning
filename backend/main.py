"""FastAPI server for Azure SQL Dashboard."""
import os
import sys
import glob
import configparser
import json
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager
from db_proxy import db


# Determine if running as packaged exe or development
def get_base_path():
    """Get the base path for static files."""
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    else:
        return os.path.dirname(os.path.abspath(__file__))


BASE_PATH = get_base_path()
STATIC_PATH = os.path.join(BASE_PATH, 'static')
CONFIG_PATH = os.path.join(BASE_PATH, 'config.ini')
QUERIES_PATH = os.path.join(BASE_PATH, 'queries.json')
QUERIES_DEFAULT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'queries.json')


class QueryRequest(BaseModel):
    query: str
    params: Optional[List[Any]] = None


class UpdateRequest(BaseModel):
    query: str
    params: Optional[List[Any]] = None


class QueryResponse(BaseModel):
    success: bool
    data: Optional[List[Dict[str, Any]]] = None
    rows: Optional[int] = None
    error: Optional[str] = None


class UpdateResponse(BaseModel):
    success: bool
    rows_affected: Optional[int] = None
    error: Optional[str] = None


class ConfigRequest(BaseModel):
    server: str
    database: str
    port: str = "1433"
    old_database: Optional[str] = None


class ConfigResponse(BaseModel):
    success: bool
    server: Optional[str] = None
    database: Optional[str] = None
    port: Optional[str] = None
    error: Optional[str] = None


class TuningSessionRow(BaseModel):
    PPGClusterID: int
    Action: str
    OperationType: Optional[str] = None
    ConfigValue: Optional[float] = None
    Comment: Optional[str] = None


class SaveTuningSessionRequest(BaseModel):
    VersionID: int
    Rows: List[TuningSessionRow]


class MarkSubmittedRequest(BaseModel):
    VersionID: int
    PPGClusterIDs: List[int]


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[*] Starting up Azure SQL Dashboard API...")
    try:
        db.connect()
    except Exception as e:
        print(f"[WARN] Database connection failed: {e}")
        print("[WARN] API will still run - you can fix settings and restart")
    yield
    print("\n[*] Shutting down...")
    try:
        db.disconnect()
    except:
        pass


app = FastAPI(
    title="Azure SQL Dashboard API",
    description="REST API for Azure SQL Server operations with multiple authentication methods",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# CONFIG ENDPOINTS
# =============================================================================

def read_config():
    defaults = {
        'server': 'hebwmddev-sqlvm.ri-team.net',
        'database': 'WASTE_HEB',
        'port': '1433'
    }
    if os.path.exists(CONFIG_PATH):
        config = configparser.ConfigParser()
        config.read(CONFIG_PATH)
        if 'database' in config:
            return {
                'server': config.get('database', 'server', fallback=defaults['server']),
                'database': config.get('database', 'database', fallback=defaults['database']),
                'port': config.get('database', 'port', fallback=defaults['port'])
            }
    return defaults


def write_config(server: str, database: str, port: str):
    config = configparser.ConfigParser()
    config['database'] = {
        'server': server,
        'database': database,
        'port': port
    }
    with open(CONFIG_PATH, 'w') as f:
        f.write("[database]\n")
        f.write("# SQL Server hostname or IP address\n")
        f.write(f"server = {server}\n\n")
        f.write("# Database name\n")
        f.write(f"database = {database}\n\n")
        f.write("# Port (default: 1433)\n")
        f.write(f"port = {port}\n")


def load_queries():
    if os.path.exists(QUERIES_PATH):
        try:
            with open(QUERIES_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f'[WARN] Error reading queries.json: {e}')
    if os.path.exists(QUERIES_DEFAULT_PATH):
        try:
            with open(QUERIES_DEFAULT_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f'[WARN] Error reading default queries.json: {e}')
    return {'queries': []}


def save_queries(data: dict):
    with open(QUERIES_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)


def load_default_queries():
    if os.path.exists(QUERIES_DEFAULT_PATH):
        try:
            with open(QUERIES_DEFAULT_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f'[WARN] Error reading default queries.json: {e}')
    return {'queries': []}


def update_queries_database(old_db: str, new_db: str):
    if old_db == new_db:
        return True, "No change needed"
    total_count = 0
    old_pattern = f'[{old_db}]'
    new_pattern = f'[{new_db}]'
    try:
        queries_data = load_queries()
        queries_json_str = json.dumps(queries_data)
        count = queries_json_str.count(old_pattern)
        if count > 0:
            updated_json_str = queries_json_str.replace(old_pattern, new_pattern)
            updated_data = json.loads(updated_json_str)
            save_queries(updated_data)
            total_count += count
            print(f'[CONFIG] Updated {count} occurrences in queries.json')
    except Exception as e:
        print(f'[WARN] Error updating queries.json: {e}')
    try:
        assets_path = os.path.join(STATIC_PATH, 'assets')
        if os.path.exists(assets_path):
            js_files = glob.glob(os.path.join(assets_path, 'index-*.js'))
            if js_files:
                js_file = js_files[0]
                with open(js_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                count = content.count(old_pattern)
                if count > 0:
                    updated_content = content.replace(old_pattern, new_pattern)
                    with open(js_file, 'w', encoding='utf-8') as f:
                        f.write(updated_content)
                    total_count += count
                    print(f'[CONFIG] Updated {count} occurrences in JS bundle')
    except Exception as e:
        print(f'[WARN] Error updating JS bundle: {e}')
    if total_count == 0:
        return True, f"No occurrences of [{old_db}] found"
    return True, f"Updated {total_count} total occurrences of [{old_db}] to [{new_db}]"


@app.get("/api/config", response_model=ConfigResponse)
async def get_config():
    try:
        config = read_config()
        return ConfigResponse(
            success=True,
            server=config['server'],
            database=config['database'],
            port=config['port']
        )
    except Exception as e:
        return ConfigResponse(success=False, error=str(e))


@app.post("/api/config", response_model=ConfigResponse)
async def save_config(request: ConfigRequest):
    try:
        old_db = request.old_database
        if not old_db:
            current_config = read_config()
            old_db = current_config['database']
        success, message = update_queries_database(old_db, request.database)
        if not success:
            return ConfigResponse(success=False, error=f"Failed to update queries: {message}")
        write_config(request.server, request.database, request.port)
        print(f"[CONFIG] Updated: {old_db} -> {request.database}")
        print(f"[CONFIG] {message}")
        return ConfigResponse(
            success=True,
            server=request.server,
            database=request.database,
            port=request.port
        )
    except Exception as e:
        return ConfigResponse(success=False, error=str(e))


# =============================================================================
# QUERY LIBRARY ENDPOINTS
# =============================================================================

@app.get("/api/queries")
async def get_queries():
    try:
        data = load_queries()
        return {'success': True, 'queries': data.get('queries', [])}
    except Exception as e:
        return {'success': False, 'error': str(e)}


@app.put("/api/queries/{query_id}")
async def update_query(query_id: str, query_data: dict = Body(...)):
    try:
        data = load_queries()
        queries = data.get('queries', [])
        found = False
        for i, q in enumerate(queries):
            if q.get('id') == query_id:
                queries[i]['sql'] = query_data.get('sql', q.get('sql'))
                found = True
                break
        if not found:
            return {'success': False, 'error': f'Query {query_id} not found'}
        data['queries'] = queries
        save_queries(data)
        print(f'[QUERIES] Updated query: {query_id}')
        return {'success': True, 'message': f'Query {query_id} updated successfully'}
    except Exception as e:
        return {'success': False, 'error': str(e)}


@app.put("/api/queries/{query_id}/make-default")
async def make_query_default(query_id: str, query_data: dict = Body(...)):
    """Save a query as the new default (so Reset returns to this version)."""
    try:
        new_sql = query_data.get('sql')
        if not new_sql:
            return {'success': False, 'error': 'No SQL provided'}
        data = load_queries()
        queries = data.get('queries', [])
        found = False
        for i, q in enumerate(queries):
            if q.get('id') == query_id:
                queries[i]['sql'] = new_sql
                found = True
                break
        if not found:
            return {'success': False, 'error': f'Query {query_id} not found'}
        data['queries'] = queries
        save_queries(data)
        default_data = load_default_queries()
        default_queries = default_data.get('queries', [])
        for i, q in enumerate(default_queries):
            if q.get('id') == query_id:
                default_queries[i]['sql'] = new_sql
                break
        default_data['queries'] = default_queries
        with open(QUERIES_DEFAULT_PATH, 'w', encoding='utf-8') as f:
            json.dump(default_data, f, indent=2)
        print(f'[QUERIES] Set new default for query: {query_id}')
        return {'success': True, 'message': f'Query {query_id} saved as new default'}
    except Exception as e:
        return {'success': False, 'error': str(e)}


@app.post("/api/queries/reset")
async def reset_queries():
    try:
        default_data = load_default_queries()
        save_queries(default_data)
        print('[QUERIES] Reset all queries to defaults')
        return {
            'success': True,
            'message': 'All queries reset to defaults',
            'queries': default_data.get('queries', [])
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}


@app.post("/api/queries/{query_id}/reset")
async def reset_single_query(query_id: str):
    try:
        current_data = load_queries()
        default_data = load_default_queries()
        current_queries = current_data.get('queries', [])
        default_queries = default_data.get('queries', [])
        default_query = None
        for q in default_queries:
            if q.get('id') == query_id:
                default_query = q
                break
        if not default_query:
            return {'success': False, 'error': f'No default found for query {query_id}'}
        found = False
        for i, q in enumerate(current_queries):
            if q.get('id') == query_id:
                current_queries[i] = default_query
                found = True
                break
        if not found:
            current_queries.append(default_query)
        current_data['queries'] = current_queries
        save_queries(current_data)
        print(f'[QUERIES] Reset query to default: {query_id}')
        return {
            'success': True,
            'message': f'Query {query_id} reset to default',
            'query': default_query
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}


# =============================================================================
# TUNING SESSION ENDPOINTS
# =============================================================================

@app.post("/api/tuning-session/save")
async def save_tuning_session(request: SaveTuningSessionRequest):
    """
    Save (upsert) tuning session decisions to config.TuningSession.
    Uses SQL Server's logged-in user for SavedBy via SYSTEM_USER.
    One row per VersionID + PPGClusterID — existing rows are updated.
    """
    try:
        if not request.Rows:
            return {'success': False, 'error': 'No rows provided'}

        saved = 0
        errors = []

        for row in request.Rows:
            op_type = f"'{row.OperationType}'" if row.OperationType else 'NULL'
            config_val = str(row.ConfigValue) if row.ConfigValue is not None else 'NULL'
            comment = f"'{row.Comment.replace(chr(39), chr(39)*2)}'" if row.Comment else 'NULL'

            sql = f"""
MERGE [WASTE_HEB].[config].[TuningSession] AS target
USING (SELECT 
    {request.VersionID} AS VersionID,
    {row.PPGClusterID} AS PPGClusterID,
    '{row.Action}' AS Action,
    {op_type} AS OperationType,
    {config_val} AS ConfigValue,
    {comment} AS Comment,
    SYSTEM_USER AS SavedBy,
    GETUTCDATE() AS SavedOnUTC
) AS source
ON target.VersionID = source.VersionID AND target.PPGClusterID = source.PPGClusterID
WHEN MATCHED THEN
    UPDATE SET
        Action = source.Action,
        OperationType = source.OperationType,
        ConfigValue = source.ConfigValue,
        Comment = source.Comment,
        SavedBy = source.SavedBy,
        SavedOnUTC = source.SavedOnUTC
WHEN NOT MATCHED THEN
    INSERT (VersionID, PPGClusterID, Action, OperationType, ConfigValue, Comment, SavedBy, SavedOnUTC, IsSubmitted)
    VALUES (source.VersionID, source.PPGClusterID, source.Action, source.OperationType, source.ConfigValue, source.Comment, source.SavedBy, source.SavedOnUTC, 0);
"""
            try:
                db.execute_batch_query(sql)
                saved += 1
            except Exception as e:
                errors.append(f"PPGClusterID {row.PPGClusterID}: {str(e)}")

        if errors:
            return {
                'success': False,
                'error': f"Saved {saved} rows but {len(errors)} failed: {'; '.join(errors)}"
            }

        print(f'[TUNING SESSION] Saved {saved} rows for VersionID {request.VersionID}')
        return {'success': True, 'saved': saved}

    except Exception as e:
        return {'success': False, 'error': str(e)}


@app.get("/api/tuning-session/{version_id}")
async def load_tuning_session(version_id: int):
    """
    Load all saved tuning session rows for a given VersionID.
    Returns both submitted and unsubmitted rows.
    """
    try:
        sql = f"""
SELECT 
    VersionID,
    PPGClusterID,
    Action,
    OperationType,
    ConfigValue,
    Comment,
    SavedBy,
    SavedOnUTC,
    IsSubmitted,
    SubmittedOnUTC
FROM [WASTE_HEB].[config].[TuningSession]
WHERE VersionID = {version_id}
ORDER BY PPGClusterID
"""
        results = db.execute_query(sql)
        print(f'[TUNING SESSION] Loaded {len(results)} rows for VersionID {version_id}')
        return {'success': True, 'rows': results}
    except Exception as e:
        return {'success': False, 'error': str(e)}


@app.post("/api/tuning-session/mark-submitted")
async def mark_tuning_session_submitted(request: MarkSubmittedRequest):
    """
    Mark rows as submitted (IsSubmitted = 1) after Tune button is clicked.
    """
    try:
        if not request.PPGClusterIDs:
            return {'success': False, 'error': 'No PPGClusterIDs provided'}

        ids = ', '.join(str(i) for i in request.PPGClusterIDs)
        sql = f"""
UPDATE [WASTE_HEB].[config].[TuningSession]
SET IsSubmitted = 1, SubmittedOnUTC = GETUTCDATE()
WHERE VersionID = {request.VersionID}
AND PPGClusterID IN ({ids})
"""
        db.execute_batch_query(sql)
        print(f'[TUNING SESSION] Marked {len(request.PPGClusterIDs)} rows as submitted for VersionID {request.VersionID}')
        return {'success': True, 'marked': len(request.PPGClusterIDs)}
    except Exception as e:
        return {'success': False, 'error': str(e)}


# =============================================================================
# DATABASE ENDPOINTS
# =============================================================================

@app.get("/api/tables", response_model=QueryResponse)
async def get_tables():
    try:
        tables = db.get_tables()
        return QueryResponse(
            success=True,
            data=[{"table_name": table} for table in tables],
            rows=len(tables)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tables/{table_name}/schema", response_model=QueryResponse)
async def get_table_schema(table_name: str):
    try:
        schema = db.get_table_schema(table_name)
        return QueryResponse(success=True, data=schema, rows=len(schema))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/query", response_model=QueryResponse)
async def execute_query(request: QueryRequest):
    try:
        params = tuple(request.params) if request.params else None
        results = db.execute_query(request.query, params)
        return QueryResponse(success=True, data=results, rows=len(results))
    except Exception as e:
        return QueryResponse(success=False, error=str(e))


@app.post("/api/query/batch", response_model=QueryResponse)
async def execute_batch_query(request: QueryRequest):
    try:
        params = tuple(request.params) if request.params else None
        results = db.execute_batch_query(request.query, params)
        return QueryResponse(success=True, data=results, rows=len(results))
    except Exception as e:
        return QueryResponse(success=False, error=str(e))


@app.post("/api/update", response_model=UpdateResponse)
async def execute_update(request: UpdateRequest):
    try:
        params = tuple(request.params) if request.params else None
        rows_affected = db.execute_update(request.query, params)
        return UpdateResponse(success=True, rows_affected=rows_affected)
    except Exception as e:
        return UpdateResponse(success=False, error=str(e))


@app.get("/api/health")
async def health_check():
    try:
        db.execute_query("SELECT 1 AS health_check")
        return {"status": "healthy", "database": "connected", "message": "All systems operational!"}
    except Exception as e:
        return {"status": "unhealthy", "database": "disconnected", "error": str(e)}


# =============================================================================
# STATIC FILE SERVING
# =============================================================================

if os.path.exists(STATIC_PATH) and os.path.isdir(STATIC_PATH):
    print(f"[*] Serving static files from: {STATIC_PATH}")

    @app.get("/")
    async def serve_root():
        return FileResponse(os.path.join(STATIC_PATH, 'index.html'))

    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_PATH, 'assets')), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        file_path = os.path.join(STATIC_PATH, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(STATIC_PATH, 'index.html'))
else:
    @app.get("/")
    async def root():
        return {
            "status": "ok",
            "message": "Azure SQL Dashboard API is running!",
            "version": "1.0.0",
            "note": "Frontend not bundled. Run 'npm run dev' in frontend folder."
        }


if __name__ == "__main__":
    import uvicorn
    if getattr(sys, 'frozen', False):
        uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
    else:
        uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
