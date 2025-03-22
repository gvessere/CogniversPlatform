from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class TaskDefinitionResponse(BaseModel):
    id: int
    processor_id: int
    questionnaire_id: int
    question_ids: List[int]
    is_active: bool

    class Config:
        from_attributes = True 