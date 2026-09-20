from pydantic import BaseModel
from typing import List, Optional
from app.schemas.common import StrId, OptStrId


class SalesTrendPoint(BaseModel):
    date: str
    sales_count: int
    revenue: float
    total_items: int


class SalesTrendsResponse(BaseModel):
    period_days: int
    data: List[SalesTrendPoint]
    total_revenue: float
    total_sales: int


class PurchaseTrendPoint(BaseModel):
    date: str
    purchases_count: int
    total_spent: float


class PurchaseTrendsResponse(BaseModel):
    period_days: int
    data: List[PurchaseTrendPoint]
    total_spent: float


class ProductPerformanceItem(BaseModel):
    product_id: StrId
    product_name: str
    sku: str
    qty_sold: int
    revenue: float
    profit: float


class ProductPerformanceResponse(BaseModel):
    top_selling: List[ProductPerformanceItem]
    slow_moving: List[ProductPerformanceItem]


class InventoryTurnoverResponse(BaseModel):
    total_inventory_value: float
    cost_of_goods_sold: float
    turnover_ratio: float
    average_days_to_sell: float


class ExpiryTrendItem(BaseModel):
    period: str  # "0-7 days", "8-15 days", "16-30 days", "Expired"
    batch_count: int
    total_quantity: int
    estimated_loss_value: float


class ExpiryTrendsResponse(BaseModel):
    summary: List[ExpiryTrendItem]
    total_at_risk_value: float


class RevenueMetricsResponse(BaseModel):
    today_revenue: float
    this_week_revenue: float
    this_month_revenue: float
    average_order_value: float
