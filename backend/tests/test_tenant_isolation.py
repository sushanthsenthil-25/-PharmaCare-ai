import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_multi_tenant_isolation(client: AsyncClient, setup_tenants: dict):
    token_a = setup_tenants["token_owner_a"]
    token_b = setup_tenants["token_owner_b"]

    # 1. Tenant A creates Product A
    create_res = await client.post(
        "/api/v1/products",
        json={
            "sku": "AMOX-500-TENANT-A",
            "name": "Tenant A Amoxicillin 500mg",
            "purchase_price": 50.0,
            "selling_price": 95.0,
            "reorder_level": 20,
        },
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert create_res.status_code == 201
    prod_a = create_res.json()
    prod_a_id = prod_a["id"]

    # 2. Tenant B lists products -> MUST NOT contain Tenant A's product
    list_b = await client.get(
        "/api/v1/products",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert list_b.status_code == 200
    items_b = list_b.json()["items"]
    assert all(item["id"] != prod_a_id for item in items_b)

    # 3. Tenant B directly accessing Tenant A's product by ID -> 404 NOT FOUND (IDOR prevention)
    get_b = await client.get(
        f"/api/v1/products/{prod_a_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert get_b.status_code == 404

    # 4. Tenant B trying to update Tenant A's product -> 404 NOT FOUND
    patch_b = await client.patch(
        f"/api/v1/products/{prod_a_id}",
        json={"name": "Hacked Name"},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert patch_b.status_code == 404

    # 5. Tenant B trying to delete Tenant A's product -> 404 NOT FOUND
    del_b = await client.delete(
        f"/api/v1/products/{prod_a_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert del_b.status_code == 404
