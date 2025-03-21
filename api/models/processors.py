from datetime import datetime
from typing import Optional, Dict, List, Any, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, JSON, Text, Enum as SQLEnum
from enum import Enum

if TYPE_CHECKING:
    from models.questionnaire import QuestionnaireResponse, Questionnaire, Question

class ProcessorStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    TESTING = "testing"

class InterpreterType(str, Enum):
    NONE = "none"
    PYTHON = "python"
    JAVASCRIPT = "javascript"

class Processor(SQLModel, table=True):
    """Admin-defined processor configuration"""
    __tablename__ = "processors"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    description: str
    prompt_template: str = Field(
        sa_column=Column(Text),
        description="""
        Prompt template using Jinja2 syntax. Available variables:
        - questions: List of question objects, each containing:
          - id: Question ID
          - text: Question text
          - type: Question type
          - answer: User's answer
          - index: 1-based index in the batch
        
        Example template:
        {% for question in questions %}
        Question #{{ question.index }}
        {{ question.text }}
        Answer: {{ question.answer }}
        {% endfor %}
        """
    )
    post_processing_code: Optional[str] = Field(sa_column=Column(Text), default=None)
    interpreter: InterpreterType = Field(sa_column=Column(SQLEnum(InterpreterType)), default=InterpreterType.NONE)
    status: ProcessorStatus = Field(sa_column=Column(SQLEnum(ProcessorStatus)), default=ProcessorStatus.TESTING)
    is_active: bool = Field(default=True, description="Whether this processor is active and should process responses")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    created_by_id: int = Field(foreign_key="user.id")
    
    # LLM Configuration
    llm_model: Optional[str] = Field(default=None)  # e.g., "gpt-4", "claude-3-opus"
    llm_temperature: Optional[float] = Field(default=0.7)
    llm_max_tokens: Optional[int] = Field(default=2000)
    llm_stop_sequences: Optional[List[str]] = Field(sa_column=Column(JSON), default=None)
    llm_system_prompt: Optional[str] = Field(sa_column=Column(Text), default=None)
    
    # Relationships
    questionnaires: List["QuestionnaireProcessorMapping"] = Relationship(back_populates="processor")
    questions: List["QuestionProcessorMapping"] = Relationship(back_populates="processor")
    results: List["ProcessingResult"] = Relationship(back_populates="processor")

class QuestionnaireProcessorMapping(SQLModel, table=True):
    """Mapping between questionnaires and processors"""
    __tablename__ = "questionnaire_processor_mappings"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    questionnaire_id: int = Field(foreign_key="questionnaires.id")
    processor_id: int = Field(foreign_key="processors.id")
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.now)
    
    # Relationships
    questionnaire: "Questionnaire" = Relationship(back_populates="processors")
    processor: Processor = Relationship(back_populates="questionnaires")

class QuestionProcessorMapping(SQLModel, table=True):
    """Mapping between questions and processors"""
    __tablename__ = "question_processor_mappings"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    question_id: int = Field(foreign_key="questions.id")
    processor_id: int = Field(foreign_key="processors.id")
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    # Relationships
    question: "Question" = Relationship(back_populates="processors")
    processor: Processor = Relationship(back_populates="questions")

class ProcessingResult(SQLModel, table=True):
    """Results of processing questionnaire responses"""
    __tablename__ = "processing_results"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    questionnaire_response_id: int = Field(foreign_key="questionnaire_responses.id")
    processor_id: int = Field(foreign_key="processors.id")
    processor_version: str
    prompt: str = Field(sa_column=Column(Text), description="The final prompt sent to the processor")
    raw_output: str = Field(sa_column=Column(Text))
    processed_output: Optional[Dict[str, Any]] = Field(sa_column=Column(JSON), default=None)
    status: str
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    question_ids: List[int] = Field(sa_column=Column(JSON))
    batch_index: Optional[int] = None
    
    # Relationships
    questionnaire_response: "QuestionnaireResponse" = Relationship(back_populates="processing_results")
    processor: Processor = Relationship(back_populates="results")
    annotations: List["Annotation"] = Relationship(back_populates="processing_result")

class Annotation(SQLModel, table=True):
    """Annotations extracted from processing results"""
    __tablename__ = "annotations"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    processing_result_id: int = Field(foreign_key="processing_results.id")
    start_offset: int
    end_offset: int
    class_label: str = Field(max_length=255)
    explanation: str
    confidence: Optional[dict] = Field(
        sa_column=Column(JSON, nullable=True),
        default=None
    )
    created_at: datetime = Field(default_factory=datetime.now)
    
    processing_result: ProcessingResult = Relationship(back_populates="annotations")

    class Config:
        table = True
        sa_table_args = (
            {"info": {"indexes": [("created_at", "class_label")]}}
        ) 