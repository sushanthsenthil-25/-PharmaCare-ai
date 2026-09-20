from datetime import datetime, timezone
from typing import Optional

from beanie import Document, Indexed
from pydantic import Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


ALERT_TYPES = ["LOW_STOCK", "OUT_OF_STOCK", "EXPIRING_SOON", "EXPIRED", "INVENTORY_ANOMALY", "PRICE_ANOMALY"]
ALERT_SEVERITIES = ["INFO", "WARNING", "CRITICAL"]


class Alert(Document):
    business_id: Indexed(str)  # type: ignore[valid-type]
    branch_id: Optional[str] = None
    alert_type: Indexed(str)  # type: ignore[valid-type]
    severity: str = "WARNING"
    product_id: Optional[str] = None
    batch_id: Optional[str] = None
    title: str
    message: str
    is_read: bool = False
    is_resolved: bool = False
    created_at: Indexed(datetime) = Field(default_factory=utcnow)  # type: ignore[valid-type]
    resolved_at: Optional[datetime] = None

    class Settings:
        name = "alerts"
