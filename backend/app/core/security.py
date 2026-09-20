from datetime import datetime, timedelta, timezone
from typing import Any, Optional
import uuid

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings


# ---------------------------------------------------------------------------
# Password Utilities (Bcrypt Native)
# ---------------------------------------------------------------------------

def hash_password(plain_password: str) -> str:
    """Hash a plaintext password using bcrypt with 72-byte boundary safety."""
    pwd_bytes = plain_password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against its bcrypt hash."""
    try:
        pwd_bytes = plain_password.encode("utf-8")[:72]
        return bcrypt.checkpw(pwd_bytes, hashed_password.encode("utf-8"))
    except Exception:
        return False



# ---------------------------------------------------------------------------
# JWT Utilities
# ---------------------------------------------------------------------------

def _create_token(
    payload: dict[str, Any],
    secret: str,
    expire_minutes: Optional[int] = None,
    expire_days: Optional[int] = None,
) -> str:
    data = payload.copy()
    now = datetime.now(timezone.utc)

    if expire_days is not None:
        expire = now + timedelta(days=expire_days)
    elif expire_minutes is not None:
        expire = now + timedelta(minutes=expire_minutes)
    else:
        expire = now + timedelta(minutes=15)

    data.update({"exp": expire, "iat": now, "jti": str(uuid.uuid4())})
    return jwt.encode(data, secret, algorithm=settings.JWT_ALGORITHM)


def create_access_token(
    user_id: str,
    business_id: str,
    role: str,
    email: str,
) -> str:
    """Create a short-lived JWT access token embedding tenant + role."""
    return _create_token(
        payload={
            "sub": user_id,
            "business_id": business_id,
            "role": role,
            "email": email,
            "type": "access",
        },
        secret=settings.JWT_SECRET,
        expire_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
    )


def create_refresh_token(user_id: str, business_id: str) -> str:
    """Create a long-lived JWT refresh token."""
    return _create_token(
        payload={
            "sub": user_id,
            "business_id": business_id,
            "type": "refresh",
        },
        secret=settings.JWT_REFRESH_SECRET,
        expire_days=settings.REFRESH_TOKEN_EXPIRE_DAYS,
    )


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate an access token. Raises JWTError on failure."""
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    if payload.get("type") != "access":
        raise JWTError("Invalid token type")
    return payload


def decode_refresh_token(token: str) -> dict[str, Any]:
    """Decode and validate a refresh token. Raises JWTError on failure."""
    payload = jwt.decode(token, settings.JWT_REFRESH_SECRET, algorithms=[settings.JWT_ALGORITHM])
    if payload.get("type") != "refresh":
        raise JWTError("Invalid token type")
    return payload
