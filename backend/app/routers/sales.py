from typing import Optional, List
from fastapi import APIRouter, Depends, status

from app.auth.dependencies import get_current_user, CurrentUser, require_roles
from app.core.permissions import UserRole
from app.schemas.transaction import SaleCreate, SaleResponse
from app.services.sales_service import create_sale, list_sales

router = APIRouter(prefix="/api/v1/sales", tags=["Sales (POS)"])


@router.post("", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
async def process_new_sale(
    req: SaleCreate,
    current_user: CurrentUser = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF])),
):
    """
    Process a new point-of-sale transaction.
    Automatically deducts inventory and handles batch FEFO logic.
    """
    return await create_sale(current_user.business_id, current_user.id, req)


@router.get("", response_model=List[SaleResponse])
async def get_sales_history(
    branch_id: Optional[str] = None,
    limit: int = 50,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Retrieve sales history.
    """
    return await list_sales(
        business_id=current_user.business_id,
        branch_id=branch_id,
        limit=limit,
    )
