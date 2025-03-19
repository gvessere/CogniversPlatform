from datetime import datetime, date
from typing import Optional, List, Dict, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, JSON, Enum as SQLEnum
from enum import Enum

if TYPE_CHECKING:
    from models.interaction import InteractionBatch
    from models.processors import ProcessingResult, QuestionnaireProcessorMapping
    from models.user import User

class QuestionType(str, Enum):
    TEXT = "text"
    MULTIPLE_CHOICE_SINGLE = "multiple_choice_single"
    MULTIPLE_CHOICE_MULTIPLE = "multiple_choice_multiple"

class QuestionnaireType(str, Enum):
    SIGNUP = "signup"
    PRE_TEST = "pre_test"
    POST_TEST = "post_test"
    TRAINER_EVALUATION = "trainer_evaluation"

class Session(SQLModel, table=True):
    __tablename__ = "sessions"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(index=True)
    description: str
    start_date: date
    end_date: date
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    created_by_id: int = Field(foreign_key="user.id")
    trainer_id: int = Field(foreign_key="user.id")
    is_public: bool = Field(default=True)
    session_code: Optional[str] = Field(default=None, index=True)
    
    # Relationships
    created_by: "User" = Relationship(sa_relationship_kwargs={"foreign_keys": "[Session.created_by_id]"})
    trainer: "User" = Relationship(sa_relationship_kwargs={"foreign_keys": "[Session.trainer_id]"})
    questionnaire_instances: List["QuestionnaireInstance"] = Relationship(back_populates="session")
    client_enrollments: List["ClientSessionEnrollment"] = Relationship(back_populates="session")

class Questionnaire(SQLModel, table=True):
    __tablename__ = "questionnaires"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(index=True)
    description: str
    type: QuestionnaireType = Field(sa_column=Column(SQLEnum(QuestionnaireType)))
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    is_paginated: bool = Field(default=False)
    requires_completion: bool = Field(default=True)
    number_of_attempts: int
    created_by_id: int = Field(foreign_key="user.id")
    
    # Relationships
    questions: List["Question"] = Relationship(back_populates="questionnaire")
    responses: List["QuestionnaireResponse"] = Relationship(back_populates="questionnaire")
    processors: List["QuestionnaireProcessorMapping"] = Relationship(back_populates="questionnaire")
    instances: List["QuestionnaireInstance"] = Relationship(back_populates="questionnaire")

class QuestionnaireInstance(SQLModel, table=True):
    __tablename__ = "questionnaire_instances"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(index=True)  # e.g., "Pre-Test", "Enrollment questionnaire", "Post-Test"
    questionnaire_id: int = Field(foreign_key="questionnaires.id")
    session_id: int = Field(foreign_key="sessions.id")
    is_active: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    # Relationships
    questionnaire: "Questionnaire" = Relationship(back_populates="instances")
    session: "Session" = Relationship(back_populates="questionnaire_instances")
    responses: List["QuestionnaireResponse"] = Relationship(back_populates="questionnaire_instance")

class Question(SQLModel, table=True):
    __tablename__ = "questions"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    questionnaire_id: int = Field(foreign_key="questionnaires.id")
    text: str
    type: QuestionType = Field(sa_column=Column(SQLEnum(QuestionType)))
    order: int = Field(index=True)
    is_required: bool = Field(default=True)
    time_limit_seconds: Optional[int] = None
    configuration: Dict = Field(
        sa_column=Column(JSON),
        default={
            "answer_box_size": "medium",  # small, medium, large
            "choices": [],  # for multiple choice questions
            "min_choices": None,  # for multiple choice multiple
            "max_choices": None,  # for multiple choice multiple
        }
    )
    page_number: Optional[int] = Field(default=1)
    
    # Relationships
    questionnaire: Questionnaire = Relationship(back_populates="questions")
    responses: List["QuestionResponse"] = Relationship(back_populates="question")

class QuestionnaireResponse(SQLModel, table=True):
    __tablename__ = "questionnaire_responses"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    questionnaire_id: int = Field(foreign_key="questionnaires.id")
    questionnaire_instance_id: Optional[int] = Field(foreign_key="questionnaire_instances.id", nullable=True)
    user_id: int = Field(foreign_key="user.id")
    started_at: datetime = Field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    
    # Relationships
    questionnaire: Questionnaire = Relationship(back_populates="responses")
    questionnaire_instance: Optional[QuestionnaireInstance] = Relationship(back_populates="responses")
    question_responses: List["QuestionResponse"] = Relationship(back_populates="questionnaire_response")
    processing_results: List["ProcessingResult"] = Relationship(back_populates="questionnaire_response")

class QuestionResponse(SQLModel, table=True):
    __tablename__ = "question_responses"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    question_id: int = Field(foreign_key="questions.id")
    questionnaire_response_id: int = Field(foreign_key="questionnaire_responses.id")
    question_text: str  # Store the question text at the time of response
    question_type: QuestionType  # Store the question type at the time of response
    question_configuration: Dict = Field(sa_column=Column(JSON))  # Store the question configuration at the time of response
    answer: Dict = Field(sa_column=Column(JSON))  # Stores text or selected choices
    started_at: datetime = Field(default_factory=datetime.now)
    last_updated_at: datetime = Field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    interaction_batch_id: Optional[int] = Field(foreign_key="interaction_batches.id", nullable=True)
    
    # Relationships
    question: Question = Relationship(back_populates="responses")
    questionnaire_response: QuestionnaireResponse = Relationship(back_populates="question_responses")
    interaction_batch: Optional["InteractionBatch"] = Relationship()

    class Config:
        table = True

class ClientSessionEnrollment(SQLModel, table=True):
    __tablename__ = "client_session_enrollments"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    client_id: int = Field(foreign_key="user.id")
    session_id: int = Field(foreign_key="sessions.id")
    enrolled_at: datetime = Field(default_factory=datetime.now)
    status: str = Field(default="active")  # active, completed, dropped
    
    # Relationships
    client: "User" = Relationship(sa_relationship_kwargs={"foreign_keys": "[ClientSessionEnrollment.client_id]"})
    session: "Session" = Relationship(back_populates="client_enrollments") 