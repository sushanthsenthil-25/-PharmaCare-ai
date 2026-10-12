import logging
import re
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from bson.decimal128 import Decimal128

from app.core.config import settings
from app.db.mongodb import get_motor_client

router = APIRouter(
    prefix="/api/v1/medicine-catalogue",
    tags=["Medicine Catalogue"],
)
logger = logging.getLogger(__name__)

def serialize_price(value: Any):
    """Convert MongoDB numeric values to JSON-safe values."""
    if value is None:
        return None

    if isinstance(value, Decimal128):
        value = value.to_decimal()

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def format_catalogue_item(item: dict) -> dict:
    composition = item.get("composition") or []

    if not isinstance(composition, list):
        composition = [str(composition)]

    return {
        "id": str(item.get("source_id", item.get("_id", ""))),
        "name": item.get("name", ""),
        "manufacturer": item.get("manufacturer_name"),
        "medicineType": item.get("medicine_type"),
        "packSize": item.get("pack_size_label"),
        "composition": composition,
        "priceINR": serialize_price(item.get("price_inr")),
        "isDiscontinued": bool(item.get("is_discontinued", False)),
        "source": item.get("source"),
        "sourceVerified": (item.get("data_quality") or {}).get(
            "source_verified", False
        ),
        "priceMissing": (item.get("data_quality") or {}).get(
            "price_missing", item.get("price_inr") is None
        ),
    }


@router.get("/search")
async def search_medicines(
    q: str = Query(..., min_length=2, max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
):
    query_text = q.strip()

    if len(query_text) < 2:
        raise HTTPException(
            status_code=422,
            detail="Enter at least 2 characters to search.",
        )

    try:
        client = get_motor_client()
        database = client[settings.MONGODB_DB_NAME]
        collection = database["medicine_catalogue"]

        # Escape regex characters so user input is treated as text.
        pattern = re.escape(query_text)

        search_filter = {
            "$or": [
                {"name": {"$regex": pattern, "$options": "i"}},
                {"name_normalized": {"$regex": pattern, "$options": "i"}},
                {"manufacturer_name": {"$regex": pattern, "$options": "i"}},
                {"composition": {"$regex": pattern, "$options": "i"}},
            ]
        }

        total = await collection.count_documents(search_filter)

        cursor = (
            collection.find(
                search_filter,
                {
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
                },
            )
            .sort("name", 1)
            .skip((page - 1) * page_size)
            .limit(page_size)
        )

        items = [
            format_catalogue_item(item)
            async for item in cursor
        ]

        return {
            "query": query_text,
            "page": page,
            "pageSize": page_size,
            "total": total,
            "results": items,
        }

    except HTTPException:
        raise
    except Exception:
        # Do not expose database credentials or internal errors.
        raise HTTPException(
            status_code=503,
            detail="Medicine catalogue is temporarily unavailable.",
        )

