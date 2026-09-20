from typing import Optional, Dict, Any

from app.models.audit import AuditLog
from app.schemas.audit import AuditLogResponse, AuditLogListResponse


async def record_audit_log(
    action: str,
    business_id: Optional[str] = None,
    user_id: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    changes: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    status: str = "SUCCESS",
    # Keep db parameter for backward compat but ignore it
    db: Optional[object] = None,
) -> AuditLog:
    """Record an immutable audit event."""
    log = AuditLog(
        business_id=str(business_id) if business_id else None,
        user_id=str(user_id) if user_id else None,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id else None,
        changes=changes,
        ip_address=ip_address,
        user_agent=user_agent,
        status=status,
    )
    await log.insert()
    return log


async def list_audit_logs(
    business_id: str,
    page: int = 1,
    page_size: int = 50,
    action_filter: Optional[str] = None,
    # Keep db parameter for backward compat but ignore it
    db: Optional[object] = None,
) -> AuditLogListResponse:
    query = AuditLog.find(AuditLog.business_id == business_id)
    if action_filter:
        query = query.find(AuditLog.action == action_filter)

    total = await query.count()
    items = (
        await query.sort(-AuditLog.created_at)
        .skip((page - 1) * page_size)
        .limit(page_size)
        .to_list()
    )

    return AuditLogListResponse(
        items=[AuditLogResponse.model_validate(item.model_dump()) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )
