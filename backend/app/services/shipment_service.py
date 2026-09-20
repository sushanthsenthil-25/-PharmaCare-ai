from typing import List, Optional
from fastapi import HTTPException, status

from app.models.shipment import ImportShipment, ExportShipment, SHIPMENT_STATUSES
from app.db.mongodb import to_oid
from app.schemas.order import ShipmentCreate, ShipmentStatusUpdate, ShipmentResponse
from app.services.audit_service import record_audit_log


# ---------------------------------------------------------------------------
# Imports
# ---------------------------------------------------------------------------

async def create_import_shipment(
    business_id: str,
    user_id: str,
    req: ShipmentCreate,
    db=None,
) -> ShipmentResponse:
    shipment = ImportShipment(
        business_id=business_id,
        supplier_id=str(req.supplier_id) if req.supplier_id else None,
        status="PENDING",
        tracking_no=req.tracking_no,
        carrier=req.carrier,
        total_value=req.total_value,
        notes=req.notes,
        shipment_date=req.shipment_date,
        expected_arrival=req.expected_date,
        created_by=user_id,
    )
    await shipment.insert()

    await record_audit_log(
        action="IMPORT_CREATE",
        business_id=business_id,
        user_id=user_id,
        entity_type="ImportShipment",
        entity_id=str(shipment.id),
        changes={"tracking_no": shipment.tracking_no, "carrier": shipment.carrier},
    )
    return ShipmentResponse.model_validate(shipment.model_dump())


async def list_import_shipments(
    business_id: str,
    limit: int = 50,
    db=None,
) -> List[ShipmentResponse]:
    shipments = await ImportShipment.find(
        ImportShipment.business_id == business_id
    ).sort(-ImportShipment.created_at).limit(limit).to_list()
    return [ShipmentResponse.model_validate(s.model_dump()) for s in shipments]


async def update_import_status(
    business_id: str,
    shipment_id: str,
    user_id: str,
    req: ShipmentStatusUpdate,
    db=None,
) -> ShipmentResponse:
    if req.status not in SHIPMENT_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{req.status}'. Allowed: {SHIPMENT_STATUSES}",
        )

    shipment = await ImportShipment.find_one(
        ImportShipment.id == to_oid(shipment_id),
        ImportShipment.business_id == business_id
    )
    if not shipment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import shipment not found")

    old_status = shipment.status
    update_data = {"status": req.status}
    if req.tracking_no:
        update_data["tracking_no"] = req.tracking_no

    await shipment.set(update_data)

    await record_audit_log(
        action="IMPORT_STATUS_UPDATE",
        business_id=business_id,
        user_id=user_id,
        entity_type="ImportShipment",
        entity_id=str(shipment.id),
        changes={"old_status": old_status, "new_status": req.status},
    )
    return ShipmentResponse.model_validate(shipment.model_dump())


# ---------------------------------------------------------------------------
# Exports
# ---------------------------------------------------------------------------

async def create_export_shipment(
    business_id: str,
    user_id: str,
    req: ShipmentCreate,
    db=None,
) -> ShipmentResponse:
    shipment = ExportShipment(
        business_id=business_id,
        customer_id=str(req.customer_id) if req.customer_id else None,
        status="PENDING",
        tracking_no=req.tracking_no,
        carrier=req.carrier,
        total_value=req.total_value,
        notes=req.notes,
        shipment_date=req.shipment_date,
        expected_delivery=req.expected_date,
        created_by=user_id,
    )
    await shipment.insert()

    await record_audit_log(
        action="EXPORT_CREATE",
        business_id=business_id,
        user_id=user_id,
        entity_type="ExportShipment",
        entity_id=str(shipment.id),
        changes={"tracking_no": shipment.tracking_no, "carrier": shipment.carrier},
    )
    return ShipmentResponse.model_validate(shipment.model_dump())


async def list_export_shipments(
    business_id: str,
    limit: int = 50,
    db=None,
) -> List[ShipmentResponse]:
    shipments = await ExportShipment.find(
        ExportShipment.business_id == business_id
    ).sort(-ExportShipment.created_at).limit(limit).to_list()
    return [ShipmentResponse.model_validate(s.model_dump()) for s in shipments]


async def update_export_status(
    business_id: str,
    shipment_id: str,
    user_id: str,
    req: ShipmentStatusUpdate,
    db=None,
) -> ShipmentResponse:
    if req.status not in SHIPMENT_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{req.status}'. Allowed: {SHIPMENT_STATUSES}",
        )

    shipment = await ExportShipment.find_one(
        ExportShipment.id == to_oid(shipment_id),
        ExportShipment.business_id == business_id
    )
    if not shipment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Export shipment not found")

    old_status = shipment.status
    update_data = {"status": req.status}
    if req.tracking_no:
        update_data["tracking_no"] = req.tracking_no

    await shipment.set(update_data)

    await record_audit_log(
        action="EXPORT_STATUS_UPDATE",
        business_id=business_id,
        user_id=user_id,
        entity_type="ExportShipment",
        entity_id=str(shipment.id),
        changes={"old_status": old_status, "new_status": req.status},
    )
    return ShipmentResponse.model_validate(shipment.model_dump())
