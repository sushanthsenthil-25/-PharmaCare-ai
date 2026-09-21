import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_public_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["service"] == "backend"
        assert "message" in data

@pytest.mark.asyncio
async def test_public_medicines_and_dolo_search():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Fetch all medicines
        res = await client.get("/api/medicines")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert len(data["medicines"]) >= 20

        # 2. Search for Dolo
        res_dolo = await client.get("/api/medicines/search?q=dolo")
        assert res_dolo.status_code == 200
        dolo_data = res_dolo.json()
        assert dolo_data["success"] is True
        assert len(dolo_data["medicines"]) > 0
        # The result must contain Paracetamol 650 (Dolo alias)
        assert any("Paracetamol 650" in m["name"] or "Dolo" in m.get("brand", "") or "Dolo" in str(m.get("aliases", [])) for m in dolo_data["medicines"])

@pytest.mark.asyncio
async def test_public_jarvis_ai_chat():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. General knowledge / math
        res_math = await client.post("/api/ai/chat", json={"message": "What is 25 + 25?"})
        assert res_math.status_code == 200
        math_data = res_math.json()
        assert math_data["success"] is True
        assert "50" in math_data["message"]

        # 2. Joke
        res_joke = await client.post("/api/ai/chat", json={"message": "Tell me a joke"})
        assert res_joke.status_code == 200
        assert res_joke.json()["success"] is True

        # 3. Medicine query for Dolo
        res_dolo = await client.post("/api/ai/chat", json={"message": "Tell me about Dolo"})
        assert res_dolo.status_code == 200
        dolo_ai = res_dolo.json()
        assert dolo_ai["success"] is True
        assert len(dolo_ai.get("products", [])) > 0
        assert "Paracetamol 650" in dolo_ai["products"][0]["name"]

@pytest.mark.asyncio
async def test_public_cart_and_order_pipeline():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Login to get token
        login_res = await client.post("/api/auth/login", json={"email": "tester@pharmacare.ai", "password": "Password123!"})
        assert login_res.status_code == 200
        token = login_res.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Add product to cart
        add_res = await client.post("/api/cart", json={"productId": "med-paracetamol-650", "qty": 2}, headers=headers)
        assert add_res.status_code == 200
        cart_data = add_res.json()
        assert cart_data["success"] is True

        # 3. Calculate cart
        calc_res = await client.post("/api/cart/calculate", json={"items": [{"productId": "med-paracetamol-650", "name": "Paracetamol 650", "price": 30, "quantity": 2}]})
        assert calc_res.status_code == 200
        calc_data = calc_res.json()
        assert calc_data["subtotal"] == 60.0

        # 4. Create Order
        order_res = await client.post("/api/orders", json={"items": [{"productId": "med-paracetamol-650", "name": "Paracetamol 650", "price": 30, "quantity": 2}]}, headers=headers)
        assert order_res.status_code == 200
        order_data = order_res.json()
        order_id = order_data["orderId"]
        assert order_id.startswith("ORD-")

        # 5. Live Tracking
        tracking_res = await client.get(f"/api/orders/{order_id}/tracking", headers=headers)
        assert tracking_res.status_code == 200
        tracking_data = tracking_res.json()
        assert tracking_data["success"] is True
        assert tracking_data["status"] == "PLACED"
        assert len(tracking_data["trackingEvents"]) >= 5
