from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.core.config import settings
from app.db.mongodb import init_db, close_db
from app.routers import (
    health,
    auth,
    products,
    inventory,
    sales,
    purchases,
    orders,
    shipments,
    alerts,
    dashboard,
    analytics,
    ai,
    ml,
    audit,
    public_api,
)
from app.websocket.router import ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialise MongoDB + Beanie
    await init_db()
    yield
    # Shutdown: close Motor client
    await close_db()


app = FastAPI(
    title="PharmaCare AI — Production Backend",
    description="Enterprise-grade pharmacy management and clinical AI backend powered by FastAPI & MongoDB.",
    version="1.0.0",
    openapi_url="/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS Middleware
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Global Exception Handlers
# ---------------------------------------------------------------------------
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors(), "message": "Validation error"},
    )


# ---------------------------------------------------------------------------
# Include Routers
# ---------------------------------------------------------------------------
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(products.router)
app.include_router(inventory.router)
app.include_router(sales.router)
app.include_router(purchases.router)
app.include_router(orders.router)
app.include_router(shipments.router)
app.include_router(alerts.router)
app.include_router(dashboard.router)
app.include_router(analytics.router)
app.include_router(ai.router)
app.include_router(ml.router)
app.include_router(audit.router)
app.include_router(public_api.router)
app.include_router(ws_router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "service": "PharmaCare AI API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
        "ready": "/ready",
    }
