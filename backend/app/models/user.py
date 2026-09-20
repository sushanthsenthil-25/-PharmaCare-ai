from datetime import datetime, timezone
from typing import Optional

from beanie import Document, Indexed
from pydantic import EmailStr, Field

from app.core.permissions import UserRole


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Business(Document):
    name: str
    license_no: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "businesses"


class Branch(Document):
    business_id: Indexed(str)  # type: ignore[valid-type]
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "branches"


class User(Document):
    business_id: Indexed(str)  # type: ignore[valid-type]
    branch_id: Optional[str] = None
    email: Indexed(str, unique=True)  # type: ignore[valid-type]
    phone: Optional[str] = None
    full_name: str
    hashed_password: str
    role: str = UserRole.STAFF.value
    is_active: bool = True
    refresh_token_hash: Optional[str] = None
    last_login_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "users"
