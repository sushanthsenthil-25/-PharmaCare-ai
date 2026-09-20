import uuid
from datetime import datetime, date, timezone
from typing import List, Optional
from fastapi import HTTPException, status

from app.models.transaction import Sale, SaleItem, Customer
from app.models.product import Product
from app.models.inventory import Batch, Inventory, InventoryMovement
from app.db.mongodb import to_oid
from app.schemas.transaction import SaleCreate, SaleResponse, SaleItemResponse
from app.services.audit_service import record_audit_log


def generate_invoice_no() -> str:
    now = datetime.now(timezone.utc)
    return f"INV-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"


async def create_sale(
    business_id: str,
    user_id: str,
    req: SaleCreate,
    db=None,
) -> SaleResponse:
    today = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)
    subtotal = 0.0
    sale_items_to_create = []

    if req.customer_id:
        cust = await Customer.find_one(
            Customer.id == to_oid(req.customer_id),
            Customer.business_id == business_id,
        )
        if not cust:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found in this business")

    for item in req.items:
        product = await Product.find_one(
            Product.id == to_oid(item.product_id),
            Product.business_id == business_id,
        )
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product '{item.product_id}' not found in your business",
            )
        if product.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product '{product.name}' is {product.status} and cannot be sold",
            )

        # Atomic inventory check and update to prevent race conditions
        inv_col = Inventory.get_pymongo_collection()
        inv_doc = await inv_col.find_one_and_update(
            {
                "product_id": str(item.product_id),
                "branch_id": str(req.branch_id),
                "qty_on_hand": {"$gte": item.qty},
            },
            {"$inc": {"qty_on_hand": -item.qty}, "$set": {"last_updated": datetime.now(timezone.utc)}},
            return_document=False,  # gives doc before update
        )

        if not inv_doc:
            current_inv = await Inventory.find_one(
                Inventory.product_id == str(item.product_id),
                Inventory.branch_id == str(req.branch_id),
            )
            avail = current_inv.qty_on_hand if current_inv else 0
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient inventory for '{product.name}'. Available: {avail}, Requested: {item.qty}",
            )

        qty_before = inv_doc.get("qty_on_hand", 0)
        new_inv_qty = qty_before - item.qty

        selected_batch = None
        if item.batch_id:
            selected_batch = await Batch.find_one(Batch.id == to_oid(item.batch_id))
            if not selected_batch:
                # Revert atomic inv deduction
                await inv_col.update_one({"_id": inv_doc["_id"]}, {"$inc": {"qty_on_hand": item.qty}})
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Specified batch not found")
        else:
            # Simple FEFO for MongoDB
            batches = await Batch.find(
                Batch.product_id == str(item.product_id),
                Batch.branch_id == str(req.branch_id),
                Batch.qty_remaining >= item.qty,
            ).to_list()
            # Filter non-expired and sort by expiry
            valid_batches = [b for b in batches if datetime.combine(b.expiry_date, datetime.min.time()).replace(tzinfo=timezone.utc) > today]
            valid_batches.sort(key=lambda b: b.expiry_date)
            if valid_batches:
                selected_batch = valid_batches[0]

        if selected_batch:
            batch_expiry = datetime.combine(selected_batch.expiry_date, datetime.min.time()).replace(tzinfo=timezone.utc)
            if batch_expiry <= today:
                # Revert atomic inv deduction
                await inv_col.update_one({"_id": inv_doc["_id"]}, {"$inc": {"qty_on_hand": item.qty}})
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Batch '{selected_batch.batch_no}' for '{product.name}' expired on {selected_batch.expiry_date}. Expired products cannot be sold.",
                )
            if selected_batch.qty_remaining < item.qty:
                # Revert atomic inv deduction
                await inv_col.update_one({"_id": inv_doc["_id"]}, {"$inc": {"qty_on_hand": item.qty}})
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Batch '{selected_batch.batch_no}' has only {selected_batch.qty_remaining} units available, requested {item.qty}.",
                )
            await selected_batch.set({Batch.qty_remaining: selected_batch.qty_remaining - item.qty})

        item_discount = item.unit_price * (item.discount_pct / 100.0)
        net_price = item.unit_price - item_discount
        line_total = round(net_price * item.qty, 2)
        subtotal += line_total

        sale_item = SaleItem(
            sale_id="temp",  # Will update after sale insert
            product_id=str(item.product_id),
            batch_id=str(selected_batch.id) if selected_batch else None,
            qty=item.qty,
            unit_price=item.unit_price,
            discount_pct=item.discount_pct,
            line_total=line_total,
        )
        sale_items_to_create.append((sale_item, product, qty_before, new_inv_qty, selected_batch))

    total_amount = round(subtotal - req.discount_amount + req.tax_amount, 2)
    if total_amount < 0:
        total_amount = 0.0

    sale = Sale(
        business_id=business_id,
        branch_id=str(req.branch_id),
        customer_id=str(req.customer_id) if req.customer_id else None,
        invoice_no=generate_invoice_no(),
        subtotal=round(subtotal, 2),
        discount_amount=req.discount_amount,
        tax_amount=req.tax_amount,
        total_amount=total_amount,
        payment_mode=req.payment_mode,
        payment_status="PAID",
        notes=req.notes,
        created_by=user_id,
    )
    await sale.insert()

    for s_item, product, qty_before, qty_after, batch in sale_items_to_create:
        s_item.sale_id = str(sale.id)
        await s_item.insert()

        movement = InventoryMovement(
            business_id=business_id,
            product_id=str(product.id),
            branch_id=str(req.branch_id),
            batch_id=str(batch.id) if batch else None,
            movement_type="SALE",
            qty_change=-s_item.qty,
            qty_before=qty_before,
            qty_after=qty_after,
            reference_type="sale",
            reference_id=str(sale.id),
            notes=f"Sold via {sale.invoice_no}",
            created_by=user_id,
        )
        await movement.insert()

    await record_audit_log(
        action="SALE_CREATE",
        business_id=business_id,
        user_id=user_id,
        entity_type="Sale",
        entity_id=str(sale.id),
        changes={
            "invoice_no": sale.invoice_no,
            "total_amount": float(sale.total_amount),
            "item_count": len(sale_items_to_create),
        },
    )

    sale_dict = sale.model_dump()
    sale_items = await SaleItem.find(SaleItem.sale_id == str(sale.id)).to_list()
    sale_dict["items"] = [item.model_dump() for item in sale_items]

    return SaleResponse.model_validate(sale_dict)


async def list_sales(
    business_id: str,
    branch_id: Optional[str] = None,
    limit: int = 50,
    db=None,
) -> List[SaleResponse]:
    query = Sale.find(Sale.business_id == business_id)
    if branch_id:
        query = query.find(Sale.branch_id == str(branch_id))

    sales = await query.sort(-Sale.created_at).limit(limit).to_list()
    results = []
    for sale in sales:
        sale_dict = sale.model_dump()
        items = await SaleItem.find(SaleItem.sale_id == str(sale.id)).to_list()
        sale_dict["items"] = [item.model_dump() for item in items]
        results.append(SaleResponse.model_validate(sale_dict))
    return results
