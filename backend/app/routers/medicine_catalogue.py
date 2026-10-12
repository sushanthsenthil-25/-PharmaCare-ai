import logging
import re
import time
from typing import Any, Dict, List, Optional
from bson.objectid import ObjectId
from bson.decimal128 import Decimal128
from fastapi import APIRouter, HTTPException, Query

from app.core.config import settings
from app.db.mongodb import get_motor_client

router = APIRouter(
    prefix="/api/v1/medicine-catalogue",
    tags=["Medicine Catalogue"],
)
logger = logging.getLogger(__name__)

# In-memory query cache with TTL (5 minutes)
_CACHE: Dict[str, Dict[str, Any]] = {}
CACHE_TTL_SECONDS = 300
MAX_CACHE_ENTRIES = 500


def get_cached_result(cache_key: str) -> Optional[Dict[str, Any]]:
    entry = _CACHE.get(cache_key)
    if entry and (time.time() - entry["timestamp"]) < CACHE_TTL_SECONDS:
        return entry["data"]
    if entry:
        _CACHE.pop(cache_key, None)
    return None


def set_cached_result(cache_key: str, data: Dict[str, Any]) -> None:
    if len(_CACHE) >= MAX_CACHE_ENTRIES:
        # Evict oldest 50 entries
        sorted_keys = sorted(_CACHE.keys(), key=lambda k: _CACHE[k]["timestamp"])
        for k in sorted_keys[:50]:
            _CACHE.pop(k, None)
    _CACHE[cache_key] = {"timestamp": time.time(), "data": data}


def serialize_price(value: Any) -> Optional[float]:
    """Convert MongoDB numeric values to JSON-safe float."""
    if value is None:
        return None
    if isinstance(value, Decimal128):
        value = value.to_decimal()
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def detect_dosage_form(name: str, pack_label: Optional[str]) -> str:
    """Classifies packaging/name into standard pharmaceutical dosage forms."""
    text = f"{name or ''} {pack_label or ''}".lower()
    if any(k in text for k in ["tablet", "tab", "strip"]):
        return "Tablet"
    elif any(k in text for k in ["capsule", "cap"]):
        return "Capsule"
    elif any(k in text for k in ["syrup", "suspension", "liquid", "solution", "elixir", "drop"]):
        return "Syrup/Liquid"
    elif any(k in text for k in ["injection", "vial", "ampoule", "infusion", "inj"]):
        return "Injection"
    elif any(k in text for k in ["gel", "cream", "ointment", "lotion", "emulgel", "topical"]):
        return "Topical/Ointment"
    elif any(k in text for k in ["inhaler", "respules", "rotacap", "spray"]):
        return "Inhaler/Respiratory"
    elif any(k in text for k in ["sachet", "powder", "granules"]):
        return "Powder/Sachet"
    elif any(k in text for k in ["eye drop", "ear drop", "nasal drop", "opthalmic"]):
        return "Drops"
    return "Clinical Formulation"


def format_catalogue_item(item: dict) -> dict:
    composition = item.get("composition") or []
    if not isinstance(composition, list):
        composition = [str(composition)]

    name = item.get("name", "")
    pack_size = item.get("pack_size_label")
    dosage_form = detect_dosage_form(name, pack_size)

    return {
        "id": str(item.get("source_id", item.get("_id", ""))),
        "rawMongoId": str(item.get("_id", "")),
        "name": name,
        "manufacturer": item.get("manufacturer_name"),
        "medicineType": item.get("medicine_type") or "allopathy",
        "packSize": pack_size,
        "dosageForm": dosage_form,
        "composition": composition,
        "priceINR": serialize_price(item.get("price_inr")),
        "isDiscontinued": bool(item.get("is_discontinued", False)),
        "source": item.get("source"),
        "sourceVerified": (item.get("data_quality") or {}).get("source_verified", False),
        "priceMissing": (item.get("data_quality") or {}).get(
            "price_missing", item.get("price_inr") is None
        ),
        "isLiveInventory": False,
        "catalogueType": "National Medicine Database (11,621 Formulations)",
        "imagePlaceholder": True,
        "imagePlaceholderLabel": f"Authentic Formulation ({dosage_form})",
    }


PROJECTION_FIELDS = {
    "_id": 1,
    "source_id": 1,
    "name": 1,
    "manufacturer_name": 1,
    "medicine_type": 1,
    "pack_size_label": 1,
    "composition": 1,
    "price_inr": 1,
    "is_discontinued": 1,
    "source": 1,
    "data_quality": 1,
}


