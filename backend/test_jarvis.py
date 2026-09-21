"""
End-to-end JARVIS test script.
Run from the backend directory: python test_jarvis.py
"""
import os
import sys
import asyncio

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))


async def run_tests():
    from app.services.jarvis_ai import jarvis_service, GEMINI_MODEL

    print(f"=== JARVIS AI Test Suite ===")
    print(f"Model          : {GEMINI_MODEL}")
    print(f"Gemini available: {jarvis_service.genai_available}")
    print()

    tests = [
        ("Hello Jarvis", "GREETING"),
        ("Tell me about Dolo", "PRODUCT_SEARCH"),
        ("Show me paracetamol", "PRODUCT_SEARCH"),
        ("How is the weather?", "WEATHER"),
        ("Where is my order?", "ORDER_TRACKING"),
    ]

    passed = 0
    failed = 0

    for msg, expected_intent in tests:
        try:
            intent = jarvis_service.classify_intent(msg)
            result = await jarvis_service.generate_response(msg)
            got_message = bool(result.get("message"))
            intent_ok = intent == expected_intent

            if got_message:
                passed += 1
                status = "PASS"
            else:
                failed += 1
                status = "FAIL (no message)"

            intent_label = "OK" if intent_ok else f"MISMATCH (got {intent}, expected {expected_intent})"
            print(f"[{status}] [{intent_label}]")
            print(f"  Input   : {repr(msg)}")
            print(f"  Intent  : {intent}")
            print(f"  Type    : {result.get('type', '?')}")
            print(f"  Products: {len(result.get('products', []))}")
            print(f"  Message : {result.get('message', '')[:90]}")
            print()
        except Exception as e:
            import traceback
            failed += 1
            print(f"[FAIL] {repr(msg)}")
            print(f"  Exception: {type(e).__name__}: {e}")
            traceback.print_exc()
            print()

    # Gemini direct test
    print("--- Gemini Direct Test ---")
    try:
        reply = await jarvis_service.ask_gemini("Tell me one fun fact about medicine in one sentence.")
        if reply:
            print(f"[PASS] Gemini responded: {reply[:100]}")
            passed += 1
        else:
            print("[FAIL] Gemini returned None")
            failed += 1
    except Exception as e:
        print(f"[FAIL] Gemini exception: {type(e).__name__}: {e}")
        failed += 1

    print()
    print(f"=== Results: {passed} passed, {failed} failed ===")


if __name__ == "__main__":
    asyncio.run(run_tests())
