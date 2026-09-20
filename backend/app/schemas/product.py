from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
from app.schemas.common import StrId, OptStrId


class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    parent_id: OptStrId = None


class CategoryResponse(BaseModel):
    id: StrId
    name: str
    parent_id: OptStrId = None
    is_active: bool
    model_config = {"from_attributes": True}


class ProductCreate(BaseModel):
    sku: str = Field(..., min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=255)
    category_id: OptStrId = None
    manufacturer: Optional[str] = None
    description: Optional[str] = None
    composition: Optional[str] = None
    purchase_price: float = Field(..., ge=0)
    selling_price: float = Field(..., ge=0)
    mrp: Optional[float] = Field(None, ge=0)
    reorder_level: int = Field(default=10, ge=0)
    rx_required: bool = False
    image_url: Optional[str] = None
    status: str = Field(default="ACTIVE", pattern="^(ACTIVE|INACTIVE|DISCONTINUED)$")

    @field_validator("selling_price")
    @classmethod
    def selling_gte_purchase(cls, v, info):
        return v


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    category_id: OptStrId = None
    manufacturer: Optional[str] = None
    description: Optional[str] = None
    composition: Optional[str] = None
    purchase_price: Optional[float] = Field(None, ge=0)
    selling_price: Optional[float] = Field(None, ge=0)
    mrp: Optional[float] = Field(None, ge=0)
    reorder_level: Optional[int] = Field(None, ge=0)
    rx_required: Optional[bool] = None
    image_url: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(ACTIVE|INACTIVE|DISCONTINUED)$")


class ProductResponse(BaseModel):
    id: StrId
    business_id: StrId
    sku: str
    name: str
    category_id: OptStrId = None
    manufacturer: Optional[str] = None
    description: Optional[str] = None
    composition: Optional[str] = None
    purchase_price: float
    selling_price: float
    mrp: Optional[float] = None
    reorder_level: int
    rx_required: bool
    image_url: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProductListResponse(BaseModel):
    items: List[ProductResponse]
    total: int
    page: int
    page_size: int