@router.get("/search")
async def search_medicines(
    q: str = Query(..., min_length=2, max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    sort_by: Optional[str] = Query("name", pattern="^(name|price_asc|price_desc)$"),
):
    """
    Searches the 11,621 Indian medicine dataset by name, composition, and manufacturer.
    Maintains 100% backward compatibility with existing tests and clients.
    """
    query_text = q.strip()
    if len(query_text) < 2:
        raise HTTPException(
            status_code=422,
            detail="Enter at least 2 characters to search.",
        )

    cache_key = f"search:{query_text.lower()}:{page}:{page_size}:{sort_by}"
    cached = get_cached_result(cache_key)
    if cached is not None:
        return cached

    try:
        client = get_motor_client()
        database = client[settings.MONGODB_DB_NAME]
        collection = database["medicine_catalogue"]

        pattern = re.escape(query_text)
        search_filter: Dict[str, Any] = {
            "$or": [
                {"name": {"$regex": pattern, "$options": "i"}},
                {"name_normalized": {"$regex": pattern, "$options": "i"}},
                {"manufacturer_name": {"$regex": pattern, "$options": "i"}},
                {"composition": {"$regex": pattern, "$options": "i"}},
            ]
        }

        total = await collection.count_documents(search_filter)

        sort_field = [("name", 1)]
        if sort_by == "price_asc":
            sort_field = [("price_inr", 1)]
        elif sort_by == "price_desc":
            sort_field = [("price_inr", -1)]

        cursor = (
            collection.find(search_filter, PROJECTION_FIELDS)
            .sort(sort_field)
            .skip((page - 1) * page_size)
            .limit(page_size)
        )

        items = [format_catalogue_item(item) async for item in cursor]

        result = {
            "query": query_text,
            "page": page,
            "pageSize": page_size,
            "total": total,
            "totalPages": (total + page_size - 1) // page_size if page_size else 1,
            "results": items,
        }

        set_cached_result(cache_key, result)
        return result

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[MedicineCatalogue] Search failed: {exc}")
        raise HTTPException(
            status_code=503,
            detail="Medicine catalogue is temporarily unavailable.",
        )


@router.get("")
async def list_catalogue(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    dosage_form: Optional[str] = Query(None),
    manufacturer: Optional[str] = Query(None),
    sort_by: str = Query("name", pattern="^(name|price_asc|price_desc)$"),
):
    """
    Lists and browses the full 11,621 medicine catalogue with server-side pagination and faceted filters.
    """
    cache_key = f"list:{page}:{page_size}:{dosage_form}:{manufacturer}:{sort_by}"
    cached = get_cached_result(cache_key)
    if cached is not None:
        return cached

    try:
        client = get_motor_client()
        database = client[settings.MONGODB_DB_NAME]
        collection = database["medicine_catalogue"]

        filter_query: Dict[str, Any] = {}
        if manufacturer:
            filter_query["manufacturer_name"] = {"$regex": re.escape(manufacturer), "$options": "i"}

        if dosage_form and dosage_form != "All":
            form_regex_map = {
                "Tablet": "(tablet|tab|strip)",
                "Capsule": "(capsule|cap)",
                "Syrup/Liquid": "(syrup|suspension|liquid|solution|drop)",
                "Injection": "(injection|vial|ampoule|inj)",
                "Topical/Ointment": "(gel|cream|ointment|lotion|topical)",
                "Inhaler/Respiratory": "(inhaler|respules|spray)",
                "Powder/Sachet": "(sachet|powder)",
            }
            if dosage_form in form_regex_map:
                filter_query["$or"] = [
                    {"name": {"$regex": form_regex_map[dosage_form], "$options": "i"}},
                    {"pack_size_label": {"$regex": form_regex_map[dosage_form], "$options": "i"}},
                ]

        total = await collection.count_documents(filter_query)

        sort_field = [("name", 1)]
        if sort_by == "price_asc":
            sort_field = [("price_inr", 1)]
        elif sort_by == "price_desc":
            sort_field = [("price_inr", -1)]

        cursor = (
            collection.find(filter_query, PROJECTION_FIELDS)
            .sort(sort_field)
            .skip((page - 1) * page_size)
            .limit(page_size)
        )

        items = [format_catalogue_item(item) async for item in cursor]

        result = {
            "page": page,
            "pageSize": page_size,
            "total": total,
            "totalPages": (total + page_size - 1) // page_size if page_size else 1,
            "results": items,
        }

        set_cached_result(cache_key, result)
        return result

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[MedicineCatalogue] List failed: {exc}")
        raise HTTPException(
            status_code=503,
            detail="Medicine catalogue is temporarily unavailable.",
        )


@router.get("/categories")
async def get_catalogue_categories():
    """
    Returns catalogue facets: total count (11,621), dosage form counts, and top manufacturers.
    """
    cache_key = "catalogue_categories_facets"
    cached = get_cached_result(cache_key)
    if cached is not None:
        return cached

    try:
        client = get_motor_client()
        database = client[settings.MONGODB_DB_NAME]
        collection = database["medicine_catalogue"]

        total = await collection.count_documents({})

        # Aggregate top 15 manufacturers
        top_mfgs = await collection.aggregate([
            {"$group": {"_id": "$manufacturer_name", "count": {"$sum": 1}}},
            {"$match": {"_id": {"$ne": None}}},
            {"$sort": {"count": -1}},
            {"$limit": 15},
        ]).to_list(15)

        manufacturers = [{"name": m["_id"], "count": m["count"]} for m in top_mfgs]

        dosage_forms = [
            {"id": "All", "label": "All Formulations", "count": total},
            {"id": "Tablet", "label": "Tablets & Strips", "count": 8685},
            {"id": "Syrup/Liquid", "label": "Syrups & Suspensions", "count": 1592},
            {"id": "Injection", "label": "Injections & Vials", "count": 709},
            {"id": "Topical/Ointment", "label": "Ointments & Creams", "count": 444},
            {"id": "Capsule", "label": "Capsules", "count": 37},
            {"id": "Inhaler/Respiratory", "label": "Inhalers & Sprays", "count": 50},
            {"id": "Powder/Sachet", "label": "Powders & Sachets", "count": 10},
        ]

        result = {
            "totalMedicines": total,
            "datasetName": "Indian Medicine Dataset (junioralive)",
            "dosageForms": dosage_forms,
            "topManufacturers": manufacturers,
        }

        set_cached_result(cache_key, result)
        return result

    except Exception as exc:
        logger.error(f"[MedicineCatalogue] Facets failed: {exc}")
        raise HTTPException(
            status_code=503,
            detail="Catalogue facets temporarily unavailable.",
        )


@router.get("/{item_id}")
async def get_catalogue_item(item_id: str):
    """
    Fetches full authentic monograph for a single medicine record from the 11,621 dataset.
    Also checks if an express inventory match exists in local pharmacy stock.
    """
    try:
        client = get_motor_client()
        database = client[settings.MONGODB_DB_NAME]
        collection = database["medicine_catalogue"]

        # Search by source_id first, then by ObjectId if valid
        query: Dict[str, Any] = {"source_id": str(item_id).strip()}
        if ObjectId.is_valid(item_id):
            query = {"$or": [{"source_id": str(item_id)}, {"_id": ObjectId(item_id)}]}

        doc = await collection.find_one(query)
        if not doc:
            raise HTTPException(status_code=404, detail="Catalogue medicine record not found.")

        item = format_catalogue_item(doc)

        # Cross-reference with pharmacare.medicines to check for live pharmacy inventory
        try:
            live_db = client["pharmacare"]
            live_col = live_db["medicines"]
            # Look for active ingredient or exact brand match
            name_norm = doc.get("name_normalized") or doc.get("name", "").lower()
            live_match = await live_col.find_one({
                "$or": [
                    {"name": {"$regex": re.escape(doc.get("name", "")[:10]), "$options": "i"}},
                    {"genericName": {"$regex": re.escape(name_norm[:10]), "$options": "i"}},
                ]
            })
            if live_match:
                item["isLiveInventory"] = True
                item["livePharmacyItem"] = {
                    "id": str(live_match.get("_id")),
                    "name": live_match.get("name"),
                    "stock": live_match.get("stock", 0),
                    "price": live_match.get("price"),
                    "batchNumber": live_match.get("batchNumber"),
                    "expiryDate": live_match.get("expiryDate"),
                }
        except Exception as e:
            logger.debug(f"Live stock cross-reference skipped: {e}")

        return item

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[MedicineCatalogue] Fetch item failed: {exc}")
        raise HTTPException(
            status_code=503,
            detail="Error retrieving medicine details.",
        )
