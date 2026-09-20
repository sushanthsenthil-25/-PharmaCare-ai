from datetime import datetime, date, timezone
from typing import Optional

from beanie import Document, Indexed
from pydantic import Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Supplier(Document):
    business_id: Indexed(str)  # type: ignore[valid-type]
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    drug_license_no: Optional[str] = None
    gstin: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "suppliers"


class Batch(Document):
    product_id: Indexed(str)  # type: ignore[valid-type]
    branch_id: Indexed(str)  # type: ignore[valid-type]
    supplier_id: Optional[str] = None
    batch_no: str
    mfg_date: Optional[date] = None
    expiry_date: date
    purchase_price: float
    selling_price: Optional[float] = None
    qty_received: int = 0
    qty_remaining: int = 0
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "batches"


class Inventory(Document):
    product_id: Indexed(str)  # type: ignore[valid-type]
    branch_id: Indexed(str)  # type: ignore[valid-type]
    qty_on_hand: int = 0
    last_updated: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "inventory"


class InventoryMovement(Document):
    business_id: Indexed(str)  # type: ignore[valid-type]
    product_id: Indexed(str)  # type: ignore[valid-type]
    branch_id: str
    batch_id: Optional[str] = None
    movement_type: str  # PURCHASE|SALE|RETURN|ADJUSTMENT|WASTAGE|EXPIRY
    qty_change: int
    qty_before: int
    qty_after: int
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    notes: Optional[str] = None
    created_by: str
    created_at: Indexed(datetime) = Field(default_factory=utcnow)  # type: ignore[valid-type]

    class Settings:
        name = "inventory_movements"
