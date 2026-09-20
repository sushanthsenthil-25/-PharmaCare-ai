from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from app.schemas.common import StrId, OptStrId


class SaleItemCreate(BaseModel):
    product_id: StrId
    batch_id: OptStrId = None
    qty: int = Field(..., gt=0)
    unit_price: float = Field(..., gt=0)
    discount_pct: float = Field(default=0.0, ge=0, le=100)


class SaleCreate(BaseModel):
    branch_id: StrId
    customer_id: OptStrId = None
    items: List[SaleItemCreate] = Field(..., min_length=1)
    payment_mode: str = Field(default="CASH", pattern="^(CASH|UPI|CARD|CREDIT)$")
    discount_amount: float = Field(default=0.0, ge=0)
    tax_amount: float = Field(default=0.0, ge=0)
    notes: Optional[str] = None


class SaleItemResponse(BaseModel):
    id: StrId
    product_id: StrId
    batch_id: OptStrId = None
    qty: int
    unit_price: float
    discount_pct: float
    line_total: float
    model_config = {"from_attributes": True}


class SaleResponse(BaseModel):
    id: StrId
    business_id: StrId
    branch_id: StrId
    customer_id: OptStrId = None
    invoice_no: Optional[str] = None
    subtotal: float
    discount_amount: float
    tax_amount: float
    total_amount: float
    payment_mode: str
    payment_status: str
    items: List[SaleItemResponse]
    created_at: datetime
    model_config = {"from_attributes": True}


class PurchaseItemCreate(BaseModel):
    product_id: StrId
    batch_no: str = Field(..., min_length=1)
    mfg_date: Optional[date] = None
    expiry_date: date
    qty: int = Field(..., gt=0)
    unit_cost: float = Field(..., gt=0)
    supplier_id: OptStrId = None


class PurchaseCreate(BaseModel):
    branch_id: StrId
    supplier_id: OptStrId = None
    invoice_no: Optional[str] = None
    items: List[PurchaseItemCreate] = Field(..., min_length=1)
    payment_mode: str = Field(default="CREDIT", pattern="^(CASH|UPI|CARD|CREDIT|CHEQUE)$")
    tax_amount: float = Field(default=0.0, ge=0)
    notes: Optional[str] = None
    received_at: Optional[datetime] = None


class PurchaseItemResponse(BaseModel):
    id: StrId
    product_id: StrId
    batch_id: OptStrId = None
    qty: int
    unit_cost: float
    line_total: float
    model_config = {"from_attributes": True}


class PurchaseResponse(BaseModel):
    id: StrId
    business_id: StrId
    branch_id: StrId
    supplier_id: OptStrId = None
    invoice_no: Optional[str] = None
    subtotal: float
    tax_amount: float
    total_amount: float
    payment_mode: str
    items: List[PurchaseItemResponse]
    created_at: datetime
    model_config = {"from_attributes": True}
