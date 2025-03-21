from typing import List, Optional, Dict, Any, cast, Sequence, Union
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, Column as SAColumn, distinct, text, or_, and_
from sqlalchemy.sql import Select, expression, ClauseElement
from sqlalchemy.sql.elements import ColumnElement
from sqlalchemy.sql.selectable import FromClause, SelectBase
from datetime import datetime
from sqlalchemy.orm import joinedload

from database import get_async_session
from models.questionnaire import (
    Questionnaire as QuestionnaireModel,
    Question as QuestionModel,
    QuestionnaireResponse as QuestionnaireResponseModel,
    QuestionResponse as QuestionResponseModel,
    QuestionType, QuestionnaireType, ClientSessionEnrollment, QuestionnaireInstance,
    Session
)
from models.processors import (
    QuestionnaireProcessorMapping, QuestionProcessorMapping, TaskDefinition
)
from models.user import User, UserRole
from models.interaction import InteractionBatch
from auth.dependencies import get_current_user
from tasks import process_questionnaire_response
import schemas

# Import response schemas
from schemas import QuestionnaireResponse, PaginatedResponse

# Create a router for questionnaire responses
responses_router = APIRouter(prefix="/responses", tags=["questionnaire-responses"])

# Count questionnaire responses
@responses_router.get("/count", response_model=schemas.CountResponse)
async def count_questionnaire_responses(
    questionnaire_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Count questionnaire responses with optional filtering."""
    # Build base query
    base_query = select(func.count()).select_from(QuestionnaireResponseModel)

    # Apply filters
    if questionnaire_id:
        base_query = base_query.where(QuestionnaireResponseModel.questionnaire_id == questionnaire_id)

    # Execute query
    count = await db.scalar(base_query) or 0  # Default to 0 if count is None

    return schemas.CountResponse(count=count)

# List all questionnaire responses
@responses_router.get("", response_model=schemas.PaginatedResponse[schemas.QuestionnaireResponseListItem])
async def list_questionnaire_responses(
    page: int = 1,
    limit: int = 10,
    session_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    user_name: Optional[str] = None,
    user_email: Optional[str] = None,
    questionnaire_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """List questionnaire responses with filtering options."""
    # Build base query
    base_query = (
        select(QuestionnaireResponseModel)
        .join(User)
        .join(QuestionnaireModel, isouter=False)  # Ensure inner join for questionnaire
        .outerjoin(QuestionnaireInstance)
        .outerjoin(Session)
        .options(
            joinedload(QuestionnaireResponseModel.user),
            joinedload(QuestionnaireResponseModel.questionnaire),
            joinedload(QuestionnaireResponseModel.questionnaire_instance).joinedload(QuestionnaireInstance.session),
            joinedload(QuestionnaireResponseModel.question_responses).joinedload(QuestionResponseModel.question)
        )
    )

    # Apply filters
    if session_id:
        base_query = base_query.where(Session.id == session_id)
    
    if start_date:
        base_query = base_query.where(QuestionnaireResponseModel.started_at >= start_date)
    
    if end_date:
        base_query = base_query.where(QuestionnaireResponseModel.started_at <= end_date)
    
    if user_name:
        base_query = base_query.where(
            or_(
                User.first_name.ilike(f"%{user_name}%"),
                User.last_name.ilike(f"%{user_name}%")
            )
        )
    
    if user_email:
        base_query = base_query.where(User.email.ilike(f"%{user_email}%"))
    
    if questionnaire_id:
        base_query = base_query.where(QuestionnaireResponseModel.questionnaire_id == questionnaire_id)

    # Count total responses
    count_query = select(func.count()).select_from(base_query.subquery())
    total = await db.scalar(count_query) or 0  # Default to 0 if count is None

    # Apply pagination
    base_query = base_query.offset((page - 1) * limit).limit(limit)

    # Execute query
    result = await db.execute(base_query)
    responses = result.unique().scalars().all()

    # Convert to response format with error handling
    items = []
    for response in responses:
        try:
            # Validate questionnaire data
            if not response.questionnaire:
                print(f"Warning: Response {response.id} has no associated questionnaire")
                continue

            # Validate required questionnaire fields
            required_fields = ['id', 'title', 'description', 'type', 'is_paginated', 'requires_completion', 'number_of_attempts']
            missing_fields = [field for field in required_fields if not hasattr(response.questionnaire, field)]
            if missing_fields:
                print(f"Warning: Response {response.id} questionnaire is missing required fields: {missing_fields}")
                continue

            items.append(schemas.QuestionnaireResponseListItem(
                id=response.id,
                questionnaire_id=response.questionnaire_id,
                session_id=response.questionnaire_instance.session_id if response.questionnaire_instance else None,
                user_id=response.user_id,
                status="completed" if response.completed_at else "in_progress",
                created_at=response.started_at,
                updated_at=response.completed_at or response.started_at,
                user=response.user,
                questionnaire=schemas.QuestionnaireBasicInfo(
                    id=response.questionnaire.id,
                    title=response.questionnaire.title,
                    description=response.questionnaire.description,
                    type=response.questionnaire.type,
                    is_paginated=response.questionnaire.is_paginated,
                    requires_completion=response.questionnaire.requires_completion,
                    number_of_attempts=response.questionnaire.number_of_attempts
                ),
                session=response.questionnaire_instance.session if response.questionnaire_instance else None,
                answers=[
                    schemas.QuestionResponseListItem(
                        id=answer.id,
                        question_id=answer.question_id,
                        questionnaire_response_id=answer.questionnaire_response_id,
                        question_text=answer.question.text,
                        question_type=answer.question.type,
                        question_configuration=answer.question.configuration,
                        answer=answer.answer,
                        started_at=answer.started_at,
                        last_updated_at=answer.last_updated_at,
                        completed_at=answer.completed_at
                    )
                    for answer in response.question_responses
                ]
            ))
        except Exception as e:
            print(f"Error processing response {response.id}: {str(e)}")
            continue

    return schemas.PaginatedResponse(
        items=items,
        total=total,
        page=page,
        limit=limit
    )

# Create the main router
router = APIRouter(prefix="/questionnaires", tags=["questionnaires"])

# Include the responses router
router.include_router(responses_router)

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
    new_questionnaire = QuestionnaireModel(
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
        QuestionModel(
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
        # Get all questionnaires from active instances in the client's enrolled sessions
        query = text("""
            SELECT DISTINCT q.*
            FROM questionnaires q
            JOIN questionnaire_instances qi ON q.id = qi.questionnaire_id
            JOIN client_session_enrollments cse ON qi.session_id = cse.session_id
            WHERE cse.client_id = :client_id
            AND qi.is_active = true
        """)
        
        result = await db.execute(query, {"client_id": current_user.id})
        questionnaires = result.all()
        
        # Get all responses for the current user
        result = await db.execute(
            select(QuestionnaireResponseModel)
            .where(QuestionnaireResponseModel.user_id == current_user.id)
        )
        user_responses = result.scalars().all()
        
        # Group responses by questionnaire
        responses_by_questionnaire: dict[int, list[QuestionnaireResponseModel]] = {}
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
                type=questionnaire.type.lower(),  # Convert to lowercase
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
@router.get("", response_model=List[schemas.QuestionnaireResponse])
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
                schemas.QuestionnaireResponse(
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
@router.get("/{questionnaire_id}", response_model=schemas.QuestionnaireResponse)
async def get_questionnaire(
    questionnaire_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    result = await db.execute(
        select(QuestionnaireModel)
        .where(QuestionnaireModel.id == questionnaire_id)
        .options(joinedload(QuestionnaireModel.questions))
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
    response = schemas.QuestionnaireResponse(
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
        select(QuestionnaireModel)
        .where(QuestionnaireModel.id == questionnaire_id)
        .options(joinedload(QuestionnaireModel.questions))
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
                new_question = QuestionModel(
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
                    select(func.count(QuestionResponseModel.id))
                    .where(QuestionResponseModel.question_id == question_id)
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
        select(QuestionnaireModel)
        .where(QuestionnaireModel.id == questionnaire_id)
    )
    questionnaire = result.scalar_one_or_none()
    
    if not questionnaire:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Questionnaire not found"
        )
    
    new_question = QuestionModel(
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
        select(QuestionModel)
        .where(
            (QuestionModel.id == question_id) & 
            (QuestionModel.questionnaire_id == questionnaire_id)
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
        select(QuestionModel)
        .where(
            (QuestionModel.id == question_id) & 
            (QuestionModel.questionnaire_id == questionnaire_id)
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
        select(QuestionnaireModel)
        .where(QuestionnaireModel.id == questionnaire_id)
    )
    questionnaire = result.scalar_one_or_none()
    
    if not questionnaire:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Questionnaire not found"
        )
    
    # Check if user has an incomplete response
    result = await db.execute(
        select(QuestionnaireResponseModel)
        .where(
            (QuestionnaireResponseModel.questionnaire_id == questionnaire_id) &
            (QuestionnaireResponseModel.user_id == current_user.id) &
            (QuestionnaireResponseModel.completed_at == None)
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
        select(func.coalesce(func.max(QuestionnaireResponseModel.attempt_number), 0) + 1)
        .where(
            (QuestionnaireResponseModel.questionnaire_id == questionnaire_id) &
            (QuestionnaireResponseModel.user_id == current_user.id)
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
    new_response = QuestionnaireResponseModel(
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
    response_data: schemas.QuestionResponseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    # Verify questionnaire response belongs to user
    result = await db.execute(
        select(QuestionnaireResponseModel)
        .where(
            (QuestionnaireResponseModel.id == response_id) & 
            (QuestionnaireResponseModel.questionnaire_id == questionnaire_id) &
            (QuestionnaireResponseModel.user_id == current_user.id)
        )
        .join(QuestionnaireModel)
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
        select(QuestionModel)
        .where(
            (QuestionModel.id == question_id) & 
            (QuestionModel.questionnaire_id == questionnaire_id)
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
        select(QuestionResponseModel)
        .where(
            (QuestionResponseModel.question_id == question_id) &
            (QuestionResponseModel.questionnaire_response_id == response_id)
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
        question_response = QuestionResponseModel(
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
        select(QuestionnaireResponseModel)
        .where(
            (QuestionnaireResponseModel.id == response_id) & 
            (QuestionnaireResponseModel.questionnaire_id == questionnaire_id) &
            (QuestionnaireResponseModel.user_id == current_user.id)
        )
        .join(QuestionnaireModel)
        .options(joinedload(QuestionnaireResponseModel.questionnaire))
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
            select(QuestionModel)
            .where(
                (QuestionModel.questionnaire_id == questionnaire_id) &
                (QuestionModel.is_required == True)
            )
        )
        required_questions = result.scalars().all()
        
        # Get answered questions
        result = await db.execute(
            select(QuestionResponseModel)
            .where(QuestionResponseModel.questionnaire_response_id == response_id)
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
        select(QuestionnaireModel)
        .where(QuestionnaireModel.id == questionnaire_id)
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
        select(QuestionnaireModel)
        .where(QuestionnaireModel.id == questionnaire_id)
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
        select(QuestionnaireModel)
        .options(joinedload(QuestionnaireModel.questions))
        .where(QuestionnaireModel.id == questionnaire_id)
    )
    questionnaire = result.scalar_one_or_none()
    
    if not questionnaire:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Questionnaire not found"
        )
    
    # Create a new questionnaire with the same data
    new_questionnaire = QuestionnaireModel(
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
        new_question = QuestionModel(
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
            select(QuestionnaireModel)
            .where(QuestionnaireModel.id == questionnaire_id)
        )
        questionnaire = result.scalar_one_or_none()
        
        if not questionnaire:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Questionnaire not found"
            )
        
        # Get all attempts for this user and questionnaire
        result = await db.execute(
            select(QuestionnaireResponseModel)
            .where(
                (QuestionnaireResponseModel.questionnaire_id == questionnaire_id) &
                (QuestionnaireResponseModel.user_id == current_user.id)
            )
            .order_by(QuestionnaireResponseModel.started_at.desc())
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
        select(QuestionnaireResponseModel)
        .where(
            (QuestionnaireResponseModel.id == response_id) & 
            (QuestionnaireResponseModel.questionnaire_id == questionnaire_id) &
            (QuestionnaireResponseModel.user_id == current_user.id)
        )
        .options(joinedload(QuestionnaireResponseModel.question_responses))
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

# Get responses count for a specific questionnaire
@router.get("/{questionnaire_id}/responses/count", response_model=schemas.CountResponse)
async def get_questionnaire_responses_count(
    questionnaire_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get the count of responses for a questionnaire."""
    # Check if user has access to this questionnaire
    result = await db.execute(
        select(QuestionnaireModel)
        .where(QuestionnaireModel.id == questionnaire_id)
    )
    questionnaire = result.scalar_one_or_none()
    
    if not questionnaire:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Questionnaire not found"
        )
    
    # Get the count of responses
    result = await db.execute(
        select(func.count(QuestionnaireResponseModel.id))
        .where(QuestionnaireResponseModel.questionnaire_id == questionnaire_id)
    )
    count = result.scalar()
    
    return schemas.CountResponse(count=count)

