import pytest
from datetime import date, timedelta
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_ai_chat_and_multilingual_voice(client: AsyncClient, setup_tenants: dict):
    token = setup_tenants["token_owner_a"]
    branch_id = str(setup_tenants["branch_a"].id)

    # 1. Create a product and stock in business
    prod_res = await client.post(
        "/api/v1/products",
        json={"sku": "PARA-650-AI", "name": "Paracetamol 650mg", "purchase_price": 10.0, "selling_price": 20.0},
        headers={"Authorization": f"Bearer {token}"},
    )
    prod_id = prod_res.json()["id"]

    await client.post(
        "/api/v1/inventory/batches",
        json={
            "product_id": prod_id,
            "branch_id": branch_id,
            "batch_no": "PARA-B001",
            "expiry_date": str(date.today() + timedelta(days=200)),
            "purchase_price": 10.0,
            "qty_received": 100,
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    # 2. AI Chat: READ Action ("How many Paracetamol are available?")
    chat_read = await client.post(
        "/api/v1/ai/chat",
        json={"message": "How many Paracetamol are available?"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert chat_read.status_code == 200
    chat_data = chat_read.json()
    assert chat_data["action_type"] == "READ"
    assert "Paracetamol" in chat_data["message"]
    assert "100" in chat_data["message"]

    # 3. AI Chat: WRITE Action requires explicit confirmation ("Sell 10 Paracetamol")
    chat_write = await client.post(
        "/api/v1/ai/chat",
        json={"message": "Sell 10 Paracetamol"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert chat_write.status_code == 200
    write_data = chat_write.json()
    assert write_data["action_type"] == "WRITE"
    assert write_data["requires_confirmation"] is True
    assert "confirm" in write_data["confirmation_prompt"].lower()

    # 4. Voice: Tanglish READ intent ("Paracetamol stock evlo irukku?")
    tanglish_res = await client.post(
        "/api/v1/ai/voice",
        json={"command_text": "Paracetamol stock evlo irukku?"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert tanglish_res.status_code == 200
    t_data = tanglish_res.json()
    assert t_data["detected_language"] in ["tanglish", "ta"]
    assert t_data["intent"] == "CHECK_STOCK"
    assert t_data["action_type"] == "READ"
    assert "100" in t_data["tts_text"] or "piece" in t_data["tts_text"]

    # 5. Voice: Tanglish WRITE intent ("Paracetamol 10 piece sell pannunga") -> Requires Confirmation
    voice_write = await client.post(
        "/api/v1/ai/voice",
        json={"command_text": "Paracetamol 10 piece sell pannunga"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert voice_write.status_code == 200
    vw_data = voice_write.json()
    assert vw_data["intent"] == "CREATE_SALE"
    assert vw_data["action_type"] == "WRITE"
    assert vw_data["requires_confirmation"] is True
    command_id = vw_data["command_id"]

    # 6. Confirm and execute Voice Write Action
    confirm_res = await client.post(
        "/api/v1/ai/voice/confirm",
        json={"command_id": command_id, "confirmed": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert confirm_res.status_code == 200
    c_data = confirm_res.json()
    assert c_data["execution_status"] == "EXECUTED"
    assert "sale_id" in c_data["result"]
    assert "invoice_no" in c_data["result"]

    # 7. Verify stock deduction in database (was 100, now 90)
    inv_check = await client.get(
        f"/api/v1/inventory?product_id={prod_id}&branch_id={branch_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert inv_check.json()[0]["qty_on_hand"] == 90
