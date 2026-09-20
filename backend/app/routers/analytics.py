from fastapi import APIRouter, Depends, Query
from app.auth.dependencies import get_current_user, CurrentUser, require_roles
from app.core.permissions import UserRole
from app.schemas.analytics import (
    SalesTrendsResponse,
    PurchaseTrendsResponse,
    ProductPerformanceResponse,
    InventoryTurnoverResponse,
    ExpiryTrendsResponse,
    RevenueMetricsResponse,
)
from app.services.analytics_service import (
    get_sales_trends,
    get_purchase_trends,
    get_product_performance,
    get_inventory_turnover,
    get_expiry_trends,
    get_revenue_metrics,
)

router = APIRouter(prefix="/api/v1/analytics", tags=["Analytics & Reports"])


@router.get("/sales-trends", response_model=SalesTrendsResponse)
async def sales_trends(
    days: int = Query(30, ge=7, le=365),
    current_user: CurrentUser = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER])),
):
    """Get daily sales volume and revenue over a period."""
    return await get_sales_trends(current_user.business_id, days)


@router.get("/purchase-trends", response_model=PurchaseTrendsResponse)
async def purchase_trends(
    days: int = Query(30, ge=7, le=365),
    current_user: CurrentUser = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER])),
):
    """Get daily purchase volume and expenditure over a period."""
    return await get_purchase_trends(current_user.business_id, days)


@router.get("/product-performance", response_model=ProductPerformanceResponse)
async def product_performance(
    current_user: CurrentUser = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER])),
):
    """Identify top-selling vs slow-moving products based on historical sales and profit."""
    return await get_product_performance(current_user.business_id)


@router.get("/inventory-turnover", response_model=InventoryTurnoverResponse)
async def inventory_turnover(
    current_user: CurrentUser = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER])),
):
    """Calculate the inventory turnover ratio and average days to sell."""
    return await get_inventory_turnover(current_user.business_id)


@router.get("/expiry-trends", response_model=ExpiryTrendsResponse)
async def expiry_trends(
    current_user: CurrentUser = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER])),
):
    """Analyze expiring stock in buckets (0-7 days, 8-15 days, etc.) and calculate estimated financial loss."""
    return await get_expiry_trends(current_user.business_id)


@router.get("/revenue-metrics", response_model=RevenueMetricsResponse)
async def revenue_metrics(
    current_user: CurrentUser = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER])),
):
    """Get high-level revenue metrics (today, this week, this month, AOV)."""
    return await get_revenue_metrics(current_user.business_id)
