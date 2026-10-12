"""
MongoDB connection and Beanie ODM initialisation.
All Beanie Document models must be listed in `init_db()`."""
import asyncio
import logging

logger = logging.getLogger(__name__)
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

# Module-level Motor client and initialization state (cached across warm serverless invocations)
_motor_client: AsyncIOMotorClient | None = None
_beanie_initialized: bool = False


def get_motor_client() -> AsyncIOMotorClient:
    global _motor_client, _beanie_initialized
    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        current_loop = None

    if _motor_client is not None:
        try:
            client_loop = getattr(_motor_client, "io_loop", None) or _motor_client.get_io_loop()
            if client_loop is None or client_loop.is_closed() or (current_loop and client_loop is not current_loop):
                try:
                    _motor_client.close()
                except Exception:
                    pass
                _motor_client = None
                _beanie_initialized = False
        except Exception:
            _motor_client = None
            _beanie_initialized = False

    if _motor_client is None:
        uri = settings.mongodb_connection_string
        _motor_client = AsyncIOMotorClient(
            uri,
            serverSelectionTimeoutMS=5000,
            maxPoolSize=10,
            minPoolSize=0,
        )
    return _motor_client


async def init_db() -> None:
    """Initialise Beanie with all document models. Idempotent for serverless reuse."""
    global _beanie_initialized
    if _beanie_initialized:
        return

    try:
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
        if client:
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
            _beanie_initialized = True
            logger.info("[MongoDB] Beanie ODM models initialized successfully.")
    except Exception:
        logger.exception("[MongoDB] Beanie initialization failed")


async def close_db() -> None:
    """Gracefully close the Motor client.  Called from app lifespan shutdown."""
    global _motor_client
    if _motor_client is not None:
        _motor_client.close()
        _motor_client = None
