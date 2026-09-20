from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime
from app.schemas.common import StrId, OptStrId


class AuditLogResponse(BaseModel):
    id: StrId
    user_id: OptStrId = None
    business_id: OptStrId = None
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    changes: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    status: str
    created_at: datetime
    model_config = {"from_attributes": True}


class AuditLogListResponse(BaseModel):
    items: List[AuditLogResponse]
    total: int
    page: int
    page_size: int
