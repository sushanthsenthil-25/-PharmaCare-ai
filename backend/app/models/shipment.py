from datetime import datetime, timezone
from typing import Optional

from beanie import Document, Indexed
from pydantic import Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


SHIPMENT_STATUSES = ["PENDING", "PROCESSING", "COMPLETED", "CANCELLED", "FAILED"]


class ImportShipment(Document):
    business_id: Indexed(str)  # type: ignore[valid-type]
    supplier_id: Optional[str] = None
    purchase_id: Optional[str] = None
    status: Indexed(str) = "PENDING"  # type: ignore[valid-type]
    tracking_no: Optional[str] = None
    origin_country: Optional[str] = None
    carrier: Optional[str] = None
    shipment_date: Optional[datetime] = None
    expected_arrival: Optional[datetime] = None
    actual_arrival: Optional[datetime] = None
    total_value: Optional[float] = None
    notes: Optional[str] = None
    created_by: str
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "import_shipments"


class ExportShipment(Document):
    business_id: Indexed(str)  # type: ignore[valid-type]
    customer_id: Optional[str] = None
    sale_id: Optional[str] = None
    status: Indexed(str) = "PENDING"  # type: ignore[valid-type]
    tracking_no: Optional[str] = None
    destination_country: Optional[str] = None
    carrier: Optional[str] = None
    shipment_date: Optional[datetime] = None
    expected_delivery: Optional[datetime] = None
    actual_delivery: Optional[datetime] = None
    total_value: Optional[float] = None
    notes: Optional[str] = None
    created_by: str
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "export_shipments"
