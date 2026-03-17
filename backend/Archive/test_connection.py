"""Quick test script to verify database connection."""
from db import db
from config import settings

print("=" * 60)
print("Testing SQL Server Connection")
print("=" * 60)
print(f"\nServer: {settings.sql_server}")
print(f"Database: {settings.sql_database}")
print(f"Username: {settings.sql_username}")
print(f"Password set: {'Yes' if settings.sql_password else 'No'}")
print(f"Use Azure AD: {settings.use_azure_ad}")
print("\n" + "=" * 60)

try:
    db.connect()
    print("\n[SUCCESS] Connection established!")
    
    # Test a simple query
    print("\nTesting query execution...")
    result = db.execute_query("SELECT @@VERSION AS sql_version")
    print(f"\nSQL Server Version:\n{result[0]['sql_version']}")
    
    # Get tables
    print("\nFetching tables...")
    tables = db.get_tables()
    print(f"Found {len(tables)} tables:")
    for table in tables[:10]:  # Show first 10
        print(f"  - {table}")
    if len(tables) > 10:
        print(f"  ... and {len(tables) - 10} more")
    
    db.disconnect()
    print("\n[SUCCESS] All tests passed!")
    
except Exception as e:
    print(f"\n[ERROR] {e}")
    print("\nPlease check:")
    print("1. Your password is set correctly in .env file")
    print("2. Your username is: ri-team\\brian.c")
    print("3. The SQL Server is reachable")
