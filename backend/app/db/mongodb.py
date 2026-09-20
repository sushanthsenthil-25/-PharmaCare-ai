"""
MongoDB connection and Beanie ODM initialisation.
All Beanie Document models must be listed in `init_db()`.
"""
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie, PydanticObjectId
from bson.errors import InvalidId

from app.core.config import settings


def to_oid(val):
    if val is None:
        return None
    if isinstance(val, PydanticObjectId):
        return val
    try:
        return PydanticObjectId(str(val))
    except (InvalidId, ValueError, TypeError):
        return val

# Module-level Motor client (created once at startup)
_motor_client: AsyncIOMotorClient | None = None


def get_motor_client() -> AsyncIOMotorClient:
    global _motor_client
    if _motor_client is None:
        _motor_client = AsyncIOMotorClient(settings.MONGODB_URL)
    return _motor_client


async def init_db() -> None:
    """Initialise Beanie with all document models.  Called from app lifespan."""
    from app.models.user import Business, Branch, User
    from app.models.product import Category, Product
    from app.models.inventory import Supplier, Batch, Inventory, InventoryMovement
    from app.models.transaction import Customer, Sale, SaleItem, Purchase, PurchaseItem
    from app.models.order import Order, OrderItem
    from app.models.shipment import ImportShipment, ExportShipment
    from app.models.alert import Alert
    from app.models.ai import AIPrediction, VoiceCommand, AIPreference, MLFeedback
    from app.models.audit import AuditLog

    client = get_motor_client()
    database = client[settings.MONGODB_DB_NAME]

    await init_beanie(
        database=database,
        document_models=[
            Business, Branch, User,
            Category, Product,
            Supplier, Batch, Inventory, InventoryMovement,
            Customer, Sale, SaleItem, Purchase, PurchaseItem,
            Order, OrderItem,
            ImportShipment, ExportShipment,
            Alert,
            AIPrediction, VoiceCommand, AIPreference, MLFeedback,
            AuditLog,
        ],
    )


async def close_db() -> None:
    """Gracefully close the Motor client.  Called from app lifespan shutdown."""
    global _motor_client
    if _motor_client is not None:
        _motor_client.close()
        _motor_client = None
