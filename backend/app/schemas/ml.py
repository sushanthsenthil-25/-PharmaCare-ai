from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.schemas.common import StrId, OptStrId


class DemandPredictRequest(BaseModel):
    product_id: StrId
    horizon_days: int = Field(default=30, ge=1, le=90)


class DemandPredictResponse(BaseModel):
    product_id: StrId
    product_name: str
    has_sufficient_data: bool
    data_points_found: int
    minimum_required: int = 5
    predicted_daily_demand: Optional[float] = None
    predicted_horizon_demand: Optional[float] = None
    confidence_score: Optional[float] = None
    trend: Optional[str] = None  # "INCREASING" | "STABLE" | "DECREASING"
    notes: str


class StockPredictResponse(BaseModel):
    product_id: StrId
    product_name: str
    current_stock: int
    predicted_daily_burn_rate: Optional[float] = None
    estimated_days_until_stockout: Optional[int] = None
    recommended_reorder_qty: Optional[int] = None
    urgency_level: str  # "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
    has_sufficient_data: bool
    notes: str


class ExpiryRiskItem(BaseModel):
    batch_id: StrId
    batch_no: str
    product_name: str
    expiry_date: str
    remaining_qty: int
    predicted_sales_before_expiry: Optional[int] = None
    estimated_wastage_qty: Optional[int] = None
    risk_level: str  # "HIGH" | "MEDIUM" | "LOW"


class ExpiryRiskResponse(BaseModel):
    batches: List[ExpiryRiskItem]
    total_at_risk_qty: int
    estimated_loss_value: float


class AnomalyItem(BaseModel):
    anomaly_type: str  # "INVENTORY_DISCREPANCY" | "PRICE_DEVIATION" | "SPIKE_SALE"
    severity: str  # "CRITICAL" | "WARNING" | "INFO"
    product_id: OptStrId = None
    product_name: Optional[str] = None
    description: str
    observed_value: float
    expected_range: str
    score: float


class AnomalyDetectionResponse(BaseModel):
    total_anomalies: int
    anomalies: List[AnomalyItem]
    checked_products_count: int


class MLFeedbackCreate(BaseModel):
    prediction_id: OptStrId = None
    prediction_type: str
    actual_value: Optional[float] = None
    predicted_value: Optional[float] = None
    accuracy_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    notes: Optional[str] = None


class MLFeedbackResponse(BaseModel):
    id: StrId
    business_id: StrId
    prediction_type: str
    actual_value: Optional[float] = None
    predicted_value: Optional[float] = None
    accuracy_score: Optional[float] = None
    created_at: datetime
    model_config = {"from_attributes": True}
