from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError

from app.core.security import decode_access_token
from app.models.user import User

security = HTTPBearer()


class CurrentUser:
    """Represents the authenticated user extracted from JWT."""
    def __init__(self, user: User):
        self._user = user

    @property
    def id(self) -> str:
        return str(self._user.id)

    @property
    def business_id(self) -> str:
        return self._user.business_id

    @property
    def branch_id(self) -> Optional[str]:
        return self._user.branch_id

    @property
    def role(self) -> str:
        return self._user.role

    @property
    def email(self) -> str:
        return self._user.email

    @property
    def full_name(self) -> str:
        return self._user.full_name

    @property
    def is_active(self) -> bool:
        return self._user.is_active

    @property
    def db_user(self) -> User:
        return self._user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> CurrentUser:
    """
    FastAPI dependency: validates JWT, loads user from MongoDB, returns CurrentUser.
    Raises 401 on any failure.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_access_token(credentials.credentials)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = await User.get(user_id)

    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )

    return CurrentUser(user)


async def get_current_active_user(
    current_user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    """Alias for get_current_user — always ensures user is active."""
    return current_user


def require_roles(allowed_roles: list):
    """Dependency factory that enforces RBAC on a route."""
    async def _check(current_user: CurrentUser = Depends(get_current_user)):
        if current_user.role not in [r.value if hasattr(r, "value") else r for r in allowed_roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {[r.value if hasattr(r, 'value') else r for r in allowed_roles]}",
            )
        return current_user
    return _check
