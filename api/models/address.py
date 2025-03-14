from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from models.user import User

class Address(SQLModel, table=True):
    __tablename__ = "addresses"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    street_address: str = Field(max_length=255)
    city: str = Field(max_length=100)
    state: str = Field(max_length=100)
    postal_code: str = Field(max_length=20)
    country: str = Field(max_length=100)
    
    # Relationship with User
    user: "User" = Relationship(back_populates="address")

    class Config:
        table = True 