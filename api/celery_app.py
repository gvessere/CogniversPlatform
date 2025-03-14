from typing import Any, Dict, List, Optional
# Use type ignore for the celery import
from celery import Celery  # type: ignore
import os

# Define required environment variables
required_env_vars: List[str] = ["REDIS_HOST", "REDIS_PORT", "MODEL_VERSION_LOCK"]

# Check for missing environment variables
missing_env_vars = [var for var in required_env_vars if var not in os.environ]
if missing_env_vars:
    raise EnvironmentError(f"Missing required environment variables: {', '.join(missing_env_vars)}")

# Get environment variables
redis_host: str = os.environ["REDIS_HOST"]
redis_port: str = os.environ["REDIS_PORT"]
model_version_lock: str = os.environ["MODEL_VERSION_LOCK"]

celery_app: Celery = Celery(
    "cognivers",
    broker=f"redis://{redis_host}:{redis_port}/0",
    backend=f"redis://{redis_host}:{redis_port}/1",
    include=["tasks"]
)

celery_app.conf.update(
    task_track_started=True,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

# Export for type checking
__all__ = ['celery_app']

