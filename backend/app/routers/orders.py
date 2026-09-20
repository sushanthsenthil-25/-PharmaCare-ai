from typing import Optional, List
from fastapi import APIRouter, Depends, status

from app.auth.dependencies import get_current_user, CurrentUser, require_roles
from app.core.permissions import UserRole
from app.schemas.order import OrderCreate, OrderStatusUpdate, OrderResponse
from app.services.order_service import create_order, list_orders, get_order_by_id, update_order_status

router = APIRouter(prefix="/api/v1/orders", tags=["Orders (B2B & B2C)"])


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_new_order(
    req: OrderCreate,
    current_user: CurrentUser = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF])),
):
    """Create a new outgoing B2B or B2C order."""
    return await create_order(current_user.business_id, current_user.id, req)


@router.get("", response_model=List[OrderResponse])
async def get_all_orders(
    status_filter: Optional[str] = None,
    limit: int = 50,
    current_user: CurrentUser = Depends(get_current_user),
):
    """List outgoing orders with optional status filtering."""
    return await list_orders(current_user.business_id, status_filter, limit)


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get details of a specific order."""
    return await get_order_by_id(current_user.business_id, order_id)


@router.patch("/{order_id}/status", response_model=OrderResponse)
async def update_order_state(
    order_id: str,
    req: OrderStatusUpdate,
    current_user: CurrentUser = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER])),
):
    """Update order status (e.g. PROCESSING -> SHIPPED) and attach tracking/rider info."""
    return await update_order_status(current_user.business_id, order_id, current_user.id, req)
