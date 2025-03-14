from typing import List, Optional, Dict, Any, cast, Sequence
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, Column as SAColumn
from sqlalchemy.sql import Select
from datetime import datetime
from sqlalchemy.orm import joinedload

from database import get_async_session
from models.questionnaire import (
    Questionnaire, Question, QuestionnaireResponse, QuestionResponse,
    QuestionType, QuestionnaireType, ClientSessionEnrollment, QuestionnaireInstance
)
from models.user import User, UserRole
from models.interaction import InteractionBatch
from auth.dependencies import get_current_user
from tasks import process_questionnaire_response
import schemas

router = APIRouter(prefix="/questionnaires", tags=["questionnaires"])

# Helper function to check user permissions
async def check_admin_or_trainer(current_user: User = Depends(get_current_user)):
    if current_user.role not in [UserRole.ADMINISTRATOR, UserRole.TRAINER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and trainers can manage questionnaires"
        )
    return current_user

# Create new questionnaire
@router.post("", response_model=schemas.IdResponse)
async def create_questionnaire(
    questionnaire_data: schemas.QuestionnaireCreate,
    current_user: User = Depends(check_admin_or_trainer),
    db: AsyncSession = Depends(get_async_session)
):
    new_questionnaire = Questionnaire(
        title=questionnaire_data.title,
        description=questionnaire_data.description,
        type=questionnaire_data.type,
        is_paginated=questionnaire_data.is_paginated,
        requires_completion=questionnaire_data.requires_completion,
        created_by_id=current_user.id
    )
    
    db.add(new_questionnaire)
    await db.flush()  # Get the ID without committing
    
    # Create questions
    questions = [
        Question(
            questionnaire_id=new_questionnaire.id,
            **question.dict()
        )
        for question in questionnaire_data.questions
    ]
    
    db.add_all(questions)
    await db.commit()
    
    # Ensure id is not None before passing to IdResponse
    if new_questionnaire.id is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate questionnaire ID"
        )
    
    return schemas.IdResponse(id=new_questionnaire.id, message="Questionnaire created successfully")

