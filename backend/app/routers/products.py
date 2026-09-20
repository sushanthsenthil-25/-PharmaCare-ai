import uuid
from typing import Optional
from fastapi import APIRouter, Depends, status, Query

from app.auth.dependencies import get_current_user, CurrentUser, require_roles
from app.core.permissions import UserRole
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductListResponse,
    CategoryCreate,
    CategoryResponse,
)
from app.services.product_service import (
    create_product,
    get_product_by_id,
    list_products,
    update_product,
    delete_product,
    create_category,
    list_categories,
)
from app.schemas.inventory import InventoryResponse
from app.services.inventory_service import get_inventory

router = APIRouter(prefix="/api/v1", tags=["Products"])


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------

@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_new_category(
    req: CategoryCreate,
    current_user: CurrentUser = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER])),
):
    return await create_category(current_user.business_id, current_user.id, req)


@router.get("/categories", response_model=list[CategoryResponse])
async def get_all_categories(
    current_user: CurrentUser = Depends(get_current_user),
):
    return await list_categories(current_user.business_id)


# ---------------------------------------------------------------------------
# Products CRUD
# ---------------------------------------------------------------------------

@router.post("/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_new_product(
    req: ProductCreate,
    current_user: CurrentUser = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER])),
):
    return await create_product(current_user.business_id, current_user.id, req)


@router.get("/products", response_model=ProductListResponse)
async def get_products(
    category_id: Optional[str] = None,
    search: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
):
    return await list_products(
        business_id=current_user.business_id,
        category_id=category_id,
        search=search,
        status_filter=status_filter,
        page=page,
        page_size=page_size,
    )


@router.get("/products/inventory", response_model=list[InventoryResponse])
async def get_products_inventory(
    branch_id: Optional[str] = None,
    product_id: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Retrieve inventory stock levels for products."""
    return await get_inventory(
        business_id=current_user.business_id,
        branch_id=branch_id or current_user.branch_id,
        product_id=product_id,
    )


@router.get("/products/{product_id}", response_model=ProductResponse)
async def get_single_product(
    product_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    return await get_product_by_id(current_user.business_id, product_id)


@router.patch("/products/{product_id}", response_model=ProductResponse)
async def update_single_product(
    product_id: str,
    req: ProductUpdate,
    current_user: CurrentUser = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER])),
):
    return await update_product(current_user.business_id, product_id, current_user.id, req)


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_single_product(
    product_id: str,
    current_user: CurrentUser = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER])),
):
    await delete_product(current_user.business_id, product_id, current_user.id)
