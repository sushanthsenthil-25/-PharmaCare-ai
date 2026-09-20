import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_import_and_export_shipments(client: AsyncClient, setup_tenants: dict):
    token = setup_tenants["token_owner_a"]

    # 1. Create Import Shipment
    imp_res = await client.post(
        "/api/v1/imports",
        json={
            "tracking_no": "DHL-IN-88991",
            "carrier": "DHL Express",
            "total_value": 45000.0,
            "notes": "Bulk raw materials from Germany",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert imp_res.status_code == 201
    imp_data = imp_res.json()
    assert imp_data["status"] == "PENDING"
    imp_id = imp_data["id"]

    # 2. Update Import Status
    imp_update = await client.patch(
        f"/api/v1/imports/{imp_id}/status",
        json={"status": "COMPLETED"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert imp_update.status_code == 200
    assert imp_update.json()["status"] == "COMPLETED"

    # 3. Create Export Shipment
    exp_res = await client.post(
        "/api/v1/exports",
        json={
            "tracking_no": "FDX-EX-11223",
            "carrier": "FedEx Healthcare",
            "total_value": 120000.0,
            "notes": "Export to Sri Lanka distribution center",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert exp_res.status_code == 201
    exp_id = exp_res.json()["id"]

    # 4. List Exports
    exp_list = await client.get(
        "/api/v1/exports",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert exp_list.status_code == 200
    assert len(exp_list.json()) >= 1