# Get questionnaires for clients with response status
@router.get("/client", response_model=List[schemas.QuestionnaireClientResponse])
async def get_client_questionnaires(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get questionnaires available for the client with response status"""
    
    # Get all questionnaires
    result = await db.execute(select(Questionnaire))
    questionnaires = result.scalars().all()
    
    # Get all responses for this user
    result = await db.execute(
        select(QuestionnaireResponse)
        .where(QuestionnaireResponse.user_id == current_user.id)
    )
    responses = result.scalars().all()
    
    # Create a map of questionnaire ID to response status
    response_map: dict[int, dict[str, Any]] = {}
    for response in responses:
        if response.id not in response_map or (
            response.completed_at and 
            (not response_map[response.questionnaire_id]["completed_at"] or 
             response.completed_at > response_map[response.questionnaire_id]["completed_at"])
        ):
            response_map[response.questionnaire_id] = {
                "has_response": True,
                "is_completed": response.completed_at is not None,
                "last_updated": response.completed_at or response.started_at
            }
    
    # Build the response
    return [
        schemas.QuestionnaireClientResponse(
            id=q.id,
            title=q.title,
            description=q.description,
            type=q.type,
            has_response=response_map.get(q.id, {}).get("has_response", False),
            is_completed=response_map.get(q.id, {}).get("is_completed", False),
            last_updated=response_map.get(q.id, {}).get("last_updated")
        )
        for q in questionnaires
    ]

# Get all questionnaires
@router.get("", response_model=List[schemas.QuestionnaireResponse])
async def get_questionnaires(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    # For clients, only show questionnaires from their enrolled sessions
    if current_user.role == UserRole.CLIENT:
        # Get client's enrolled sessions
        session_query: Select = select(ClientSessionEnrollment.session_id).where(  # type: ignore
            ClientSessionEnrollment.client_id == current_user.id
        )
        result = await db.execute(session_query)
        enrolled_session_ids: Sequence[int] = [row[0] for row in result]
        
        # Get questionnaire instances for enrolled sessions
        if enrolled_session_ids:  # Only query if there are enrolled sessions
            instance_query: Select = select(QuestionnaireInstance).where(  # type: ignore
                QuestionnaireInstance.session_id.in_(enrolled_session_ids)  # type: ignore
            )
            result = await db.execute(instance_query)
            instances = result.scalars().all()
            
            # Get unique questionnaire IDs from instances
            questionnaire_ids = list(set(instance.questionnaire_id for instance in instances))
        else:
            instances = []
            questionnaire_ids = []
        
        # Get questionnaires
        if questionnaire_ids:  # Only query if there are questionnaire IDs
            questionnaire_query: Select = select(Questionnaire).where(  # type: ignore
                Questionnaire.id.in_(questionnaire_ids)  # type: ignore
            ).options(joinedload(Questionnaire.questions))
            result = await db.execute(questionnaire_query)
            questionnaires = result.scalars().unique().all()
        else:
            questionnaires = []
    else:
        # For trainers and admins, show all questionnaires
        admin_query: Select = select(Questionnaire).options(joinedload(Questionnaire.questions))  # type: ignore
        result = await db.execute(admin_query)
        questionnaires = result.scalars().unique().all()
    
    return [
        schemas.QuestionnaireResponse(
            id=q.id,
            title=q.title,
            description=q.description,
            type=q.type,
            is_paginated=q.is_paginated,
            requires_completion=q.requires_completion,
            created_at=q.created_at,
            updated_at=q.updated_at,
            created_by_id=q.created_by_id,
            question_count=len(q.questions)
        )
        for q in questionnaires
    ]

# Get single questionnaire with questions
@router.get("/{questionnaire_id}", response_model=schemas.QuestionnaireResponse)
async def get_questionnaire(
    questionnaire_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    result = await db.execute(
        select(Questionnaire)
        .where(Questionnaire.id == questionnaire_id)
        .options(joinedload(Questionnaire.questions))
    )
    questionnaire = result.unique().scalar_one_or_none()
    
    if not questionnaire:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Questionnaire not found"
        )
    
    # Convert questions to Pydantic models
    questions = [
        schemas.QuestionResponse(
            id=q.id,
            questionnaire_id=q.questionnaire_id,
            text=q.text,
            type=q.type,
            order=q.order,
            is_required=q.is_required,
            time_limit_seconds=q.time_limit_seconds,
            configuration=q.configuration,
            page_number=q.page_number
        )
        for q in sorted(questionnaire.questions, key=lambda x: (x.page_number, x.order))
    ]
    
    return schemas.QuestionnaireResponse(
        id=questionnaire.id,
        title=questionnaire.title,
        description=questionnaire.description,
        type=questionnaire.type,
        is_paginated=questionnaire.is_paginated,
        requires_completion=questionnaire.requires_completion,
        created_at=questionnaire.created_at,
        updated_at=questionnaire.updated_at,
        created_by_id=questionnaire.created_by_id,
        questions=questions
    )

# Update questionnaire
@router.patch("/{questionnaire_id}", response_model=schemas.MessageResponse)
async def update_questionnaire(
    questionnaire_id: int,
    update_data: schemas.QuestionnaireUpdate,
    current_user: User = Depends(check_admin_or_trainer),
    db: AsyncSession = Depends(get_async_session)
):
    result = await db.execute(
        select(Questionnaire)
        .where(Questionnaire.id == questionnaire_id)
    )
    questionnaire = result.scalar_one_or_none()
    
    if not questionnaire:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Questionnaire not found"
        )
    
    update_dict = update_data.dict(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(questionnaire, key, value)
    
    questionnaire.updated_at = datetime.now()
    await db.commit()
    
    return schemas.MessageResponse(message="Questionnaire updated successfully")

# Add question to questionnaire
@router.post("/{questionnaire_id}/questions", response_model=schemas.IdResponse)
async def add_question(
    questionnaire_id: int,
    question_data: schemas.QuestionCreate,
    current_user: User = Depends(check_admin_or_trainer),
    db: AsyncSession = Depends(get_async_session)
):
    result = await db.execute(
        select(Questionnaire)
        .where(Questionnaire.id == questionnaire_id)
    )
    questionnaire = result.scalar_one_or_none()
    
    if not questionnaire:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Questionnaire not found"
        )
    
    new_question = Question(
        questionnaire_id=questionnaire_id,
        **question_data.dict()
    )
    
    db.add(new_question)
    await db.commit()
    
    # Ensure id is not None before passing to IdResponse
    if new_question.id is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate question ID"
        )
    
    return schemas.IdResponse(id=new_question.id, message="Question added successfully")

# Update question
@router.patch("/{questionnaire_id}/questions/{question_id}", response_model=schemas.MessageResponse)
async def update_question(
    questionnaire_id: int,
    question_id: int,
    update_data: schemas.QuestionUpdate,
    current_user: User = Depends(check_admin_or_trainer),
    db: AsyncSession = Depends(get_async_session)
):
    result = await db.execute(
        select(Question)
        .where(
            (Question.id == question_id) & 
            (Question.questionnaire_id == questionnaire_id)
        )
    )
    question = result.scalar_one_or_none()
    
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found"
        )
    
    update_dict = update_data.dict(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(question, key, value)
    
    await db.commit()
    
    return schemas.MessageResponse(message="Question updated successfully")

# Delete question
@router.delete("/{questionnaire_id}/questions/{question_id}", response_model=schemas.MessageResponse)
async def delete_question(
    questionnaire_id: int,
    question_id: int,
    current_user: User = Depends(check_admin_or_trainer),
    db: AsyncSession = Depends(get_async_session)
):
    result = await db.execute(
        select(Question)
        .where(
            (Question.id == question_id) & 
            (Question.questionnaire_id == questionnaire_id)
        )
    )
    question = result.scalar_one_or_none()
    
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found"
        )
    
    await db.delete(question)
    await db.commit()
    
    return schemas.MessageResponse(message="Question deleted successfully")

# Start questionnaire response
@router.post("/{questionnaire_id}/start", response_model=schemas.QuestionnaireStartResponse)
async def start_questionnaire(
    questionnaire_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    # Check if questionnaire exists
    result = await db.execute(
        select(Questionnaire)
        .where(Questionnaire.id == questionnaire_id)
    )
    questionnaire = result.scalar_one_or_none()
    
    if not questionnaire:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Questionnaire not found"
        )
    
    # Check if user has an incomplete response
    result = await db.execute(
        select(QuestionnaireResponse)
        .where(
            (QuestionnaireResponse.questionnaire_id == questionnaire_id) &
            (QuestionnaireResponse.user_id == current_user.id) &
            (QuestionnaireResponse.completed_at == None)
        )
    )
    existing_response = result.scalar_one_or_none()
    
    if existing_response:
        # Ensure id is not None before passing to QuestionnaireStartResponse
        if existing_response.id is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Response ID is missing"
            )
        
        return schemas.QuestionnaireStartResponse(
            response_id=existing_response.id, 
            message="Continuing existing response"
        )
    
    # Create new response
    new_response = QuestionnaireResponse(
        questionnaire_id=questionnaire_id,
        user_id=current_user.id
    )
    
    # Add the new response and flush to get the ID without committing
    db.add(new_response)
    await db.flush()
    
    # Get the ID before committing
    response_id = new_response.id
    
    # Now commit the transaction
    await db.commit()
    
    # Ensure id is not None before passing to QuestionnaireStartResponse
    if response_id is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate response ID"
        )
    
    return schemas.QuestionnaireStartResponse(
        response_id=response_id, 
        message="Questionnaire response started"
    )

# Submit question response
@router.post("/{questionnaire_id}/responses/{response_id}/questions/{question_id}", response_model=schemas.QuestionResponseSubmitResponse)
async def submit_question_response(
    questionnaire_id: int,
    response_id: int,
    question_id: int,
    response_data: schemas.QuestionResponseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    # Verify questionnaire response belongs to user
    result = await db.execute(
        select(QuestionnaireResponse)
        .where(
            (QuestionnaireResponse.id == response_id) & 
            (QuestionnaireResponse.questionnaire_id == questionnaire_id) &
            (QuestionnaireResponse.user_id == current_user.id)
        )
        .join(Questionnaire)
    )
    questionnaire_response = result.scalar_one_or_none()
    
    if not questionnaire_response:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Questionnaire response not found"
        )
    
    if questionnaire_response.completed_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Questionnaire response already completed"
        )
    
    # Check if question exists and belongs to questionnaire
    result = await db.execute(
        select(Question)
        .where(
            (Question.id == question_id) & 
            (Question.questionnaire_id == questionnaire_id)
        )
    )
    question = result.scalar_one_or_none()
    
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found"
        )
    
    # Get or create question response
    result = await db.execute(
        select(QuestionResponse)
        .where(
            (QuestionResponse.question_id == question_id) &
            (QuestionResponse.questionnaire_response_id == response_id)
        )
    )
    question_response = result.scalar_one_or_none()
    
    if question_response:
        # Update existing response
        question_response.answer = response_data.answer
        question_response.last_updated_at = datetime.now()
        if response_data.interaction_batch_id:
            question_response.interaction_batch_id = response_data.interaction_batch_id
    else:
        # Create new response
        question_response = QuestionResponse(
            question_id=question_id,
            questionnaire_response_id=response_id,
            answer=response_data.answer,
            interaction_batch_id=response_data.interaction_batch_id
        )
        db.add(question_response)
    
    await db.commit()
    
    return schemas.QuestionResponseSubmitResponse(
        message="Response submitted successfully",
        saved=True
    )

# Complete questionnaire response
@router.post("/{questionnaire_id}/responses/{response_id}/complete", response_model=schemas.QuestionnaireCompleteResponse)
async def complete_questionnaire_response(
    questionnaire_id: int,
    response_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    # Verify questionnaire response belongs to user
    result = await db.execute(
        select(QuestionnaireResponse)
        .where(
            (QuestionnaireResponse.id == response_id) & 
            (QuestionnaireResponse.questionnaire_id == questionnaire_id) &
            (QuestionnaireResponse.user_id == current_user.id)
        )
        .join(Questionnaire)
    )
    questionnaire_response = result.scalar_one_or_none()
    
    if not questionnaire_response:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Questionnaire response not found"
        )
    
    if questionnaire_response.completed_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Questionnaire response already completed"
        )
    
    # If questionnaire requires completion, verify all required questions are answered
    if questionnaire_response.questionnaire.requires_completion:
        # Get all required questions
        result = await db.execute(
            select(Question)
            .where(
                (Question.questionnaire_id == questionnaire_id) &
                (Question.is_required == True)
            )
        )
        required_questions = result.scalars().all()
        
        # Get answered questions
        result = await db.execute(
            select(QuestionResponse)
            .where(QuestionResponse.questionnaire_response_id == response_id)
        )
        answered_questions = result.scalars().all()
        answered_question_ids = {r.question_id for r in answered_questions}
        
        # Check if all required questions are answered
        unanswered = [q for q in required_questions if q.id not in answered_question_ids]
        if unanswered:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Required questions not answered: {[q.id for q in unanswered]}"
            )
    
    # Mark as completed
    questionnaire_response.completed_at = datetime.now()
    await db.commit()
    
    # Trigger processing of the questionnaire response
    process_questionnaire_response.delay(questionnaire_response.id)
    
    return schemas.QuestionnaireCompleteResponse(message="Questionnaire response completed successfully") 