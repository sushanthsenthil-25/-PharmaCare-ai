from fastapi import APIRouter, Depends
from app.auth.dependencies import get_current_user, CurrentUser, require_roles
from app.core.permissions import UserRole
from app.schemas.order import DashboardSummary
from app.services.dashboard_service import get_dashboard_summary

router = APIRouter(prefix="/api/v1/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def get_summary(
    current_user: CurrentUser = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER])),
):
    """
    Get high-level KPIs and metrics for the main dashboard.
    """
    return await get_dashboard_summary(business_id=current_user.business_id)
