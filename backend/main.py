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


def get_base_path():
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
        return ConfigResponse(success=True, server=config['server'], database=config['database'], port=config['port'])
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
        return ConfigResponse(success=True, server=request.server, database=request.database, port=request.port)
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
        return {'success': True, 'message': 'All queries reset to defaults', 'queries': default_data.get('queries', [])}
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
        return {'success': True, 'message': f'Query {query_id} reset to default', 'query': default_query}
    except Exception as e:
        return {'success': False, 'error': str(e)}


# =============================================================================
# TUNING SESSION ENDPOINTS
# =============================================================================

@app.post("/api/tuning-session/save")
async def save_tuning_session(request: SaveTuningSessionRequest):
    """Save (upsert) tuning session decisions to config.TuningSession."""
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
    UPDATE SET Action = source.Action, OperationType = source.OperationType,
               ConfigValue = source.ConfigValue, Comment = source.Comment,
               SavedBy = source.SavedBy, SavedOnUTC = source.SavedOnUTC
WHEN NOT MATCHED THEN
    INSERT (VersionID, PPGClusterID, Action, OperationType, ConfigValue, Comment, SavedBy, SavedOnUTC, IsSubmitted)
    VALUES (source.VersionID, source.PPGClusterID, source.Action, source.OperationType,
            source.ConfigValue, source.Comment, source.SavedBy, source.SavedOnUTC, 0);
"""
            try:
                db.execute_batch_query(sql)
                saved += 1
            except Exception as e:
                errors.append(f"PPGClusterID {row.PPGClusterID}: {str(e)}")
        if errors:
            return {'success': False, 'error': f"Saved {saved} rows but {len(errors)} failed: {'; '.join(errors)}"}
        print(f'[TUNING SESSION] Saved {saved} rows for VersionID {request.VersionID}')
        return {'success': True, 'saved': saved}
    except Exception as e:
        return {'success': False, 'error': str(e)}


@app.get("/api/tuning-session/conflicts/{max_version_id}/{active_version_id}")
async def get_conflicts_and_proposed(max_version_id: int, active_version_id: int):
    """
    Returns conflicts and clean rows by running two separate queries and
    classifying results in Python to avoid SQL CTE materialization issues.

    QUERY 1: All PPGClusterIDs where MAX and Active DefaultPercentage differ,
             joined with TuningSession. Classified as clean or conflict.

    QUERY 2: TuningSession rows that say Change/Reset but DB configs now match
             (stale session data). These are always conflicts.

    Clean:
      - DB says Change + TS says Change with matching Op+Value
      - DB says Reset  + TS says Reset
      - DB says Leave  + TS says Leave  (explicit session leave)

    Conflict: everything else where versions differ or session is stale.
    """
    try:
        # ------------------------------------------------------------------
        # Query 1: All rows where MAX differs from Active, with TS joined
        # ------------------------------------------------------------------
        q1 = f"""
SELECT
    x.PPGClusterID,
    x.DB_DerivedAction,
    x.DB_OperationType,
    x.DB_ConfigValue,
    ts.Action           AS TS_Action,
    ts.OperationType    AS TS_OperationType,
    CAST(ts.ConfigValue AS FLOAT) AS TS_ConfigValue,
    ts.SavedBy          AS TS_SavedBy,
    CONVERT(VARCHAR(30), ts.SavedOnUTC, 120) AS TS_SavedOnUTC,
    h.HierarchyLevel4Name,
    h.HierarchyLevel3Name,
    h.HierarchyLevel2Name,
    h.HierarchyLevel1Name
FROM (
    -- Change: in MAX and differs from Active
    SELECT
        m.PPGClusterID,
        'Change'                         AS DB_DerivedAction,
        m.ConfigOperationType            AS DB_OperationType,
        CAST(m.ConfigValue AS FLOAT)     AS DB_ConfigValue
    FROM [WASTE_HEB].[config].[DefaultPercentage] m
    LEFT JOIN [WASTE_HEB].[config].[DefaultPercentage] a
        ON m.PPGClusterID = a.PPGClusterID AND a.VersionID = {active_version_id}
    WHERE m.VersionID = {max_version_id}
      AND (
            a.PPGClusterID IS NULL
            OR m.ConfigValue         <> a.ConfigValue
            OR m.ConfigOperationType <> a.ConfigOperationType
          )

    UNION ALL

    -- Reset: in Active but missing from MAX
    SELECT
        a.PPGClusterID,
        'Reset'   AS DB_DerivedAction,
        NULL      AS DB_OperationType,
        NULL      AS DB_ConfigValue
    FROM [WASTE_HEB].[config].[DefaultPercentage] a
    WHERE a.VersionID = {active_version_id}
      AND NOT EXISTS (
            SELECT 1
            FROM [WASTE_HEB].[config].[DefaultPercentage] m
            WHERE m.PPGClusterID = a.PPGClusterID
              AND m.VersionID    = {max_version_id}
          )
) x
LEFT JOIN [WASTE_HEB].[config].[TuningSession] ts
    ON x.PPGClusterID = ts.PPGClusterID AND ts.VersionID = {max_version_id}
