from enum import Enum
from functools import wraps
from typing import List

from fastapi import HTTPException, status


class UserRole(str, Enum):
    OWNER = "OWNER"
    MANAGER = "MANAGER"
    STAFF = "STAFF"


# Role hierarchy: what each role can access
ROLE_HIERARCHY: dict[UserRole, int] = {
    UserRole.OWNER: 3,
    UserRole.MANAGER: 2,
    UserRole.STAFF: 1,
}

# Permission matrix: which roles are allowed per capability
PERMISSIONS: dict[str, List[UserRole]] = {
    "manage_business": [UserRole.OWNER],
    "manage_users": [UserRole.OWNER],
    "view_analytics": [UserRole.OWNER, UserRole.MANAGER],
    "manage_ai_settings": [UserRole.OWNER],
    "manage_products": [UserRole.OWNER, UserRole.MANAGER],
    "view_products": [UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF],
    "manage_inventory": [UserRole.OWNER, UserRole.MANAGER],
    "view_inventory": [UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF],
    "create_sale": [UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF],
    "view_sales": [UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF],
    "create_purchase": [UserRole.OWNER, UserRole.MANAGER],
    "view_purchases": [UserRole.OWNER, UserRole.MANAGER],
    "manage_orders": [UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF],
    "view_reports": [UserRole.OWNER, UserRole.MANAGER],
    "manage_shipments": [UserRole.OWNER, UserRole.MANAGER],
    "view_alerts": [UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF],
    "use_ai": [UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF],
    "use_voice": [UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF],
}


def require_roles(allowed_roles: List[UserRole]):
    """
    FastAPI dependency that enforces role-based access control.
    Usage:
        @router.get("/", dependencies=[Depends(require_roles([UserRole.OWNER, UserRole.MANAGER]))])
    """
    def dependency(current_user=None):
        if current_user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
        if UserRole(current_user.role) not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required: {[r.value for r in allowed_roles]}",
            )
        return current_user
    return dependency


def check_permission(user_role: str, permission: str) -> bool:
    """Check if a role has a specific named permission."""
    allowed = PERMISSIONS.get(permission, [])
    try:
        return UserRole(user_role) in allowed
    except ValueError:
        return False


def assert_permission(user_role: str, permission: str) -> None:
    """Raise HTTP 403 if user does not have the required permission."""
    if not check_permission(user_role, permission):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied: '{permission}' requires one of {[r.value for r in PERMISSIONS.get(permission, [])]}",
        )


def assert_tenant(resource_business_id: str, current_business_id: str) -> None:
    """
    IDOR protection: ensure the resource belongs to the authenticated business.
    Call this whenever fetching any resource by ID.
    """
    if str(resource_business_id) != str(current_business_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: resource does not belong to your business",
        )
