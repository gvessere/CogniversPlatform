from pydantic import BaseModel, SecretStr
from typing import List, Dict, Optional, Any
from datetime import datetime, date
from enum import Enum
from models.user import UserRole
from models.questionnaire import QuestionType, QuestionnaireType

# Common configuration for all response models
class BaseResponseModel(BaseModel):
    class Config:
        from_attributes = True
        json_schema_extra: dict[str, dict] = {
            "example": {}  # Will be overridden by child classes
        }

# ==================== User Models ====================

class UserBase(BaseModel):
    email: str
    first_name: str
    last_name: str
    role: UserRole
    dob: Optional[date] = None

# Separate model for signup that doesn't include role
class UserSignup(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    dob: Optional[date] = None

    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "password": "securepassword",
                "first_name": "John",
                "last_name": "Doe",
                "dob": "1990-01-01"
            }
        }

class UserCreate(UserBase):
    password: str

    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "password": "securepassword",
                "first_name": "John",
                "last_name": "Doe",
                "role": "CLIENT",
                "dob": "1990-01-01"
            }
        }

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    supervisor: Optional[str] = None
    dob: Optional[date] = None
    role: Optional[UserRole] = None
    current_password: Optional[SecretStr] = None
    new_password: Optional[SecretStr] = None

    class Config:
        from_attributes = True
        json_encoders = {
            SecretStr: lambda v: "[FILTERED]" if v else None
        }
        json_schema_extra = {
            "example": {
                "first_name": "John",
                "last_name": "Doe",
                "dob": "1990-01-01"
            }
        }

class UserResponse(UserBase, BaseResponseModel):
    id: int

    class Config(BaseResponseModel.Config):
        json_schema_extra = {
            "example": {
                "id": 1,
                "email": "user@example.com",
                "first_name": "John",
                "last_name": "Doe",
                "role": "CLIENT",
                "dob": "1990-01-01"
            }
        }

# ==================== Authentication Models ====================

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

    class Config:
        json_schema_extra = {
            "example": {
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "token_type": "bearer",
                "user": {
                    "id": 1,
                    "email": "user@example.com",
                    "first_name": "John",
                    "last_name": "Doe",
                    "role": "CLIENT",
                    "dob": "1990-01-01"
                }
            }
        }

class LoginData(BaseModel):
    email: str
    password: str

    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "password": "securepassword"
            }
        }

# ==================== Address Models ====================

class AddressBase(BaseModel):
    street_address: str
    city: str
    state: str
    postal_code: str
    country: str

class AddressCreate(AddressBase):
    pass

    class Config:
        json_schema_extra = {
            "example": {
                "street_address": "123 Main St",
                "city": "Anytown",
                "state": "CA",
                "postal_code": "12345",
                "country": "USA"
            }
        }

class AddressUpdate(BaseModel):
    street_address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "street_address": "456 New St",
                "city": "Newtown"
            }
        }

class AddressResponse(AddressBase, BaseResponseModel):
    id: int
    user_id: int

    class Config(BaseResponseModel.Config):
        json_schema_extra = {
            "example": {
                "id": 1,
                "user_id": 1,
                "street_address": "123 Main St",
                "city": "Anytown",
                "state": "CA",
                "postal_code": "12345",
                "country": "USA"
            }
        }

# ==================== Questionnaire Models ====================

class QuestionBase(BaseModel):
    text: str
    type: QuestionType
    order: int
    is_required: bool = True
    time_limit_seconds: Optional[int] = None
    configuration: Dict
    page_number: Optional[int] = 1

class QuestionCreate(QuestionBase):
    pass

    class Config:
        json_schema_extra = {
            "example": {
                "text": "How would you rate your experience?",
                "type": "multiple_choice_single",
                "order": 1,
                "is_required": True,
                "configuration": {
                    "choices": ["Poor", "Fair", "Good", "Excellent"],
                    "answer_box_size": "medium"
                },
                "page_number": 1
            }
        }

class QuestionUpdate(BaseModel):
    text: Optional[str] = None
    type: Optional[QuestionType] = None
    order: Optional[int] = None
    is_required: Optional[bool] = None
    time_limit_seconds: Optional[int] = None
    configuration: Optional[Dict] = None
    page_number: Optional[int] = None

    class Config:
        json_schema_extra = {
            "example": {
                "text": "Updated question text",
                "order": 2
            }
        }

