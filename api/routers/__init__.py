"""
API routers package.
"""

from fastapi import APIRouter
from .auth import router as auth_router
from .users import router as users_router
from .address import router as address_router
from .questionnaires import router as questionnaires_router
from .interactions import router as interactions_router
from .processors import router as processors_router
from .sessions import router as sessions_router

api_router = APIRouter() 