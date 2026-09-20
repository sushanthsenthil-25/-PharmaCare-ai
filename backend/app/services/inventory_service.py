from datetime import datetime, timezone
from typing import Optional, List
from fastapi import HTTPException, status

from app.models.inventory import Supplier, Batch, Inventory, InventoryMovement
from app.models.product import Product
from app.db.mongodb import to_oid
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
from app.services.audit_service import record_audit_log


# ---------------------------------------------------------------------------
# Suppliers
# ---------------------------------------------------------------------------

async def create_supplier(business_id: str, user_id: str, req: SupplierCreate, db=None) -> SupplierResponse:
    supplier = Supplier(
        business_id=business_id,
        name=req.name,
        contact_person=req.contact_person,
        phone=req.phone,
        email=req.email,
        address=req.address,
        drug_license_no=req.drug_license_no,
        gstin=req.gstin,
    )
    await supplier.insert()

    await record_audit_log(
        action="SUPPLIER_CREATE",
        business_id=business_id,
        user_id=user_id,
        entity_type="Supplier",
        entity_id=str(supplier.id),
        changes={"name": supplier.name},
    )
    return SupplierResponse.model_validate(supplier.model_dump())


async def list_suppliers(business_id: str, active_only: bool = True, db=None) -> List[SupplierResponse]:
    query = Supplier.find(Supplier.business_id == business_id)
    if active_only:
        query = query.find(Supplier.is_active == True)
    suppliers = await query.sort(+Supplier.name).to_list()
    return [SupplierResponse.model_validate(s.model_dump()) for s in suppliers]


async def update_supplier(business_id: str, supplier_id: str, user_id: str, req: SupplierUpdate, db=None) -> SupplierResponse:
    supplier = await Supplier.find_one(Supplier.id == to_oid(supplier_id), Supplier.business_id == business_id)
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    data = req.model_dump(exclude_unset=True)
    await supplier.set({getattr(Supplier, k): v for k, v in data.items() if hasattr(Supplier, k)})

    await record_audit_log(
        action="SUPPLIER_UPDATE",
        business_id=business_id,
        user_id=user_id,
        entity_type="Supplier",
        entity_id=str(supplier.id),
        changes=data,
    )
    return SupplierResponse.model_validate(supplier.model_dump())


# ---------------------------------------------------------------------------
# Batches
# ---------------------------------------------------------------------------

