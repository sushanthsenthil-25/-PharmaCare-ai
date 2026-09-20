import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_orders_lifecycle(client: AsyncClient, setup_tenants: dict):
    token = setup_tenants["token_owner_a"]
    branch_id = str(setup_tenants["branch_a"].id)

    # 1. Create Product
    prod_res = await client.post(
        "/api/v1/products",
        json={"sku": "PAN-40", "name": "Pantoprazole 40mg", "purchase_price": 30.0, "selling_price": 65.0},
        headers={"Authorization": f"Bearer {token}"},
    )
    prod_id = prod_res.json()["id"]

    # 2. Create Express Order
    order_res = await client.post(
        "/api/v1/orders",
        json={
            "branch_id": branch_id,
            "items": [{"product_id": prod_id, "qty": 2, "unit_price": 65.0}],
            "delivery_address": "Flat 402, Green Glen Layout, Bellandur",
            "delivery_pin": "560103",
            "delivery_fee": 30.0,
            "notes": "Express 30 min doorstep delivery",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert order_res.status_code == 201
    order_data = order_res.json()
    assert order_data["status"] == "CREATED"
    # 2 * 65 + 30 = 160.0
    assert order_data["total_amount"] == 160.0
    order_id = order_data["id"]

    # 3. Progress Status: CONFIRMED -> PROCESSING -> OUT_FOR_DELIVERY
    update_res = await client.patch(
        f"/api/v1/orders/{order_id}/status",
        json={
            "status": "OUT_FOR_DELIVERY",
            "rider_name": "Vikram Singh",
            "rider_phone": "+91 98765 43210",
            "eta_minutes": 18,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["status"] == "OUT_FOR_DELIVERY"
    assert updated_data["rider_name"] == "Vikram Singh"
    assert updated_data["eta_minutes"] == 18

    # 4. Get order details
    get_res = await client.get(
        f"/api/v1/orders/{order_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_res.status_code == 200
    assert get_res.json()["status"] == "OUT_FOR_DELIVERY"

    # 5. Invalid status transition rejection
    bad_status = await client.patch(
        f"/api/v1/orders/{order_id}/status",
        json={"status": "INVALID_STATUS"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert bad_status.status_code in [400, 422]
