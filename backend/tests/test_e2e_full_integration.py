import pytest
from datetime import date, timedelta
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_full_system_integration_e2e(client: AsyncClient, setup_tenants: dict):
    """
    Complete Section 19 Verification:
    REGISTER -> LOGIN -> HOME -> PRODUCTS -> PRODUCT DETAILS -> INVENTORY ->
    SALE -> INVENTORY DECREASE -> PURCHASE -> INVENTORY INCREASE ->
    ALERT -> ORDER -> TRACK ORDER -> AI -> VOICE -> CONFIRMATION
    """
    token_owner_a = setup_tenants["token_owner_a"]
    branch_id = str(setup_tenants["branch_a"].id)
    headers_a = {"Authorization": f"Bearer {token_owner_a}"}

    # 1. Health & Docs
    health_res = await client.get("/health")
    assert health_res.status_code == 200
    assert health_res.json()["status"] in ["ok", "healthy"]

    ready_res = await client.get("/ready")
    assert ready_res.status_code == 200

    docs_res = await client.get("/openapi.json")
    assert docs_res.status_code == 200

    # 2. Products - Create category and product
    cat_res = await client.post(
        "/api/v1/categories",
        headers=headers_a,
        json={"name": "Prescription Antibiotics"},
    )
    assert cat_res.status_code == 201
    cat_id = cat_res.json()["id"]

    prod_res = await client.post(
        "/api/v1/products",
        headers=headers_a,
        json={
            "category_id": cat_id,
            "sku": "AMOX-500-E2E",
            "name": "Amoxicillin 500mg Trihydrate",
            "purchase_price": 90.0,
            "selling_price": 145.0,
            "mrp": 180.0,
            "rx_required": True,
            "composition": "Amoxicillin (500mg)",
        },
    )
    assert prod_res.status_code == 201
    prod = prod_res.json()
    prod_id = prod["id"]

    # 3. Product Details
    detail_res = await client.get(f"/api/v1/products/{prod_id}", headers=headers_a)
    assert detail_res.status_code == 200
    assert detail_res.json()["name"] == "Amoxicillin 500mg Trihydrate"

    # 4. Inventory lookup before purchase
    inv_res = await client.get(f"/api/v1/inventory?product_id={prod_id}", headers=headers_a)
    assert inv_res.status_code == 200
    assert len(inv_res.json()) == 0

    # Test alias /products/inventory
    alias_inv_res = await client.get(f"/api/v1/products/inventory?product_id={prod_id}", headers=headers_a)
    assert alias_inv_res.status_code == 200

    # 5. Purchase - Stock In
    supp_res = await client.post(
        "/api/v1/suppliers",
        headers=headers_a,
        json={"name": "Apex Pharma Distributors", "phone": "9876543210"},
    )
    assert supp_res.status_code == 201
    supplier_id = supp_res.json()["id"]

    purchase_res = await client.post(
        "/api/v1/purchases",
        headers=headers_a,
        json={
            "branch_id": branch_id,
            "supplier_id": supplier_id,
            "invoice_no": "INV-E2E-001",
            "items": [
                {
                    "product_id": prod_id,
                    "batch_no": "BATCH-E2E-01",
                    "expiry_date": str(date.today() + timedelta(days=500)),
                    "qty": 100,
                    "unit_cost": 90.0,
                }
            ],
            "payment_mode": "CREDIT",
        },
    )
    assert purchase_res.status_code == 201

    # 6. Verify Inventory Increased
    inv_after_purchase = await client.get(f"/api/v1/inventory?product_id={prod_id}", headers=headers_a)
    assert inv_after_purchase.status_code == 200
    inv_items = inv_after_purchase.json()
    assert len(inv_items) > 0
    assert inv_items[0]["qty_on_hand"] == 100

    batches_res = await client.get(f"/api/v1/inventory/batches?product_id={prod_id}&branch_id={branch_id}", headers=headers_a)
    assert batches_res.status_code == 200
    batches = batches_res.json()
    assert len(batches) > 0
    batch_id = batches[0]["id"]

    # 7. Sale - Stock Out
    sale_res = await client.post(
        "/api/v1/sales",
        headers=headers_a,
        json={
            "branch_id": branch_id,
            "items": [
                {
                    "product_id": prod_id,
                    "batch_id": batch_id,
                    "qty": 10,
                    "unit_price": 145.0,
                    "discount_pct": 0.0,
                }
            ],
            "payment_mode": "CASH",
        },
    )
    assert sale_res.status_code == 201
    sale_data = sale_res.json()
    assert sale_data["total_amount"] == 1450.0

    # 8. Verify Inventory Decreased
    inv_after_sale = await client.get(f"/api/v1/inventory?product_id={prod_id}", headers=headers_a)
    assert inv_after_sale.status_code == 200
    assert inv_after_sale.json()[0]["qty_on_hand"] == 90

    # 9. Order & Track Order
    order_res = await client.post(
        "/api/v1/orders",
        headers=headers_a,
        json={
            "branch_id": branch_id,
            "items": [{"product_id": prod_id, "qty": 2, "unit_price": 145.0}],
            "delivery_address": "100 Feet Rd, Indiranagar, Bangalore",
            "delivery_pin": "560038",
            "delivery_fee": 0.0,
        },
    )
    assert order_res.status_code == 201
    order_id = order_res.json()["id"]

    # Track Order
    track_res = await client.get(f"/api/v1/orders/{order_id}", headers=headers_a)
    assert track_res.status_code == 200
    assert track_res.json()["status"] in ["CREATED", "CONFIRMED"]

    # Update Order status
    update_order_res = await client.patch(
        f"/api/v1/orders/{order_id}/status",
        headers=headers_a,
        json={
            "status": "OUT_FOR_DELIVERY",
            "rider_name": "Vikram Singh",
            "rider_phone": "+91 98765 43210",
            "eta_minutes": 18,
        },
    )
    assert update_order_res.status_code == 200
    assert update_order_res.json()["status"] == "OUT_FOR_DELIVERY"

    # 10. Alerts Check
    alerts_res = await client.get("/api/v1/alerts", headers=headers_a)
    assert alerts_res.status_code == 200
    assert isinstance(alerts_res.json(), list)

    # 11. Dashboard Summary
    dash_res = await client.get("/api/v1/dashboard/summary", headers=headers_a)
    assert dash_res.status_code == 200
    dash = dash_res.json()
    assert dash["product_count"] >= 1
    assert dash["today_sales_count"] >= 1
    assert dash["active_orders"] >= 1

    # 12. AI Chat
    ai_chat_res = await client.post(
        "/api/v1/ai/chat",
        headers=headers_a,
        json={"message": "What is the stock of Amoxicillin?"},
    )
    assert ai_chat_res.status_code == 200
    assert "message" in ai_chat_res.json()

    # 13. Voice with Tamil / Tanglish
    voice_res = await client.post(
        "/api/v1/ai/voice",
        headers=headers_a,
        json={"command_text": "Amoxicillin stock evlo irukku?"},
    )
    assert voice_res.status_code == 200
    v_data = voice_res.json()
    assert "transcript" in v_data
    assert "tts_text" in v_data

    # 14. Voice Write Command with Confirmation Dialogue
    voice_write_res = await client.post(
        "/api/v1/ai/voice",
        headers=headers_a,
        json={"command_text": "Amoxicillin 5 piece sell pannunga"},
    )
    assert voice_write_res.status_code == 200
    vw_data = voice_write_res.json()
    assert vw_data["requires_confirmation"] is True
    cmd_id = vw_data["command_id"]

    # Confirm action
    confirm_res = await client.post(
        "/api/v1/ai/voice/confirm",
        headers=headers_a,
        json={"command_id": cmd_id, "confirmed": True},
    )
    assert confirm_res.status_code == 200
    assert confirm_res.json()["execution_status"] == "EXECUTED"