async def create_batch(business_id: str, user_id: str, req: BatchCreate, db=None) -> BatchResponse:
    product = await Product.find_one(Product.id == to_oid(req.product_id), Product.business_id == business_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found in this business")

    batch = Batch(
        product_id=str(req.product_id),
        branch_id=str(req.branch_id),
        supplier_id=str(req.supplier_id) if req.supplier_id else None,
        batch_no=req.batch_no,
        mfg_date=req.mfg_date,
        expiry_date=req.expiry_date,
        purchase_price=req.purchase_price,
        selling_price=req.selling_price,
        qty_received=req.qty_received,
        qty_remaining=req.qty_received,
    )
    await batch.insert()

    # Update/create inventory on hand
    inv = await Inventory.find_one(
        Inventory.product_id == str(req.product_id),
        Inventory.branch_id == str(req.branch_id),
    )
    qty_before = inv.qty_on_hand if inv else 0
    qty_after = qty_before + req.qty_received

    if inv:
        await inv.set({Inventory.qty_on_hand: qty_after, Inventory.last_updated: datetime.now(timezone.utc)})
    else:
        inv = Inventory(
            product_id=str(req.product_id),
            branch_id=str(req.branch_id),
            qty_on_hand=qty_after,
        )
        await inv.insert()

    # Record inventory movement
    movement = InventoryMovement(
        business_id=business_id,
        product_id=str(req.product_id),
        branch_id=str(req.branch_id),
        batch_id=str(batch.id),
        movement_type="PURCHASE",
        qty_change=req.qty_received,
        qty_before=qty_before,
        qty_after=qty_after,
        reference_type="batch_creation",
        reference_id=str(batch.id),
        notes=f"Batch {req.batch_no} created",
        created_by=user_id,
    )
    await movement.insert()

    return BatchResponse.model_validate(batch.model_dump())


async def list_batches(business_id: str, product_id: Optional[str] = None, branch_id: Optional[str] = None, db=None) -> List[BatchResponse]:
    # Get all products for this business to filter
    business_product_ids = [str(p.id) for p in await Product.find(Product.business_id == business_id).to_list()]

    conditions = [{"product_id": {"$in": business_product_ids}}]
    if product_id:
        conditions.append({"product_id": str(product_id)})
    if branch_id:
        conditions.append({"branch_id": str(branch_id)})

    query = Batch.find(*[getattr(Batch, k) == v for c in conditions for k, v in c.items()] if False else [])
    # Simpler approach for hackathon:
    batches = await Batch.find().to_list()
    batches = [b for b in batches if b.product_id in business_product_ids]
    if product_id:
        batches = [b for b in batches if b.product_id == str(product_id)]
    if branch_id:
        batches = [b for b in batches if b.branch_id == str(branch_id)]
    batches.sort(key=lambda b: str(b.expiry_date))
    return [BatchResponse.model_validate(b.model_dump()) for b in batches]


# ---------------------------------------------------------------------------
# Inventory
# ---------------------------------------------------------------------------

async def get_inventory(business_id: str, branch_id: Optional[str] = None, product_id: Optional[str] = None, db=None) -> List[InventoryResponse]:
    # Get all products for this business
    prod_query = Product.find(Product.business_id == business_id)
    products = await prod_query.to_list()
    product_map = {str(p.id): p for p in products}

    inv_query = Inventory.find({"product_id": {"$in": list(product_map.keys())}})
    if branch_id:
        inv_query = inv_query.find(Inventory.branch_id == str(branch_id))
    if product_id:
        inv_query = inv_query.find(Inventory.product_id == str(product_id))

    inventories = await inv_query.to_list()
    items = []
    for inv in inventories:
        p = product_map.get(inv.product_id)
        if not p:
            continue
        items.append(InventoryResponse(
            id=str(inv.id),
            product_id=inv.product_id,
            branch_id=inv.branch_id,
            product_name=p.name,
            sku=p.sku,
            qty_on_hand=inv.qty_on_hand,
            reorder_level=p.reorder_level,
            last_updated=inv.last_updated,
        ))
    return items


async def adjust_stock(business_id: str, user_id: str, req: StockAdjustmentRequest, db=None) -> InventoryResponse:
    product = await Product.find_one(Product.id == to_oid(req.product_id), Product.business_id == business_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found in this business")

    inv = await Inventory.find_one(
        Inventory.product_id == str(req.product_id),
        Inventory.branch_id == str(req.branch_id),
    )
    qty_before = inv.qty_on_hand if inv else 0
    qty_after = qty_before + req.qty_change

    if qty_after < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Adjustment results in negative stock: current={qty_before}, change={req.qty_change}",
        )

    if inv:
        await inv.set({Inventory.qty_on_hand: qty_after, Inventory.last_updated: datetime.now(timezone.utc)})
    else:
        inv = Inventory(product_id=str(req.product_id), branch_id=str(req.branch_id), qty_on_hand=qty_after)
        await inv.insert()

    if req.batch_id:
        batch = await Batch.find_one(Batch.id == to_oid(req.batch_id))
        if batch:
            batch_after = batch.qty_remaining + req.qty_change
            if batch_after < 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Batch stock cannot be negative. Batch remaining: {batch.qty_remaining}",
                )
            await batch.set({Batch.qty_remaining: batch_after})

    movement = InventoryMovement(
        business_id=business_id,
        product_id=str(req.product_id),
        branch_id=str(req.branch_id),
        batch_id=str(req.batch_id) if req.batch_id else None,
        movement_type=req.movement_type,
        qty_change=req.qty_change,
        qty_before=qty_before,
        qty_after=qty_after,
        reference_type="adjustment",
        notes=req.notes,
        created_by=user_id,
    )
    await movement.insert()

    await record_audit_log(
        action="INVENTORY_ADJUSTMENT",
        business_id=business_id,
        user_id=user_id,
        entity_type="Inventory",
        entity_id=str(inv.id),
        changes={
            "product_id": str(req.product_id),
            "branch_id": str(req.branch_id),
            "qty_change": req.qty_change,
            "qty_before": qty_before,
            "qty_after": qty_after,
            "type": req.movement_type,
        },
    )

    return InventoryResponse(
        id=str(inv.id),
        product_id=inv.product_id,
        branch_id=inv.branch_id,
        product_name=product.name,
        sku=product.sku,
        qty_on_hand=inv.qty_on_hand,
        reorder_level=product.reorder_level,
        last_updated=inv.last_updated,
    )


async def list_movements(business_id: str, product_id: Optional[str] = None, branch_id: Optional[str] = None, limit: int = 100, db=None) -> List[InventoryMovementResponse]:
    query = InventoryMovement.find(InventoryMovement.business_id == business_id)
    if product_id:
        query = query.find(InventoryMovement.product_id == str(product_id))
    if branch_id:
        query = query.find(InventoryMovement.branch_id == str(branch_id))

    movements = await query.sort(-InventoryMovement.created_at).limit(limit).to_list()
    return [InventoryMovementResponse.model_validate(m.model_dump()) for m in movements]
