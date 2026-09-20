from typing import Optional, List
from fastapi import APIRouter, Depends, status

from app.auth.dependencies import get_current_user, CurrentUser, require_roles
from app.core.permissions import UserRole
from app.schemas.transaction import PurchaseCreate, PurchaseResponse
from app.services.purchase_service import create_purchase, list_purchases

router = APIRouter(prefix="/api/v1/purchases", tags=["Purchases & Goods Inward"])


@router.post("", response_model=PurchaseResponse, status_code=status.HTTP_201_CREATED)
async def process_new_purchase(
    req: PurchaseCreate,
    current_user: CurrentUser = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER])),
):
    """
    Record a new purchase from a supplier.
    Automatically increments inventory and creates/updates batches.
    """
    return await create_purchase(current_user.business_id, current_user.id, req)


@router.get("", response_model=List[PurchaseResponse])
async def get_purchase_history(
    branch_id: Optional[str] = None,
    limit: int = 50,
    current_user: CurrentUser = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER])),
):
    """
    Retrieve purchase history.
    """
    return await list_purchases(
        business_id=current_user.business_id,
        branch_id=branch_id,
        limit=limit,
    )
