# All Beanie Document models — imported for use across the app.
# init_db() in app/db/mongodb.py registers all of these with Beanie.

from app.models.user import User, Business, Branch  # noqa: F401
from app.models.product import Category, Product  # noqa: F401
from app.models.inventory import Supplier, Batch, Inventory, InventoryMovement  # noqa: F401
from app.models.transaction import Customer, Sale, SaleItem, Purchase, PurchaseItem  # noqa: F401
from app.models.order import Order, OrderItem  # noqa: F401
from app.models.shipment import ImportShipment, ExportShipment  # noqa: F401
from app.models.alert import Alert  # noqa: F401
from app.models.ai import AIPrediction, VoiceCommand, AIPreference, MLFeedback  # noqa: F401
from app.models.audit import AuditLog  # noqa: F401
