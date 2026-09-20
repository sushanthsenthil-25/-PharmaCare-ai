from datetime import datetime, timezone
from typing import Optional

from beanie import Document, Indexed
from pydantic import Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Category(Document):
    business_id: Indexed(str)  # type: ignore[valid-type]
    name: str
    parent_id: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "categories"


class Product(Document):
    business_id: Indexed(str)  # type: ignore[valid-type]
    category_id: Optional[str] = None
    sku: str
    name: str
    manufacturer: Optional[str] = None
    description: Optional[str] = None
    composition: Optional[str] = None
    purchase_price: float = 0.0
    selling_price: float = 0.0
    mrp: Optional[float] = None
    reorder_level: int = 10
    rx_required: bool = False
    image_url: Optional[str] = None
    status: str = "ACTIVE"  # ACTIVE | INACTIVE | DISCONTINUED
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "products"
