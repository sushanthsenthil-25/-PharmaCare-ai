from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from app.schemas.common import StrId, OptStrId


class VoiceProcessRequest(BaseModel):
    command_text: Optional[str] = None
    audio_base64: Optional[str] = None
    language_hint: Optional[str] = "auto"  # "en", "ta", "tanglish", "auto"


class VoiceResponse(BaseModel):
    command_id: StrId
    transcript: str
    detected_language: str
    intent: str
    entities: Dict[str, Any]
    action_type: str  # "READ" | "WRITE"
    requires_confirmation: bool
    confirmation_prompt: Optional[str] = None
    tts_text: str
    result: Optional[Dict[str, Any]] = None
    execution_status: str  # "EXECUTED" | "PENDING_CONFIRMATION" | "FAILED"


class VoiceConfirmRequest(BaseModel):
    command_id: StrId
    confirmed: bool
