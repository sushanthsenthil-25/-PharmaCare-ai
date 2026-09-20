from fastapi import APIRouter, status, Response

from app.db.mongodb import get_motor_client

router = APIRouter(tags=["Health"])


@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    """Liveness probe: verifies the application process is running."""
    return {"status": "healthy", "service": "pharmacare-ai-backend"}


@router.get("/ready", status_code=status.HTTP_200_OK)
async def readiness_check(response: Response):
    """Readiness probe: verifies the application and database connection are both functional."""
    try:
        client = get_motor_client()
        if client:
            await client.admin.command('ping')
            return {
                "status": "ready",
                "service": "pharmacare-ai-backend",
                "database": "connected",
            }
        else:
            raise Exception("MongoDB client not initialized")
    except Exception as e:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "status": "unhealthy",
            "service": "pharmacare-ai-backend",
            "database": "disconnected",
            "error": str(e),
        }
