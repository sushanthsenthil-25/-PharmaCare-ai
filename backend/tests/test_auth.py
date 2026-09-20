import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_auth_register_and_login(client: AsyncClient):
    # 1. Register new user + business
    reg_payload = {
        "email": "dr_sharma@wellnessrx.com",
        "password": "SecurePassword123!",
        "full_name": "Dr. Sharma",
        "phone": "+919876543210",
        "business_name": "Wellness Rx Pharmacy",
        "business_gstin": "33ABCDE1234F1Z5",
        "business_address": "123 Main Road, Bangalore",
        "branch_name": "Flagship Branch",
    }
    res = await client.post("/api/v1/auth/register", json=reg_payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    access_token = data["access_token"]
    refresh_token = data["refresh_token"]

    # 2. Duplicate registration rejection
    dup_res = await client.post("/api/v1/auth/register", json=reg_payload)
    assert dup_res.status_code == 409

    # 3. Login with correct password
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "dr_sharma@wellnessrx.com", "password": "SecurePassword123!"},
    )
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert "access_token" in login_data

    # 4. Login with wrong password failure
    wrong_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "dr_sharma@wellnessrx.com", "password": "WrongPassword!"},
    )
    assert wrong_login.status_code == 401

    # 5. Access /me
    me_res = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["email"] == "dr_sharma@wellnessrx.com"
    assert me_data["role"] == "OWNER"

    # 6. Refresh token
    ref_res = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert ref_res.status_code == 200
    new_tokens = ref_res.json()
    assert "access_token" in new_tokens

    # 7. Logout
    logout_res = await client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert logout_res.status_code == 204
