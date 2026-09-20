from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from app.models.transaction import Sale, SaleItem, Purchase
from app.models.product import Product
from app.models.inventory import Batch, Inventory
from app.models.order import Order
from app.schemas.analytics import (
    SalesTrendsResponse,
    SalesTrendPoint,
    PurchaseTrendsResponse,
    PurchaseTrendPoint,
    ProductPerformanceResponse,
    ProductPerformanceItem,
    InventoryTurnoverResponse,
    ExpiryTrendsResponse,
    ExpiryTrendItem,
    RevenueMetricsResponse,
)


async def get_sales_trends(business_id: str, days: int = 30, db=None) -> SalesTrendsResponse:
    start_date = datetime.now(timezone.utc) - timedelta(days=days)

    sales = await Sale.find(
        Sale.business_id == business_id,
        Sale.created_at >= start_date
    ).to_list()

    daily_sales = {}
    for sale in sales:
        day = sale.created_at.date().isoformat()
        if day not in daily_sales:
            daily_sales[day] = {"count": 0, "revenue": 0.0}
        daily_sales[day]["count"] += 1
        daily_sales[day]["revenue"] += float(sale.total_amount)

    points = []
    total_rev = 0.0
    total_sales = 0
    for day, data in sorted(daily_sales.items()):
        total_rev += data["revenue"]
        total_sales += data["count"]
        points.append(
            SalesTrendPoint(
                date=day,
                sales_count=data["count"],
                revenue=round(data["revenue"], 2),
                total_items=data["count"],
            )
        )

    return SalesTrendsResponse(
        period_days=days,
        data=points,
        total_revenue=round(total_rev, 2),
        total_sales=total_sales,
    )


async def get_purchase_trends(business_id: str, days: int = 30, db=None) -> PurchaseTrendsResponse:
    start_date = datetime.now(timezone.utc) - timedelta(days=days)

    purchases = await Purchase.find(
        Purchase.business_id == business_id,
        Purchase.created_at >= start_date
    ).to_list()

    daily_purchases = {}
    for p in purchases:
        day = p.created_at.date().isoformat()
        if day not in daily_purchases:
            daily_purchases[day] = {"count": 0, "spent": 0.0}
        daily_purchases[day]["count"] += 1
        daily_purchases[day]["spent"] += float(p.total_amount)

    points = []
    total_spent = 0.0
    for day, data in sorted(daily_purchases.items()):
        total_spent += data["spent"]
        points.append(
            PurchaseTrendPoint(
                date=day,
                purchases_count=data["count"],
                total_spent=round(data["spent"], 2),
            )
        )

    return PurchaseTrendsResponse(
        period_days=days,
        data=points,
        total_spent=round(total_spent, 2),
    )


async def get_product_performance(business_id: str, db=None) -> ProductPerformanceResponse:
    products = await Product.find(Product.business_id == business_id).to_list()
    product_map = {str(p.id): p for p in products}
    product_ids = list(product_map.keys())

    sales = await Sale.find(Sale.business_id == business_id).to_list()
    sale_ids = [str(s.id) for s in sales]

    sale_items = []
    if sale_ids:
        # Batch fetching for sale items could be large, but acceptable for hackathon
        sale_items = await SaleItem.find({"sale_id": {"$in": sale_ids}}).to_list()

    perf_map = {}
    for p in products:
        perf_map[str(p.id)] = {"qty": 0, "revenue": 0.0}

    for item in sale_items:
        if item.product_id in perf_map:
            perf_map[item.product_id]["qty"] += item.qty
            perf_map[item.product_id]["revenue"] += float(item.line_total)

    perf_list = []
    for pid, data in perf_map.items():
        product = product_map[pid]
        f_rev = data["revenue"]
        f_cost = float(product.purchase_price or 0.0) * data["qty"]
        profit = round(f_rev - f_cost, 2)
        perf_list.append(
            ProductPerformanceItem(
                product_id=pid,
                product_name=product.name,
                sku=product.sku,
                qty_sold=data["qty"],
                revenue=round(f_rev, 2),
                profit=profit,
            )
        )

    perf_list.sort(key=lambda x: x.qty_sold, reverse=True)

    top_list = [p for p in perf_list if p.qty_sold > 0][:10]
    slow_list = [p for p in perf_list if p.qty_sold == 0][:10]
    if len(slow_list) < 10:
        slow_list.extend([p for p in reversed(perf_list) if p.qty_sold > 0][:10 - len(slow_list)])

    return ProductPerformanceResponse(
        top_selling=top_list,
        slow_moving=slow_list,
    )


