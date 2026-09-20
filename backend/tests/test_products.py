import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_product_crud_and_categories(client: AsyncClient, setup_tenants: dict):
    token = setup_tenants["token_owner_a"]

    # 1. Create Category
    cat_res = await client.post(
        "/api/v1/categories",
        json={"name": "Antibiotics"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert cat_res.status_code == 201
    cat_id = cat_res.json()["id"]

    # 2. List Categories
    cats_res = await client.get(
        "/api/v1/categories",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert cats_res.status_code == 200
    assert any(c["name"] == "Antibiotics" for c in cats_res.json())

    # 3. Create Product in that Category
    prod_res = await client.post(
        "/api/v1/products",
        json={
            "sku": "CIPRO-500",
            "name": "Ciprofloxacin 500mg",
            "category_id": cat_id,
            "manufacturer": "Cipla Ltd",
            "purchase_price": 40.0,
            "selling_price": 75.0,
            "mrp": 85.0,
            "reorder_level": 15,
            "rx_required": True,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert prod_res.status_code == 201
    prod_data = prod_res.json()
    assert prod_data["sku"] == "CIPRO-500"
    assert prod_data["rx_required"] is True
    prod_id = prod_data["id"]

    # 4. Enforce Duplicate SKU constraint
    dup_res = await client.post(
        "/api/v1/products",
        json={
            "sku": "CIPRO-500",
            "name": "Duplicate Cipro",
            "purchase_price": 40.0,
            "selling_price": 75.0,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert dup_res.status_code == 409

    # 5. Get Product by ID
    get_res = await client.get(
        f"/api/v1/products/{prod_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Ciprofloxacin 500mg"

    # 6. Update Product
    patch_res = await client.patch(
        f"/api/v1/products/{prod_id}",
        json={"selling_price": 80.0, "reorder_level": 25},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["selling_price"] == 80.0
    assert patch_res.json()["reorder_level"] == 25

    # 7. Soft Delete Product
    del_res = await client.delete(
        f"/api/v1/products/{prod_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert del_res.status_code == 204

    # Verify status is DISCONTINUED
    check_res = await client.get(
        f"/api/v1/products/{prod_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert check_res.json()["status"] == "DISCONTINUED"
