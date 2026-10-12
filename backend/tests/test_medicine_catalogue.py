import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_search_existing_medicine(client: AsyncClient):
    """Test searching for an existing medicine record (paracetamol)."""
    res = await client.get("/api/v1/medicine-catalogue/search?q=paracetamol&page=1&page_size=20")
    assert res.status_code == 200
    data = res.json()
    assert data["query"] == "paracetamol"
    assert data["page"] == 1
    assert data["pageSize"] == 20
    assert data["total"] > 0
    assert isinstance(data["results"], list)
    assert len(data["results"]) <= 20

    # Validate structure of first item
    first = data["results"][0]
    assert "id" in first
    assert "name" in first
    assert "manufacturer" in first
    assert "composition" in first
    assert isinstance(first["composition"], list)
    assert "priceINR" in first
    assert "isDiscontinued" in first
    assert "source" in first
    assert "sourceVerified" in first
    assert "priceMissing" in first


@pytest.mark.asyncio
async def test_search_nonexistent_medicine(client: AsyncClient):
    """Test searching for a medicine name that does not exist."""
    res = await client.get("/api/v1/medicine-catalogue/search?q=xyznonexistentmed778899&page=1&page_size=20")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 0
    assert data["results"] == []


@pytest.mark.asyncio
async def test_search_missing_and_short_query(client: AsyncClient):
    """Test validation errors for missing or too-short search terms."""
    # Missing q parameter
    res_missing = await client.get("/api/v1/medicine-catalogue/search")
    assert res_missing.status_code == 422

    # Query with 1 character (< 2 character min_length)
    res_short = await client.get("/api/v1/medicine-catalogue/search?q=a")
    assert res_short.status_code == 422

    # Query with whitespace only
    res_blank = await client.get("/api/v1/medicine-catalogue/search?q=%20%20")
    assert res_blank.status_code == 422


@pytest.mark.asyncio
async def test_search_case_insensitivity(client: AsyncClient):
    """Verify that search is case-insensitive."""
    res_lower = await client.get("/api/v1/medicine-catalogue/search?q=augmentin")
    res_upper = await client.get("/api/v1/medicine-catalogue/search?q=AUGMENTIN")
    assert res_lower.status_code == 200
    assert res_upper.status_code == 200
    assert res_lower.json()["total"] == res_upper.json()["total"]


@pytest.mark.asyncio
async def test_search_special_characters_escaping(client: AsyncClient):
    """Verify regex special characters are escaped and do not cause server errors."""
    special_queries = ["d[o]lo", "dolo (650)", "calpol+500", "para.*cetamol"]
    for sq in special_queries:
        res = await client.get(f"/api/v1/medicine-catalogue/search?q={sq}")
        assert res.status_code == 200
        assert isinstance(res.json()["results"], list)


@pytest.mark.asyncio
async def test_search_pagination_boundaries(client: AsyncClient):
    """Test pagination offset, page size, and distinct pages."""
    res_p1 = await client.get("/api/v1/medicine-catalogue/search?q=paracetamol&page=1&page_size=5")
    res_p2 = await client.get("/api/v1/medicine-catalogue/search?q=paracetamol&page=2&page_size=5")
    assert res_p1.status_code == 200
    assert res_p2.status_code == 200

    p1_items = res_p1.json()["results"]
    p2_items = res_p2.json()["results"]
    assert len(p1_items) == 5
    assert len(p2_items) == 5

    p1_ids = {item["id"] for item in p1_items}
    p2_ids = {item["id"] for item in p2_items}
    # Pages must not overlap
    assert len(p1_ids.intersection(p2_ids)) == 0

    # Invalid page numbers
    res_inv_page = await client.get("/api/v1/medicine-catalogue/search?q=paracetamol&page=0")
    assert res_inv_page.status_code == 422

    res_inv_pagesize = await client.get("/api/v1/medicine-catalogue/search?q=paracetamol&page=1&page_size=51")
    assert res_inv_pagesize.status_code == 422


@pytest.mark.asyncio
async def test_search_field_types_serialization(client: AsyncClient):
    """Test JSON serialization: prices must be float/None, composition a list, etc."""
    res = await client.get("/api/v1/medicine-catalogue/search?q=amoxycillin&page=1&page_size=5")
    assert res.status_code == 200
    for item in res.json()["results"]:
        assert isinstance(item["id"], str)
        assert isinstance(item["name"], str)
        assert isinstance(item["composition"], list)
        if item["priceINR"] is not None:
            assert isinstance(item["priceINR"], (int, float))
        assert isinstance(item["isDiscontinued"], bool)
        assert isinstance(item["sourceVerified"], bool)
        assert isinstance(item["priceMissing"], bool)


@pytest.mark.asyncio
async def test_list_catalogue_pagination(client: AsyncClient):
    """Test browsing the 11,621 catalogue with server-side pagination."""
    res = await client.get("/api/v1/medicine-catalogue?page=1&page_size=10")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 11621
    assert data["page"] == 1
    assert data["pageSize"] == 10
    assert len(data["results"]) == 10
    assert data["totalPages"] == 1163


@pytest.mark.asyncio
async def test_list_catalogue_dosage_filter(client: AsyncClient):
    """Test filtering by dosage form (e.g. Tablet, Syrup/Liquid)."""
    res = await client.get("/api/v1/medicine-catalogue?dosage_form=Tablet&page=1&page_size=5")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] > 0
    assert len(data["results"]) == 5
    for item in data["results"]:
        assert item["dosageForm"] == "Tablet"


@pytest.mark.asyncio
async def test_get_catalogue_categories_facets(client: AsyncClient):
    """Test catalogue facet statistics and top manufacturers."""
    res = await client.get("/api/v1/medicine-catalogue/categories")
    assert res.status_code == 200
    data = res.json()
    assert data["totalMedicines"] == 11621
    assert "dosageForms" in data
    assert len(data["dosageForms"]) > 0
    assert "topManufacturers" in data
    assert len(data["topManufacturers"]) > 0


@pytest.mark.asyncio
async def test_get_single_catalogue_item(client: AsyncClient):
    """Test fetching a single medicine monograph from the 11,621 dataset."""
    res = await client.get("/api/v1/medicine-catalogue/1")
    assert res.status_code == 200
    item = res.json()
    assert item["id"] == "1"
    assert "Augmentin" in item["name"]
    assert "Amoxycillin" in item["composition"][0]
    assert item["priceINR"] is not None

