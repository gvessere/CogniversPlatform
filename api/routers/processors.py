from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from datetime import datetime

from database import get_async_session
from models.processors import (
    Processor, QuestionnaireProcessorMapping, QuestionProcessorMapping,
    ProcessingResult, ProcessorStatus, InterpreterType, TaskDefinition
)
from models.questionnaire import Questionnaire, QuestionnaireResponse, Question
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
    processor_data: schemas.ProcessorCreate,
    current_user: User = Depends(check_admin),
    db: AsyncSession = Depends(get_async_session)
):
    # Validate interpreter
    try:
        interpreter = InterpreterType(processor_data.interpreter)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid interpreter. Must be one of: {', '.join([e.value for e in InterpreterType])}"
        )
    
    # Validate status
    try:
        processor_status = ProcessorStatus(processor_data.status)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Must be one of: {', '.join([e.value for e in ProcessorStatus])}"
        )
    
    # Create new processor
    new_processor = Processor(
        name=processor_data.name,
        description=processor_data.description,
        prompt_template=processor_data.prompt_template,
        post_processing_code=processor_data.post_processing_code,
        interpreter=interpreter,
        status=processor_status,
        created_by_id=current_user.id,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    
    db.add(new_processor)
    await db.commit()
    
    # Return the processor object directly
    return new_processor

# Get all processors
@router.get("", response_model=List[schemas.ProcessorResponse])
async def get_processors(
    current_user: User = Depends(check_admin),
    db: AsyncSession = Depends(get_async_session)
):
    result = await db.execute(select(Processor))
    processors = result.scalars().all()
    
    return processors

# Get single processor
@router.get("/{processor_id}", response_model=schemas.ProcessorResponse)
async def get_processor(
    processor_id: int,
    current_user: User = Depends(check_admin),
    db: AsyncSession = Depends(get_async_session)
):
    result = await db.execute(
        select(Processor)
        .where(Processor.id == processor_id)
    )
    processor = result.scalar_one_or_none()
    
    if not processor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Processor not found"
        )
    
    return processor

# Update processor
@router.patch("/{processor_id}", response_model=schemas.ProcessorResponse)
async def update_processor(
    processor_id: int,
    update_data: schemas.ProcessorUpdate,
    current_user: User = Depends(check_admin),
    db: AsyncSession = Depends(get_async_session)
):
    result = await db.execute(
        select(Processor)
        .where(Processor.id == processor_id)
    )
    processor = result.scalar_one_or_none()
    
    if not processor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Processor not found"
        )
    
    # Validate interpreter if provided
    if update_data.interpreter:
        try:
            update_data.interpreter = InterpreterType(update_data.interpreter)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid interpreter. Must be one of: {', '.join([e.value for e in InterpreterType])}"
            )
    
    # Validate status if provided
    if update_data.status:
        try:
            update_data.status = ProcessorStatus(update_data.status)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status. Must be one of: {', '.join([e.value for e in ProcessorStatus])}"
            )
    
    # Update processor
    update_dict = update_data.dict(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(processor, key, value)
    
    processor.updated_at = datetime.now()
    await db.commit()
    
    # Return the processor object directly
    return processor

# Delete processor
@router.delete("/{processor_id}", response_model=schemas.MessageResponse)
async def delete_processor(
    processor_id: int,
    current_user: User = Depends(check_admin),
    db: AsyncSession = Depends(get_async_session)
):
    result = await db.execute(
        select(Processor)
        .where(Processor.id == processor_id)
    )
    processor = result.scalar_one_or_none()
    
    if not processor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Processor not found"
        )
    
    # Check if processor is used in any mappings
    result = await db.execute(
        select(QuestionnaireProcessorMapping)
        .where(QuestionnaireProcessorMapping.processor_id == processor_id)
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
@router.post("/{processor_id}/assign", response_model=List[schemas.QuestionProcessorMappingResponse])
async def assign_processor(
    processor_id: int,
    mapping_data: schemas.QuestionProcessorMappingCreate,
    current_user: User = Depends(check_admin),
    db: AsyncSession = Depends(get_async_session)
):
    # Check if processor exists
    result = await db.execute(
        select(Processor)
        .where(Processor.id == processor_id)
    )
    processor = result.scalar_one_or_none()
    
    if not processor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Processor not found"
        )
    
    # Check if questionnaire exists
    result = await db.execute(
        select(Questionnaire)
        .where(Questionnaire.id == mapping_data.questionnaire_id)
    )
    questionnaire = result.scalar_one_or_none()
    
    if not questionnaire:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Questionnaire not found"
        )
    
    # Check if all questions exist and belong to the questionnaire
    result = await db.execute(
        select(Question)
        .where(
            (Question.id.in_(mapping_data.question_ids)) &
            (Question.questionnaire_id == mapping_data.questionnaire_id)
        )
    )
    questions = result.scalars().all()
    
    if len(questions) != len(mapping_data.question_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more questions not found or do not belong to the questionnaire"
        )
    
    # Check for existing task definitions for this processor and questionnaire
    result = await db.execute(
        select(TaskDefinition)
        .where(
            (TaskDefinition.processor_id == processor_id) &
            (TaskDefinition.questionnaire_id == mapping_data.questionnaire_id)
        )
        .order_by(TaskDefinition.created_at.desc())
    )
    existing_task_definitions = result.scalars().all()
    
    # Create a new task definition
    task_definition = TaskDefinition(
        processor_id=processor_id,
        questionnaire_id=mapping_data.questionnaire_id,
        is_active=mapping_data.is_active
    )
    db.add(task_definition)
    await db.flush()  # Get the task_definition.id
    
    # Create new mappings
    new_mappings = []
    for question_id in mapping_data.question_ids:
        # Create new mapping
        new_mapping = QuestionProcessorMapping(
            processor_id=processor_id,
            question_id=question_id,
            task_definition_id=task_definition.id,
            is_active=mapping_data.is_active
        )
        db.add(new_mapping)
        new_mappings.append(new_mapping)
    
    await db.commit()
    return new_mappings

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
        select(QuestionProcessorMapping)
        .where(
            (QuestionProcessorMapping.processor_id == processor_id) &
            (QuestionProcessorMapping.question_id == question_id)
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
        select(QuestionnaireResponse)
        .where(QuestionnaireResponse.id == response_id)
    )
    response = result.scalar_one_or_none()
    
    if not response:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Questionnaire response not found"
        )
    
    # Get all results for this response
    result = await db.execute(
        select(ProcessingResult)
        .where(ProcessingResult.questionnaire_response_id == response_id)
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
        select(ProcessingResult)
        .where(ProcessingResult.id == result_id)
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
        select(QuestionnaireResponse)
        .where(QuestionnaireResponse.id == response_id)
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