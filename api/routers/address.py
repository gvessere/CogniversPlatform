from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from database import get_async_session
from models.address import Address
from auth.dependencies import get_current_user
from models.user import User
import schemas

router = APIRouter(prefix="/address", tags=["address"])

@router.get("/me", response_model=schemas.AddressResponse)
async def get_my_address(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get the current user's address"""
    result = await db.execute(
        select(Address).where(Address.user_id == current_user.id)
    )
    address = result.scalar_one_or_none()
    
    if not address:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Address not found"
        )
    
    return schemas.AddressResponse.from_orm(address)

@router.post("/me", response_model=schemas.AddressResponse)
async def create_address(
    address_data: schemas.AddressCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Create an address for the current user"""
    # Check if user already has an address
    result = await db.execute(
        select(Address).where(Address.user_id == current_user.id)
    )
    existing_address = result.scalar_one_or_none()
    
    if existing_address:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already has an address"
        )
    
    # Create new address
    address = Address(
        user_id=current_user.id,
        **address_data.dict()
    )
    
    db.add(address)
    await db.commit()
    
    # Create a new response object directly from the address object
    # without querying the database again
    return schemas.AddressResponse.from_orm(address)

@router.patch("/me", response_model=schemas.AddressResponse)
async def update_address(
    address_data: schemas.AddressUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Update the current user's address"""
    result = await db.execute(
        select(Address).where(Address.user_id == current_user.id)
    )
    address = result.scalar_one_or_none()
    
    if not address:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Address not found"
        )
    
    # Update fields
    update_data = address_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(address, key, value)
    
    db.add(address)
    await db.commit()
    
    # Create a new response object directly from the address object
    # without querying the database again
    return schemas.AddressResponse.from_orm(address)

@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_address(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Delete the current user's address"""
    result = await db.execute(
        select(Address).where(Address.user_id == current_user.id)
    )
    address = result.scalar_one_or_none()
    
    if not address:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Address not found"
        )
    
    await db.delete(address)
    await db.commit() 