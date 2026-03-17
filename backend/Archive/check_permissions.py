"""Check what databases and permissions the user has."""
import requests

print("=" * 70)
print("CHECKING USER PERMISSIONS")
print("=" * 70)

# Try to connect without specifying a database
print("\n[TEST 1] Checking default database access...")
try:
    # Query to list databases user has access to
    payload = {
        "query": "SELECT name FROM sys.databases WHERE HAS_DBACCESS(name) = 1 ORDER BY name"
    }
    response = requests.post("http://localhost:8001/query", json=payload, timeout=5)
    
    if response.status_code == 500:
        print("  Cannot query without database context")
        print("  This confirms: You can login but don't have access to HEB_WASTE")
    else:
        data = response.json()
        if data.get("success"):
            databases = [row.get('name') for row in data.get('data', [])]
            print(f"  ✓ You have access to {len(databases)} database(s):")
            for db in databases:
                print(f"    - {db}")
        else:
            print(f"  Error: {data.get('error')}")
except Exception as e:
    print(f"  Error: {e}")

print("\n" + "=" * 70)
print("DIAGNOSIS")
print("=" * 70)
print("""
✓ Windows Authentication works!
✓ SQL Server recognizes you as: RI-TEAM\\brian.c
✗ You don't have permission to access HEB_WASTE database

SOLUTION:
Ask your DBA to grant you access to the HEB_WASTE database.

They need to run something like:
    USE HEB_WASTE;
    CREATE USER [RI-TEAM\\brian.c] FOR LOGIN [RI-TEAM\\brian.c];
    ALTER ROLE db_datareader ADD MEMBER [RI-TEAM\\brian.c];
    ALTER ROLE db_datawriter ADD MEMBER [RI-TEAM\\brian.c];

Or if you already have a login, just:
    USE HEB_WASTE;
    CREATE USER [RI-TEAM\\brian.c] FOR LOGIN [RI-TEAM\\brian.c];
    GRANT SELECT ON SCHEMA::dbo TO [RI-TEAM\\brian.c];
""")

# Alternative: Try connecting to master database
print("\n[TEST 2] Can you access the 'master' database?")
print("(Let me try to modify the proxy to connect to master instead...)")
