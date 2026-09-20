import pytest
from datetime import date, timedelta
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_purchase_flow(client: AsyncClient, setup_tenants: dict):
    token = setup_tenants["token_owner_a"]
    branch_id = str(setup_tenants["branch_a"].id)

    # 1. Create Supplier
    sup_res = await client.post(
        "/api/v1/suppliers",
        json={"name": "Torrent Pharmaceuticals", "phone": "+919999988888"},
        headers={"Authorization": f"Bearer {token}"},
    )
    sup_id = sup_res.json()["id"]

    # 2. Create Product
    prod_res = await client.post(
        "/api/v1/products",
        json={
            "sku": "LOSAR-50",
            "name": "Losartan 50mg",
            "purchase_price": 25.0,
            "selling_price": 50.0,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    prod_id = prod_res.json()["id"]

    # 3. Create Purchase Order
    purchase_payload = {
        "branch_id": branch_id,
        "supplier_id": sup_id,
        "invoice_no": "BILL-TP-9921",
        "items": [
            {
                "product_id": prod_id,
                "batch_no": "LOS-B2026",
                "expiry_date": str(date.today() + timedelta(days=500)),
                "qty": 200,
                "unit_cost": 25.0,
            }
        ],
        "payment_mode": "CREDIT",
        "tax_amount": 250.0,
    }
    res = await client.post(
        "/api/v1/purchases",
        json=purchase_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    p_data = res.json()
    assert p_data["invoice_no"] == "BILL-TP-9921"
    # 200 * 25 = 5000 + 250 = 5250
    assert p_data["total_amount"] == 5250.0

    # 4. Verify inventory was increased
    inv_res = await client.get(
        f"/api/v1/inventory?product_id={prod_id}&branch_id={branch_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert inv_res.json()[0]["qty_on_hand"] == 200

    # 5. List purchases
    p_list = await client.get(
        "/api/v1/purchases",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert p_list.status_code == 200
    assert len(p_list.json()) >= 1
