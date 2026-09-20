from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from app.models.alert import Alert
from app.models.inventory import Batch, Inventory
from app.models.product import Product
from app.db.mongodb import to_oid
from app.schemas.order import AlertResponse
from app.core.config import settings
from fastapi import HTTPException, status


async def evaluate_and_generate_alerts(
    business_id: str,
    branch_id: Optional[str] = None,
    db=None,
) -> int:
    """
    Evaluates real DB state and generates actual alerts:
    1. EXPIRED batches
    2. EXPIRING_SOON (<=30 days, <=15 days, <=7 days)
    3. OUT_OF_STOCK (qty_on_hand <= 0)
    4. LOW_STOCK (qty_on_hand <= reorder_level)
    5. PRICE_ANOMALY (selling_price < purchase_price)
    """
    today = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)
    created_count = 0

    products = {str(p.id): p for p in await Product.find(Product.business_id == business_id).to_list()}

    if not products:
        return 0

    # 1. Check Batches for Expiry & Expiring Soon
    batch_query = Batch.find({"product_id": {"$in": list(products.keys())}}, Batch.qty_remaining > 0)
    if branch_id:
        batch_query = batch_query.find(Batch.branch_id == str(branch_id))

    batches = await batch_query.to_list()
    for batch in batches:
        prod_name = products[batch.product_id].name
        batch_expiry = datetime.combine(batch.expiry_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        days_until_expiry = (batch_expiry - today).days

        alert_type = None
        severity = "WARNING"
        title = ""
        message = ""

        if days_until_expiry < 0:
            alert_type = "EXPIRED"
            severity = "CRITICAL"
            title = f"Expired Batch: {prod_name}"
            message = f"Batch '{batch.batch_no}' of {prod_name} expired on {batch.expiry_date}. Remaining stock: {batch.qty_remaining} units. Must quarantine/dispose."
        elif days_until_expiry <= settings.EXPIRY_ALERT_DAYS_7:
            alert_type = "EXPIRING_SOON"
            severity = "CRITICAL"
            title = f"Urgent: {prod_name} expires in {days_until_expiry} days"
            message = f"Batch '{batch.batch_no}' has {batch.qty_remaining} units expiring on {batch.expiry_date}."
        elif days_until_expiry <= settings.EXPIRY_ALERT_DAYS_15:
            alert_type = "EXPIRING_SOON"
            severity = "WARNING"
            title = f"{prod_name} expires in {days_until_expiry} days"
            message = f"Batch '{batch.batch_no}' has {batch.qty_remaining} units expiring on {batch.expiry_date}."
        elif days_until_expiry <= settings.EXPIRY_ALERT_DAYS_30:
            alert_type = "EXPIRING_SOON"
            severity = "INFO"
            title = f"{prod_name} expires in {days_until_expiry} days"
            message = f"Batch '{batch.batch_no}' has {batch.qty_remaining} units expiring on {batch.expiry_date}."

        if alert_type:
            existing = await Alert.find_one(
                Alert.business_id == business_id,
                Alert.batch_id == str(batch.id),
                Alert.alert_type == alert_type,
                Alert.is_resolved == False,
            )
            if not existing:
                new_alert = Alert(
                    business_id=business_id,
                    branch_id=batch.branch_id,
                    alert_type=alert_type,
                    severity=severity,
                    product_id=batch.product_id,
                    batch_id=str(batch.id),
                    title=title,
                    message=message,
                )
                await new_alert.insert()
                created_count += 1

    # 2. Check Stock for OUT_OF_STOCK and LOW_STOCK
    inv_query = Inventory.find({"product_id": {"$in": list(products.keys())}})
    if branch_id:
        inv_query = inv_query.find(Inventory.branch_id == str(branch_id))

    inventories = await inv_query.to_list()
    for inv in inventories:
        product = products[inv.product_id]
        prod_name = product.name
        reorder_level = product.reorder_level

        if inv.qty_on_hand <= 0:
            existing = await Alert.find_one(
                Alert.business_id == business_id,
                Alert.product_id == inv.product_id,
                Alert.alert_type == "OUT_OF_STOCK",
                Alert.is_resolved == False,
            )
            if not existing:
                await Alert(
                    business_id=business_id,
                    branch_id=inv.branch_id,
                    alert_type="OUT_OF_STOCK",
                    severity="CRITICAL",
                    product_id=inv.product_id,
                    title=f"Out of Stock: {prod_name}",
                    message=f"{prod_name} is completely out of stock at branch {inv.branch_id}.",
                ).insert()
                created_count += 1
        elif inv.qty_on_hand <= reorder_level:
            existing = await Alert.find_one(
                Alert.business_id == business_id,
                Alert.product_id == inv.product_id,
                Alert.alert_type == "LOW_STOCK",
                Alert.is_resolved == False,
            )
            if not existing:
                await Alert(
                    business_id=business_id,
                    branch_id=inv.branch_id,
                    alert_type="LOW_STOCK",
                    severity="WARNING",
                    product_id=inv.product_id,
                    title=f"Low Stock Alert: {prod_name}",
                    message=f"{prod_name} stock is {inv.qty_on_hand}, which is at or below reorder level ({reorder_level}).",
                ).insert()
                created_count += 1

    # 3. Check Price Anomalies
    for prod in products.values():
        if prod.selling_price < prod.purchase_price and prod.status == "ACTIVE":
            existing = await Alert.find_one(
                Alert.business_id == business_id,
                Alert.product_id == str(prod.id),
                Alert.alert_type == "PRICE_ANOMALY",
                Alert.is_resolved == False,
            )
            if not existing:
                await Alert(
                    business_id=business_id,
                    alert_type="PRICE_ANOMALY",
                    severity="WARNING",
                    product_id=str(prod.id),
                    title=f"Price Anomaly: {prod.name}",
                    message=f"Selling price ({prod.selling_price}) is lower than purchase price ({prod.purchase_price}). Loss per unit sale.",
                ).insert()
                created_count += 1

    return created_count


async def list_alerts(
    business_id: str,
    unread_only: bool = False,
    limit: int = 50,
    db=None,
) -> List[AlertResponse]:
    await evaluate_and_generate_alerts(business_id)

    query = Alert.find(Alert.business_id == business_id)
    if unread_only:
        query = query.find(Alert.is_read == False)

    alerts = await query.sort(+Alert.is_resolved, -Alert.created_at).limit(limit).to_list()
    return [AlertResponse.model_validate(a.model_dump()) for a in alerts]


async def mark_alert_read(
    business_id: str,
    alert_id: str,
    db=None,
) -> AlertResponse:
    alert = await Alert.find_one(Alert.id == to_oid(alert_id), Alert.business_id == business_id)
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    await alert.set({Alert.is_read: True})
    return AlertResponse.model_validate(alert.model_dump())


async def resolve_alert(
    business_id: str,
    alert_id: str,
    db=None,
) -> AlertResponse:
    alert = await Alert.find_one(Alert.id == to_oid(alert_id), Alert.business_id == business_id)
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    await alert.set({
        Alert.is_resolved: True,
        Alert.resolved_at: datetime.now(timezone.utc)
    })
    return AlertResponse.model_validate(alert.model_dump())
