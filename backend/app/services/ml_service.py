import numpy as np
from datetime import date, datetime, timedelta, timezone
from typing import Optional, List
from fastapi import HTTPException, status

from app.models.product import Product
from app.models.inventory import Inventory, Batch
from app.models.transaction import Sale, SaleItem
from app.models.ai import AIPrediction, MLFeedback
from app.db.mongodb import to_oid
from app.schemas.ml import (
    DemandPredictResponse,
    StockPredictResponse,
    ExpiryRiskResponse,
    ExpiryRiskItem,
    AnomalyDetectionResponse,
    AnomalyItem,
    MLFeedbackCreate,
    MLFeedbackResponse,
)

MIN_DATA_POINTS_FOR_PREDICTION = 5


async def predict_demand(
    business_id: str,
    product_id: str,
    horizon_days: int = 30,
    db=None,
) -> DemandPredictResponse:
    product = await Product.find_one(Product.id == to_oid(product_id), Product.business_id == business_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found in this business")

    start_date = datetime.now(timezone.utc) - timedelta(days=90)
    sales = await Sale.find(
        Sale.business_id == business_id,
        Sale.created_at >= start_date
    ).to_list()

    sale_ids = [str(s.id) for s in sales]
    daily_map = {}

    if sale_ids:
        sale_items = await SaleItem.find({"sale_id": {"$in": sale_ids}, "product_id": product_id}).to_list()
        sale_map = {str(s.id): s.created_at for s in sales}

        for item in sale_items:
            created_at = sale_map.get(item.sale_id)
            if created_at:
                d = created_at.date()
                daily_map[d] = daily_map.get(d, 0.0) + float(item.qty or 0)

    sorted_dates = sorted(daily_map.keys())

    if len(sorted_dates) < MIN_DATA_POINTS_FOR_PREDICTION:
        return DemandPredictResponse(
            product_id=product_id,
            product_name=product.name,
            has_sufficient_data=False,
            data_points_found=len(sorted_dates),
            minimum_required=MIN_DATA_POINTS_FOR_PREDICTION,
            predicted_daily_demand=None,
            predicted_horizon_demand=None,
            confidence_score=None,
            trend=None,
            notes=f"Insufficient historical sales data. Found {len(sorted_dates)} daily sales records, but at least {MIN_DATA_POINTS_FOR_PREDICTION} distinct dates are required for statistical demand forecasting.",
        )

    dates = sorted_dates
    quantities = np.array([daily_map[d] for d in dates], dtype=float)

    first_date = dates[0]
    x_vals = np.array([(d - first_date).days for d in dates], dtype=float)
    A = np.vstack([x_vals, np.ones(len(x_vals))]).T

    (slope, intercept), residuals, rank, s = np.linalg.lstsq(A, quantities, rcond=None)

    y_pred = slope * x_vals + intercept
    ss_res = np.sum((quantities - y_pred) ** 2)
    ss_tot = np.sum((quantities - np.mean(quantities)) ** 2)
    if ss_tot > 0:
        r_sq = float(1.0 - (ss_res / ss_tot))
    else:
        r_sq = 0.5
    confidence = max(0.1, min(0.99, float(r_sq) if not np.isnan(r_sq) else 0.5))

    last_day = x_vals[-1]
    future_days = np.arange(last_day + 1, last_day + 1 + horizon_days)
    future_preds = slope * future_days + intercept
    future_preds = np.clip(future_preds, a_min=0, a_max=None)

    daily_avg = float(np.mean(future_preds))
    horizon_total = float(np.sum(future_preds))

    if slope > 0.05:
        trend = "INCREASING"
    elif slope < -0.05:
        trend = "DECREASING"
    else:
        trend = "STABLE"

    pred = AIPrediction(
        business_id=business_id,
        product_id=product_id,
        prediction_type="DEMAND",
        predicted_value=round(horizon_total, 2),
        confidence=round(confidence, 2),
        data_points=len(sorted_dates),
        metadata={
            "daily_avg": round(daily_avg, 2),
            "horizon_days": horizon_days,
            "trend": trend,
            "slope": round(float(slope), 4),
        },
    )
    await pred.insert()

    return DemandPredictResponse(
        product_id=product_id,
        product_name=product.name,
        has_sufficient_data=True,
        data_points_found=len(sorted_dates),
        minimum_required=MIN_DATA_POINTS_FOR_PREDICTION,
        predicted_daily_demand=round(daily_avg, 2),
        predicted_horizon_demand=round(horizon_total, 2),
        confidence_score=round(confidence, 2),
        trend=trend,
        notes=f"Demand predicted using ordinary least squares regression over {len(sorted_dates)} data points.",
    )


async def predict_stockout(
    business_id: str,
    product_id: str,
    db=None,
) -> StockPredictResponse:
    product = await Product.find_one(Product.id == to_oid(product_id), Product.business_id == business_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found in this business")

    invs = await Inventory.find(Inventory.product_id == product_id).to_list()
    current_stock = sum(inv.qty_on_hand for inv in invs)

    demand = await predict_demand(business_id, product_id, horizon_days=30, db=db)
    if not demand.has_sufficient_data or not demand.predicted_daily_demand or demand.predicted_daily_demand <= 0:
        return StockPredictResponse(
            product_id=product_id,
            product_name=product.name,
            current_stock=current_stock,
            predicted_daily_burn_rate=None,
            estimated_days_until_stockout=None,
            recommended_reorder_qty=product.reorder_level * 2,
            urgency_level="CRITICAL" if current_stock == 0 else "LOW",
            has_sufficient_data=False,
            notes="Insufficient sales history to calculate statistical stock burn rate.",
        )

    daily_burn = demand.predicted_daily_demand
    days_left = int(current_stock / daily_burn) if daily_burn > 0 else 999

    if days_left <= 3 or current_stock == 0:
        urgency = "CRITICAL"
    elif days_left <= 7:
        urgency = "HIGH"
    elif days_left <= 14:
        urgency = "MEDIUM"
    else:
        urgency = "LOW"

    reorder_qty = int(daily_burn * 30 + product.reorder_level)

    return StockPredictResponse(
        product_id=product_id,
        product_name=product.name,
        current_stock=current_stock,
        predicted_daily_burn_rate=round(daily_burn, 2),
        estimated_days_until_stockout=days_left,
        recommended_reorder_qty=reorder_qty,
        urgency_level=urgency,
        has_sufficient_data=True,
        notes=f"Stockout in ~{days_left} days based on daily velocity of {daily_burn:.1f} units/day.",
    )


async def predict_expiry_risks(
    business_id: str,
    db=None,
) -> ExpiryRiskResponse:
    today_dt = datetime.combine(date.today(), datetime.min.time(), tzinfo=timezone.utc)
    products = await Product.find(Product.business_id == business_id).to_list()
    product_map = {str(p.id): p for p in products}
    product_ids = list(product_map.keys())

    max_date = today_dt + timedelta(days=60)
    batches = await Batch.find(
        {"product_id": {"$in": product_ids}},
        Batch.qty_remaining > 0
    ).to_list()

    batches = [b for b in batches if datetime.combine(b.expiry_date, datetime.min.time(), tzinfo=timezone.utc) <= max_date]
    batches.sort(key=lambda b: b.expiry_date)

    items = []
    total_loss = 0.0
    total_qty = 0

    for batch in batches:
        product = product_map[batch.product_id]
        b_expiry = datetime.combine(batch.expiry_date, datetime.min.time(), tzinfo=timezone.utc)
        days_left = max(0, (b_expiry - today_dt).days)

        demand = await predict_demand(business_id, batch.product_id, horizon_days=30, db=db)
        daily_rate = demand.predicted_daily_demand or 0.5
        expected_sales = int(daily_rate * days_left)
        wastage_qty = max(0, batch.qty_remaining - expected_sales)

        if days_left <= 15 or wastage_qty > (batch.qty_remaining * 0.5):
            risk = "HIGH"
        elif days_left <= 30:
            risk = "MEDIUM"
        else:
            risk = "LOW"

        loss_val = wastage_qty * float(batch.purchase_price or 0.0)
        total_loss += loss_val
        total_qty += wastage_qty

        items.append(
            ExpiryRiskItem(
                batch_id=str(batch.id),
                batch_no=batch.batch_no,
                product_name=product.name,
                expiry_date=str(batch.expiry_date),
                remaining_qty=batch.qty_remaining,
                predicted_sales_before_expiry=expected_sales,
                estimated_wastage_qty=wastage_qty,
                risk_level=risk,
            )
        )

    return ExpiryRiskResponse(
        batches=items,
        total_at_risk_qty=total_qty,
        estimated_loss_value=round(total_loss, 2),
    )


async def detect_anomalies(
    business_id: str,
    db=None,
) -> AnomalyDetectionResponse:
    anomalies: List[AnomalyItem] = []

    products = await Product.find(Product.business_id == business_id, Product.status == "ACTIVE").to_list()

    for p in products:
        p_price = float(p.purchase_price)
        s_price = float(p.selling_price)
        if s_price < p_price:
            anomalies.append(
                AnomalyItem(
                    anomaly_type="PRICE_DEVIATION",
                    severity="CRITICAL",
                    product_id=str(p.id),
                    product_name=p.name,
                    description=f"Selling price (₹{s_price}) is lower than purchase price (₹{p_price}).",
                    observed_value=s_price,
                    expected_range=f">= ₹{p_price}",
                    score=round((p_price - s_price) / max(1, p_price), 2),
                )
            )

    product_ids = [str(p.id) for p in products]
    inventories = await Inventory.find({"product_id": {"$in": product_ids}}).to_list()
    batches = await Batch.find({"product_id": {"$in": product_ids}}).to_list()

    inv_map = {}
    for inv in inventories:
        inv_map[inv.product_id] = inv_map.get(inv.product_id, 0) + inv.qty_on_hand

    batch_map = {}
    for batch in batches:
        batch_map[batch.product_id] = batch_map.get(batch.product_id, 0) + batch.qty_remaining

    for p in products:
        pid = str(p.id)
        on_hand = inv_map.get(pid, 0)
        batch_tot = batch_map.get(pid, 0)

        if on_hand != batch_tot:
            diff = abs(on_hand - batch_tot)
            anomalies.append(
                AnomalyItem(
                    anomaly_type="INVENTORY_DISCREPANCY",
                    severity="WARNING",
                    product_id=pid,
                    product_name=p.name,
                    description=f"Inventory on hand ({on_hand}) does not match sum of active batch quantities ({batch_tot}). Discrepancy of {diff} units.",
                    observed_value=float(on_hand),
                    expected_range=f"= {batch_tot}",
                    score=min(1.0, diff / max(1, on_hand, batch_tot)),
                )
            )

    return AnomalyDetectionResponse(
        total_anomalies=len(anomalies),
        anomalies=anomalies,
        checked_products_count=len(products),
    )


async def submit_ml_feedback(
    business_id: str,
    user_id: str,
    req: MLFeedbackCreate,
    db=None,
) -> MLFeedbackResponse:
    feedback = MLFeedback(
        business_id=business_id,
        prediction_id=req.prediction_id,
        prediction_type=req.prediction_type,
        actual_value=req.actual_value,
        predicted_value=req.predicted_value,
        accuracy_score=req.accuracy_score,
        notes=req.notes,
        created_by=user_id,
    )
    await feedback.insert()
    return MLFeedbackResponse.model_validate(feedback.model_dump())
