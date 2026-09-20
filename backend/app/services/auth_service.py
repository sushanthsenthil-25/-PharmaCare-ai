from datetime import datetime, timezone

from fastapi import HTTPException, status

from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_refresh_token
from app.core.config import settings
from app.models.user import User, Business, Branch
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse


async def register_user(req: RegisterRequest) -> TokenResponse:
    """Register a new user with their business and default branch."""
    # 1. Check email uniqueness
    existing = await User.find_one(User.email == req.email)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    # 2. Create business
    business = Business(
        name=req.business_name,
        gstin=req.business_gstin,
        address=req.business_address,
    )
    await business.insert()

    # 3. Create default branch
    branch = Branch(business_id=str(business.id), name=req.branch_name or "Main Branch")
    await branch.insert()

    # 4. Create user (OWNER role for the registering user)
    user = User(
        business_id=str(business.id),
        branch_id=str(branch.id),
        email=req.email,
        phone=req.phone,
        full_name=req.full_name,
        hashed_password=hash_password(req.password),
        role="OWNER",
    )

    # 5. Generate tokens
    # We need the user id — insert first to get it
    await user.insert()

    access_token = create_access_token(
        user_id=str(user.id),
        business_id=str(business.id),
        role=user.role,
        email=user.email,
    )
    refresh_token = create_refresh_token(
        user_id=str(user.id),
        business_id=str(business.id),
    )

    # 6. Store refresh token hash
    await user.set({
        User.refresh_token_hash: hash_password(refresh_token),
        User.last_login_at: datetime.now(timezone.utc),
    })

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


async def login_user(req: LoginRequest) -> TokenResponse:
    """Authenticate user and return JWT tokens."""
    user = await User.find_one(User.email == req.email)

    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    access_token = create_access_token(
        user_id=str(user.id),
        business_id=str(user.business_id),
        role=user.role,
        email=user.email,
    )
    refresh_token = create_refresh_token(
        user_id=str(user.id),
        business_id=str(user.business_id),
    )

    await user.set({
        User.refresh_token_hash: hash_password(refresh_token),
        User.last_login_at: datetime.now(timezone.utc),
    })

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


async def refresh_tokens(refresh_token: str) -> TokenResponse:
    """Rotate refresh token and issue new access token."""
    from jose import JWTError
    try:
        payload = decode_refresh_token(refresh_token)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user_id = payload.get("sub")
    user = await User.get(user_id)

    if not user or not user.refresh_token_hash:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token not found")

    if not verify_password(refresh_token, user.refresh_token_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    new_access = create_access_token(
        user_id=str(user.id),
        business_id=str(user.business_id),
        role=user.role,
        email=user.email,
    )
    new_refresh = create_refresh_token(
        user_id=str(user.id),
        business_id=str(user.business_id),
    )
    await user.set({User.refresh_token_hash: hash_password(new_refresh)})

    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


async def logout_user(user_id: str) -> None:
    """Invalidate the user's refresh token."""
    user = await User.get(user_id)
    if user:
        await user.set({User.refresh_token_hash: None})
