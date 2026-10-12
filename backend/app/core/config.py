import os
import importlib
from typing import List, Any, Dict
from pydantic import BaseModel

try:
    _ps = importlib.import_module("pydantic_settings")
    BaseSettings = getattr(_ps, "BaseSettings", BaseModel)
except Exception:
    BaseSettings = BaseModel


class Settings(BaseSettings):
    model_config: Dict[str, Any] = {"extra": "ignore", "env_file": ".env", "env_file_encoding": "utf-8"}

        
    # Database (MongoDB)
    MONGODB_URL: str = ""
    MONGODB_URI: str = ""
    MONGODB_DB_NAME: str = "pharmacare_ai"

    @property
    def mongodb_connection_string(self) -> str:
        connection_string = (
            os.getenv("MONGODB_URL", "").strip()
            or os.getenv("MONGODB_URI", "").strip()
            or self.MONGODB_URL.strip()
            or self.MONGODB_URI.strip()
        )

        if not connection_string:
            raise ValueError(
                "MongoDB connection string is missing. "
                "Set MONGODB_URL in backend/.env or Vercel environment variables."
            )

        return connection_string


    # JWT
    JWT_SECRET: str = "dev-secret-change-in-production-must-be-64-chars-minimum"
    JWT_REFRESH_SECRET: str = "dev-refresh-secret-change-in-production-64-chars"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,https://pharma-care-ai-slcb.vercel.app"

    @property
    def cors_origins_list(self) -> List[str]:
        raw = os.getenv("CORS_ORIGINS", "").strip() or self.CORS_ORIGINS.strip()
        if not raw:
            return ["http://localhost:5173", "https://pharma-care-ai-slcb.vercel.app"]
        if raw == "*":
            if self.is_production:
                return ["https://pharma-care-ai-slcb.vercel.app"]
            return ["*"]
        return [o.strip().rstrip("/") for o in raw.split(",") if o.strip()]

    # AI / Speech
    AI_API_KEY: str = ""
    STT_API_KEY: str = ""
    TTS_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    GOOGLE_APPLICATION_CREDENTIALS: str = ""

    # Redis
    REDIS_URL: str = ""

    # App
    ENVIRONMENT: str = "development"
    RATE_LIMIT_PER_MINUTE: int = 60

    # Alert thresholds
    EXPIRY_ALERT_DAYS_30: int = 30
    EXPIRY_ALERT_DAYS_15: int = 15
    EXPIRY_ALERT_DAYS_7: int = 7
    LOW_STOCK_MULTIPLIER: float = 1.5

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"


settings = Settings()
