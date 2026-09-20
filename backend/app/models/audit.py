from datetime import datetime, timezone
from typing import Optional, Any, Dict

from beanie import Document, Indexed
from pydantic import Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


AUDIT_ACTIONS = [
    "LOGIN", "LOGOUT", "REGISTER",
    "PRODUCT_CREATE", "PRODUCT_UPDATE", "PRODUCT_DELETE",
    "INVENTORY_ADJUSTMENT",
    "SALE_CREATE",
    "PURCHASE_CREATE",
    "ORDER_CREATE", "ORDER_STATUS_UPDATE",
    "IMPORT_CREATE", "IMPORT_STATUS_UPDATE",
    "EXPORT_CREATE", "EXPORT_STATUS_UPDATE",
    "AI_ACTION", "VOICE_ACTION",
    "PERMISSION_FAILURE",
    "USER_CREATE", "USER_UPDATE",
]


class AuditLog(Document):
    user_id: Optional[str] = None
    business_id: Optional[str] = None
    action: Indexed(str)  # type: ignore[valid-type]
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    changes: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    status: str = "SUCCESS"  # SUCCESS | FAILURE
    created_at: Indexed(datetime) = Field(default_factory=utcnow)  # type: ignore[valid-type]

    class Settings:
        name = "audit_logs"
