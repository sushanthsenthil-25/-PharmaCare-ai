from fastapi import APIRouter, Depends, status

from app.auth.dependencies import get_current_user, CurrentUser
from app.schemas.auth import RegisterRequest, LoginRequest, RefreshRequest, TokenResponse, UserMeResponse
from app.services.auth_service import register_user, login_user, refresh_tokens, logout_user
from app.services.audit_service import record_audit_log

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest):
    """Register a new pharmacy owner and their business."""
    return await register_user(req)


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    """Authenticate and obtain JWT access & refresh tokens."""
    return await login_user(req)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(req: RefreshRequest):
    """Rotate refresh token and issue a fresh access token."""
    return await refresh_tokens(req.refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(current_user: CurrentUser = Depends(get_current_user)):
    """Invalidate current user refresh token."""
    await logout_user(current_user.id)
    await record_audit_log(
        action="LOGOUT",
        business_id=current_user.business_id,
        user_id=current_user.id,
        entity_type="User",
        entity_id=str(current_user.id),
    )


@router.get("/me", response_model=UserMeResponse)
async def get_me(current_user: CurrentUser = Depends(get_current_user)):
    """Get authenticated user profile."""
    return UserMeResponse.model_validate(current_user.db_user.model_dump())
