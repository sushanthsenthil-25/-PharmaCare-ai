import pytest
import uuid
from datetime import date, datetime, timedelta, timezone
from httpx import AsyncClient

from app.models.product import Product
from app.models.inventory import Inventory, Batch
from app.models.transaction import Sale, SaleItem


@pytest.mark.asyncio
async def test_ml_demand_prediction_and_anomalies(client: AsyncClient, setup_tenants: dict):
    token = setup_tenants["token_owner_a"]
    branch_id = str(setup_tenants["branch_a"].id)
    biz_id = str(setup_tenants["biz_a"].id)
    user_id = str(setup_tenants["owner_a"].id)

    # 1. Create Product
    prod = Product(
        business_id=biz_id,
        sku="MET-500",
        name="Metformin 500mg",
        purchase_price=20.0,
        selling_price=45.0,
        reorder_level=50,
    )
    await prod.insert()

    inv = Inventory(product_id=str(prod.id), branch_id=branch_id, qty_on_hand=200)
    await inv.insert()

    # 2. Test Insufficient Data Response (<5 data points)
    res_insuf = await client.post(
        "/api/v1/ml/predict-demand",
        json={"product_id": str(prod.id), "horizon_days": 30},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_insuf.status_code == 200
    d_insuf = res_insuf.json()
    assert d_insuf["has_sufficient_data"] is False
    assert "insufficient" in d_insuf["notes"].lower()

    # 3. Seed 7 distinct daily sales records for statistical ML modeling
    now = datetime.now(timezone.utc)
    for i in range(7):
        sale_dt = now - timedelta(days=i + 1)
        s = Sale(
            business_id=biz_id,
            branch_id=branch_id,
            subtotal=450.0,
            total_amount=450.0,
            payment_mode="CASH",
            created_by=user_id,
            created_at=sale_dt,
        )
        await s.insert()

        si = SaleItem(
            sale_id=str(s.id),
            product_id=str(prod.id),
            qty=10 + i * 2,  # 10, 12, 14, 16, 18, 20, 22
            unit_price=45.0,
            line_total=float((10 + i * 2) * 45.0),
        )
        await si.insert()

    # 4. Re-run demand prediction with sufficient data
    res_suf = await client.post(
        "/api/v1/ml/predict-demand",
        json={"product_id": str(prod.id), "horizon_days": 30},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_suf.status_code == 200
    d_suf = res_suf.json()
    assert d_suf["has_sufficient_data"] is True
    assert d_suf["predicted_daily_demand"] is not None
    assert d_suf["predicted_horizon_demand"] is not None
    assert d_suf["confidence_score"] is not None
    assert d_suf["trend"] in ["INCREASING", "DECREASING", "STABLE"]

    # 5. Stockout prediction
    stock_res = await client.get(
        f"/api/v1/ml/predict-stockout/{prod.id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert stock_res.status_code == 200
    s_data = stock_res.json()
    assert s_data["has_sufficient_data"] is True
    assert s_data["estimated_days_until_stockout"] is not None
    assert s_data["urgency_level"] in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]

    # 6. Anomaly Detection
    anom_res = await client.get(
        "/api/v1/ml/anomalies",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert anom_res.status_code == 200
    anom_data = anom_res.json()
    assert "total_anomalies" in anom_data

    # 7. Submit ML Feedback
    fb_res = await client.post(
        "/api/v1/ml/feedback",
        json={
            "prediction_type": "DEMAND",
            "actual_value": 460.0,
            "predicted_value": 450.0,
            "accuracy_score": 0.98,
            "notes": "Very accurate 30-day forecast",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert fb_res.status_code == 200
    assert fb_res.json()["accuracy_score"] == 0.98
