import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_rbac_permissions(client: AsyncClient, setup_tenants: dict):
    owner_token = setup_tenants["token_owner_a"]
    manager_token = setup_tenants["token_manager_a"]
    staff_token = setup_tenants["token_staff_a"]

    # 1. OWNER can access audit logs
    owner_audit = await client.get(
        "/api/v1/audit/logs",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert owner_audit.status_code == 200

    # 2. MANAGER is forbidden from viewing audit logs (HTTP 403)
    mgr_audit = await client.get(
        "/api/v1/audit/logs",
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert mgr_audit.status_code == 403

    # 3. STAFF is forbidden from viewing audit logs (HTTP 403)
    staff_audit = await client.get(
        "/api/v1/audit/logs",
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert staff_audit.status_code == 403

    # 4. OWNER & MANAGER can create products
    prod_payload = {
        "sku": "PARA-650-RBAC",
        "name": "Paracetamol 650mg",
        "purchase_price": 10.0,
        "selling_price": 25.0,
        "reorder_level": 50,
    }
    mgr_create = await client.post(
        "/api/v1/products",
        json=prod_payload,
        headers={"Authorization": f"Bearer {manager_token}"},
    )
    assert mgr_create.status_code == 201

    # 5. STAFF is forbidden from creating products (HTTP 403)
    staff_create = await client.post(
        "/api/v1/products",
        json={**prod_payload, "sku": "PARA-STAFF"},
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert staff_create.status_code == 403

    # 6. STAFF CAN view products (HTTP 200)
    staff_view = await client.get(
        "/api/v1/products",
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert staff_view.status_code == 200
