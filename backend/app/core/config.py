from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database (MongoDB)
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "pharmacare"

    # JWT
    JWT_SECRET: str = "dev-secret-change-in-production-must-be-64-chars-minimum"
    JWT_REFRESH_SECRET: str = "dev-refresh-secret-change-in-production-64-chars"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

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
