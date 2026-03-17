"""Comprehensive authentication diagnostics."""
import pyodbc
import getpass
from config import settings

print("=" * 70)
print("SQL Server Authentication Diagnostics")
print("=" * 70)

print("\n[INFO] SQL Server allows these authentication modes:")
print("  1. Windows Authentication (Integrated) - requires domain trust")
print("  2. SQL Server Authentication - username/password")
print("  3. Mixed Mode - both of the above")
print()

print("[QUESTION] Let's try SQL Authentication with fresh credentials")
print("             (Some special characters can cause issues in .env files)")
print()

# Get fresh credentials
username = input("Enter username (default: ri-team\\brian.c): ").strip()
if not username:
    username = r"ri-team\brian.c"

password = getpass.getpass("Enter password: ")

# Try different authentication methods
print("\n" + "=" * 70)
print("Testing Connection Methods...")
print("=" * 70)

base_conn_str = (
    f"DRIVER={{ODBC Driver 17 for SQL Server}};"
    f"SERVER={settings.sql_server},{settings.sql_port};"
    f"DATABASE={settings.sql_database};"
    f"Encrypt=yes;"
    f"TrustServerCertificate=yes;"
)

# Test 1: SQL Auth with username/password
print("\n[TEST 1] SQL Authentication with credentials")
try:
    conn_str = base_conn_str + f"UID={username};PWD={password};"
    conn = pyodbc.connect(conn_str, timeout=5)
    print("  SUCCESS! SQL Authentication works!")
    conn.close()
    
    # Save to .env
    print("\n[SAVING] Would you like to save these credentials to .env? (y/n)")
    save = input().strip().lower()
    if save == 'y':
        with open('.env', 'r') as f:
            lines = f.readlines()
        
        new_lines = []
        for line in lines:
            if line.startswith("USE_WINDOWS_AUTH="):
                new_lines.append("USE_WINDOWS_AUTH=False\n")
            elif line.startswith("SQL_USERNAME="):
                new_lines.append(f"SQL_USERNAME={username}\n")
            elif line.startswith("SQL_PASSWORD="):
                # Escape the password properly
                new_lines.append(f"SQL_PASSWORD={password}\n")
            else:
                new_lines.append(line)
        
        with open('.env', 'w') as f:
            f.writelines(new_lines)
        
        print("  Saved to .env!")
        print("\n[SUCCESS] You can now start the server with:")
        print("  uv run python main.py")
    exit(0)
except pyodbc.Error as e:
    error_code = e.args[0] if e.args else "Unknown"
    print(f"  FAILED - Error {error_code}")
    print(f"  Details: {str(e)[:200]}")

# Test 2: Different username formats
print("\n[TEST 2] Trying alternate username formats...")

# Extract short username
if "\\" in username:
    short_username = username.split("\\")[-1]
else:
    short_username = username

usernames_to_try = [
    username,
    username.replace("\\", "\\\\"),
    short_username + "@ri-team",
    short_username + "@ri-team.net",
    short_username,
]

for test_user in usernames_to_try:
    print(f"  Trying: {test_user}")
    try:
        conn_str = base_conn_str + f"UID={test_user};PWD={password};"
        conn = pyodbc.connect(conn_str, timeout=3)
        print(f"    SUCCESS with: {test_user}")
        conn.close()
        
        print(f"\n[FOUND IT!] Use this in .env: SQL_USERNAME={test_user}")
        exit(0)
    except:
        print(f"    Failed")

print("\n" + "=" * 70)
print("All authentication attempts failed.")
print("=" * 70)
print("\n[DIAGNOSIS] Possible issues:")
print("  1. SQL Server Authentication is disabled on the server")
print("  2. The account doesn't have SQL Server login permissions")
print("  3. Password is incorrect")
print("  4. SQL Server only allows Windows domain-joined authentication")
print()
print("[SOLUTION OPTIONS]:")
print("  A) Ask your DBA to enable SQL Server Authentication (Mixed Mode)")
print("  B) Ask your DBA to create a SQL Server login for ri-team\\brian.c")
print("  C) Run the application on a domain-joined machine")
print("  D) Use Azure AD authentication (if this is Azure SQL)")
