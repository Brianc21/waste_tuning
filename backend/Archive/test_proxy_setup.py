"""Test the proxy setup to verify everything works."""
import requests
import time

print("=" * 70)
print("PROXY SETUP TEST")
print("=" * 70)

# Test 1: Check if proxy is running
print("\n[TEST 1] Checking if SQL Proxy is running...")
try:
    response = requests.get("http://localhost:8001/", timeout=2)
    if response.status_code == 200:
        print("  ✓ SQL Proxy is running!")
        data = response.json()
        print(f"  Service: {data.get('service')}")
        print(f"  Status: {data.get('status')}")
    else:
        print(f"  ✗ Proxy returned unexpected status: {response.status_code}")
        exit(1)
except requests.exceptions.ConnectionError:
    print("  ✗ FAILED - SQL Proxy is NOT running!")
    print("\n  Start it with: start_proxy.bat")
    print("  (You'll need to enter your ri-team\\brian.c password)")
    exit(1)

# Test 2: Check database connectivity through proxy
print("\n[TEST 2] Checking database connectivity...")
try:
    response = requests.get("http://localhost:8001/health", timeout=5)
    data = response.json()
    
    if data.get("status") == "healthy":
        print("  ✓ Database connection works!")
        print(f"  Server: {data.get('server')}")
        print(f"  Database: {data.get('database_name')}")
    else:
        print(f"  ✗ Database unhealthy: {data.get('error')}")
        exit(1)
except Exception as e:
    print(f"  ✗ FAILED: {e}")
    exit(1)

# Test 3: Try a simple query
print("\n[TEST 3] Testing query execution...")
try:
    payload = {
        "query": "SELECT @@VERSION AS sql_version"
    }
    response = requests.post("http://localhost:8001/query", json=payload, timeout=5)
    data = response.json()
    
    if data.get("success"):
        version = data.get("data", [{}])[0].get("sql_version", "")
        print("  ✓ Query execution works!")
        print(f"  SQL Server: {version[:80]}...")
    else:
        print(f"  ✗ Query failed: {data.get('error')}")
        exit(1)
except Exception as e:
    print(f"  ✗ FAILED: {e}")
    exit(1)

# Test 4: Get list of tables
print("\n[TEST 4] Getting table list...")
try:
    response = requests.get("http://localhost:8001/tables", timeout=5)
    data = response.json()
    
    if data.get("success"):
        tables = data.get("data", [])
        print(f"  ✓ Found {len(tables)} tables!")
        if tables:
            print(f"  First few tables:")
            for table in tables[:5]:
                print(f"    - {table.get('TABLE_NAME')}")
    else:
        print(f"  ✗ Failed: {data.get('error')}")
        exit(1)
except Exception as e:
    print(f"  ✗ FAILED: {e}")
    exit(1)

print("\n" + "=" * 70)
print("ALL TESTS PASSED! ✓")
print("=" * 70)
print("\nYour proxy setup is working correctly!")
print("You can now start the main API with: start_api.bat")
print("\nOr test it manually:")
print("  uv run python main.py")
