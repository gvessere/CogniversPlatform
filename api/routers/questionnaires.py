from typing import List, Optional, Dict, Any, cast, Sequence, Union
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, Column as SAColumn, distinct, text
from sqlalchemy.sql import Select, expression
from sqlalchemy.sql.elements import ColumnElement
from sqlalchemy.sql.selectable import FromClause, SelectBase
from datetime import datetime
from sqlalchemy.orm import joinedload

from database import get_async_session
from models.questionnaire import (
    Questionnaire, Question, QuestionnaireResponse, QuestionResponse,
    QuestionType, QuestionnaireType, ClientSessionEnrollment, QuestionnaireInstance,
    Session
)
from models.user import User, UserRole
from models.interaction import InteractionBatch
from auth.dependencies import get_current_user
from tasks import process_questionnaire_response
import schemas
from schemas import (
    QuestionnaireResponse as QuestionnaireResponseSchema,
    QuestionResponseCreate,
    QuestionnaireClientResponse,
    QuestionnaireAttemptResponse,
    QuestionnaireAttemptsResponse
)

# Helper function to convert type strings to QuestionnaireType enum
def try_convert_to_questionnaire_type(type_str: str) -> QuestionnaireType:
    try:
        if isinstance(type_str, QuestionnaireType):
            return type_str
        # Convert string type to lowercase and create enum instance
        type_value = str(type_str).lower()
        return QuestionnaireType(type_value)
    except (ValueError, TypeError):
        # If conversion fails, use a default
        return QuestionnaireType.SIGNUP

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
        number_of_attempts=questionnaire_data.number_of_attempts,
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
    
    # Create questionnaire instances for each session if provided
    if questionnaire_data.sessions:
        # Verify all sessions exist
        for session_id in questionnaire_data.sessions:
            session = await db.get(Session, session_id)
            if not session:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Session with ID {session_id} not found"
                )
        
        # Create questionnaire instances
        questionnaire_instances = [
            QuestionnaireInstance(
                title=new_questionnaire.title,
                questionnaire_id=new_questionnaire.id,
                session_id=session_id,
                is_active=False  # Default to inactive
            )
            for session_id in questionnaire_data.sessions
        ]
        
        db.add_all(questionnaire_instances)
    
    await db.commit()
    
    # Ensure id is not None before passing to IdResponse
    if new_questionnaire.id is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate questionnaire ID"
        )
    
    return schemas.IdResponse(id=new_questionnaire.id, message="Questionnaire created successfully")

