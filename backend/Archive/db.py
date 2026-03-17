"""Database connection management with multiple authentication methods."""
import struct
import pyodbc
from typing import Optional, List, Dict, Any
from msal import PublicClientApplication
from config import settings


class DatabaseConnection:
    """Manages Azure SQL Server connection with multiple authentication methods."""
    
    def __init__(self):
        self.connection: Optional[pyodbc.Connection] = None
        self.access_token: Optional[str] = None
        self.msal_app: Optional[PublicClientApplication] = None
        
    def authenticate_azure_ad(self) -> str:
        """
        Perform interactive Azure AD authentication.
        Opens browser for user to login with Microsoft account.
        Returns access token for SQL Server.
        """
        print("\n[*] Authenticating with Azure AD...")
        print(f"Please login with your Microsoft account to access {settings.sql_server}\n")
        
        # Initialize MSAL public client
        self.msal_app = PublicClientApplication(
            client_id=settings.azure_client_id,
            authority=f"https://login.microsoftonline.com/{settings.azure_tenant_id}"
        )
        
        # Scope for Azure SQL Database
        scopes = ["https://database.windows.net//.default"]
        
        # Try to get cached token first
        accounts = self.msal_app.get_accounts()
        if accounts:
            print("Found cached credentials, attempting silent authentication...")
            result = self.msal_app.acquire_token_silent(scopes, account=accounts[0])
            if result and "access_token" in result:
                print("[OK] Silent authentication successful!")
                return result["access_token"]
        
        # Interactive authentication
        print("Opening browser for authentication...")
        result = self.msal_app.acquire_token_interactive(scopes=scopes)
        
        if "access_token" in result:
            print("[OK] Authentication successful!")
            return result["access_token"]
        else:
            error = result.get("error_description", result.get("error", "Unknown error"))
            raise Exception(f"Authentication failed: {error}")
    
    def connect(self):
        """Establish connection to Azure SQL Server using configured authentication method."""
        if self.connection:
            return  # Already connected
        
        # Build base connection string
        connection_string = (
            f"DRIVER={{ODBC Driver 17 for SQL Server}};"
            f"SERVER={settings.sql_server},{settings.sql_port};"
            f"DATABASE={settings.sql_database};"
            f"Encrypt=yes;"
            f"TrustServerCertificate=yes;"
        )
        
        print(f"\n[*] Connecting to {settings.sql_server}/{settings.sql_database}...")
        
        try:
            if settings.use_azure_ad:
                # Azure AD Token Authentication
                print("[AUTH] Using Azure AD authentication...")
                self.access_token = self.authenticate_azure_ad()
                
                # Convert token to format needed by ODBC driver
                token_bytes = self.access_token.encode("utf-16-le")
                token_struct = struct.pack(f'<I{len(token_bytes)}s', len(token_bytes), token_bytes)
                
                # SQL_COPT_SS_ACCESS_TOKEN = 1256
                self.connection = pyodbc.connect(
                    connection_string,
                    attrs_before={1256: token_struct}
                )
            elif settings.use_windows_auth:
                # Windows Integrated Authentication (uses current process credentials)
                print("[AUTH] Using Windows Integrated Authentication...")
                print("[INFO] Make sure you're running this process with domain credentials!")
                print("[INFO] Use: runas /netonly /user:ri-team\\brian.c \"cmd /k ...\"")
                connection_string += "Trusted_Connection=yes;"
                self.connection = pyodbc.connect(connection_string)
            elif settings.sql_username and settings.sql_password:
                # SQL Server or Windows Authentication with explicit credentials
                print(f"[AUTH] Using username/password authentication for user: {settings.sql_username}")
                connection_string += (
                    f"UID={settings.sql_username};"
                    f"PWD={settings.sql_password};"
                )
                self.connection = pyodbc.connect(connection_string)
            else:
                raise Exception("No authentication method configured! Check your .env file.")
            
            print("[OK] Database connection established!\n")
        except pyodbc.Error as e:
            print(f"\n[ERROR] Connection failed!")
            print(f"Error details: {str(e)}\n")
            raise Exception(f"Database connection failed: {str(e)}")
    
    def disconnect(self):
        """Close the database connection."""
        if self.connection:
            self.connection.close()
            self.connection = None
            print("Database connection closed.")
    
    def execute_query(self, query: str, params: Optional[tuple] = None) -> List[Dict[str, Any]]:
        """
        Execute a SELECT query and return results as list of dictionaries.
        
        Args:
            query: SQL SELECT query
            params: Optional tuple of parameters for parameterized query
            
        Returns:
            List of dictionaries with column names as keys
        """
        if not self.connection:
            raise Exception("Not connected to database. Call connect() first.")
        
        cursor = self.connection.cursor()
        
        try:
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            
            # Get column names
            columns = [column[0] for column in cursor.description] if cursor.description else []
            
            # Fetch all rows and convert to list of dicts
            results = []
            for row in cursor.fetchall():
                results.append(dict(zip(columns, row)))
            
            return results
        except pyodbc.Error as e:
            raise Exception(f"Query execution failed: {str(e)}")
        finally:
            cursor.close()
    
    def execute_update(self, query: str, params: Optional[tuple] = None) -> int:
        """
        Execute an INSERT, UPDATE, or DELETE query.
        
        Args:
            query: SQL DML query
            params: Optional tuple of parameters for parameterized query
            
        Returns:
            Number of rows affected
        """
        if not self.connection:
            raise Exception("Not connected to database. Call connect() first.")
        
        cursor = self.connection.cursor()
        
        try:
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            
            self.connection.commit()
            rows_affected = cursor.rowcount
            
            return rows_affected
        except pyodbc.Error as e:
            self.connection.rollback()
            raise Exception(f"Update execution failed: {str(e)}")
        finally:
            cursor.close()
    
    def get_tables(self) -> List[str]:
        """Get list of all tables in the database."""
        query = """
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_NAME
        """
        results = self.execute_query(query)
        return [row['TABLE_NAME'] for row in results]
    
    def get_table_schema(self, table_name: str) -> List[Dict[str, str]]:
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
        return self.execute_query(query, (table_name,))


# Global database connection instance
db = DatabaseConnection()
