import asyncio
import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from typing import AsyncGenerator
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

from app.core.config import settings
from app.core.security import hash_password, create_access_token
from app.main import app as fastapi_app
from app.models.user import Business, Branch, User
from app.models.product import Category, Product
from app.models.inventory import Supplier, Batch, Inventory, InventoryMovement
from app.models.transaction import Customer, Sale, SaleItem, Purchase, PurchaseItem
from app.models.order import Order, OrderItem
from app.models.shipment import ImportShipment, ExportShipment
from app.models.alert import Alert
from app.models.ai import AIPrediction, VoiceCommand, AIPreference, MLFeedback
from app.models.audit import AuditLog

ALL_MODELS = [
    Business, Branch, User,
    Category, Product,
    Supplier, Batch, Inventory, InventoryMovement,
    Customer, Sale, SaleItem, Purchase, PurchaseItem,
    Order, OrderItem,
    ImportShipment, ExportShipment,
    Alert,
    AIPrediction, VoiceCommand, AIPreference, MLFeedback,
    AuditLog,
]

TEST_DB_NAME = "pharmacare_test"


@pytest_asyncio.fixture(scope="function", autouse=True)
async def init_test_db():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    database = client[TEST_DB_NAME]
    await init_beanie(database=database, document_models=ALL_MODELS)
    yield
    client.close()


@pytest_asyncio.fixture(scope="function")
async def client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture(scope="function")
async def setup_tenants():
    """
    Sets up two separate businesses (Tenant A and Tenant B) with OWNER, MANAGER, and STAFF.
    Cleans collections before creating new test records.
    """
    # Clean collections
    for model in ALL_MODELS:
        await model.delete_all()

    # Tenant A
    biz_a = Business(name="Apollo Pharmacy", license_no="AP-12345", gstin="33AAAAA0000A1Z5")
    await biz_a.insert()

    branch_a = Branch(business_id=str(biz_a.id), name="Indiranagar Branch")
    await branch_a.insert()

    owner_a = User(
        business_id=str(biz_a.id),
        branch_id=str(branch_a.id),
        email="owner_a@apollo.com",
        full_name="Apollo Owner",
        hashed_password=hash_password("password123"),
        role="OWNER",
    )
    manager_a = User(
        business_id=str(biz_a.id),
        branch_id=str(branch_a.id),
        email="manager_a@apollo.com",
        full_name="Apollo Manager",
        hashed_password=hash_password("password123"),
        role="MANAGER",
    )
    staff_a = User(
        business_id=str(biz_a.id),
        branch_id=str(branch_a.id),
        email="staff_a@apollo.com",
        full_name="Apollo Staff",
        hashed_password=hash_password("password123"),
        role="STAFF",
    )
    await owner_a.insert()
    await manager_a.insert()
    await staff_a.insert()

    token_owner_a = create_access_token(str(owner_a.id), str(biz_a.id), "OWNER", owner_a.email)
    token_manager_a = create_access_token(str(manager_a.id), str(biz_a.id), "MANAGER", manager_a.email)
    token_staff_a = create_access_token(str(staff_a.id), str(biz_a.id), "STAFF", staff_a.email)

    # Tenant B (for multi-tenant isolation testing)
    biz_b = Business(name="MedPlus Pharmacy", license_no="MP-67890", gstin="33BBBBB0000B1Z6")
    await biz_b.insert()

    branch_b = Branch(business_id=str(biz_b.id), name="Koramangala Branch")
    await branch_b.insert()

    owner_b = User(
        business_id=str(biz_b.id),
        branch_id=str(branch_b.id),
        email="owner_b@medplus.com",
        full_name="MedPlus Owner",
        hashed_password=hash_password("password123"),
        role="OWNER",
    )
    await owner_b.insert()

    token_owner_b = create_access_token(str(owner_b.id), str(biz_b.id), "OWNER", owner_b.email)

    return {
        "biz_a": biz_a,
        "branch_a": branch_a,
        "owner_a": owner_a,
        "manager_a": manager_a,
        "staff_a": staff_a,
        "token_owner_a": token_owner_a,
        "token_manager_a": token_manager_a,
        "token_staff_a": token_staff_a,
        "biz_b": biz_b,
        "branch_b": branch_b,
        "owner_b": owner_b,
        "token_owner_b": token_owner_b,
    }
