import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException, status

from app.models.transaction import Purchase, PurchaseItem
from app.models.product import Product
from app.models.inventory import Supplier, Batch, Inventory, InventoryMovement
from app.db.mongodb import to_oid
from app.schemas.transaction import PurchaseCreate, PurchaseResponse
from app.services.audit_service import record_audit_log


async def create_purchase(
    business_id: str,
    user_id: str,
    req: PurchaseCreate,
    db=None,
) -> PurchaseResponse:
    if req.supplier_id:
        sup = await Supplier.find_one(
            Supplier.id == to_oid(req.supplier_id),
            Supplier.business_id == business_id,
        )
        if not sup:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found in this business")

    subtotal = 0.0
    items_to_create = []

    for item in req.items:
        product = await Product.find_one(
            Product.id == to_oid(item.product_id),
            Product.business_id == business_id,
        )
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product {item.product_id} not found in your business")

        line_total = round(item.unit_cost * item.qty, 2)
        subtotal += line_total

        batch = await Batch.find_one(
            Batch.product_id == str(item.product_id),
            Batch.branch_id == str(req.branch_id),
            Batch.batch_no == item.batch_no,
        )
        if batch:
            await batch.set({
                Batch.qty_received: batch.qty_received + item.qty,
                Batch.qty_remaining: batch.qty_remaining + item.qty,
                Batch.expiry_date: item.expiry_date,
                Batch.purchase_price: item.unit_cost,
            })
        else:
            batch = Batch(
                product_id=str(item.product_id),
                branch_id=str(req.branch_id),
                supplier_id=str(item.supplier_id or req.supplier_id) if (item.supplier_id or req.supplier_id) else None,
                batch_no=item.batch_no,
                mfg_date=item.mfg_date,
                expiry_date=item.expiry_date,
                purchase_price=item.unit_cost,
                selling_price=product.selling_price,
                qty_received=item.qty,
                qty_remaining=item.qty,
            )
            await batch.insert()

        inv = await Inventory.find_one(
            Inventory.product_id == str(item.product_id),
            Inventory.branch_id == str(req.branch_id),
        )
        qty_before = inv.qty_on_hand if inv else 0
        qty_after = qty_before + item.qty

        if inv:
            await inv.set({Inventory.qty_on_hand: qty_after})
        else:
            inv = Inventory(
                product_id=str(item.product_id),
                branch_id=str(req.branch_id),
                qty_on_hand=qty_after,
            )
            await inv.insert()

        purchase_item = PurchaseItem(
            purchase_id="temp",
            product_id=str(item.product_id),
            batch_id=str(batch.id),
            qty=item.qty,
            unit_cost=item.unit_cost,
            line_total=line_total,
        )
        items_to_create.append((purchase_item, product, batch, qty_before, qty_after))

    total_amount = round(subtotal + req.tax_amount, 2)

    purchase = Purchase(
        business_id=business_id,
        branch_id=str(req.branch_id),
        supplier_id=str(req.supplier_id) if req.supplier_id else None,
        invoice_no=req.invoice_no or f"PO-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}",
        subtotal=round(subtotal, 2),
        tax_amount=req.tax_amount,
        total_amount=total_amount,
        payment_mode=req.payment_mode,
        notes=req.notes,
        received_at=req.received_at or datetime.now(timezone.utc),
        created_by=user_id,
    )
    await purchase.insert()

    for p_item, product, batch, qty_before, qty_after in items_to_create:
        p_item.purchase_id = str(purchase.id)
        await p_item.insert()

        movement = InventoryMovement(
            business_id=business_id,
            product_id=str(product.id),
            branch_id=str(req.branch_id),
            batch_id=str(batch.id),
            movement_type="PURCHASE",
            qty_change=p_item.qty,
            qty_before=qty_before,
            qty_after=qty_after,
            reference_type="purchase",
            reference_id=str(purchase.id),
            notes=f"Purchase order {purchase.invoice_no}",
            created_by=user_id,
        )
        await movement.insert()

    await record_audit_log(
        action="PURCHASE_CREATE",
        business_id=business_id,
        user_id=user_id,
        entity_type="Purchase",
        entity_id=str(purchase.id),
        changes={
            "invoice_no": purchase.invoice_no,
            "total_amount": float(purchase.total_amount),
            "item_count": len(items_to_create),
        },
    )

    purchase_dict = purchase.model_dump()
    purchase_items = await PurchaseItem.find(PurchaseItem.purchase_id == str(purchase.id)).to_list()
    purchase_dict["items"] = [item.model_dump() for item in purchase_items]

    return PurchaseResponse.model_validate(purchase_dict)


async def list_purchases(
    business_id: str,
    branch_id: Optional[str] = None,
    limit: int = 50,
    db=None,
) -> List[PurchaseResponse]:
    query = Purchase.find(Purchase.business_id == business_id)
    if branch_id:
        query = query.find(Purchase.branch_id == str(branch_id))

    purchases = await query.sort(-Purchase.created_at).limit(limit).to_list()
    results = []
    for purchase in purchases:
        purchase_dict = purchase.model_dump()
        items = await PurchaseItem.find(PurchaseItem.purchase_id == str(purchase.id)).to_list()
        purchase_dict["items"] = [item.model_dump() for item in items]
        results.append(PurchaseResponse.model_validate(purchase_dict))
    return results
