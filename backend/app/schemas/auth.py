from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from app.schemas.common import StrId, OptStrId


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=2, max_length=255)
    phone: Optional[str] = None
    business_name: str = Field(..., min_length=2, max_length=255)
    business_gstin: Optional[str] = None
    business_address: Optional[str] = None
    branch_name: str = Field(default="Main Branch", max_length=255)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v):
        if v and len(v.replace("+", "").replace("-", "").replace(" ", "")) < 10:
            raise ValueError("Phone number too short")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class UserMeResponse(BaseModel):
    id: StrId
    email: str
    full_name: str
    phone: Optional[str] = None
    role: str
    business_id: StrId
    branch_id: OptStrId = None
    is_active: bool
    business_name: Optional[str] = None

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, obj, **kwargs):
        data = super().model_validate(obj, **kwargs)
        # Populate business_name from the related Business relationship
        if data.business_name is None and hasattr(obj, 'business') and obj.business:
            data.business_name = obj.business.name
        return data
