from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from app.schemas.common import StrId, OptStrId


class SupplierCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    drug_license_no: Optional[str] = None
    gstin: Optional[str] = None


class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    drug_license_no: Optional[str] = None
    gstin: Optional[str] = None
    is_active: Optional[bool] = None


class SupplierResponse(BaseModel):
    id: StrId
    business_id: StrId
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    drug_license_no: Optional[str] = None
    gstin: Optional[str] = None
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class BatchCreate(BaseModel):
    product_id: StrId
    branch_id: StrId
    supplier_id: OptStrId = None
    batch_no: str = Field(..., min_length=1)
    mfg_date: Optional[date] = None
    expiry_date: date
    purchase_price: float = Field(..., ge=0)
    selling_price: Optional[float] = Field(None, ge=0)
    qty_received: int = Field(..., gt=0)


class BatchResponse(BaseModel):
    id: StrId
    product_id: StrId
    branch_id: StrId
    supplier_id: OptStrId = None
    batch_no: str
    mfg_date: Optional[date] = None
    expiry_date: date
    purchase_price: float
    selling_price: Optional[float] = None
    qty_received: int
    qty_remaining: int
    created_at: datetime
    model_config = {"from_attributes": True}


class InventoryResponse(BaseModel):
    id: StrId
    product_id: StrId
    branch_id: StrId
    product_name: Optional[str] = None
    sku: Optional[str] = None
    qty_on_hand: int
    reorder_level: Optional[int] = 10
    last_updated: datetime
    model_config = {"from_attributes": True}


class StockAdjustmentRequest(BaseModel):
    product_id: StrId
    branch_id: StrId
    batch_id: OptStrId = None
    qty_change: int = Field(..., description="Positive to add, negative to subtract")
    movement_type: str = Field(..., pattern="^(ADJUSTMENT|WASTAGE|EXPIRY|RETURN)$")
    notes: Optional[str] = None


class InventoryMovementResponse(BaseModel):
    id: StrId
    business_id: StrId
    product_id: StrId
    branch_id: StrId
    batch_id: OptStrId = None
    movement_type: str
    qty_change: int
    qty_before: int
    qty_after: int
    reference_type: Optional[str] = None
    reference_id: OptStrId = None
    notes: Optional[str] = None
    created_by: StrId
    created_at: datetime
    model_config = {"from_attributes": True}
