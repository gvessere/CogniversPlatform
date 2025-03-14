from datetime import datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, JSON

class InteractionBatch(SQLModel, table=True):
    __tablename__ = "interaction_batches"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int
    events: List[dict] = Field(sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.now)

    class Config:
        table = True
        sa_table_args = (
            {"info": {"indexes": [("created_at", "user_id")]}}
        ) 