# Get available questionnaires for the client
@router.get("/client", response_model=List[schemas.QuestionnaireClientResponse])
async def get_client_questionnaires(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get all questionnaires available for the current client"""
    
    try:
        # Get all questionnaires
        result = await db.execute(
            select(Questionnaire)
            .where(Questionnaire.type == QuestionnaireType.PRE_TEST)
        )
        questionnaires = result.scalars().all()
        
        # Get all responses for the current user
        result = await db.execute(
            select(QuestionnaireResponse)
            .where(QuestionnaireResponse.user_id == current_user.id)
        )
        user_responses = result.scalars().all()
        
        # Group responses by questionnaire
        responses_by_questionnaire: dict[int, list[QuestionnaireResponse]] = {}
        for response in user_responses:
            if response.questionnaire_id not in responses_by_questionnaire:
                responses_by_questionnaire[response.questionnaire_id] = []
            responses_by_questionnaire[response.questionnaire_id].append(response)
        
        # Create response for each questionnaire
        return [
            schemas.QuestionnaireClientResponse(
                id=questionnaire.id,
                title=questionnaire.title,
                description=questionnaire.description,
                type=questionnaire.type,
                has_response=questionnaire.id in responses_by_questionnaire,
                is_completed=any(r.completed_at is not None for r in responses_by_questionnaire.get(questionnaire.id, [])),
                last_updated=max((r.completed_at or r.started_at for r in responses_by_questionnaire.get(questionnaire.id, [])), default=None),
                completed_count=sum(1 for r in responses_by_questionnaire.get(questionnaire.id, []) if r.completed_at is not None),
                remaining_attempts=max(0, questionnaire.number_of_attempts - sum(1 for r in responses_by_questionnaire.get(questionnaire.id, []) if r.completed_at is not None)),
                attempts=[
                    schemas.QuestionnaireAttemptResponse(
                        id=attempt.id,  # type: ignore
                        questionnaire_id=attempt.questionnaire_id,
                        user_id=attempt.user_id,
                        started_at=attempt.started_at,
                        completed_at=attempt.completed_at,
                        attempt_number=attempt.attempt_number
                    )
                    for attempt in responses_by_questionnaire.get(questionnaire.id, [])
                ]
            )
            for questionnaire in questionnaires
        ]
    except Exception as e:
        import traceback
        print(f"Error in get_client_questionnaires: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve client questionnaires: {str(e)}"
        )

# Get all questionnaires
@router.get("", response_model=List[QuestionnaireResponseSchema])
async def get_questionnaires(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    # For clients, only show questionnaires from their enrolled sessions
    if current_user.role == UserRole.CLIENT:
        enrolled_sessions_query = text("""
            SELECT session_id FROM client_session_enrollments
            WHERE client_id = :client_id
        """)
        
        enrolled_sessions_result = await db.execute(enrolled_sessions_query, {"client_id": current_user.id})
        enrolled_session_ids = [row[0] for row in enrolled_sessions_result.all()]
        
        if not enrolled_session_ids:
            return []
        
        questionnaire_instances_query = text("""
            SELECT questionnaire_id FROM questionnaire_instances
            WHERE session_id = ANY(:session_ids) AND is_active = TRUE
        """)
        
        questionnaire_instances_result = await db.execute(
            questionnaire_instances_query, 
            {"session_ids": enrolled_session_ids}
        )
        questionnaire_ids = [row[0] for row in questionnaire_instances_result.all()]
        
        if not questionnaire_ids:
            return []
        
        # Use a simpler query with text() to avoid SQLAlchemy type issues
        query = text("""
            SELECT q.*, 
                   COUNT(DISTINCT qu.id) as question_count,
                   COUNT(DISTINCT qi.id) as session_count
            FROM questionnaires q
            LEFT JOIN questions qu ON q.id = qu.questionnaire_id
            LEFT JOIN questionnaire_instances qi ON q.id = qi.questionnaire_id
            WHERE q.id = ANY(:questionnaire_ids)
            GROUP BY q.id
            ORDER BY q.created_at DESC
        """)
        
        result = await db.execute(query, {"questionnaire_ids": questionnaire_ids})
    else:
        # Admin and trainers see all questionnaires
        query = text("""
            SELECT q.*, 
                   COUNT(DISTINCT qu.id) as question_count,
                   COUNT(DISTINCT qi.id) as session_count
            FROM questionnaires q
            LEFT JOIN questions qu ON q.id = qu.questionnaire_id
            LEFT JOIN questionnaire_instances qi ON q.id = qi.questionnaire_id
            GROUP BY q.id
            ORDER BY q.created_at DESC
        """)
        
        result = await db.execute(query)
    
    # Extract questionnaires with their question counts
    questionnaires_with_counts = result.all()
    
    # Convert to response format
    response_data = []
    for row in questionnaires_with_counts:
        try:
            # Safely extract and convert the type value
            type_value = None
            try:
                if hasattr(row, 'type') and row.type is not None:
                    if isinstance(row.type, QuestionnaireType):
                        type_value = row.type
                    else:
                        # Convert string type to lowercase and create enum instance
                        type_str = str(row.type).lower()
                        type_value = QuestionnaireType(type_str)
                else:
                    # Default if type is missing
                    type_value = QuestionnaireType.SIGNUP
            except (ValueError, TypeError):
                # If conversion fails, use a default
                type_value = QuestionnaireType.SIGNUP
            
            response_data.append(
                QuestionnaireResponseSchema(
                    id=row.id,
                    title=row.title,
                    description=row.description,
                    type=type_value,
                    is_paginated=row.is_paginated,
                    requires_completion=row.requires_completion,
                    created_at=row.created_at,
                    created_by_id=row.created_by_id,
                    question_count=row.question_count,
                    session_count=row.session_count,
                    questions=[],  # We're not loading questions here for performance
                    number_of_attempts=row.number_of_attempts
                )
            )
        except Exception as e:
            print(f"Error processing questionnaire row: {e}")
            # Continue to the next row if there's an error
            continue
    
    return response_data

# Get single questionnaire with questions
@router.get("/{questionnaire_id}", response_model=QuestionnaireResponseSchema)
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
    
    # Get associated sessions
    result = await db.execute(
        select(QuestionnaireInstance)
        .where(QuestionnaireInstance.questionnaire_id == questionnaire_id)
    )
    instances = result.scalars().all()
    session_ids = [instance.session_id for instance in instances]
    
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
    
    # Safely extract and convert the type value
    type_value = None
    try:
        if hasattr(questionnaire, 'type') and questionnaire.type is not None:
            if isinstance(questionnaire.type, QuestionnaireType):
                type_value = questionnaire.type
            elif isinstance(questionnaire.type, str):
                type_value = QuestionnaireType(questionnaire.type)
    except (ValueError, TypeError) as e:
        # Log the error but continue with a default value
        print(f"Error converting questionnaire type: {e}")
        type_value = QuestionnaireType.SIGNUP  # Default value
    
    # Create the response with session information
    response = QuestionnaireResponseSchema(
        id=questionnaire.id,
        title=questionnaire.title,
        description=questionnaire.description,
        type=type_value or QuestionnaireType.SIGNUP,
        is_paginated=questionnaire.is_paginated,
        requires_completion=questionnaire.requires_completion,
        created_at=questionnaire.created_at,
        created_by_id=questionnaire.created_by_id,
        question_count=len(questions),
        session_count=len(session_ids),
        sessions=session_ids,
        questions=questions,
        number_of_attempts=questionnaire.number_of_attempts
    )
    
    return response

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
        .options(joinedload(Questionnaire.questions))
    )
    questionnaire = result.unique().scalar_one_or_none()
    
    if not questionnaire:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Questionnaire not found"
        )
    
    # Handle basic questionnaire updates
    update_dict = update_data.dict(exclude_unset=True, exclude={"sessions", "questions"})
    for key, value in update_dict.items():
        setattr(questionnaire, key, value)
    
    questionnaire.updated_at = datetime.now()
    
    # Handle session associations if provided
    if update_data.sessions is not None:
        # Get current questionnaire instances
        result = await db.execute(
            select(QuestionnaireInstance)
            .where(QuestionnaireInstance.questionnaire_id == questionnaire_id)
        )
        current_instances = result.scalars().all()
        
        # Get current session IDs
        current_session_ids = {instance.session_id for instance in current_instances}
        
        # Determine which sessions to add and which to remove
        new_session_ids = set(update_data.sessions)
        sessions_to_add = new_session_ids - current_session_ids
        sessions_to_remove = current_session_ids - new_session_ids
        
        # Verify all new sessions exist
        for session_id in sessions_to_add:
            session = await db.get(Session, session_id)
            if not session:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Session with ID {session_id} not found"
                )
        
        # Remove instances for sessions no longer associated
        for instance in current_instances:
            if instance.session_id in sessions_to_remove:
                await db.delete(instance)
        
        # Add new instances for newly associated sessions
        new_instances = [
            QuestionnaireInstance(
                title=questionnaire.title,
                questionnaire_id=questionnaire_id,
                session_id=session_id,
                is_active=False  # Default to inactive
            )
            for session_id in sessions_to_add
        ]
        
        db.add_all(new_instances)
    
    # Handle questions if provided
    if update_data.questions is not None:
        # Create a map of current questions by ID
        current_questions_by_id = {q.id: q for q in questionnaire.questions}
        
        # Track which questions have been processed
        processed_question_ids = set()
        
        # Process each question in the update data
        for i, question_data in enumerate(update_data.questions):
            # Check if this is an existing question (has ID) or a new one
            question_dict = question_data.dict(exclude_unset=True)
            question_id = question_dict.get('id')
            
            # Handle existing question
            if question_id is not None and question_id in current_questions_by_id:
                existing_question = current_questions_by_id[question_id]
                # Update existing question
                for key, value in question_dict.items():
                    if key != 'id' and key != 'questionnaire_id':
                        setattr(existing_question, key, value)
                processed_question_ids.add(existing_question.id)
            else:
                # Create new question
                new_question = Question(
                    questionnaire_id=questionnaire_id,
                    order=i + 1
                )
                
                for key, value in question_dict.items():
                    if key != 'id' and key != 'questionnaire_id':
                        setattr(new_question, key, value)
                
                db.add(new_question)
        
        # Check for questions to delete (ones not included in the update)
        for question_id, question in current_questions_by_id.items():
            if question_id not in processed_question_ids:
                # Check if this question has any responses before deleting
                result = await db.execute(
                    select(func.count(QuestionResponse.id))
                    .where(QuestionResponse.question_id == question_id)
                )
                response_count = result.scalar_one()
                
                if response_count == 0:
                    # Safe to delete
                    await db.delete(question)
    
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
            message="Continuing existing response",
            is_new_attempt=False
        )
    
    # Get the next attempt number for this questionnaire and user
    result = await db.execute(
        select(func.coalesce(func.max(QuestionnaireResponse.attempt_number), 0) + 1)
        .where(
            (QuestionnaireResponse.questionnaire_id == questionnaire_id) &
            (QuestionnaireResponse.user_id == current_user.id)
        )
    )
    next_attempt_number = result.scalar_one()
    
    # Check if user has reached the maximum number of attempts
    # Use getattr with default value in case number_of_attempts is not defined
    number_of_attempts = getattr(questionnaire, "number_of_attempts", 1)
    if next_attempt_number > number_of_attempts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum number of attempts ({number_of_attempts}) reached"
        )
    
    # Create new response
    new_response = QuestionnaireResponse(
        questionnaire_id=questionnaire_id,
        user_id=current_user.id,
        attempt_number=next_attempt_number
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
        message="Questionnaire response started",
        is_new_attempt=True
    )

# Submit question response
@router.post("/{questionnaire_id}/responses/{response_id}/questions/{question_id}", response_model=schemas.QuestionResponseSubmitResponse)
async def submit_question_response(
    questionnaire_id: int,
    response_id: int,
    question_id: int,
    response_data: QuestionResponseCreate,
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
            detail="Cannot modify answers for a completed questionnaire"
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
        # Create new response with question details
        question_response = QuestionResponse(
            question_id=question_id,
            questionnaire_response_id=response_id,
            question_text=question.text,
            question_type=question.type,
            question_configuration=question.configuration,
            answer=response_data.answer,
            interaction_batch_id=response_data.interaction_batch_id
        )
        db.add(question_response)
    
    await db.commit()
    
    return schemas.QuestionResponseSubmitResponse(
        question_id=question_id,
        question_text=question.text,
        question_type=question.type,
        question_configuration=question.configuration,
        answer=response_data.answer,
        interaction_batch_id=response_data.interaction_batch_id,
        started_at=question_response.started_at,
        last_updated_at=question_response.last_updated_at,
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
        .options(joinedload(QuestionnaireResponse.questionnaire))
    )
    questionnaire_response = result.unique().scalar_one_or_none()
    
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
    
    return schemas.QuestionnaireCompleteResponse(
        message="Questionnaire response completed successfully",
        completed=True,
        completed_at=questionnaire_response.completed_at
    )

# Delete questionnaire
@router.delete("/{questionnaire_id}", response_model=schemas.MessageResponse)
async def delete_questionnaire(
    questionnaire_id: int,
    current_user: User = Depends(check_admin_or_trainer),
    db: AsyncSession = Depends(get_async_session)
):
    # Get the questionnaire
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
    
    # Check if questionnaire is associated with any sessions
    count_query = text("""
        SELECT COUNT(id) FROM questionnaire_instances
        WHERE questionnaire_id = :questionnaire_id
    """)
    result = await db.execute(count_query, {"questionnaire_id": questionnaire_id})
    session_count = result.scalar_one()
    
    if session_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete questionnaire that is associated with sessions"
        )
    
    # Delete the questionnaire
    await db.delete(questionnaire)
    await db.commit()
    
    return schemas.MessageResponse(message="Questionnaire deleted successfully")

# Get sessions associated with a questionnaire
@router.get("/{questionnaire_id}/sessions", response_model=schemas.QuestionnaireSessionsResponse)
async def get_questionnaire_sessions(
    questionnaire_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    # Get the questionnaire
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
    
    # Get sessions associated with this questionnaire
    query = text("""
        SELECT s.*
        FROM sessions s
        JOIN questionnaire_instances qi ON s.id = qi.session_id
        WHERE qi.questionnaire_id = :questionnaire_id
        ORDER BY s.start_date DESC
    """)
    
    result = await db.execute(query, {"questionnaire_id": questionnaire_id})
    sessions = result.all()
    
    # Count how many sessions are associated
    session_count = len(sessions)
    
    # Map sessions to response format
    session_list = [
        schemas.SessionBasicInfo(
            id=session.id,
            title=session.title,
            start_date=session.start_date,
            end_date=session.end_date
        )
        for session in sessions
    ]
    
    return schemas.QuestionnaireSessionsResponse(
        sessions=session_list,
        session_count=session_count
    )

# Clone questionnaire
@router.post("/{questionnaire_id}/clone", response_model=schemas.IdResponse)
async def clone_questionnaire(
    questionnaire_id: int,
    current_user: User = Depends(check_admin_or_trainer),
    db: AsyncSession = Depends(get_async_session)
):
    # Get the questionnaire to clone
    result = await db.execute(
        select(Questionnaire)
        .options(joinedload(Questionnaire.questions))
        .where(Questionnaire.id == questionnaire_id)
    )
    questionnaire = result.scalar_one_or_none()
    
    if not questionnaire:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Questionnaire not found"
        )
    
    # Create a new questionnaire with the same data
    new_questionnaire = Questionnaire(
        title=f"{questionnaire.title} (Clone)",
        description=questionnaire.description,
        type=questionnaire.type,
        is_paginated=questionnaire.is_paginated,
        requires_completion=questionnaire.requires_completion,
        number_of_attempts=questionnaire.number_of_attempts,
        created_by_id=current_user.id
    )
    
    db.add(new_questionnaire)
    await db.flush()  # Get the ID without committing
    
    # Clone the questions
    for question in questionnaire.questions:
        new_question = Question(
            questionnaire_id=new_questionnaire.id,
            text=question.text,
            type=question.type,
            order=question.order,
            is_required=question.is_required,
            time_limit_seconds=question.time_limit_seconds,
            configuration=question.configuration,
            page_number=question.page_number
        )
        db.add(new_question)
    
    await db.commit()
    
    # Ensure id is not None before passing to IdResponse
    if new_questionnaire.id is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate questionnaire ID"
        )
    
    return schemas.IdResponse(id=new_questionnaire.id, message="Questionnaire cloned successfully") 

# Get attempts for a questionnaire
@router.get("/{questionnaire_id}/attempts", response_model=schemas.QuestionnaireAttemptsResponse)
async def get_questionnaire_attempts(
    questionnaire_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get all attempts for a questionnaire by the current user"""
    
    try:
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
        
        # Get all attempts for this user and questionnaire
        result = await db.execute(
            select(QuestionnaireResponse)
            .where(
                (QuestionnaireResponse.questionnaire_id == questionnaire_id) &
                (QuestionnaireResponse.user_id == current_user.id)
            )
            .order_by(QuestionnaireResponse.started_at.desc())
        )
        attempts = result.scalars().all()
        
        # Count completed attempts
        completed_count = sum(1 for attempt in attempts if attempt.completed_at is not None)
        
        # Calculate remaining attempts with fallback to default
        number_of_attempts = getattr(questionnaire, "number_of_attempts", 1)
        remaining_attempts = max(0, number_of_attempts - completed_count)
        
        # Convert to response format
        attempt_responses = [
            schemas.QuestionnaireAttemptResponse(
                id=attempt.id,
                questionnaire_id=attempt.questionnaire_id,
                user_id=attempt.user_id,
                started_at=attempt.started_at,
                completed_at=attempt.completed_at,
                attempt_number=attempt.attempt_number
            )
            for attempt in attempts
        ]
        
        return schemas.QuestionnaireAttemptsResponse(
            attempts=attempt_responses,
            completed_count=completed_count,
            remaining_attempts=remaining_attempts
        )
    except Exception as e:
        import traceback
        print(f"Error in get_questionnaire_attempts: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve questionnaire attempts: {str(e)}"
        )

# Get specific questionnaire response
@router.get("/{questionnaire_id}/responses/{response_id}", response_model=schemas.QuestionnaireAttemptResponse)
async def get_questionnaire_response(
    questionnaire_id: int,
    response_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get a specific questionnaire response"""
    
    # Verify questionnaire response belongs to user
    result = await db.execute(
        select(QuestionnaireResponse)
        .where(
            (QuestionnaireResponse.id == response_id) & 
            (QuestionnaireResponse.questionnaire_id == questionnaire_id) &
            (QuestionnaireResponse.user_id == current_user.id)
        )
        .options(joinedload(QuestionnaireResponse.question_responses))
    )
    questionnaire_response = result.unique().scalar_one_or_none()
    
    if not questionnaire_response:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Questionnaire response not found"
        )
    
    # Convert question responses to a dictionary
    responses = {}
    for qr in questionnaire_response.question_responses:
        responses[str(qr.question_id)] = {
            "answer": qr.answer,
            "interactionBatchId": qr.interaction_batch_id,
            "question_text": qr.question_text
        }
    
    return {
        "id": questionnaire_response.id,
        "questionnaire_id": questionnaire_response.questionnaire_id,
        "user_id": questionnaire_response.user_id,
        "started_at": questionnaire_response.started_at,
        "completed_at": questionnaire_response.completed_at,
        "attempt_number": questionnaire_response.attempt_number,
        "responses": responses
    }

# Create question response
@router.post("/{questionnaire_id}/responses/{response_id}/questions", response_model=schemas.IdResponse)
async def create_question_response(
    questionnaire_id: int,
    response_id: int,
    question_response: QuestionResponseCreate,
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
            detail="Cannot modify answers for a completed questionnaire"
        )
    
    # Check if question exists and belongs to questionnaire
    result = await db.execute(
        select(Question)
        .where(
            (Question.id == question_response.question_id) & 
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
            (QuestionResponse.question_id == question_response.question_id) &
            (QuestionResponse.questionnaire_response_id == response_id)
        )
    )
    existing_question_response = result.scalar_one_or_none()
    
    if existing_question_response:
        # Update existing response
        existing_question_response.answer = question_response.answer
        existing_question_response.last_updated_at = datetime.now()
        if question_response.interaction_batch_id:
            existing_question_response.interaction_batch_id = question_response.interaction_batch_id
    else:
        # Create new response with question details
        new_question_response = QuestionResponse(
            question_id=question_response.question_id,
            questionnaire_response_id=response_id,
            question_text=question.text,
            question_type=question.type,
            question_configuration=question.configuration,
            answer=question_response.answer,
            interaction_batch_id=question_response.interaction_batch_id
        )
        db.add(new_question_response)
    
    await db.commit()
    
    # Ensure id is not None before passing to IdResponse
    if new_question_response.id is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate question response ID"
        )
    
    return schemas.IdResponse(id=new_question_response.id, message="Question response created successfully") 