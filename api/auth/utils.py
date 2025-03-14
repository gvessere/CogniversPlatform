import os
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from typing import Annotated

# Security config
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Note: Authentication has been moved to api.routers.users.get_current_user
# Please use that function for all authentication needs.
# This file is kept for reference only and may be removed in the future.

# Completely removing the get_current_user_id function

# Note: Authentication has been moved to api.routers.users.get_current_user
# Please use that function for all authentication needs.
# This file is kept for reference only and may be removed in the future. 