-- Join hierarchy for display in modal
LEFT JOIN (
    SELECT
        i.PPGClusterID,
        iml.HierarchyLevel4Name,
        iml.HierarchyLevel3Name,
        iml.HierarchyLevel2Name,
        iml.HierarchyLevel1Name,
        ROW_NUMBER() OVER (PARTITION BY i.PPGClusterID ORDER BY COUNT(iml.UniqueItemID) DESC) AS rn
    FROM [WASTE_HEB].[dbo].[Item] i
    LEFT JOIN [WASTE_HEB].[dbo].[ItemML] iml ON i.UniqueItemID = iml.UniqueItemID
    GROUP BY i.PPGClusterID, iml.HierarchyLevel4Name, iml.HierarchyLevel3Name,
             iml.HierarchyLevel2Name, iml.HierarchyLevel1Name
) h ON x.PPGClusterID = h.PPGClusterID AND h.rn = 1
ORDER BY x.PPGClusterID;
"""

        # ------------------------------------------------------------------
        # Query 2: Stale TuningSession rows (TS says Change/Reset but
        #          DB configs now match between versions)
        # ------------------------------------------------------------------
        q2 = f"""
SELECT
    ts.PPGClusterID,
    'Leave'     AS DB_DerivedAction,
    NULL        AS DB_OperationType,
    NULL        AS DB_ConfigValue,
    ts.Action   AS TS_Action,
    ts.OperationType AS TS_OperationType,
    CAST(ts.ConfigValue AS FLOAT) AS TS_ConfigValue,
    ts.SavedBy  AS TS_SavedBy,
    CONVERT(VARCHAR(30), ts.SavedOnUTC, 120) AS TS_SavedOnUTC,
    h.HierarchyLevel4Name,
    h.HierarchyLevel3Name,
    h.HierarchyLevel2Name,
    h.HierarchyLevel1Name
FROM [WASTE_HEB].[config].[TuningSession] ts
LEFT JOIN (
    SELECT
        i.PPGClusterID,
        iml.HierarchyLevel4Name,
        iml.HierarchyLevel3Name,
        iml.HierarchyLevel2Name,
        iml.HierarchyLevel1Name,
        ROW_NUMBER() OVER (PARTITION BY i.PPGClusterID ORDER BY COUNT(iml.UniqueItemID) DESC) AS rn
    FROM [WASTE_HEB].[dbo].[Item] i
    LEFT JOIN [WASTE_HEB].[dbo].[ItemML] iml ON i.UniqueItemID = iml.UniqueItemID
    GROUP BY i.PPGClusterID, iml.HierarchyLevel4Name, iml.HierarchyLevel3Name,
             iml.HierarchyLevel2Name, iml.HierarchyLevel1Name
) h ON ts.PPGClusterID = h.PPGClusterID AND h.rn = 1
WHERE ts.VersionID = {max_version_id}
  AND ts.Action IN ('Change', 'Reset')
  -- Only include if the two versions' configs now match (stale session)
  AND NOT EXISTS (
    SELECT 1
    FROM [WASTE_HEB].[config].[DefaultPercentage] m
    LEFT JOIN [WASTE_HEB].[config].[DefaultPercentage] a
        ON m.PPGClusterID = a.PPGClusterID AND a.VersionID = {active_version_id}
    WHERE m.VersionID = {max_version_id}
      AND m.PPGClusterID = ts.PPGClusterID
      AND (
            a.PPGClusterID IS NULL
            OR m.ConfigValue         <> a.ConfigValue
            OR m.ConfigOperationType <> a.ConfigOperationType
          )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM [WASTE_HEB].[config].[DefaultPercentage] a
    WHERE a.VersionID = {active_version_id}
      AND a.PPGClusterID = ts.PPGClusterID
      AND NOT EXISTS (
            SELECT 1 FROM [WASTE_HEB].[config].[DefaultPercentage] m
            WHERE m.PPGClusterID = a.PPGClusterID AND m.VersionID = {max_version_id}
          )
  )
