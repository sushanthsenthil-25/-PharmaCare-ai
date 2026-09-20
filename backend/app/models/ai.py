from datetime import datetime, timezone
from typing import Optional, Any, Dict

from beanie import Document, Indexed
from pydantic import Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AIPrediction(Document):
    business_id: Indexed(str)  # type: ignore[valid-type]
    product_id: Optional[str] = None
    prediction_type: str  # DEMAND|STOCK|EXPIRY|ANOMALY
    predicted_value: Optional[float] = None
    confidence: Optional[float] = None
    data_points: Optional[int] = None
    metadata_: Optional[Dict[str, Any]] = Field(None, alias="metadata")
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "ai_predictions"


class VoiceCommand(Document):
    user_id: Indexed(str)  # type: ignore[valid-type]
    business_id: Indexed(str)  # type: ignore[valid-type]
    transcript: str
    language: Optional[str] = None
    intent: Optional[str] = None
    entities: Optional[Dict[str, Any]] = None
    result: Optional[Dict[str, Any]] = None
    action_type: Optional[str] = None  # READ | WRITE
    confirmed: Optional[bool] = None
    execution_status: Optional[str] = None  # PENDING|CONFIRMED|EXECUTED|REJECTED
    created_at: Indexed(datetime) = Field(default_factory=utcnow)  # type: ignore[valid-type]

    class Settings:
        name = "voice_commands"


class AIPreference(Document):
    business_id: Indexed(str, unique=True)  # type: ignore[valid-type]
    preferred_language: str = "en"
    voice_enabled: bool = True
    auto_reorder_enabled: bool = False
    ai_write_actions_enabled: bool = True
    settings: Optional[Dict[str, Any]] = None
    updated_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "ai_preferences"


class MLFeedback(Document):
    business_id: Indexed(str)  # type: ignore[valid-type]
    prediction_id: Optional[str] = None
    prediction_type: Indexed(str)  # type: ignore[valid-type]
    actual_value: Optional[float] = None
    predicted_value: Optional[float] = None
    accuracy_score: Optional[float] = None
    notes: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "ml_feedback"
