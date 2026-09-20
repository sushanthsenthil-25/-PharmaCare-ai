"""
Fetches the SUPABASE_ANON_KEY using the Supabase Management API.
Run: python -X utf8 fetch_anon_key.py
Set env vars before running:
  SUPABASE_PROJECT_REF=your_project_ref
  SUPABASE_MANAGEMENT_KEY=your_management_key
"""
import sys, io, os, httpx
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"), override=True)

PROJECT_REF    = os.environ.get("SUPABASE_PROJECT_REF", "")
MANAGEMENT_KEY = os.environ.get("SUPABASE_MANAGEMENT_KEY", "")

if not PROJECT_REF or not MANAGEMENT_KEY:
    print("[FAIL] Set SUPABASE_PROJECT_REF and SUPABASE_MANAGEMENT_KEY in backend/.env first")
    sys.exit(1)

print("=" * 60)
print("Fetching SUPABASE_ANON_KEY via Management API")
print("=" * 60)

try:
    resp = httpx.get(
        f"https://api.supabase.com/v1/projects/{PROJECT_REF}/api-keys",
        headers={"Authorization": f"Bearer {MANAGEMENT_KEY}"},
        timeout=10,
    )
    if resp.status_code == 200:
        for k in resp.json():
            name = k.get("name", "")
            api_key = k.get("api_key", "")
            print(f"\n  {name}: {api_key}")
    else:
        print(f"[FAIL] HTTP {resp.status_code}: {resp.text[:300]}")
except Exception as e:
    print(f"[FAIL] {e}")