class QuestionResponse(QuestionBase, BaseResponseModel):
    id: int
    questionnaire_id: int

    class Config(BaseResponseModel.Config):
        json_schema_extra = {
            "example": {
                "id": 1,
                "questionnaire_id": 1,
                "text": "How would you rate your experience?",
                "type": "multiple_choice_single",
                "order": 1,
                "is_required": True,
                "time_limit_seconds": None,
                "configuration": {
                    "choices": ["Poor", "Fair", "Good", "Excellent"],
                    "answer_box_size": "medium"
                },
                "page_number": 1
            }
        }

class QuestionnaireBase(BaseModel):
    title: str
    description: str
    type: QuestionnaireType
    is_paginated: bool = False
    requires_completion: bool = True

class QuestionnaireCreate(QuestionnaireBase):
    questions: List[QuestionCreate]

    class Config:
        json_schema_extra = {
            "example": {
                "title": "Customer Satisfaction Survey",
                "description": "Please rate your experience with our service",
                "type": "post_test",
                "is_paginated": True,
                "requires_completion": True,
                "questions": [
                    {
                        "text": "How would you rate our service?",
                        "type": "multiple_choice_single",
                        "order": 1,
                        "is_required": True,
                        "configuration": {
                            "choices": ["Poor", "Fair", "Good", "Excellent"],
                            "answer_box_size": "medium"
                        },
                        "page_number": 1
                    }
                ]
            }
        }

class QuestionnaireUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    type: Optional[QuestionnaireType] = None
    is_paginated: Optional[bool] = None
    requires_completion: Optional[bool] = None

    class Config:
        json_schema_extra = {
            "example": {
                "title": "Updated Survey Title",
                "is_paginated": False
            }
        }

class QuestionnaireResponse(QuestionnaireBase, BaseResponseModel):
    id: int
    created_at: datetime
    updated_at: datetime
    created_by_id: int
    question_count: Optional[int] = None
    questions: Optional[List[QuestionResponse]] = None

    class Config(BaseResponseModel.Config):
        json_schema_extra = {
            "example": {
                "id": 1,
                "title": "Customer Satisfaction Survey",
                "description": "Please rate your experience with our service",
                "type": "post_test",
                "is_paginated": True,
                "requires_completion": True,
                "created_at": "2023-01-01T12:00:00",
                "updated_at": "2023-01-01T12:00:00",
                "created_by_id": 1,
                "question_count": 5
            }
        }

class QuestionnaireClientResponse(BaseResponseModel):
    id: int
    title: str
    description: str
    type: QuestionnaireType
    has_response: bool
    is_completed: bool
    last_updated: Optional[datetime] = None

    class Config(BaseResponseModel.Config):
        json_schema_extra = {
            "example": {
                "id": 1,
                "title": "Customer Satisfaction Survey",
                "description": "Please rate your experience with our service",
                "type": "post_test",
                "has_response": True,
                "is_completed": False,
                "last_updated": "2023-01-01T12:00:00"
            }
        }

class QuestionResponseCreate(BaseModel):
    answer: Dict
    interaction_batch_id: Optional[int] = None

    class Config:
        json_schema_extra = {
            "example": {
                "answer": {
                    "selected_choice": "Good"
                }
            }
        }

class QuestionResponseSubmitResponse(BaseModel):
    message: str
    saved: bool

    class Config:
        json_schema_extra = {
            "example": {
                "message": "Response submitted successfully",
                "saved": True
            }
        }

class QuestionnaireStartResponse(BaseModel):
    response_id: int
    message: str

    class Config:
        json_schema_extra = {
            "example": {
                "response_id": 1,
                "message": "Questionnaire response started"
            }
        }

class QuestionnaireCompleteResponse(BaseModel):
    message: str

    class Config:
        json_schema_extra = {
            "example": {
                "message": "Questionnaire response completed successfully"
            }
        }

# ==================== Interaction Models ====================

class Event(BaseModel):
    type: str
    timestamp: datetime
    data: Dict

    class Config:
        json_schema_extra = {
            "example": {
                "type": "click",
                "timestamp": "2023-01-01T12:00:00",
                "data": {
                    "element_id": "submit_button",
                    "page": "/dashboard"
                }
            }
        }

