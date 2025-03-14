from sqlmodel import SQLModel, create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from typing import AsyncGenerator
import os

DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_NAME = os.getenv("DB_NAME", "cognivers")
ENV = os.getenv("ENV", "development")

DATABASE_URL = f"postgresql+asyncpg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}"
if ENV == "production":
    DATABASE_URL += "?sslmode=require"

engine = create_async_engine(DATABASE_URL, pool_size=20, max_overflow=10)
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    expire_on_commit=False)

async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        async with session.begin():
            yield session

async def init_db() -> None:
    async with engine.begin() as conn:
        # Import all models here to ensure they're registered with SQLModel
        from models.user import User
        from models.address import Address
        from models.interaction import InteractionBatch
        from models.questionnaire import Questionnaire, Question, QuestionnaireResponse, QuestionResponse
        from models.processors import ProcessingResult, Annotation
        
        await conn.run_sync(SQLModel.metadata.create_all)