ORDER BY ts.PPGClusterID;
"""

        rows_q1 = db.execute_query(q1)
        rows_q2 = db.execute_query(q2)

        # ------------------------------------------------------------------
        # Classify Q1 rows as clean or conflict in Python
        # ------------------------------------------------------------------
        clean = []
        conflicts = []

        def vals_match(ts_op, ts_val, db_op, db_val):
            op_match = (ts_op == db_op) or (ts_op is None and db_op is None)
            if ts_val is None and db_val is None:
                val_match = True
            elif ts_val is not None and db_val is not None:
                val_match = abs(float(ts_val) - float(db_val)) < 0.0001
            else:
                val_match = False
            return op_match and val_match

        conflict_reasons = {
            ('Change', None):     'MAX version differs from Active but no session record exists',
            ('Change', 'Leave'):  'MAX version was tuned but session says Leave',
            ('Change', 'Reset'):  'MAX version has config but session says Reset',
            ('Change', 'Change'): 'MAX version config differs from saved session values',
            ('Reset',  None):     'Config removed from MAX version but no session record exists',
            ('Reset',  'Change'): 'Config removed from MAX version but session says Change',
            ('Reset',  'Leave'):  'Config removed from MAX version but session says Leave',
        }

        for r in rows_q1:
            db_action = r['DB_DerivedAction']
            ts_action = r.get('TS_Action')

            is_clean = False
            if db_action == 'Change' and ts_action == 'Change':
                if vals_match(r.get('TS_OperationType'), r.get('TS_ConfigValue'),
                              r.get('DB_OperationType'), r.get('DB_ConfigValue')):
                    is_clean = True
            elif db_action == 'Reset' and ts_action == 'Reset':
                is_clean = True
            elif db_action == 'Leave' and ts_action == 'Leave':
                is_clean = True

            if is_clean:
                clean.append({
                    'PPGClusterID':       r['PPGClusterID'],
                    'Action':             db_action,
                    'OperationType':      r.get('DB_OperationType'),
                    'ConfigValue':        r.get('DB_ConfigValue'),
                    'HierarchyLevel4Name': r.get('HierarchyLevel4Name'),
                    'HierarchyLevel3Name': r.get('HierarchyLevel3Name'),
                    'HierarchyLevel2Name': r.get('HierarchyLevel2Name'),
                    'HierarchyLevel1Name': r.get('HierarchyLevel1Name'),
                })
            else:
                reason = conflict_reasons.get(
                    (db_action, ts_action),
                    f'Conflict: DB={db_action}, Session={ts_action}'
                )
                conflicts.append({
                    'PPGClusterID':        r['PPGClusterID'],
                    'DB_DerivedAction':    db_action,
                    'DB_OperationType':    r.get('DB_OperationType'),
                    'DB_ConfigValue':      r.get('DB_ConfigValue'),
                    'TS_Action':           ts_action,
                    'TS_OperationType':    r.get('TS_OperationType'),
                    'TS_ConfigValue':      r.get('TS_ConfigValue'),
                    'TS_SavedBy':          r.get('TS_SavedBy'),
                    'TS_SavedOnUTC':       r.get('TS_SavedOnUTC'),
                    'ConflictReason':      reason,
                    'HierarchyLevel4Name': r.get('HierarchyLevel4Name'),
                    'HierarchyLevel3Name': r.get('HierarchyLevel3Name'),
                    'HierarchyLevel2Name': r.get('HierarchyLevel2Name'),
                    'HierarchyLevel1Name': r.get('HierarchyLevel1Name'),
                })

        # Q2 rows are always conflicts (stale session)
        for r in rows_q2:
            ts_action = r.get('TS_Action')
            reason = (
                'Configs match between versions but session says Change'
                if ts_action == 'Change'
                else 'Configs match between versions but session says Reset'
            )
            conflicts.append({
                'PPGClusterID':        r['PPGClusterID'],
                'DB_DerivedAction':    'Leave',
                'DB_OperationType':    None,
                'DB_ConfigValue':      None,
                'TS_Action':           ts_action,
                'TS_OperationType':    r.get('TS_OperationType'),
                'TS_ConfigValue':      r.get('TS_ConfigValue'),
                'TS_SavedBy':          r.get('TS_SavedBy'),
                'TS_SavedOnUTC':       r.get('TS_SavedOnUTC'),
                'ConflictReason':      reason,
                'HierarchyLevel4Name': r.get('HierarchyLevel4Name'),
                'HierarchyLevel3Name': r.get('HierarchyLevel3Name'),
                'HierarchyLevel2Name': r.get('HierarchyLevel2Name'),
                'HierarchyLevel1Name': r.get('HierarchyLevel1Name'),
            })

        print(f'[TUNING SESSION] Conflicts: {len(conflicts)}, Clean: {len(clean)} '
              f'(MAX={max_version_id}, Active={active_version_id})')
        return {'success': True, 'conflicts': conflicts, 'clean': clean}

    except Exception as e:
        return {'success': False, 'error': str(e)}


@app.delete("/api/tuning-session/reset-all/{max_version_id}/{active_version_id}")
async def reset_all_planned_changes(max_version_id: int, active_version_id: int):
    """Reset ALL planned changes for MAX version back to match Active version."""
    try:
        sql_delete_changed = f"""