class InteractionBatchCreate(BaseModel):
    user_id: int
    events: List[Event]

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": 1,
                "events": [
                    {
                        "type": "click",
                        "timestamp": "2023-01-01T12:00:00",
                        "data": {
                            "element_id": "submit_button",
                            "page": "/dashboard"
                        }
                    }
                ]
            }
        }

class InteractionBatchResponse(BaseModel):
    batch_id: int
    task_id: str
    message: str

    class Config:
        json_schema_extra = {
            "example": {
                "batch_id": 1,
                "task_id": "task-123",
                "message": "Processing 5 events"
            }
        }

# ==================== Generic Response Models ====================

class MessageResponse(BaseModel):
    message: str

    class Config:
        json_schema_extra = {
            "example": {
                "message": "Operation completed successfully"
            }
        }

class ErrorResponse(BaseModel):
    detail: str

    class Config:
        json_schema_extra = {
            "example": {
                "detail": "An error occurred"
            }
        }

class IdResponse(BaseModel):
    id: int
    message: str

    class Config:
        json_schema_extra = {
            "example": {
                "id": 1,
                "message": "Resource created successfully"
            }
        }

# Processor schemas
class ProcessorBase(BaseModel):
    name: str
    description: str
    prompt_template: str
    post_processing_code: Optional[str] = None
    interpreter: str = "none"  # python, javascript, none

class ProcessorCreate(ProcessorBase):
    status: str = "testing"  # active, inactive, testing

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Sentiment Analysis",
                "description": "Analyzes sentiment in questionnaire responses",
                "prompt_template": "Analyze the sentiment in the following responses: {{questions}}",
                "post_processing_code": "# Python code to process output\nimport json\ndata = json.loads(input())\nprint(json.dumps({'sentiment': 'positive'}))",
                "interpreter": "python",
                "status": "testing"
            }
        }

class ProcessorUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    prompt_template: Optional[str] = None
    post_processing_code: Optional[str] = None
    interpreter: Optional[str] = None
    status: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "status": "active",
                "prompt_template": "Updated prompt template"
            }
        }

class ProcessorResponse(ProcessorBase, BaseResponseModel):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime
    created_by_id: int

    class Config(BaseResponseModel.Config):
        json_schema_extra = {
            "example": {
                "id": 1,
                "name": "Sentiment Analysis",
                "description": "Analyzes sentiment in questionnaire responses",
                "prompt_template": "Analyze the sentiment in the following responses: {{questions}}",
                "post_processing_code": "# Python code to process output\nimport json\ndata = json.loads(input())\nprint(json.dumps({'sentiment': 'positive'}))",
                "interpreter": "python",
                "status": "active",
                "created_at": "2023-01-01T12:00:00",
                "updated_at": "2023-01-01T12:00:00",
                "created_by_id": 1
            }
        }

class QuestionnaireProcessorMappingCreate(BaseModel):
    questionnaire_id: int
    processor_id: int
    is_active: bool = True

    class Config:
        json_schema_extra = {
            "example": {
                "questionnaire_id": 1,
                "processor_id": 1,
                "is_active": True
            }
        }

class QuestionnaireProcessorMappingResponse(BaseResponseModel):
    id: int
    questionnaire_id: int
    processor_id: int
    is_active: bool
    created_at: datetime

    class Config(BaseResponseModel.Config):
        json_schema_extra = {
            "example": {
                "id": 1,
                "questionnaire_id": 1,
                "processor_id": 1,
                "is_active": True,
                "created_at": "2023-01-01T12:00:00"
            }
        }

class ProcessingResultResponse(BaseResponseModel):
    id: int
    questionnaire_response_id: int
    processor_id: int
    processor_version: str
    status: str
    created_at: datetime
    updated_at: datetime
    error_message: Optional[str] = None
    
    class Config(BaseResponseModel.Config):
        json_schema_extra = {
            "example": {
                "id": 1,
                "questionnaire_response_id": 1,
                "processor_id": 1,
                "processor_version": "deepseek-r1@v0.1",
                "status": "completed",
                "created_at": "2023-01-01T12:00:00",
                "updated_at": "2023-01-01T12:00:00"
            }
        }

