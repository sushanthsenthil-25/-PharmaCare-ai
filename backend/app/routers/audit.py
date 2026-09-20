import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query

from app.auth.dependencies import CurrentUser, require_roles
from app.core.permissions import UserRole
from app.schemas.audit import AuditLogListResponse
from app.services.audit_service import list_audit_logs

router = APIRouter(prefix="/api/v1/audit", tags=["Audit Logs"])


@router.get("/logs", response_model=AuditLogListResponse)
async def get_audit_logs(
    action: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    current_user: CurrentUser = Depends(require_roles([UserRole.OWNER])),
):
    return await list_audit_logs(
        business_id=current_user.business_id,
        page=page,
        page_size=page_size,
        action_filter=action,
    )