DELETE FROM [WASTE_HEB].[config].[DefaultPercentage]
WHERE VersionID = {max_version_id}
  AND PPGClusterID IN (
    SELECT m.PPGClusterID
    FROM [WASTE_HEB].[config].[DefaultPercentage] m
    LEFT JOIN [WASTE_HEB].[config].[DefaultPercentage] a
        ON m.PPGClusterID = a.PPGClusterID AND a.VersionID = {active_version_id}
    WHERE m.VersionID = {max_version_id}
      AND (a.PPGClusterID IS NULL OR m.ConfigValue <> a.ConfigValue
           OR m.ConfigOperationType <> a.ConfigOperationType)
  )
"""
        db.execute_batch_query(sql_delete_changed)

        sql_reinsert = f"""
INSERT INTO [WASTE_HEB].[config].[DefaultPercentage]
    (VersionID, PPGClusterID, ConfigOperationType, ConfigValue,
     Comment, CreatedBy, CreatedOnUTC, UpdatedBy, UpdatedOnUTC)
SELECT
    {max_version_id} AS VersionID,
    a.PPGClusterID, a.ConfigOperationType, a.ConfigValue,
    a.Comment,
    SYSTEM_USER AS CreatedBy, GETUTCDATE() AS CreatedOnUTC,
    SYSTEM_USER AS UpdatedBy, GETUTCDATE() AS UpdatedOnUTC
FROM [WASTE_HEB].[config].[DefaultPercentage] a
WHERE a.VersionID = {active_version_id}
  AND NOT EXISTS (
    SELECT 1 FROM [WASTE_HEB].[config].[DefaultPercentage] m
    WHERE m.PPGClusterID = a.PPGClusterID AND m.VersionID = {max_version_id}
  )
"""
        db.execute_batch_query(sql_reinsert)

        sql_delete_session = f"""
DELETE FROM [WASTE_HEB].[config].[TuningSession]
WHERE VersionID = {max_version_id}
"""
        db.execute_batch_query(sql_delete_session)

        print(f'[TUNING SESSION] Reset all planned changes (MAX={max_version_id}, Active={active_version_id})')
        return {
            'success': True,
            'message': f'All planned changes for Version {max_version_id} have been reset to match Version {active_version_id}.'
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}


@app.post("/api/tuning-session/mark-submitted")
async def mark_tuning_session_submitted(request: MarkSubmittedRequest):
    """Mark rows as submitted after Tune button is clicked."""
    try:
        if not request.PPGClusterIDs:
            return {'success': False, 'error': 'No PPGClusterIDs provided'}
        ids = ', '.join(str(i) for i in request.PPGClusterIDs)
        sql = f"""
UPDATE [WASTE_HEB].[config].[TuningSession]
SET IsSubmitted = 1, SubmittedOnUTC = GETUTCDATE()
WHERE VersionID = {request.VersionID} AND PPGClusterID IN ({ids})
"""
        db.execute_batch_query(sql)
        print(f'[TUNING SESSION] Marked {len(request.PPGClusterIDs)} rows as submitted '
              f'for VersionID {request.VersionID}')
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
        return QueryResponse(success=True, data=[{"table_name": table} for table in tables], rows=len(tables))
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
