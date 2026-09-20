import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_dashboard_summary(client: AsyncClient, setup_tenants: dict):
    token = setup_tenants["token_owner_a"]

    res = await client.get(
        "/api/v1/dashboard/summary",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "product_count" in data
    assert "inventory_value" in data
    assert "low_stock_count" in data
    assert "out_of_stock_count" in data
    assert "today_sales_count" in data
    assert "today_sales_total" in data
    assert "active_orders" in data
    assert "unread_alerts" in data