async def get_inventory_turnover(business_id: str, db=None) -> InventoryTurnoverResponse:
    products = await Product.find(Product.business_id == business_id).to_list()
    product_map = {str(p.id): p for p in products}
    product_ids = list(product_map.keys())

    batches = await Batch.find({"product_id": {"$in": product_ids}}).to_list()
    inv_val = sum(b.qty_remaining * float(b.purchase_price) for b in batches)

    sales = await Sale.find(Sale.business_id == business_id).to_list()
    sale_ids = [str(s.id) for s in sales]

    cogs = 0.0
    if sale_ids:
        sale_items = await SaleItem.find({"sale_id": {"$in": sale_ids}}).to_list()
        for item in sale_items:
            product = product_map.get(item.product_id)
            if product:
                cogs += item.qty * float(product.purchase_price or 0.0)

    turnover_ratio = (cogs / inv_val) if inv_val > 0 else 0.0
    days_to_sell = (365 / turnover_ratio) if turnover_ratio > 0 else 0.0

    return InventoryTurnoverResponse(
        total_inventory_value=round(inv_val, 2),
        cost_of_goods_sold=round(cogs, 2),
        turnover_ratio=round(turnover_ratio, 2),
        average_days_to_sell=round(days_to_sell, 1),
    )


async def get_expiry_trends(business_id: str, db=None) -> ExpiryTrendsResponse:
    products = await Product.find(Product.business_id == business_id).to_list()
    product_ids = [str(p.id) for p in products]

    today = datetime.combine(date.today(), datetime.min.time(), tzinfo=timezone.utc)

    batches = await Batch.find({"product_id": {"$in": product_ids}}, Batch.qty_remaining > 0).to_list()

    buckets = {
        "Expired": {"count": 0, "qty": 0, "loss": 0.0},
        "0-7 days": {"count": 0, "qty": 0, "loss": 0.0},
        "8-15 days": {"count": 0, "qty": 0, "loss": 0.0},
        "16-30 days": {"count": 0, "qty": 0, "loss": 0.0},
    }

    total_loss = 0.0
    for batch in batches:
        b_expiry = datetime.combine(batch.expiry_date, datetime.min.time(), tzinfo=timezone.utc)
        days = (b_expiry - today).days
        val = batch.qty_remaining * float(batch.purchase_price)

        if days < 0:
            target = "Expired"
        elif days <= 7:
            target = "0-7 days"
        elif days <= 15:
            target = "8-15 days"
        elif days <= 30:
            target = "16-30 days"
        else:
            continue

        buckets[target]["count"] += 1
        buckets[target]["qty"] += batch.qty_remaining
        buckets[target]["loss"] += val
        total_loss += val

    summary = [
        ExpiryTrendItem(
            period=k,
            batch_count=v["count"],
            total_quantity=v["qty"],
            estimated_loss_value=round(v["loss"], 2),
        )
        for k, v in buckets.items()
    ]

    return ExpiryTrendsResponse(
        summary=summary,
        total_at_risk_value=round(total_loss, 2),
    )


async def get_revenue_metrics(business_id: str, db=None) -> RevenueMetricsResponse:
    now = datetime.now(timezone.utc)
    today_start = datetime.combine(now.date(), datetime.min.time(), tzinfo=timezone.utc)
    week_start = now - timedelta(days=7)
    month_start = now - timedelta(days=30)

    all_sales = await Sale.find(Sale.business_id == business_id).to_list()

    today_rev = 0.0
    week_rev = 0.0
    month_rev = 0.0
    total_rev = 0.0

    for sale in all_sales:
        amt = float(sale.total_amount)
        total_rev += amt
        if sale.created_at >= month_start:
            month_rev += amt
            if sale.created_at >= week_start:
                week_rev += amt
                if sale.created_at >= today_start:
                    today_rev += amt

    aov = (total_rev / len(all_sales)) if all_sales else 0.0

    return RevenueMetricsResponse(
        today_revenue=round(today_rev, 2),
        this_week_revenue=round(week_rev, 2),
        this_month_revenue=round(month_rev, 2),
        average_order_value=round(aov, 2),
    )
