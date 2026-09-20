from typing import Optional, List
from fastapi import APIRouter, Depends, status

from app.auth.dependencies import get_current_user, CurrentUser, require_roles
from app.core.permissions import UserRole
from app.schemas.inventory import (
    SupplierCreate,
    SupplierUpdate,
    SupplierResponse,
    BatchCreate,
    BatchResponse,
    InventoryResponse,
    StockAdjustmentRequest,
    InventoryMovementResponse,
)
from app.services.inventory_service import (
    create_supplier,
    list_suppliers,
    update_supplier,
    create_batch,
    list_batches,
    get_inventory,
    adjust_stock,
    list_movements,
)

router = APIRouter(prefix="/api/v1", tags=["Inventory & Suppliers"])


# ---------------------------------------------------------------------------
# Inventory
# ---------------------------------------------------------------------------

@router.get("/inventory", response_model=List[InventoryResponse])
async def get_current_inventory(
    branch_id: Optional[str] = None,
    product_id: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_user),
):
    return await get_inventory(
        business_id=current_user.business_id,
        branch_id=branch_id or current_user.branch_id,
        product_id=product_id,
    )


@router.post("/inventory/adjust", response_model=InventoryResponse)
async def adjust_inventory_stock(
    req: StockAdjustmentRequest,
    current_user: CurrentUser = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER])),
):
    return await adjust_stock(current_user.business_id, current_user.id, req)


@router.get("/inventory/movements", response_model=List[InventoryMovementResponse])
async def get_inventory_movements(
    product_id: Optional[str] = None,
    branch_id: Optional[str] = None,
    limit: int = 100,
    current_user: CurrentUser = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER])),
):
    return await list_movements(
        business_id=current_user.business_id,
        product_id=product_id,
        branch_id=branch_id,
        limit=limit,
    )


# ---------------------------------------------------------------------------
# Batches
# ---------------------------------------------------------------------------

@router.get("/inventory/batches", response_model=List[BatchResponse])
async def get_batches(
    product_id: Optional[str] = None,
    branch_id: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_user),
):
    return await list_batches(
        business_id=current_user.business_id,
        product_id=product_id,
        branch_id=branch_id,
    )


@router.post("/inventory/batches", response_model=BatchResponse, status_code=status.HTTP_201_CREATED)
async def create_new_batch(
    req: BatchCreate,
    current_user: CurrentUser = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER])),
):
    return await create_batch(current_user.business_id, current_user.id, req)


# ---------------------------------------------------------------------------
# Suppliers
# ---------------------------------------------------------------------------

@router.post("/suppliers", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
async def create_new_supplier(
    req: SupplierCreate,
    current_user: CurrentUser = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER])),
):
    return await create_supplier(current_user.business_id, current_user.id, req)


@router.get("/suppliers", response_model=List[SupplierResponse])
async def get_suppliers(
    active_only: bool = True,
    current_user: CurrentUser = Depends(get_current_user),
):
    return await list_suppliers(current_user.business_id, active_only=active_only)


@router.patch("/suppliers/{supplier_id}", response_model=SupplierResponse)
async def update_single_supplier(
    supplier_id: str,
    req: SupplierUpdate,
    current_user: CurrentUser = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER])),
):
    return await update_supplier(current_user.business_id, supplier_id, current_user.id, req)
