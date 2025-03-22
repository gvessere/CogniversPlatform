from typing import List, Optional, Dict, Any, cast, Sequence, Union
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func, Column as SAColumn, distinct, text, or_, and_
from sqlalchemy.sql import Select, expression, ClauseElement
from sqlalchemy.sql.elements import ColumnElement
from sqlalchemy.sql.selectable import FromClause, SelectBase
from datetime import datetime
from sqlalchemy.orm import joinedload

from database import get_async_session
from models.processors import (
    Processor as ProcessorModel,
    QuestionnaireProcessorMapping as QuestionnaireProcessorMappingModel,
    QuestionProcessorMapping as QuestionProcessorMappingModel,
    ProcessingResult as ProcessingResultModel,
    ProcessorStatus, InterpreterType, TaskDefinition as TaskDefinitionModel
)
from models.questionnaire import (
    Questionnaire as QuestionnaireModel,
    Question as QuestionModel,
    QuestionnaireResponse as QuestionnaireResponseModel,
    QuestionResponse as QuestionResponseModel,
    QuestionType, QuestionnaireType, ClientSessionEnrollment, QuestionnaireInstance,
    Session
)
from models.user import User, UserRole
from auth.dependencies import get_current_user
from tasks import process_questionnaire_response, requeue_processing
import schemas

router = APIRouter(prefix="/processors", tags=["processors"])

# Helper function to check admin permissions
async def check_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMINISTRATOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can manage processors"
        )
    return current_user

# Create new processor
@router.post("", response_model=schemas.ProcessorResponse)
async def create_processor(
    processor: schemas.ProcessorCreate,
    current_user: User = Depends(check_admin),
    db: AsyncSession = Depends(get_async_session)
):
    """Create a new processor."""
    # Validate interpreter
    try:
        interpreter = InterpreterType(processor.interpreter)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid interpreter. Must be one of: {', '.join([e.value for e in InterpreterType])}"
        )
    
    # Validate status
    try:
        processor_status = ProcessorStatus(processor.status)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Must be one of: {', '.join([e.value for e in ProcessorStatus])}"
        )
    
    # Create new processor
    new_processor = ProcessorModel(
        name=processor.name,
        description=processor.description,
        prompt_template=processor.prompt_template,
        post_processing_code=processor.post_processing_code,
        interpreter=interpreter,
        status=processor_status,
        created_by_id=current_user.id,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    
    db.add(new_processor)
    await db.commit()
    
    return new_processor

# Get all processors
@router.get("", response_model=List[schemas.ProcessorResponse])
async def get_processors(
    current_user: User = Depends(check_admin),
    db: AsyncSession = Depends(get_async_session)
):
    """Get all processors."""
    result = await db.execute(select(ProcessorModel))
    processors = result.scalars().all()
    
    return processors

# Get single processor
@router.get("/{processor_id}", response_model=schemas.ProcessorResponse)
async def get_processor(
    processor_id: int,
    current_user: User = Depends(check_admin),
    db: AsyncSession = Depends(get_async_session)
):
    """Get a specific processor."""
    result = await db.execute(
        select(ProcessorModel)
        .where(ProcessorModel.id == processor_id)
    )
    processor = result.scalar_one_or_none()
    
    if not processor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Processor not found"
        )
    
    return processor

# Update processor
@router.put("/{processor_id}", response_model=schemas.ProcessorResponse)
async def update_processor(
    processor_id: int,
    processor: schemas.ProcessorUpdate,
    current_user: User = Depends(check_admin),
    db: AsyncSession = Depends(get_async_session)
):
    """Update a processor."""
    result = await db.execute(
        select(ProcessorModel)
        .where(ProcessorModel.id == processor_id)
    )
    existing_processor = result.scalar_one_or_none()
    
    if not existing_processor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Processor not found"
        )
    
    # Validate interpreter if provided
    if processor.interpreter:
        try:
            processor.interpreter = InterpreterType(processor.interpreter)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid interpreter. Must be one of: {', '.join([e.value for e in InterpreterType])}"
            )
    
    # Validate status if provided
    if processor.status:
        try:
            processor.status = ProcessorStatus(processor.status)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status. Must be one of: {', '.join([e.value for e in ProcessorStatus])}"
            )
    
    # Update processor
    update_data = processor.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(existing_processor, key, value)
    
    existing_processor.updated_at = datetime.now()
    await db.commit()
    
    return existing_processor