class ProcessingResultDetailResponse(ProcessingResultResponse):
    raw_output: str
    processed_output: Optional[Dict] = None
    
    class Config(BaseResponseModel.Config):
        json_schema_extra = {
            "example": {
                "id": 1,
                "questionnaire_response_id": 1,
                "processor_id": 1,
                "processor_version": "deepseek-r1@v0.1",
                "status": "completed",
                "created_at": "2023-01-01T12:00:00",
                "updated_at": "2023-01-01T12:00:00",
                "raw_output": "The sentiment analysis shows positive responses.",
                "processed_output": {"sentiment": "positive"}
            }
        }

class RequeueRequest(BaseModel):
    processor_id: Optional[int] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "processor_id": 1
            }
        }

# ==================== Session Models ====================

class SessionBase(BaseModel):
    title: str
    description: str
    start_date: date
    end_date: date
    trainer_id: int
    is_public: bool = True

class SessionCreate(SessionBase):
    class Config:
        json_schema_extra = {
            "example": {
                "title": "Spring Training Session",
                "description": "Comprehensive training program for new employees",
                "start_date": "2023-04-01",
                "end_date": "2023-04-15",
                "trainer_id": 1,
                "is_public": True
            }
        }

class SessionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    trainer_id: Optional[int] = None
    is_public: Optional[bool] = None
    session_code: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "title": "Updated Training Session",
                "end_date": "2023-04-20",
                "is_public": False
            }
        }

class SessionResponse(SessionBase, BaseResponseModel):
    id: int
    created_at: datetime
    updated_at: datetime
    created_by_id: int
    trainer_name: Optional[str] = None
    session_code: Optional[str] = None

    class Config(BaseResponseModel.Config):
        json_schema_extra = {
            "example": {
                "id": 1,
                "title": "Spring Training Session",
                "description": "Comprehensive training program for new employees",
                "start_date": "2023-04-01",
                "end_date": "2023-04-15",
                "created_at": "2023-03-15T12:00:00",
                "updated_at": "2023-03-15T12:00:00",
                "created_by_id": 1,
                "trainer_id": 1,
                "trainer_name": "John Doe",
                "is_public": True,
                "session_code": "123456"
            }
        }

# ==================== QuestionnaireInstance Models ====================

class QuestionnaireInstanceBase(BaseModel):
    title: str
    questionnaire_id: int
    session_id: int
    is_active: bool = False

class QuestionnaireInstanceCreate(QuestionnaireInstanceBase):
    class Config:
        json_schema_extra = {
            "example": {
                "title": "Pre-Test",
                "questionnaire_id": 1,
                "session_id": 1,
                "is_active": False
            }
        }

class QuestionnaireInstanceUpdate(BaseModel):
    title: Optional[str] = None
    is_active: Optional[bool] = None

    class Config:
        json_schema_extra = {
            "example": {
                "title": "Updated Pre-Test",
                "is_active": True
            }
        }

class QuestionnaireInstanceResponse(QuestionnaireInstanceBase, BaseResponseModel):
    id: int
    created_at: datetime
    updated_at: datetime
    questionnaire_title: Optional[str] = None

    class Config(BaseResponseModel.Config):
        json_schema_extra = {
            "example": {
                "id": 1,
                "title": "Pre-Test",
                "questionnaire_id": 1,
                "session_id": 1,
                "is_active": False,
                "created_at": "2023-03-15T12:00:00",
                "updated_at": "2023-03-15T12:00:00",
                "questionnaire_title": "Customer Satisfaction Survey"
            }
        }

# ==================== Client Session Enrollment Models ====================

class ClientSessionEnrollmentBase(BaseModel):
    client_id: int
    session_id: int
    status: str = "active"

class ClientSessionEnrollmentCreate(ClientSessionEnrollmentBase):
    class Config:
        json_schema_extra = {
            "example": {
                "client_id": 1,
                "session_id": 1,
                "status": "active"
            }
        }

class ClientSessionEnrollmentResponse(ClientSessionEnrollmentBase, BaseResponseModel):
    id: int
    enrolled_at: datetime
    client_name: Optional[str] = None
    session_title: Optional[str] = None

    class Config(BaseResponseModel.Config):
        json_schema_extra = {
            "example": {
                "id": 1,
                "client_id": 1,
                "session_id": 1,
                "status": "active",
                "enrolled_at": "2023-03-15T12:00:00",
                "client_name": "John Doe",
                "session_title": "Spring Training Session"
            }
        }

