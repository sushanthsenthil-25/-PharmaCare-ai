from datetime import datetime, timezone
from typing import Optional

from beanie import Document, Indexed
from pydantic import Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


ORDER_STATUSES = ["CREATED", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"]


class Order(Document):
    business_id: Indexed(str)  # type: ignore[valid-type]
    branch_id: Optional[str] = None
    customer_id: Optional[str] = None
    status: str = "CREATED"
    subtotal: float = 0.0
    delivery_fee: float = 0.0
    total_amount: float = 0.0
    delivery_address: Optional[str] = None
    delivery_pin: Optional[str] = None
    rider_name: Optional[str] = None
    rider_phone: Optional[str] = None
    eta_minutes: Optional[int] = None
    notes: Optional[str] = None
    created_by: Optional[str] = None
    created_at: Indexed(datetime) = Field(default_factory=utcnow)  # type: ignore[valid-type]
    updated_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "orders"


class OrderItem(Document):
    order_id: Indexed(str)  # type: ignore[valid-type]
    product_id: str
    qty: int
    unit_price: float
    line_total: float

    class Settings:
        name = "order_items"
