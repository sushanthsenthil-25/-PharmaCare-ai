"""
Database connection test script for local MongoDB.
Run from: backend/ directory
  python test_db.py
"""
import sys, io, os, asyncio
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Force load the backend .env relative to this script's location
from dotenv import load_dotenv
_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(dotenv_path=_env_path, override=True)

print("=" * 60)
print("LOCAL MONGODB CONNECTION TESTER")
print("=" * 60)
print(f"  Loading .env from: {_env_path}")

# ── Step 1: Read env vars ─────────────────────────────────────────────────────
print("\n[STEP 1] Reading MONGODB_URL and MONGODB_DB_NAME from .env")

MONGODB_URL = os.environ.get("MONGODB_URL", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.environ.get("MONGODB_DB_NAME", "pharmacare")

print(f"  MONGODB_URL:     {MONGODB_URL}")
print(f"  MONGODB_DB_NAME: {MONGODB_DB_NAME}")

# ── Step 2: Validate URL format ───────────────────────────────────────────────
print("\n[STEP 2] Validating MONGODB_URL format")

if not (MONGODB_URL.startswith("mongodb://") or MONGODB_URL.startswith("mongodb+srv://")):
    print("  [FAIL] MONGODB_URL must start with 'mongodb://' or 'mongodb+srv://'")
    print("  Example: mongodb://localhost:27017")
    sys.exit(1)

print("  [OK] URL format looks valid")

# ── Step 3: MongoDB connection test ──────────────────────────────────────────
print("\n[STEP 3] Testing MongoDB connection via Motor")

from motor.motor_asyncio import AsyncIOMotorClient

async def test_db():
    client = AsyncIOMotorClient(MONGODB_URL, serverSelectionTimeoutMS=5000)
    try:
        info = await asyncio.wait_for(client.server_info(), timeout=6)
        print(f"  [OK] MongoDB connected!")
        print(f"  [INFO] MongoDB Version: {info.get('version', 'unknown')}")
        db = client[MONGODB_DB_NAME]
        collections = await db.list_collection_names()
        print(f"  [INFO] Database '{MONGODB_DB_NAME}' collections: {collections}")
        return True
    except asyncio.TimeoutError:
        print("  [FAIL] Connection timed out — is MongoDB service running on your machine?")
        print("         Check host/port in MONGODB_URL")
        return False
    except Exception as e:
        print(f"  [FAIL] Connection error: {e}")
        print("\n  Common fixes:")
        print("   - Make sure MongoDB service is running (e.g. 'Start-Service MongoDB')")
        print("   - Check host and port in MONGODB_URL in backend/.env")
        return False
    finally:
        client.close()

db_ok = asyncio.run(test_db())

# ── Summary ───────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
if db_ok:
    print("[PASS] MongoDB connection successful!")
else:
    print("[FAIL] Could not connect to MongoDB.")
    print("       Fix MONGODB_URL in backend/.env and re-run.")
print("=" * 60)
