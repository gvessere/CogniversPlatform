from datetime import datetime
from typing import Optional, TYPE_CHECKING
from passlib.context import CryptContext
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from enum import Enum

if TYPE_CHECKING:
    from models.address import Address

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class UserRole(str, Enum):
    ADMINISTRATOR = "Administrator"
    TRAINER = "Trainer"
    CLIENT = "Client"

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    password_hash: str = Field(nullable=False)
    first_name: str
    last_name: str
    dob: datetime
    role: UserRole = Field(default=UserRole.CLIENT)
    
    # Add address relationship
    address: Optional["Address"] = Relationship(back_populates="user", sa_relationship_kwargs={"uselist": False})

    def set_password(self, password: str) -> None:
        self.password_hash = pwd_context.hash(password)

    def verify_password(self, password: str) -> bool:
        return pwd_context.verify(password, self.password_hash)

    
    @classmethod
    async def exists(cls, session: AsyncSession, email: str) -> bool:
        result = await session.execute(select(cls).where(cls.email == email))
        return result.one_or_none() is not None