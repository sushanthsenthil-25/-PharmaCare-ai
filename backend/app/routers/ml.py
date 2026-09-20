import uuid
from fastapi import APIRouter, Depends, Query

from app.auth.dependencies import CurrentUser, require_roles
from app.core.permissions import UserRole
from app.schemas.ml import (
    DemandPredictRequest,
    DemandPredictResponse,
    StockPredictResponse,
    ExpiryRiskResponse,
    AnomalyDetectionResponse,
    MLFeedbackCreate,
    MLFeedbackResponse,
)
from app.services.ml_service import (
    predict_demand,
    predict_stockout,
    predict_expiry_risks,
    detect_anomalies,
    submit_ml_feedback,
)

router = APIRouter(prefix="/api/v1/ml", tags=["Machine Learning"])


@router.post("/predict-demand", response_model=DemandPredictResponse)
async def get_demand_prediction(
    req: DemandPredictRequest,
    current_user: CurrentUser = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER])),
):
    """
    Predict future demand using Scikit-learn Linear Regression on real historical daily sales.
    Returns explicit insufficient-data response if historical data points < 5.
    """
    return await predict_demand(
        business_id=current_user.business_id,
        product_id=str(req.product_id),
        horizon_days=req.horizon_days,
    )


@router.get("/predict-stockout/{product_id}", response_model=StockPredictResponse)
async def get_stockout_prediction(
    product_id: str,
    current_user: CurrentUser = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER])),
):
    """Calculates days until stockout based on statistical daily burn rate."""
    return await predict_stockout(
        business_id=current_user.business_id,
        product_id=product_id,
    )


@router.get("/expiry-risks", response_model=ExpiryRiskResponse)
async def get_expiry_risks(
    current_user: CurrentUser = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER])),
):
    """Predicts batches likely to expire before selling out based on burn rate."""
    return await predict_expiry_risks(business_id=current_user.business_id)


@router.get("/anomalies", response_model=AnomalyDetectionResponse)
async def get_anomalies(
    current_user: CurrentUser = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER])),
):
    """Real inventory discrepancy and pricing anomaly detection."""
    return await detect_anomalies(business_id=current_user.business_id)


@router.post("/feedback", response_model=MLFeedbackResponse)
async def log_ml_feedback(
    req: MLFeedbackCreate,
    current_user: CurrentUser = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER])),
):
    """Submit prediction accuracy feedback for continuous model refinement."""
    return await submit_ml_feedback(
        business_id=current_user.business_id,
        user_id=current_user.id,
        req=req,
    )
