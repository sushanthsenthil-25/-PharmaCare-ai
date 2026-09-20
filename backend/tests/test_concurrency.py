import asyncio
import pytest
from datetime import date, timedelta
from httpx import AsyncClient

from app.models.product import Product
from app.models.inventory import Inventory, Batch


@pytest.mark.asyncio
async def test_concurrency_race_condition_prevention(client: AsyncClient, setup_tenants: dict):
    """
    Race Condition Test:
    Stock is exactly 10 units.
    Two simultaneous requests A and B both try to sell 7 units.
    One must succeed (reducing stock to 3), and the other MUST fail with 400 (insufficient stock),
    NEVER allowing stock to drop to negative (-4).
    """
    token = setup_tenants["token_owner_a"]
    branch_id = str(setup_tenants["branch_a"].id)
    biz_id = str(setup_tenants["biz_a"].id)

    # 1. Create product with initial stock = 10
    prod = Product(
        business_id=biz_id,
        sku="CONCUR-10",
        name="Race Condition Tablet",
        purchase_price=5.0,
        selling_price=15.0,
    )
    await prod.insert()

    batch = Batch(
        product_id=str(prod.id),
        branch_id=branch_id,
        batch_no="CONCUR-B1",
        expiry_date=date.today() + timedelta(days=100),
        purchase_price=5.0,
        qty_received=10,
        qty_remaining=10,
    )
    await batch.insert()

    inv = Inventory(
        product_id=str(prod.id),
        branch_id=branch_id,
        qty_on_hand=10,
    )
    await inv.insert()

    sale_payload = {
        "branch_id": str(branch_id),
        "items": [{"product_id": str(prod.id), "qty": 7, "unit_price": 15.0}],
        "payment_mode": "CASH",
    }

    # 2. Fire two sales simultaneously
    req_a = client.post(
        "/api/v1/sales",
        json=sale_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    req_b = client.post(
        "/api/v1/sales",
        json=sale_payload,
        headers={"Authorization": f"Bearer {token}"},
    )

    results = await asyncio.gather(req_a, req_b, return_exceptions=True)

    statuses = [r.status_code for r in results if hasattr(r, "status_code")]

    # Exactly one must succeed (201) and one must be rejected (400)
    assert 201 in statuses, f"Expected at least one success, got: {statuses}"
    assert 400 in statuses, f"Expected one rejection due to insufficient stock, got: {statuses}"

    # 3. Verify final stock is exactly 3 (10 - 7), and NEVER negative
    inv_res = await client.get(
        f"/api/v1/inventory?product_id={prod.id}&branch_id={branch_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    final_stock = inv_res.json()[0]["qty_on_hand"]
    assert final_stock == 3, f"Expected final stock to be 3, got: {final_stock}"
    assert final_stock >= 0, "CRITICAL ERROR: Stock went negative!"
