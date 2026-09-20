import pytest
from datetime import date, timedelta
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_inventory_and_batches(client: AsyncClient, setup_tenants: dict):
    token = setup_tenants["token_owner_a"]
    branch_id = str(setup_tenants["branch_a"].id)

    # 1. Create Supplier
    sup_res = await client.post(
        "/api/v1/suppliers",
        json={
            "name": "Sun Pharma Wholesale",
            "contact_person": "Venkatesh",
            "phone": "+919845012345",
            "email": "orders@sunpharma.com",
            "drug_license_no": "DL-KA-2024-998",
            "gstin": "29AABCS1429B1ZB",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert sup_res.status_code == 201
    sup_id = sup_res.json()["id"]

    # 2. Create Product
    prod_res = await client.post(
        "/api/v1/products",
        json={
            "sku": "AZI-500",
            "name": "Azithromycin 500mg",
            "purchase_price": 60.0,
            "selling_price": 120.0,
            "reorder_level": 20,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert prod_res.status_code == 201
    prod_id = prod_res.json()["id"]

    # 3. Create Batch (receives 100 units)
    future_expiry = str(date.today() + timedelta(days=365))
    batch_res = await client.post(
        "/api/v1/inventory/batches",
        json={
            "product_id": prod_id,
            "branch_id": branch_id,
            "supplier_id": sup_id,
            "batch_no": "AZI2026-001",
            "mfg_date": str(date.today() - timedelta(days=30)),
            "expiry_date": future_expiry,
            "purchase_price": 60.0,
            "selling_price": 120.0,
            "qty_received": 100,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert batch_res.status_code == 201
    batch_id = batch_res.json()["id"]

    # 4. Check Inventory on hand
    inv_res = await client.get(
        f"/api/v1/inventory?product_id={prod_id}&branch_id={branch_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert inv_res.status_code == 200
    inv_items = inv_res.json()
    assert len(inv_items) == 1
    assert inv_items[0]["qty_on_hand"] == 100

    # 5. Perform Stock Adjustment (Wastage of 5 units damaged)
    adj_res = await client.post(
        "/api/v1/inventory/adjust",
        json={
            "product_id": prod_id,
            "branch_id": branch_id,
            "batch_id": batch_id,
            "qty_change": -5,
            "movement_type": "WASTAGE",
            "notes": "Damaged in transit",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert adj_res.status_code == 200
    assert adj_res.json()["qty_on_hand"] == 95

    # 6. Reject Negative Inventory Adjustment
    bad_adj = await client.post(
        "/api/v1/inventory/adjust",
        json={
            "product_id": prod_id,
            "branch_id": branch_id,
            "batch_id": batch_id,
            "qty_change": -200,  # exceeds 95
            "movement_type": "ADJUSTMENT",
            "notes": "Attempting negative stock",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert bad_adj.status_code == 400
    assert "negative" in bad_adj.text.lower()

    # 7. Verify Inventory Movement Audit Trail
    move_res = await client.get(
        f"/api/v1/inventory/movements?product_id={prod_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert move_res.status_code == 200
    movements = move_res.json()
    assert len(movements) >= 2  # Purchase + Wastage
    types = [m["movement_type"] for m in movements]
    assert "PURCHASE" in types
    assert "WASTAGE" in types
