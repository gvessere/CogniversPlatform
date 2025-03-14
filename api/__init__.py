# File: api/__init__.py
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    celery_app: Any = None
else:
    try:
        from .celery_app import celery_app
    except ImportError:
        celery_app = None

__all__ = ['celery_app']

"""
Cognivers API package.
"""

__version__ = "0.1.0"