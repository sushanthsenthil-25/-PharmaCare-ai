from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database (MongoDB)
    MONGODB_URL: str = ""
    MONGODB_URI: str = ""
    MONGODB_DB_NAME: str = "pharmacare"

    @property
    def mongodb_connection_string(self) -> str:
        import os
        return (
            os.getenv("MONGODB_URI")
            or os.getenv("MONGODB_URL")
            or self.MONGODB_URI
            or self.MONGODB_URL
            or "mongodb+srv://sushanthsenthil:sushanth2005@cluster0.p7102kd.mongodb.net/pharmacare?retryWrites=true&w=majority"
        )

    # JWT
    JWT_SECRET: str = "dev-secret-change-in-production-must-be-64-chars-minimum"
    JWT_REFRESH_SECRET: str = "dev-refresh-secret-change-in-production-64-chars"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: str = "*"

    @property
    def cors_origins_list(self) -> List[str]:
        if self.CORS_ORIGINS == "*":
            return ["*"]
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
