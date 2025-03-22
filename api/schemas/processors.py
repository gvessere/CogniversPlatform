from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
from .questionnaires import QuestionnaireResponse, QuestionResponseCreate
from .common import MessageResponse

class ProcessorCreate(BaseModel):
    name: str
    description: Optional[str] = None
    prompt_template: str
    post_processing_code: Optional[str] = None
    interpreter: str
    status: str

class ProcessorUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    prompt_template: Optional[str] = None
    post_processing_code: Optional[str] = None
    interpreter: Optional[str] = None
    status: Optional[str] = None

class ProcessorResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    prompt_template: str
    post_processing_code: Optional[str] = None
    interpreter: str
    status: str
    created_by_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class QuestionProcessorMappingCreate(BaseModel):
    questionnaire_id: int
    question_ids: List[int]
    is_active: bool = True

class QuestionProcessorMappingResponse(BaseModel):
    id: int
    processor_id: int
    question_id: int
    task_definition_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class QuestionnaireProcessorMappingResponse(BaseModel):
    id: int
    processor_id: int
    questionnaire_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ProcessingResultResponse(BaseModel):
    id: int
    processor_id: int
    questionnaire_response_id: int
    question_id: int
    result: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ProcessingResultDetailResponse(BaseModel):
    id: int
    processor_id: int
    questionnaire_response_id: int
    question_id: int
    result: str
    created_at: datetime
    updated_at: datetime
    processor: ProcessorResponse
    question: dict
    response: dict

    class Config:
        from_attributes = True

class RequeueRequest(BaseModel):
    processor_id: int

class TaskDefinitionResponse(BaseModel):
    id: int
    processor_id: int
    questionnaire_id: int
    question_ids: List[int]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class QueueResponsesRequest(BaseModel):
    questionnaire_id: int 