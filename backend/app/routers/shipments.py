from typing import List
from fastapi import APIRouter, Depends, status

from app.auth.dependencies import get_current_user, CurrentUser, require_roles
from app.core.permissions import UserRole
from app.schemas.order import ShipmentCreate, ShipmentStatusUpdate, ShipmentResponse
from app.services.shipment_service import (
    create_import_shipment,
    list_import_shipments,
    update_import_status,
    create_export_shipment,
    list_export_shipments,
    update_export_status,
)

router = APIRouter(tags=["Imports & Exports"])


# ---------------------------------------------------------------------------
# Imports
# ---------------------------------------------------------------------------

@router.post("/api/v1/shipments/imports", response_model=ShipmentResponse, status_code=status.HTTP_201_CREATED)
@router.post("/api/v1/imports", response_model=ShipmentResponse, status_code=status.HTTP_201_CREATED)
async def log_import_shipment(
    req: ShipmentCreate,
    current_user: CurrentUser = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER])),
):
    """Log an incoming international/bulk import shipment."""
    return await create_import_shipment(current_user.business_id, current_user.id, req)


@router.get("/api/v1/shipments/imports", response_model=List[ShipmentResponse])
@router.get("/api/v1/imports", response_model=List[ShipmentResponse])
async def get_import_shipments(
    limit: int = 50,
    current_user: CurrentUser = Depends(get_current_user),
):
    """List incoming import shipments."""
    return await list_import_shipments(current_user.business_id, limit)


@router.patch("/api/v1/shipments/imports/{shipment_id}/status", response_model=ShipmentResponse)
@router.patch("/api/v1/imports/{shipment_id}/status", response_model=ShipmentResponse)
async def update_import_shipment_status(
    shipment_id: str,
    req: ShipmentStatusUpdate,
    current_user: CurrentUser = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER])),
):
    """Update tracking and status of an import shipment (e.g. CUSTOMS_CLEARED)."""
    return await update_import_status(current_user.business_id, shipment_id, current_user.id, req)


# ---------------------------------------------------------------------------
# Exports
# ---------------------------------------------------------------------------

@router.post("/api/v1/shipments/exports", response_model=ShipmentResponse, status_code=status.HTTP_201_CREATED)
@router.post("/api/v1/exports", response_model=ShipmentResponse, status_code=status.HTTP_201_CREATED)
async def log_export_shipment(
    req: ShipmentCreate,
    current_user: CurrentUser = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER])),
):
    """Log an outgoing international export shipment."""
    return await create_export_shipment(current_user.business_id, current_user.id, req)


@router.get("/api/v1/shipments/exports", response_model=List[ShipmentResponse])
@router.get("/api/v1/exports", response_model=List[ShipmentResponse])
async def get_export_shipments(
    limit: int = 50,
    current_user: CurrentUser = Depends(get_current_user),
):
    """List outgoing export shipments."""
    return await list_export_shipments(current_user.business_id, limit)


@router.patch("/api/v1/shipments/exports/{shipment_id}/status", response_model=ShipmentResponse)
@router.patch("/api/v1/exports/{shipment_id}/status", response_model=ShipmentResponse)
async def update_export_shipment_status(
    shipment_id: str,
    req: ShipmentStatusUpdate,
    current_user: CurrentUser = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER])),
):
    """Update tracking and status of an export shipment."""
    return await update_export_status(current_user.business_id, shipment_id, current_user.id, req)
