from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from datetime import datetime
from app.schemas.common import StrId, OptStrId


class OrderItemCreate(BaseModel):
    product_id: StrId
    qty: int = Field(..., gt=0)
    unit_price: float = Field(..., gt=0)


class OrderCreate(BaseModel):
    branch_id: OptStrId = None
    customer_id: OptStrId = None
    items: List[OrderItemCreate] = Field(..., min_length=1)
    delivery_address: Optional[str] = None
    delivery_pin: Optional[str] = None
    delivery_fee: float = Field(default=0.0, ge=0)
    notes: Optional[str] = None


class OrderStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(CONFIRMED|PROCESSING|SHIPPED|OUT_FOR_DELIVERY|DELIVERED|CANCELLED)$")
    rider_name: Optional[str] = None
    rider_phone: Optional[str] = None
    eta_minutes: Optional[int] = None


class OrderItemResponse(BaseModel):
    id: StrId
    product_id: StrId
    qty: int
    unit_price: float
    line_total: float
    model_config = {"from_attributes": True}


class OrderResponse(BaseModel):
    id: StrId
    business_id: StrId
    branch_id: OptStrId = None
    customer_id: OptStrId = None
    status: str
    subtotal: float
    delivery_fee: float
    total_amount: float
    delivery_address: Optional[str] = None
    rider_name: Optional[str] = None
    rider_phone: Optional[str] = None
    eta_minutes: Optional[int] = None
    items: List[OrderItemResponse]
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class ShipmentCreate(BaseModel):
    supplier_id: OptStrId = None
    customer_id: OptStrId = None
    tracking_no: Optional[str] = None
    carrier: Optional[str] = None
    total_value: Optional[float] = None
    notes: Optional[str] = None
    shipment_date: Optional[datetime] = None
    expected_date: Optional[datetime] = None


class ShipmentStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(PROCESSING|COMPLETED|CANCELLED|FAILED)$")
    tracking_no: Optional[str] = None


class ShipmentResponse(BaseModel):
    id: StrId
    business_id: StrId
    status: str
    tracking_no: Optional[str] = None
    carrier: Optional[str] = None
    total_value: Optional[float] = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class AlertResponse(BaseModel):
    id: StrId
    business_id: StrId
    alert_type: str
    severity: str
    product_id: OptStrId = None
    batch_id: OptStrId = None
    title: str
    message: str
    is_read: bool
    is_resolved: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class DashboardSummary(BaseModel):
    product_count: int
    active_product_count: int
    inventory_value: float
    low_stock_count: int
    out_of_stock_count: int
    expiring_30_days: int
    expired_count: int
    today_sales_count: int
    today_sales_total: float
    today_purchases_total: float
    active_orders: int
    unread_alerts: int


class AIChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    context_type: Optional[str] = None  # "product" | "order" | "inventory" etc.
    context_id: OptStrId = None


class AIChatResponse(BaseModel):
    message: str
    action_type: Optional[str] = None  # "READ" | "WRITE" | None
    requires_confirmation: bool = False
    confirmation_prompt: Optional[str] = None
    intent: Optional[str] = None
    entities: Optional[Dict[str, Any]] = None
    command_id: OptStrId = None


class VoiceConfirmRequest(BaseModel):
    command_id: StrId
    confirmed: bool
