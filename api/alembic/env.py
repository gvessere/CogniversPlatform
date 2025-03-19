from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine
from sqlmodel import SQLModel
from sqlalchemy.sql.schema import MetaData
from alembic import context
import os
import sys
from typing import Optional, Any, Union, Dict, List
import asyncio

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import all models here
from models.questionnaire import Questionnaire, Question, QuestionnaireResponse, QuestionResponse
from models.user import User
from models.interaction import InteractionBatch
from models.processors import ProcessingResult, QuestionnaireProcessorMapping

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Get database URL from environment
database_url = os.environ.get("DATABASE_URL", "")
if not database_url:
    raise ValueError("DATABASE_URL environment variable is not set")

# Create async engine
connectable = create_async_engine(database_url)

# Define a synchronous version of the migrations function
def do_run_migrations(connection: Any) -> None:
    context.configure(
        connection=connection,
        target_metadata=SQLModel.metadata,
        compare_type=True
    )
    
    with context.begin_transaction():
        context.run_migrations()

# Use async_with instead of with for AsyncEngine
async def run_migrations() -> None:
    """Run migrations asynchronously."""
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata: Optional[MetaData] = SQLModel.metadata

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = database_url
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    asyncio.run(run_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
