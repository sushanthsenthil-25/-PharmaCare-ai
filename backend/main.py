from app.main import app

# Export app for Vercel Serverless Functions and ASGI runners
__all__ = ["app"]

if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)

