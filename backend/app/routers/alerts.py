from typing import List
from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user, CurrentUser
from app.schemas.order import AlertResponse
from app.services.alert_service import list_alerts, mark_alert_read, resolve_alert

router = APIRouter(prefix="/api/v1/alerts", tags=["Alerts"])


@router.get("", response_model=List[AlertResponse])
async def get_alerts(
    unread_only: bool = False,
    limit: int = 50,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Returns real alerts evaluated against live DB:
    LOW_STOCK, OUT_OF_STOCK, EXPIRING_SOON (30d/15d/7d), EXPIRED, PRICE_ANOMALY.
    """
    return await list_alerts(
        business_id=current_user.business_id,
        unread_only=unread_only,
        limit=limit,
    )


@router.patch("/{alert_id}/read", response_model=AlertResponse)
async def mark_as_read(
    alert_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    return await mark_alert_read(current_user.business_id, alert_id)


@router.patch("/{alert_id}/resolve", response_model=AlertResponse)
async def mark_as_resolved(
    alert_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    return await resolve_alert(current_user.business_id, alert_id)
