
import csv
import os
from decimal import Decimal, InvalidOperation

from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient, UpdateOne
from bson.decimal128 import Decimal128

load_dotenv(Path(__file__).resolve().parent / "backend" / ".env")

MONGODB_URI = os.getenv("MONGODB_URL")
DATABASE_NAME = os.getenv("MONGODB_DATABASE", "pharmacare_ai")
CSV_PATH = Path("data/indian_medicine_data.csv")
COLLECTION_NAME = "medicine_catalogue"
SOURCE = "junioralive/Indian-Medicine-Dataset"


def parse_price(value):
    value = str(value or "").strip().replace(",", "")
    if not value:
        return None
    try:
        price = Decimal(value)
        if not price.is_finite() or price < 0:
            return None
        return Decimal128(price)
    except InvalidOperation:
        return None


def convert_row(row):
    source_id = str(row.get("id", "")).strip()
    name = str(row.get("name", "")).strip()

    if not source_id or not name:
        return None

    composition = [
        str(row.get(column, "")).strip()
        for column in ("short_composition1", "short_composition2")
        if str(row.get(column, "")).strip()
    ]

    return {
        "source": SOURCE,
        "source_id": source_id,
        "name": name,
        "name_normalized": " ".join(name.casefold().split()),
        "price_inr": parse_price(row.get("price(₹)")),
        "is_discontinued": (
            str(row.get("Is_discontinued", "")).strip().upper()
            == "TRUE"
        ),
        "manufacturer_name": (
            str(row.get("manufacturer_name", "")).strip() or None
        ),
        "medicine_type": str(row.get("type", "")).strip() or None,
        "pack_size_label": (
            str(row.get("pack_size_label", "")).strip() or None
        ),
        "composition": composition,
        "data_quality": {
            "source_verified": False,
            "price_missing": not str(row.get("price(₹)", "")).strip(),
        },
    }


def main():
    if not MONGODB_URI:
        raise RuntimeError(
            "MONGODB_URI missing. Create a .env file with your Atlas URI."
        )

    if not CSV_PATH.exists():
        raise FileNotFoundError(
            f"Dataset not found: {CSV_PATH.resolve()}"
        )

    client = MongoClient(
        MONGODB_URI,
        serverSelectionTimeoutMS=10000,
    )

    try:
        client.admin.command("ping")
        collection = client[DATABASE_NAME][COLLECTION_NAME]

        collection.create_index(
            [("source", 1), ("source_id", 1)],
            unique=True,
            name="unique_dataset_record",
        )
        collection.create_index(
            [("name", "text"), ("composition", "text")],
            name="medicine_search_text",
        )

        batch = []
        imported = 0
        skipped = 0

        with CSV_PATH.open(
            "r", encoding="utf-8-sig", newline=""
        ) as file:
            reader = csv.DictReader(file)

            required = {
                "id", "name", "price(₹)", "Is_discontinued",
                "manufacturer_name", "type", "pack_size_label",
                "short_composition1", "short_composition2",
            }
            if not reader.fieldnames or not required.issubset(
                set(reader.fieldnames)
            ):
                raise ValueError(
                    f"CSV columns do not match expected schema: "
                    f"{reader.fieldnames}"
                )

            for row in reader:
                document = convert_row(row)
                if document is None:
                    skipped += 1
                    continue

                batch.append(
                    UpdateOne(
                        {"source": SOURCE, "source_id": document["source_id"]},
                        {"$set": document},
                        upsert=True,
                    )
                )

                if len(batch) >= 1000:
                    collection.bulk_write(batch, ordered=False)
                    imported += len(batch)
                    batch.clear()
                    print(f"Processed {imported:,} records")

            if batch:
                collection.bulk_write(batch, ordered=False)
                imported += len(batch)

        print("\nImport completed.")
        print(f"Processed: {imported:,}")
        print(f"Skipped: {skipped:,}")
        print(f"Total in collection: {collection.count_documents({}):,}")
        print(f"Database: {DATABASE_NAME}")
        print(f"Collection: {COLLECTION_NAME}")

    finally:
        client.close()


if __name__ == "__main__":
    main()
