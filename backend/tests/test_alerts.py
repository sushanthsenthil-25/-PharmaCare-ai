import pytest
from datetime import date, timedelta
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_alert_generation_and_resolution(client: AsyncClient, setup_tenants: dict):
    token = setup_tenants["token_owner_a"]
    branch_id = str(setup_tenants["branch_a"].id)

    # 1. Create a product with selling_price < purchase_price (PRICE_ANOMALY)
    # and low stock (LOW_STOCK)
    prod_res = await client.post(
        "/api/v1/products",
        json={
            "sku": "INSULIN-ANOMALY",
            "name": "Insulin Glargine 100IU",
            "purchase_price": 450.0,
            "selling_price": 400.0,  # lower than purchase -> PRICE_ANOMALY
            "reorder_level": 15,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    prod_id = prod_res.json()["id"]

    # 2. Add an expiring batch (expires in 5 days -> <=7 days CRITICAL alert)
    await client.post(
        "/api/v1/inventory/batches",
        json={
            "product_id": prod_id,
            "branch_id": branch_id,
            "batch_no": "INS-EXP7",
            "expiry_date": str(date.today() + timedelta(days=5)),
            "purchase_price": 450.0,
            "qty_received": 10,  # 10 is <= reorder_level 15 -> LOW_STOCK
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    # 3. Add an expired batch (expired 2 days ago -> EXPIRED CRITICAL alert)
    await client.post(
        "/api/v1/inventory/batches",
        json={
            "product_id": prod_id,
            "branch_id": branch_id,
            "batch_no": "INS-EXPIRED",
            "expiry_date": str(date.today() - timedelta(days=2)),
            "purchase_price": 450.0,
            "qty_received": 5,
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    # 4. Fetch alerts
    alerts_res = await client.get(
        "/api/v1/alerts",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert alerts_res.status_code == 200
    alerts = alerts_res.json()
    assert len(alerts) >= 2

    alert_types = [a["alert_type"] for a in alerts]
    assert "PRICE_ANOMALY" in alert_types
    assert any(t in alert_types for t in ["EXPIRING_SOON", "EXPIRED"])

    # 5. Mark alert as read
    first_alert_id = alerts[0]["id"]
    read_res = await client.patch(
        f"/api/v1/alerts/{first_alert_id}/read",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert read_res.status_code == 200
    assert read_res.json()["is_read"] is True

    # 6. Resolve alert
    resolve_res = await client.patch(
        f"/api/v1/alerts/{first_alert_id}/resolve",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resolve_res.status_code == 200
    assert resolve_res.json()["is_resolved"] is True