# Get processor mappings for a questionnaire
@router.get("/{questionnaire_id}/processors", response_model=List[schemas.QuestionnaireProcessorMappingResponse])
async def get_questionnaire_processors(
    questionnaire_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get all processor mappings for a specific questionnaire"""
    # Get the questionnaire
    result = await db.execute(
        select(QuestionnaireModel)
        .where(QuestionnaireModel.id == questionnaire_id)
    )
    questionnaire = result.scalar_one_or_none()
    
    if not questionnaire:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Questionnaire not found"
        )
    
    # Get processor mappings
    result = await db.execute(
        select(QuestionnaireProcessorMapping)
        .where(QuestionnaireProcessorMapping.questionnaire_id == questionnaire_id)
        .options(joinedload(QuestionnaireProcessorMapping.processor))
    )
    mappings = result.unique().scalars().all()
    
    return mappings

# Get question processor mappings for a questionnaire
@router.get("/{questionnaire_id}/question-processors", response_model=List[schemas.QuestionProcessorMappingResponse])
async def get_question_processors(
    questionnaire_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get all question processor mappings for a specific questionnaire"""
    # Get the questionnaire
    result = await db.execute(
        select(QuestionnaireModel)
        .where(QuestionnaireModel.id == questionnaire_id)
    )
    questionnaire = result.scalar_one_or_none()
    
    if not questionnaire:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Questionnaire not found"
        )
    
    # Get question processor mappings
    result = await db.execute(
        select(QuestionProcessorMapping)
        .join(QuestionModel)
        .where(QuestionModel.questionnaire_id == questionnaire_id)
        .options(joinedload(QuestionProcessorMapping.processor))
    )
    mappings = result.unique().scalars().all()
    
    return mappings

