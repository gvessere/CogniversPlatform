from typing import Optional, List, Annotated
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
import logging
from sqlalchemy import select
from database import get_async_session
from models.user import User, UserRole
from jose import JWTError, jwt
import os
from fastapi.security import OAuth2PasswordBearer
import schemas
from auth.dependencies import get_current_user

# Configure logging to exclude sensitive data
logger = logging.getLogger(__name__)

class SensitiveDataFilter(logging.Filter):
    def filter(self, record):
        # Remove sensitive data from logs
        sensitive_fields = ['password', 'current_password', 'new_password', 'password_hash']
        for field in sensitive_fields:
            if hasattr(record, 'msg') and field in str(record.msg):
                record.msg = str(record.msg).replace(getattr(record.msg, field, ''), '[FILTERED]')
        return True

logger.addFilter(SensitiveDataFilter())

router = APIRouter(prefix="/users", tags=["users"])
ph = PasswordHasher()

# Security config from auth.utils
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

@router.get("", response_model=List[schemas.UserResponse])
async def get_users(
    role: Optional[UserRole] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    Get users with optional role filtering.
    
    Access controls:
    - Admins can see all users
    - Trainers can see all trainers, admins, and their clients
    - Clients can only see trainers and admins
    """
    # Base query
    query = select(User)
    
    # Apply role filter if provided
    if role:
        query = query.where(User.role == role)
    
    # Apply access control filters based on user role
    if current_user.role == UserRole.CLIENT:
        # Clients can only see trainers and admins
        if not role:  # Only apply if no specific role filter was requested
            query = query.where(User.role.in_([UserRole.TRAINER, UserRole.ADMINISTRATOR]))
    elif current_user.role == UserRole.TRAINER:
        # Trainers can see all trainers, admins, and their clients
        # For now, we allow trainers to see all clients since client-trainer relationships
        # are not yet implemented in the data model
        pass  # No additional filters needed
    # Admins can see everything, so no additional filters
    
    result = await db.execute(query)
    users = result.scalars().all()
    
    return [schemas.UserResponse.from_orm(user) for user in users]

@router.get("/clients", response_model=List[schemas.UserResponse])
async def get_trainer_clients(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get all clients for a trainer"""
    if current_user.role != UserRole.TRAINER and current_user.role != UserRole.ADMINISTRATOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers can view their clients"
        )
    
    # For now, trainers can see all clients
    result = await db.execute(
        select(User).where(User.role == UserRole.CLIENT)
    )
    clients = result.scalars().all()
    
    return [schemas.UserResponse.from_orm(client) for client in clients]

@router.post("/create", response_model=schemas.UserResponse)
async def create_user(
    user_data: schemas.UserCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
) -> schemas.UserResponse:
    """Create a new user (admin only)"""
    if current_user.role != UserRole.ADMINISTRATOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can create users"
        )
    
    # Check if email already exists
    result = await db.execute(
        select(User).where(User.email == user_data.email)
    )
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Hash password
    hashed_password = ph.hash(user_data.password)
    
    # Create user
    new_user = User(
        email=user_data.email,
        password_hash=hashed_password,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        role=user_data.role,
        dob=user_data.dob
    )
    
    db.add(new_user)
    await db.commit()
    
    # Create a new response object directly from the user object
    # without querying the database again
    return schemas.UserResponse.from_orm(new_user)

@router.get("/me", response_model=schemas.UserResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get the current user's profile"""
    # The get_current_user dependency already fetches the user
    # Just return it as a response model
    return schemas.UserResponse.from_orm(current_user)

@router.patch("/me", response_model=schemas.UserResponse)
async def update_user_profile(
    update_data: schemas.UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Update the current user's profile"""
    # Handle password change if provided
    if update_data.current_password and update_data.new_password:
        try:
            # Verify current password
            password_valid = ph.verify(current_user.password_hash, update_data.current_password.get_secret_value())
            
            if not password_valid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Current password is incorrect"
                )
            
            # Update password
            current_user.password_hash = ph.hash(update_data.new_password.get_secret_value())
            
        except VerifyMismatchError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )
    
    # Update other fields
    update_dict = update_data.dict(
        exclude={"current_password", "new_password"},
        exclude_unset=True
    )
    
    # Don't allow role changes for self-update
    if "role" in update_dict:
        del update_dict["role"]
    
    for key, value in update_dict.items():
        setattr(current_user, key, value)
    
    # Save changes
    db.add(current_user)
    await db.commit()
    
    # Get a fresh copy of the user data
    from database import AsyncSessionLocal
    async with AsyncSessionLocal() as new_session:
        result = await new_session.execute(
            select(User).where(User.id == current_user.id)
        )
        updated_user = result.scalar_one()
        return schemas.UserResponse.from_orm(updated_user)

@router.patch("/{user_id}", response_model=schemas.UserResponse)
async def update_user(
    user_id: int,
    update_data: schemas.UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Update a user (admin only)"""
    if current_user.role != UserRole.ADMINISTRATOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can update other users"
        )
    
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update password if provided
    if update_data.new_password:
        user.password_hash = ph.hash(update_data.new_password.get_secret_value())
    
    # Update other fields
    update_dict = update_data.dict(
        exclude={"current_password", "new_password"},
        exclude_unset=True
    )
    
    for key, value in update_dict.items():
        setattr(user, key, value)
    
    # Save changes
    db.add(user)
    await db.commit()
    
    # Get a fresh copy of the user data
    from database import AsyncSessionLocal
    async with AsyncSessionLocal() as new_session:
        result = await new_session.execute(
            select(User).where(User.id == user_id)
        )
        updated_user = result.scalar_one()
        return schemas.UserResponse.from_orm(updated_user)

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Delete a user (admin only)"""
    if current_user.role != UserRole.ADMINISTRATOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete users"
        )
    
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    await db.delete(user)
    await db.commit()

@router.get("/{user_id}", response_model=schemas.UserResponse)
async def get_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get a specific user"""
    # Only admins can view any user, others can only view themselves
    if current_user.role != UserRole.ADMINISTRATOR and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this user"
        )
    
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return schemas.UserResponse.from_orm(user)