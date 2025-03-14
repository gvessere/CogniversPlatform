# api/dependencies.py
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt  # type: ignore
from auth.dependencies import get_current_user
from models.user import User

# This file contains deprecated code and should not be used.
# Please use auth.dependencies.get_current_user instead.

# Example usage:
"""
# For all endpoints (recommended):
@router.get("/me")
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user
"""