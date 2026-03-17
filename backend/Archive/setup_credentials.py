"""Secure credential setup script."""
import getpass
import os

print("=" * 60)
print("Secure Credential Setup")
print("=" * 60)
print("\nThis will securely update your .env file with credentials.")
print("Your password will NOT be visible as you type.\n")

username = input("Enter your username (default: ri-team\\brian.c): ").strip()
if not username:
    username = "ri-team\\brian.c"

password = getpass.getpass("Enter your password: ")

if not password:
    print("\n[ERROR] Password cannot be empty!")
    exit(1)

# Read current .env
env_path = ".env"
with open(env_path, 'r') as f:
    lines = f.readlines()

# Update the lines
new_lines = []
for line in lines:
    if line.startswith("SQL_USERNAME="):
        new_lines.append(f"SQL_USERNAME={username}\n")
    elif line.startswith("SQL_PASSWORD="):
        new_lines.append(f"SQL_PASSWORD={password}\n")
    else:
        new_lines.append(line)

# Write back
with open(env_path, 'w') as f:
    f.writelines(new_lines)

print("\n[OK] Credentials saved to .env file!")
print(f"Username: {username}")
print("Password: ********")
print("\nNow testing connection...")

# Test the connection
from db import db
try:
    db.connect()
    print("\n[SUCCESS] Connection works! You're all set!")
    db.disconnect()
except Exception as e:
    print(f"\n[ERROR] Connection failed: {e}")
    print("\nTroubleshooting:")
    print("1. Verify your password is correct")
    print("2. Try running: uv run python test_formats.py")
    print("   (This will test different username formats)")