# Delete processor
@router.delete("/{processor_id}", response_model=schemas.MessageResponse)
async def delete_processor(
    processor_id: int,
    current_user: User = Depends(check_admin),
    db: AsyncSession = Depends(get_async_session)
):
    """Delete a processor."""
    result = await db.execute(
        select(ProcessorModel)
        .where(ProcessorModel.id == processor_id)
    )
    processor = result.scalar_one_or_none()
    
    if not processor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Processor not found"
        )
    
    # Check if processor is used in any mappings
    result = await db.execute(
        select(QuestionnaireProcessorMappingModel)
        .where(QuestionnaireProcessorMappingModel.processor_id == processor_id)
    )
    mappings = result.scalars().all()
    
    if mappings:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete processor that is assigned to questionnaires"
        )
    
    # Delete processor
    await db.delete(processor)
    await db.commit()
    
    return schemas.MessageResponse(message="Processor deleted successfully")

# Assign processor to questions
@router.post("/{processor_id}/assign", response_model=schemas.TaskDefinitionResponse)
async def assign_processor(
    processor_id: int,
    mapping: schemas.QuestionProcessorMappingCreate,
    current_user: User = Depends(check_admin),
    db: AsyncSession = Depends(get_async_session)
):
    # Check if processor exists
    result = await db.execute(
        select(ProcessorModel)
        .where(ProcessorModel.id == processor_id)
    )
    processor = result.scalar_one_or_none()
    
    if not processor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Processor not found"
        )
    
    # Check if questionnaire exists
    result = await db.execute(
        select(QuestionnaireModel)
        .where(QuestionnaireModel.id == mapping.questionnaire_id)
    )
    questionnaire = result.scalar_one_or_none()
    
    if not questionnaire:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Questionnaire not found"
        )
    
    # Check if all questions exist and belong to the questionnaire
    result = await db.execute(
        select(QuestionModel)
        .where(
            (QuestionModel.id.in_(mapping.question_ids)) &
            (QuestionModel.questionnaire_id == mapping.questionnaire_id)
        )
    )
    questions = result.scalars().all()
    
    if len(questions) != len(mapping.question_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more questions not found or do not belong to the questionnaire"
        )
    
    # Check for existing task definitions for this processor and questionnaire
    result = await db.execute(
        select(TaskDefinitionModel)
        .where(
            (TaskDefinitionModel.processor_id == processor_id) &
            (TaskDefinitionModel.questionnaire_id == mapping.questionnaire_id)
        )
        .order_by(TaskDefinitionModel.created_at.desc())
    )
    existing_task_definitions = result.scalars().all()
    
    # Create a new task definition
    task_definition = TaskDefinitionModel(
        processor_id=processor_id,
        questionnaire_id=mapping.questionnaire_id,
        is_active=mapping.is_active
    )
    db.add(task_definition)
    await db.flush()  # Get the task_definition.id
    
    # Create new mappings
    new_mappings = []
    for question_id in mapping.question_ids:
        # Create new mapping
        new_mapping = QuestionProcessorMappingModel(
            processor_id=processor_id,
            question_id=question_id,
            task_definition_id=task_definition.id,
            is_active=mapping.is_active
        )
        db.add(new_mapping)
        new_mappings.append(new_mapping)
    
    await db.commit()
    return task_definition

