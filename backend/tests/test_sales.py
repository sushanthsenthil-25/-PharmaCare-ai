import pytest
from datetime import date, timedelta
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_sales_workflow_and_expiry_block(client: AsyncClient, setup_tenants: dict):
    token = setup_tenants["token_owner_a"]
    branch_id = str(setup_tenants["branch_a"].id)

    # 1. Create Product
    prod_res = await client.post(
        "/api/v1/products",
        json={
            "sku": "DOLO-650",
            "name": "Dolo 650 Tablets",
            "purchase_price": 15.0,
            "selling_price": 32.0,
            "reorder_level": 10,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert prod_res.status_code == 201
    prod_id = prod_res.json()["id"]

    # 2. Add Valid Batch (Stock: 50)
    valid_batch = await client.post(
        "/api/v1/inventory/batches",
        json={
            "product_id": prod_id,
            "branch_id": branch_id,
            "batch_no": "DOLO-VALID-1",
            "expiry_date": str(date.today() + timedelta(days=180)),
            "purchase_price": 15.0,
            "qty_received": 50,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert valid_batch.status_code == 201
    valid_batch_id = valid_batch.json()["id"]

    # 3. Add Expired Batch (Stock: 20)
    expired_batch = await client.post(
        "/api/v1/inventory/batches",
        json={
            "product_id": prod_id,
            "branch_id": branch_id,
            "batch_no": "DOLO-EXPIRED-9",
            "expiry_date": str(date.today() - timedelta(days=10)),
            "purchase_price": 15.0,
            "qty_received": 20,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert expired_batch.status_code == 201
    expired_batch_id = expired_batch.json()["id"]

    # 4. Attempt to sell Expired Batch explicitly -> MUST FAIL with HTTP 400
    bad_sale = await client.post(
        "/api/v1/sales",
        json={
            "branch_id": branch_id,
            "items": [
                {
                    "product_id": prod_id,
                    "batch_id": expired_batch_id,
                    "qty": 5,
                    "unit_price": 32.0,
                }
            ],
            "payment_mode": "CASH",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert bad_sale.status_code == 400
    assert "expired" in bad_sale.text.lower()

    # 5. Execute Valid Sale (10 units)
    sale_res = await client.post(
        "/api/v1/sales",
        json={
            "branch_id": branch_id,
            "items": [
                {
                    "product_id": prod_id,
                    "batch_id": valid_batch_id,
                    "qty": 10,
                    "unit_price": 32.0,
                    "discount_pct": 5.0,
                }
            ],
            "payment_mode": "UPI",
            "notes": "Walk-in patient customer",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert sale_res.status_code == 201
    sale_data = sale_res.json()
    assert sale_data["invoice_no"].startswith("INV-")
    assert len(sale_data["items"]) == 1
    # 10 * 32 * 0.95 = 304.0
    assert sale_data["total_amount"] == 304.0

    # 6. Verify inventory was decreased
    inv_res = await client.get(
        f"/api/v1/inventory?product_id={prod_id}&branch_id={branch_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    # Total stock was 50 + 20 = 70, minus 10 = 60
    assert inv_res.json()[0]["qty_on_hand"] == 60

    # 7. Attempt to sell more than available inventory -> MUST FAIL
    oversell = await client.post(
        "/api/v1/sales",
        json={
            "branch_id": branch_id,
            "items": [
                {
                    "product_id": prod_id,
                    "qty": 100,  # only 60 available
                    "unit_price": 32.0,
                }
            ],
            "payment_mode": "CASH",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert oversell.status_code == 400
    assert "insufficient" in oversell.text.lower()

    # 8. List sales history
    history_res = await client.get(
        "/api/v1/sales",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert history_res.status_code == 200
    assert len(history_res.json()) >= 1
