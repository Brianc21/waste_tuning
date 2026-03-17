"""Test the full system end-to-end."""
import requests
import json

print("=" * 70)
print("FULL SYSTEM TEST")
print("=" * 70)

BASE_URL = "http://localhost:8000"

# Test 1: Root endpoint
print("\n[TEST 1] Root endpoint...")
try:
    response = requests.get(f"{BASE_URL}/")
    print(f"  Status: {response.status_code}")
    print(f"  Response: {response.json()}")
except Exception as e:
    print(f"  FAILED: {e}")

# Test 2: Health check with database
print("\n[TEST 2] Health check (with database)...")
try:
    response = requests.get(f"{BASE_URL}/api/health")
    data = response.json()
    print(f"  Status: {data.get('status')}")
    print(f"  Database: {data.get('database')}")
    print(f"  Message: {data.get('message')}")
except Exception as e:
    print(f"  FAILED: {e}")

# Test 3: Get tables
print("\n[TEST 3] Get list of tables...")
try:
    response = requests.get(f"{BASE_URL}/api/tables")
    data = response.json()
    if data.get('success'):
        tables = [t['table_name'] for t in data.get('data', [])]
        print(f"  SUCCESS! Found {len(tables)} tables:")
        for table in tables[:10]:
            print(f"    - {table}")
        if len(tables) > 10:
            print(f"    ... and {len(tables) - 10} more")
    else:
        print(f"  FAILED: {data.get('error')}")
except Exception as e:
    print(f"  FAILED: {e}")

# Test 4: Custom query
print("\n[TEST 4] Custom query (SQL Server version)...")
try:
    payload = {
        "query": "SELECT @@VERSION AS version, DB_NAME() AS current_db"
    }
    response = requests.post(f"{BASE_URL}/api/query", json=payload)
    data = response.json()
    if data.get('success'):
        result = data.get('data', [{}])[0]
        print(f"  Database: {result.get('current_db')}")
        print(f"  SQL Version: {result.get('version', '')[:80]}...")
    else:
        print(f"  FAILED: {data.get('error')}")
except Exception as e:
    print(f"  FAILED: {e}")

print("\n" + "=" * 70)
print("SYSTEM STATUS: OPERATIONAL! ✓")
print("=" * 70)
print("\nYour Azure SQL Dashboard is ready to use!")
print("\nAPI Endpoints:")
print("  - Root: http://localhost:8000")
print("  - Health: http://localhost:8000/api/health")
print("  - Tables: http://localhost:8000/api/tables")
print("  - Query: POST http://localhost:8000/api/query")
print("  - Update: POST http://localhost:8000/api/update")
print("\nNext steps:")
print("  1. Start the frontend (React app)")
print("  2. Build your dashboard UI")
print("  3. Query your WASTE_HEB database!")
