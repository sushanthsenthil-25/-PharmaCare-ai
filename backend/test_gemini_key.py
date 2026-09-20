"""
Debug script: Verifies GEMINI_API_KEY is loaded correctly and the Gemini API responds.
Run from: backend/ directory
  python test_gemini_key.py
"""
import sys
import os

# Fix Windows console encoding
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# ── Step 1: Load settings ─────────────────────────────────────────────────────
print("=" * 60)
print("STEP 1 - Loading settings from config.py / .env")
print("=" * 60)

try:
    from app.core.config import settings
    key = settings.GEMINI_API_KEY
    if not key:
        print("[FAIL] GEMINI_API_KEY is EMPTY - check backend/.env or config.py default")
        sys.exit(1)
    masked = key[:8] + "..." + key[-6:]
    print(f"[OK] GEMINI_API_KEY loaded: {masked}")
    print(f"     Key length : {len(key)} chars")
except Exception as e:
    print(f"[FAIL] Failed to import settings: {e}")
    sys.exit(1)

# ── Step 2: Configure Gemini client ──────────────────────────────────────────
print("\n" + "=" * 60)
print("STEP 2 - Configuring google-generativeai client")
print("=" * 60)

try:
    import google.generativeai as genai
    genai.configure(api_key=key)
    print("[OK] genai.configure() succeeded")
except ImportError:
    print("[FAIL] google-generativeai not installed - run: pip install google-generativeai")
    sys.exit(1)
except Exception as e:
    print(f"[FAIL] genai.configure() failed: {e}")
    sys.exit(1)

# ── Step 3: List available models ────────────────────────────────────────────
print("\n" + "=" * 60)
print("STEP 3 - Listing available Gemini models (API connectivity test)")
print("=" * 60)

try:
    models = [m.name for m in genai.list_models() if "generateContent" in m.supported_generation_methods]
    if models:
        print(f"[OK] API key is VALID - {len(models)} model(s) accessible:")
        for m in models[:5]:
            print(f"     - {m}")
    else:
        print("[WARN] Key accepted but no models returned - check API quota or region")
except Exception as e:
    print(f"[FAIL] API key INVALID or network error:\n   {e}")
    sys.exit(1)

# ── Step 4: Real inference test ───────────────────────────────────────────────
print("\n" + "=" * 60)
print("STEP 4 - Sending a test prompt to Gemini")
print("=" * 60)

try:
    target_model = "models/gemini-3.6-flash" if "models/gemini-3.6-flash" in models else "models/gemini-flash-latest"
    print(f"  Testing with model: {target_model}")
    model = genai.GenerativeModel(target_model)
    response = model.generate_content("Say: 'PharmaCare AI key test successful' and nothing else.")
    reply = response.text.strip()
    print(f"[OK] Gemini responded: \"{reply}\"")
except Exception as e:
    print(f"[FAIL] Inference failed: {e}")
    sys.exit(1)

# ── Summary ───────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("[PASS] ALL CHECKS PASSED - GEMINI_API_KEY is working correctly!")
print("=" * 60)