# Remove processor from questions
@router.delete("/{processor_id}/assign/{question_id}", response_model=schemas.MessageResponse)
async def remove_processor(
    processor_id: int,
    question_id: int,
    current_user: User = Depends(check_admin),
    db: AsyncSession = Depends(get_async_session)
):
    # Check if mapping exists
    result = await db.execute(
        select(QuestionProcessorMappingModel)
        .where(
            (QuestionProcessorMappingModel.processor_id == processor_id) &
            (QuestionProcessorMappingModel.question_id == question_id)
        )
    )
    mapping = result.scalar_one_or_none()
    
    if not mapping:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Processor is not assigned to this question"
        )
    
    # Delete mapping
    await db.delete(mapping)
    await db.commit()
    
    return schemas.MessageResponse(message="Processor removed from question successfully")

# Get results for a questionnaire response
@router.get("/results/response/{response_id}", response_model=List[schemas.ProcessingResultResponse])
async def get_results_for_response(
    response_id: int,
    current_user: User = Depends(check_admin),
    db: AsyncSession = Depends(get_async_session)
):
    # Check if response exists
    result = await db.execute(
        select(QuestionnaireResponseModel)
        .where(QuestionnaireResponseModel.id == response_id)
    )
    response = result.scalar_one_or_none()
    
    if not response:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Questionnaire response not found"
        )
    
    # Get all results for this response
    result = await db.execute(
        select(ProcessingResultModel)
        .where(ProcessingResultModel.questionnaire_response_id == response_id)
    )
    results = result.scalars().all()
    
    return results

# Get detailed result
@router.get("/results/{result_id}", response_model=schemas.ProcessingResultDetailResponse)
async def get_result_detail(
    result_id: int,
    current_user: User = Depends(check_admin),
    db: AsyncSession = Depends(get_async_session)
):
    result = await db.execute(
        select(ProcessingResultModel)
        .where(ProcessingResultModel.id == result_id)
    )
    processing_result = result.scalar_one_or_none()
    
    if not processing_result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Result not found"
        )
    
    return processing_result

# Requeue a questionnaire response for processing
@router.post("/requeue/{response_id}", response_model=schemas.MessageResponse)
async def requeue_response(
    response_id: int,
    requeue_data: schemas.RequeueRequest,
    current_user: User = Depends(check_admin),
    db: AsyncSession = Depends(get_async_session)
):
    # Check if response exists
    result = await db.execute(
        select(QuestionnaireResponseModel)
        .where(QuestionnaireResponseModel.id == response_id)
    )
    response = result.scalar_one_or_none()
    
    if not response:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Questionnaire response not found"
        )
    
    # Requeue for processing
    requeue_processing.delay(response_id, requeue_data.processor_id)
    
    return schemas.MessageResponse(message=f"Requeued response {response_id} for processing")

# Queue processing for all responses of a questionnaire
@router.post("/queue-responses", response_model=schemas.MessageResponse)
async def queue_questionnaire_responses(
    queue_data: schemas.QueueResponsesRequest,
    current_user: User = Depends(check_admin),
    db: AsyncSession = Depends(get_async_session)
):
    """Queue processing for all responses of a questionnaire."""
    # Check if questionnaire exists
    result = await db.execute(
        select(QuestionnaireModel)
        .where(QuestionnaireModel.id == queue_data.questionnaire_id)
    )
    questionnaire = result.scalar_one_or_none()
    
    if not questionnaire:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Questionnaire not found"
        )
    
    # Get all responses for this questionnaire
    result = await db.execute(
        select(QuestionnaireResponseModel)
        .where(QuestionnaireResponseModel.questionnaire_id == queue_data.questionnaire_id)
    )
    responses = result.scalars().all()
    
    # Queue processing for each response
    for response in responses:
        process_questionnaire_response.delay(response.id)
    
    return schemas.MessageResponse(
        message=f"Queued processing for {len(responses)} responses"
    ) 