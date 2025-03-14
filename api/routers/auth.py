# api/routers/auth.py
from fastapi import Depends, APIRouter, HTTPException, Body, Form
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_async_session, AsyncSessionLocal
from argon2 import PasswordHasher
from datetime import date, timedelta
from typing import Optional
import logging

from fastapi.security import OAuth2PasswordRequestForm
from models.user import User, UserRole
from core.security import create_access_token
from sqlalchemy import select
from auth.dependencies import get_current_user
import schemas

router = APIRouter(prefix="/auth", tags=["auth"])
ph = PasswordHasher()
logger = logging.getLogger(__name__)

@router.post("/signup", response_model=schemas.IdResponse)
async def signup(user: schemas.UserSignup, db: AsyncSession = Depends(get_async_session)):
    # Check if user exists
    if await User.exists(db, email=user.email):
        raise HTTPException(
            status_code=409,
            detail="Email already registered"
        )
    
    # Set role based on email
    if user.email == "gery@vessere.com":
        role = UserRole.ADMINISTRATOR
    else:
        role = UserRole.CLIENT
    
    # Create new user
    hashed_pw = ph.hash(user.password)
    new_user = User(
        email=user.email,
        password_hash=hashed_pw,
        first_name=user.first_name,
        last_name=user.last_name,
        dob=user.dob,
        role=role  # Use the role determined above
    )
    
    try:
        db.add(new_user)
        await db.commit()
        
        # Create a new session for fetching the user
        async with AsyncSessionLocal() as new_session:
            async with new_session.begin():
                result = await new_session.execute(
                    select(User).where(User.email == user.email)
                )
                created_user = result.scalar_one()
                return schemas.IdResponse(id=created_user.id, message="Signup successful")
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to create user. Please try again."
        )

# Create a new login endpoint that accepts JSON
@router.post("/login", response_model=schemas.Token)
async def login(
    login_data: schemas.LoginData,
    db: AsyncSession = Depends(get_async_session)
):
    logger.info(f"Login attempt for email: {login_data.email}")
    
    # Find user by email
    result = await db.execute(
        select(User).where(User.email == login_data.email)
    )
    user = result.scalar_one_or_none()

    if not user:
        logger.warning(f"User not found: {login_data.email}")
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password"
        )

    try:
        password_valid: bool = ph.verify(user.password_hash, login_data.password)
        logger.info(f"Password verification result for {login_data.email}: {password_valid}")
    except Exception as e:
        logger.error(f"Password verification error for {login_data.email}: {str(e)}")
        password_valid = False

    if not password_valid:
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password"
        )
    
    # Create JWT token with 24 hour expiration
    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "dob": user.dob.isoformat() if user.dob else None,
            "role": user.role
        },
        expires_delta=timedelta(hours=24)
    )
    logger.info(f"Login successful for {login_data.email}")
    
    # Create user response
    user_response = schemas.UserResponse(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role,
        dob=user.dob
    )
    
    return schemas.Token(access_token=access_token, token_type="bearer", user=user_response)

# Simple token validation endpoint
@router.get("/validate", response_model=schemas.MessageResponse)
async def validate_token(current_user: User = Depends(get_current_user)):
    """Simple endpoint to validate a token"""
    return schemas.MessageResponse(message="Token is valid")
