"""Test different username formats for SQL Server authentication."""
import pyodbc
from config import settings

# Different username formats to try
username_formats = [
    "ri-team\\brian.c",           # Current format
    "ri-team\\\\brian.c",          # Double backslash
    "brian.c@ri-team",            # UPN style
    "brian.c@ri-team.net",        # Full UPN
    "brian.c",                    # Just username
]

connection_string_base = (
    f"DRIVER={{ODBC Driver 17 for SQL Server}};"
    f"SERVER={settings.sql_server},{settings.sql_port};"
    f"DATABASE={settings.sql_database};"
    f"Encrypt=yes;"
    f"TrustServerCertificate=yes;"
)

print("Testing different username formats...")
print("=" * 60)

for username in username_formats:
    print(f"\nTrying: {username}")
    connection_string = connection_string_base + f"UID={username};PWD={settings.sql_password};"
    
    try:
        conn = pyodbc.connect(connection_string, timeout=5)
        print(f"  [SUCCESS!] Connected with: {username}")
        conn.close()
        print(f"\nUse this format in your .env: SQL_USERNAME={username}")
        break
    except pyodbc.Error as e:
        error_code = e.args[0] if e.args else "Unknown"
        print(f"  [FAILED] Error {error_code}: {str(e)[:100]}")

print("\n" + "=" * 60)
print("If all failed, the password might be wrong or")
print("the account may not have SQL Server login permissions.")
