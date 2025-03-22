from typing import TypeVar, Generic, List, Optional
from pydantic import BaseModel
from datetime import datetime

T = TypeVar('T')

class MessageResponse(BaseModel):
    message: str

class IdResponse(BaseModel):
    id: int
    message: str

class CountResponse(BaseModel):
    count: int

class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    limit: int 