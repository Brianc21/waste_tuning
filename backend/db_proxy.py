"""Database proxy client - talks to SQL Proxy Service via HTTP."""
import requests
import time
from typing import Optional, List, Dict, Any


class DatabaseProxyConnection:
    """Connects to SQL Server via the SQL Proxy Service."""
    
    def __init__(self, proxy_url: str = "http://localhost:8001"):
        self.proxy_url = proxy_url
        self.connected = False
        
    def connect(self, max_retries: int = 3, retry_delay: int = 5):
        """Check connection to proxy service with retry logic."""
        print(f"\n[*] Connecting to SQL Proxy at {self.proxy_url}...")
        
        last_error = None
        
        for attempt in range(1, max_retries + 1):
            try:
                # Increased timeout to 30 seconds for slow database connections
                response = requests.get(f"{self.proxy_url}/health", timeout=30)
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("status") == "healthy":
                        self.connected = True
                        print(f"[OK] Connected to {data.get('server')}/{data.get('database_name')}")
                        print("[OK] Using Windows Authentication via proxy\n")
                        return  # Success!
                    else:
                        last_error = f"Proxy unhealthy: {data.get('error', 'Unknown error')}"
                else:
                    last_error = f"Proxy returned status {response.status_code}"
                    
            except requests.exceptions.ConnectionError:
                last_error = "connection_refused"
            except requests.exceptions.ReadTimeout:
                last_error = "timeout"
            except Exception as e:
                last_error = str(e)
            
            # If not the last attempt, wait and retry
            if attempt < max_retries:
                if last_error == "connection_refused":
                    print(f"[WAIT] Proxy not ready, retrying in {retry_delay}s... (attempt {attempt}/{max_retries})")
                elif last_error == "timeout":
                    print(f"[WAIT] Proxy slow to respond, retrying in {retry_delay}s... (attempt {attempt}/{max_retries})")
                else:
                    print(f"[WAIT] {last_error}, retrying in {retry_delay}s... (attempt {attempt}/{max_retries})")
                time.sleep(retry_delay)
        
        # All retries failed
        if last_error == "connection_refused":
            print(f"\n[ERROR] Cannot connect to SQL Proxy Service!")
            print(f"[ERROR] Make sure sql_proxy.py is running with domain credentials")
            print(f"[ERROR] Start it with: start_proxy.bat (in the backend folder)")
            raise Exception("SQL Proxy Service is not running")
        elif last_error == "timeout":
            print(f"\n[ERROR] SQL Proxy is not responding (timed out)")
            print(f"[ERROR] The proxy may still be connecting to the database")
            print(f"[ERROR] Check the proxy window for errors")
            raise Exception("SQL Proxy timed out - check proxy window for errors")
        else:
            raise Exception(f"Database connection failed: {last_error}")
    
    def disconnect(self):
        """Disconnect (nothing to do for HTTP proxy)."""
        self.connected = False
        print("Database connection closed.")
    
    def execute_query(self, query: str, params: Optional[tuple] = None) -> List[Dict[str, Any]]:
        """
        Execute a SELECT query and return results.
        
        Args:
            query: SQL SELECT query
            params: Optional tuple of parameters for parameterized query
            
        Returns:
            List of dictionaries with column names as keys
        """
        if not self.connected:
            raise Exception("Not connected to database. Call connect() first.")
        
        try:
            payload = {
                "query": query,
                "params": list(params) if params else None
            }
            
            response = requests.post(
                f"{self.proxy_url}/query",
                json=payload,
                timeout=30
            )
            
            response.raise_for_status()
            result = response.json()
            
            if result.get("success"):
                return result.get("data", [])
            else:
                raise Exception(result.get("error", "Query failed"))
                
        except requests.exceptions.RequestException as e:
            raise Exception(f"Query execution failed: {str(e)}")
    
    def execute_batch_query(self, query: str, params: Optional[tuple] = None) -> List[Dict[str, Any]]:
        """
        Execute a batch query with multiple statements (temp tables, variables, dynamic SQL).
        
        This method handles complex scripts that use:
        - Temp tables (#, ##)
        - Variables (@var)
        - Dynamic SQL (EXEC sp_executesql)
        
        Args:
            query: SQL batch query (multiple statements)
            params: Optional tuple of parameters
            
        Returns:
            List of dictionaries from the final result set
        """
        if not self.connected:
            raise Exception("Not connected to database. Call connect() first.")
        
        try:
            payload = {
                "query": query,
                "params": list(params) if params else None
            }
            
            response = requests.post(
                f"{self.proxy_url}/query/batch",
                json=payload,
                timeout=120  # Longer timeout for complex queries
            )
            
            response.raise_for_status()
            result = response.json()
            
            if result.get("success"):
                return result.get("data", [])
            else:
                raise Exception(result.get("error", "Batch query failed"))
                
        except requests.exceptions.RequestException as e:
            raise Exception(f"Batch query execution failed: {str(e)}")
    
    def execute_update(self, query: str, params: Optional[tuple] = None) -> int:
        """
        Execute an INSERT, UPDATE, or DELETE query.
        
        Args:
            query: SQL DML query
            params: Optional tuple of parameters for parameterized query
            
        Returns:
            Number of rows affected
        """
        if not self.connected:
            raise Exception("Not connected to database. Call connect() first.")
        
        try:
            payload = {
                "query": query,
                "params": list(params) if params else None
            }
            
            response = requests.post(
                f"{self.proxy_url}/update",
                json=payload,
                timeout=30
            )
            
            response.raise_for_status()
            result = response.json()
            
            if result.get("success"):
                return result.get("rows", 0)
            else:
                raise Exception(result.get("error", "Update failed"))
                
        except requests.exceptions.RequestException as e:
            raise Exception(f"Update execution failed: {str(e)}")
    
    def get_tables(self) -> List[str]:
        """Get list of all tables in the database."""
        try:
            response = requests.get(f"{self.proxy_url}/tables", timeout=10)
            response.raise_for_status()
            result = response.json()
            
            if result.get("success"):
                return [row['TABLE_NAME'] for row in result.get("data", [])]
            else:
                raise Exception(result.get("error", "Failed to get tables"))
                
        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to get tables: {str(e)}")
    
    def get_table_schema(self, table_name: str) -> List[Dict[str, str]]:
        """Get schema information for a specific table."""
        try:
            response = requests.get(
                f"{self.proxy_url}/tables/{table_name}/schema",
                timeout=10
            )
            response.raise_for_status()
            result = response.json()
            
            if result.get("success"):
                return result.get("data", [])
            else:
                raise Exception(result.get("error", "Failed to get schema"))
                
        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to get schema: {str(e)}")


# Global database connection instance using proxy
db = DatabaseProxyConnection()
