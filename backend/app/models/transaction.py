from datetime import datetime, timezone
from typing import Optional

from beanie import Document, Indexed
from pydantic import Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Customer(Document):
    business_id: Indexed(str)  # type: ignore[valid-type]
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "customers"


class Sale(Document):
    business_id: Indexed(str)  # type: ignore[valid-type]
    branch_id: str
    customer_id: Optional[str] = None
    invoice_no: Optional[str] = None
    subtotal: float = 0.0
    discount_amount: float = 0.0
    tax_amount: float = 0.0
    total_amount: float
    payment_mode: str = "CASH"  # CASH|UPI|CARD|CREDIT
    payment_status: str = "PAID"
    notes: Optional[str] = None
    created_by: str
    created_at: Indexed(datetime) = Field(default_factory=utcnow)  # type: ignore[valid-type]

    class Settings:
        name = "sales"


class SaleItem(Document):
    sale_id: Indexed(str)  # type: ignore[valid-type]
    product_id: str
    batch_id: Optional[str] = None
    qty: int
    unit_price: float
    discount_pct: float = 0.0
    line_total: float

    class Settings:
        name = "sale_items"


class Purchase(Document):
    business_id: Indexed(str)  # type: ignore[valid-type]
    branch_id: str
    supplier_id: Optional[str] = None
    invoice_no: Optional[str] = None
    subtotal: float = 0.0
    tax_amount: float = 0.0
    total_amount: float
    payment_mode: str = "CREDIT"
    notes: Optional[str] = None
    received_at: Optional[datetime] = None
    created_by: str
    created_at: Indexed(datetime) = Field(default_factory=utcnow)  # type: ignore[valid-type]

    class Settings:
        name = "purchases"


class PurchaseItem(Document):
    purchase_id: Indexed(str)  # type: ignore[valid-type]
    product_id: str
    batch_id: Optional[str] = None
    qty: int
    unit_cost: float
    line_total: float

    class Settings:
        name = "purchase_items"