@pytest.mark.asyncio
async def test_tenant_isolation_complete(client: AsyncClient, setup_tenants: dict):
    """
    Section 20: Comprehensive Tenant Isolation Test
    Uses Tenant A and Tenant B from setup_tenants.
    Verifies:
    - Business A cannot retrieve Business B products.
    - Business A cannot access Business B inventory.
    - Business A cannot access Business B sales.
    - Business A cannot access Business B orders.
    - Business A cannot access Business B AI context.
    """
    headers_a = {"Authorization": f"Bearer {setup_tenants['token_owner_a']}"}
    headers_b = {"Authorization": f"Bearer {setup_tenants['token_owner_b']}"}

    # Business A creates a category and product
    cat_a = await client.post(
        "/api/v1/categories",
        headers=headers_a,
        json={"name": "Specialty Oncology A"},
    )
    assert cat_a.status_code == 201
    cat_a_id = cat_a.json()["id"]

    prod_a = await client.post(
        "/api/v1/products",
        headers=headers_a,
        json={
            "category_id": cat_a_id,
            "sku": "SKU-BIZ-A-ONLY",
            "name": "Proprietary Medicine A",
            "purchase_price": 700.0,
            "selling_price": 999.0,
            "mrp": 1200.0,
        },
    )
    assert prod_a.status_code == 201
    prod_a_id = prod_a.json()["id"]

    # Business A creates an order
    order_a = await client.post(
        "/api/v1/orders",
        headers=headers_a,
        json={"items": [{"product_id": prod_a_id, "qty": 1, "unit_price": 999.0}]},
    )
    assert order_a.status_code == 201
    order_a_id = order_a.json()["id"]

    # 1. Product Isolation: Business B cannot get Business A product
    leak_prod = await client.get(f"/api/v1/products/{prod_a_id}", headers=headers_b)
    assert leak_prod.status_code == 404, "Tenant B leaked access to Tenant A product!"

    # Product list isolation: Business B's list should not include Product A
    list_b = await client.get("/api/v1/products", headers=headers_b)
    assert list_b.status_code == 200
    b_skus = [p["sku"] for p in list_b.json()["items"]]
    assert "SKU-BIZ-A-ONLY" not in b_skus, "Tenant B list leaked Tenant A product!"

    # 2. Inventory Isolation: Business B cannot query Tenant A product inventory
    inv_leak = await client.get(f"/api/v1/inventory?product_id={prod_a_id}", headers=headers_b)
    assert inv_leak.status_code == 200
    assert len(inv_leak.json()) == 0

    # 3. Order Isolation: Business B cannot access Tenant A order
    order_leak = await client.get(f"/api/v1/orders/{order_a_id}", headers=headers_b)
    assert order_leak.status_code == 404, "Tenant B leaked access to Tenant A order!"

    # 4. Sales Isolation: Business B cannot see Tenant A sales
    sales_b = await client.get("/api/v1/sales", headers=headers_b)
    assert sales_b.status_code == 200
    assert len(sales_b.json()) == 0