# Get task definitions for a questionnaire
@router.get("/{questionnaire_id}/task-definitions", response_model=List[schemas.TaskDefinitionResponse])
async def get_task_definitions(
    questionnaire_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get all task definitions for a questionnaire."""
    # Get questionnaire
    questionnaire = await db.get(QuestionnaireModel, questionnaire_id)
    if not questionnaire:
        raise HTTPException(status_code=404, detail="Questionnaire not found")

    # Check if user has access to this questionnaire
    if current_user.role != UserRole.ADMINISTRATOR and questionnaire.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this questionnaire")

    # Get task definitions with question mappings
    query = (
        select(TaskDefinition)
        .where(TaskDefinition.questionnaire_id == questionnaire_id)
        .options(
            joinedload(TaskDefinition.question_mappings).joinedload(QuestionProcessorMapping.question)
    )
    )
    result = await db.execute(query)
    task_definitions = result.unique().scalars().all()

    # Convert to response format
    return [
        schemas.TaskDefinitionResponse(
            id=td.id,
            processor_id=td.processor_id,
            questionnaire_id=td.questionnaire_id,
            is_active=td.is_active,
            created_at=td.created_at,
            updated_at=td.updated_at,
            question_ids=[qm.question_id for qm in td.question_mappings]
        )
        for td in task_definitions
    ]

@router.delete("/task-definitions/{task_definition_id}", response_model=schemas.MessageResponse)
async def delete_task_definition(
    task_definition_id: int,
    current_user: User = Depends(check_admin_or_trainer),
    db: AsyncSession = Depends(get_async_session)
):
    """Delete a task definition and all its associated question processor mappings."""
    # First find the task definition
    result = await db.execute(
        select(TaskDefinition)
        .where(TaskDefinition.id == task_definition_id)
    )
    task_definition = result.scalar_one_or_none()
    
    if not task_definition:
        raise HTTPException(status_code=404, detail="Task definition not found")
    
    # Get all mappings for this task definition
    result = await db.execute(
        select(QuestionProcessorMapping)
        .where(QuestionProcessorMapping.task_definition_id == task_definition_id)
    )
    mappings = result.scalars().all()
    
    # Delete all mappings
    for mapping in mappings:
        await db.delete(mapping)
    
    # Delete the task definition
    await db.delete(task_definition)
    await db.commit()
    
    return schemas.MessageResponse(message="Task definition deleted successfully") 