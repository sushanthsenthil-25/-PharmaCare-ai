from datetime import date, datetime, timezone, timedelta
from typing import Optional

from app.models.product import Product
from app.models.inventory import Inventory, Batch
from app.models.transaction import Sale, Purchase
from app.models.order import Order
from app.models.alert import Alert
from app.schemas.order import DashboardSummary


async def get_dashboard_summary(business_id: str, db=None) -> DashboardSummary:
    today = datetime.combine(date.today(), datetime.min.time(), tzinfo=timezone.utc)

    # 1. Product count & active product count
    products = await Product.find(Product.business_id == business_id).to_list()
    product_count = len(products)
    active_product_count = sum(1 for p in products if p.status == "ACTIVE")

    # 2. Inventory Value (sum of qty_remaining * purchase_price across batches)
    product_ids = [str(p.id) for p in products]
    batches = await Batch.find({"product_id": {"$in": product_ids}}, Batch.qty_remaining > 0).to_list()
    inventory_value = sum(b.qty_remaining * b.purchase_price for b in batches)

    # 3. Stock counts (low stock, out of stock)
    inventories = await Inventory.find({"product_id": {"$in": product_ids}}).to_list()
    product_reorder_map = {str(p.id): p.reorder_level for p in products}

    low_stock_count = 0
    out_of_stock_count = 0
    for inv in inventories:
        reorder = product_reorder_map.get(inv.product_id, 0)
        if inv.qty_on_hand <= 0:
            out_of_stock_count += 1
        elif inv.qty_on_hand <= reorder:
            low_stock_count += 1

    # 4. Expiring and expired products
    expiring_30_days = 0
    expired_count = 0
    for batch in batches:
        b_expiry = datetime.combine(batch.expiry_date, datetime.min.time(), tzinfo=timezone.utc)
        days = (b_expiry - today).days
        if days < 0:
            expired_count += 1
        elif days <= 30:
            expiring_30_days += 1

    # 5. Today's sales
    today_sales = await Sale.find(
        Sale.business_id == business_id,
        Sale.created_at >= today
    ).to_list()
    today_sales_count = len(today_sales)
    today_sales_total = sum(s.total_amount for s in today_sales)

    # 6. Today's purchases
    today_purchases = await Purchase.find(
        Purchase.business_id == business_id,
        Purchase.created_at >= today
    ).to_list()
    today_purchases_total = sum(p.total_amount for p in today_purchases)

    # 7. Active orders
    active_orders = await Order.find(
        Order.business_id == business_id,
        {"status": {"$in": ["CREATED", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY"]}}
    ).count()

    # 8. Unread alerts
    unread_alerts = await Alert.find(
        Alert.business_id == business_id,
        Alert.is_read == False
    ).count()

    return DashboardSummary(
        product_count=product_count,
        active_product_count=active_product_count,
        inventory_value=round(inventory_value, 2),
        low_stock_count=low_stock_count,
        out_of_stock_count=out_of_stock_count,
        expiring_30_days=expiring_30_days,
        expired_count=expired_count,
        today_sales_count=today_sales_count,
        today_sales_total=round(today_sales_total, 2),
        today_purchases_total=round(today_purchases_total, 2),
        active_orders=active_orders,
        unread_alerts=unread_alerts,
    )
