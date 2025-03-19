from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlmodel import Session, select, and_
from sqlalchemy.orm import selectinload
from typing import List, Optional, Any, TypeVar, Generic
from datetime import datetime
from sqlalchemy.orm.query import Query
from sqlalchemy.sql.selectable import Select
from sqlalchemy.ext.asyncio import AsyncSession
import random
import string

from database import get_async_session
from auth.dependencies import get_current_user
from models.user import User, UserRole
from models.questionnaire import Session as SessionModel, Questionnaire, QuestionnaireInstance, ClientSessionEnrollment
from schemas import (
    SessionCreate, 
    SessionUpdate, 
    SessionResponse, 
    QuestionnaireInstanceCreate, 
    QuestionnaireInstanceUpdate, 
    QuestionnaireInstanceResponse,
    ClientSessionEnrollmentCreate,
    ClientSessionEnrollmentResponse,
    IdResponse,
    MessageResponse
)

router = APIRouter(prefix="/sessions", tags=["sessions"])

# Helper function to check if user is trainer or admin
def is_trainer_or_admin(user: User) -> bool:
    return user.role in [UserRole.TRAINER, UserRole.ADMINISTRATOR]

# Helper function to get a session by ID
async def get_session_by_id(session_id: int, db: AsyncSession) -> SessionModel:
    result = await db.get(SessionModel, session_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session with ID {session_id} not found"
        )
    return result

# Helper function to generate a random session code
def generate_session_code(length: int = 6) -> str:
    # Use only lowercase letters for session codes
    characters = string.ascii_lowercase
    return ''.join(random.choices(characters, k=length))

# Helper function to check if a session code is unique
async def is_session_code_unique(code: str, db: AsyncSession) -> bool:
    query: Any = select(SessionModel).where(SessionModel.session_code == code)
    result = await db.execute(query)
    return result.first() is None

# Helper function to get a questionnaire instance by ID
async def get_questionnaire_instance_by_id(instance_id: int, db: AsyncSession) -> QuestionnaireInstance:
    instance = await db.get(QuestionnaireInstance, instance_id)
    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Questionnaire instance with ID {instance_id} not found"
        )
    return instance

# Helper function to check if a questionnaire is attached to any active sessions
async def is_questionnaire_attached_to_sessions(questionnaire_id: int, db: AsyncSession) -> bool:
    query: Any = select(QuestionnaireInstance).where(
        QuestionnaireInstance.questionnaire_id == questionnaire_id
    )
    result = await db.execute(query)
    instances = result.scalars().all()
    return len(instances) > 0

# Helper function to check if a client is enrolled in a session
async def is_client_enrolled_in_session(client_id: Optional[int], session_id: int, db: AsyncSession) -> bool:
    """Check if a client is enrolled in a specific session"""
    if client_id is None:
        return False
        
    query: Any = select(ClientSessionEnrollment).where(
        and_(
            ClientSessionEnrollment.client_id == client_id,
            ClientSessionEnrollment.session_id == session_id
        )
    )
    result = await db.execute(query)
    enrollment = result.scalar_one_or_none()
    return enrollment is not None

# ==================== Session Routes ====================

@router.post("/", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    session_data: SessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    if not is_trainer_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers and admins can create sessions"
        )
    
    # Validate trainer exists
    trainer = await db.get(User, session_data.trainer_id)
    if not trainer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trainer with ID {session_data.trainer_id} not found"
        )
    
    # Validate trainer is actually a trainer or admin
    if not is_trainer_or_admin(trainer):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with ID {session_data.trainer_id} is not a trainer or admin"
        )
    
    # Validate dates
    if session_data.start_date >= session_data.end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date must be after start date"
        )
    
    # Generate a session code for all sessions (both public and private)
    session_code = generate_session_code()
    # Ensure the code is unique
    while not await is_session_code_unique(session_code, db):
        session_code = generate_session_code()
    
    # Create session
    new_session = SessionModel(
        **session_data.model_dump(),
        created_by_id=current_user.id,
        session_code=session_code
    )
    
    db.add(new_session)
    await db.commit()
    
    # Add trainer name to response without querying again
    response_data = SessionResponse(
        **new_session.model_dump(),
        trainer_name=f"{trainer.first_name} {trainer.last_name}"
    )
    
    return response_data

@router.get("/", response_model=List[SessionResponse])
async def get_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    # For trainers and admins, show all sessions
    if is_trainer_or_admin(current_user):
        query: Any = select(SessionModel)
    else:
        # For clients, only show public sessions
        sessions_query: Any = select(SessionModel).where(SessionModel.is_public == True)
    
    result = await db.execute(query if is_trainer_or_admin(current_user) else sessions_query)
    sessions = result.scalars().all()
    
    # Add trainer names to responses
    response_data = []
    for session in sessions:
        trainer = await db.get(User, session.trainer_id)
        trainer_name = f"{trainer.first_name} {trainer.last_name}" if trainer else None
        
        response_data.append(
            SessionResponse(
                **session.model_dump(),
                trainer_name=trainer_name
            )
        )
    
    return response_data

@router.get("/{session_id}", response_model=SessionResponse)
async def get_session_by_id_route(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    if not is_trainer_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers and admins can view sessions"
        )
    
    session = await get_session_by_id(session_id, db)
    
    # Add trainer name to response without querying again
    trainer = await db.get(User, session.trainer_id)
    trainer_name = f"{trainer.first_name} {trainer.last_name}" if trainer else None
    
    response_data = SessionResponse(
        **session.model_dump(),
        trainer_name=trainer_name
    )
    
    return response_data

@router.put("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: int,
    session_data: SessionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    if not is_trainer_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers and admins can update sessions"
        )
    
    session = await get_session_by_id(session_id, db)
    
    # Update fields if provided
    update_data = session_data.model_dump(exclude_unset=True)
    
    # If trainer_id is being updated, validate the new trainer
    if "trainer_id" in update_data:
        trainer = await db.get(User, update_data["trainer_id"])
        if not trainer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Trainer with ID {update_data['trainer_id']} not found"
            )
        
        if not is_trainer_or_admin(trainer):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User with ID {update_data['trainer_id']} is not a trainer or admin"
            )
    
    # If dates are being updated, validate them
    start_date = update_data.get("start_date", session.start_date)
    end_date = update_data.get("end_date", session.end_date)
    
    if start_date >= end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date must be after start date"
        )
    
    # Handle session_code changes
    # Generate a session code if one doesn't exist
    if not session.session_code:
        session_code = generate_session_code()
        # Ensure the code is unique
        while not await is_session_code_unique(session_code, db):
            session_code = generate_session_code()
        update_data["session_code"] = session_code
    
    # Update session
    for key, value in update_data.items():
        setattr(session, key, value)
    
    session.updated_at = datetime.now()
    
    db.add(session)
    await db.commit()
    
    # Add trainer name to response without querying again
    trainer = await db.get(User, session.trainer_id)
    trainer_name = f"{trainer.first_name} {trainer.last_name}" if trainer else None
    
    response_data = SessionResponse(
        **session.model_dump(),
        trainer_name=trainer_name
    )
    
    return response_data

@router.delete("/{session_id}", response_model=MessageResponse)
async def delete_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    if not is_trainer_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers and admins can delete sessions"
        )
    
    session = await get_session_by_id(session_id, db)
    
    # Check if session has questionnaire instances
    query: Any = select(QuestionnaireInstance).where(
        QuestionnaireInstance.session_id == session_id
    )
    result = await db.execute(query)
    instances = result.scalars().all()
    
    if instances:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete session with attached questionnaire instances. Remove instances first."
        )
    
    # Check if session has any enrollments
    enrollment_query: Any = select(ClientSessionEnrollment).where(
        ClientSessionEnrollment.session_id == session_id
    )
    enrollment_result = await db.execute(enrollment_query)
    enrollments = enrollment_result.scalars().all()
    
    if enrollments:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete session with active enrollments. A session with enrollments cannot be deleted."
        )
    
    await db.delete(session)
    await db.commit()
    
    return MessageResponse(message=f"Session with ID {session_id} deleted successfully")

# ==================== Questionnaire Instance Base Functions ====================

async def get_questionnaire_instances(
    session_id: int,
    current_user: User,
    db: AsyncSession
) -> List[QuestionnaireInstanceResponse]:
    """Get all questionnaires attached to a session"""
    session = await get_session_by_id(session_id, db)
    
    if not is_trainer_or_admin(current_user) and not await is_client_enrolled_in_session(current_user.id, session_id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: User is not associated with this session"
        )
    
    query = select(QuestionnaireInstance).where(
        QuestionnaireInstance.session_id == session_id
    ).options(
        selectinload(QuestionnaireInstance.questionnaire)
    )
    
    result = await db.execute(query)
    instances = result.scalars().all()
    
    return [QuestionnaireInstanceResponse.model_validate(instance) for instance in instances]

async def create_questionnaire_instance(
    instance_data: QuestionnaireInstanceCreate,
    current_user: User,
    db: AsyncSession
) -> QuestionnaireInstanceResponse:
    """Create a new questionnaire instance attached to a session"""
    if not is_trainer_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers and admins can attach questionnaires to sessions"
        )
    
    session = await get_session_by_id(instance_data.session_id, db)
    
    # Check if the questionnaire exists
    questionnaire = await db.get(Questionnaire, instance_data.questionnaire_id)
    if not questionnaire:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Questionnaire with ID {instance_data.questionnaire_id} not found"
        )
    
    # Create the questionnaire instance
    new_instance = QuestionnaireInstance(
        session_id=instance_data.session_id,
        questionnaire_id=instance_data.questionnaire_id,
        is_active=instance_data.is_active,
        created_by=current_user.id,
        updated_by=current_user.id
    )
    
    db.add(new_instance)
    await db.commit()
    await db.refresh(new_instance)
    
    # Load the related questionnaire
    await db.refresh(new_instance, ["questionnaire"])
    
    return QuestionnaireInstanceResponse.model_validate(new_instance)

async def update_questionnaire_instance(
    instance_id: int,
    instance_data: QuestionnaireInstanceUpdate,
    current_user: User,
    db: AsyncSession
) -> QuestionnaireInstanceResponse:
    """Update a questionnaire instance"""
    if not is_trainer_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers and admins can update questionnaires attached to sessions"
        )
    
    # Get the instance
    instance = await db.get(QuestionnaireInstance, instance_id)
    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Questionnaire instance with ID {instance_id} not found"
        )
    
    # Apply updates
    for key, value in instance_data.model_dump(exclude_unset=True).items():
        setattr(instance, key, value)
    
    instance.updated_by = current_user.id
    instance.updated_at = datetime.now()
    
    await db.commit()
    await db.refresh(instance)
    
    # Load the related questionnaire
    await db.refresh(instance, ["questionnaire"])
    
    return QuestionnaireInstanceResponse.model_validate(instance)
    
async def delete_questionnaire_instance(
    instance_id: int,
    current_user: User,
    db: AsyncSession
) -> MessageResponse:
    """Delete a questionnaire instance"""
    if not is_trainer_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers and admins can delete questionnaires attached to sessions"
        )
    
    # Get the instance
    instance = await db.get(QuestionnaireInstance, instance_id)
    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Questionnaire instance with ID {instance_id} not found"
        )
    
    await db.delete(instance)
    await db.commit()
    
    return MessageResponse(message=f"Questionnaire instance with ID {instance_id} deleted successfully")

async def activate_questionnaire_instance(
    instance_id: int,
    current_user: User,
    db: AsyncSession
) -> QuestionnaireInstanceResponse:
    """Activate a questionnaire instance"""
    if not is_trainer_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers and admins can activate questionnaires"
        )
    
    # Get the instance
    instance = await db.get(QuestionnaireInstance, instance_id)
    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Questionnaire instance with ID {instance_id} not found"
        )
    
    instance.is_active = True
    instance.updated_at = datetime.now()
    
    # Load the related questionnaire before committing
    await db.refresh(instance, ["questionnaire"])
    
    await db.commit()
    
    return QuestionnaireInstanceResponse.model_validate(instance)

async def deactivate_questionnaire_instance(
    instance_id: int,
    current_user: User,
    db: AsyncSession
) -> QuestionnaireInstanceResponse:
    """Deactivate a questionnaire instance"""
    if not is_trainer_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers and admins can deactivate questionnaires"
        )
    
    # Get the instance
    instance = await db.get(QuestionnaireInstance, instance_id)
    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Questionnaire instance with ID {instance_id} not found"
        )
    
    instance.is_active = False
    instance.updated_at = datetime.now()
    
    # Load the related questionnaire before committing
    await db.refresh(instance, ["questionnaire"])
    
    await db.commit()
    
    return QuestionnaireInstanceResponse.model_validate(instance)

# ==================== Questionnaire Instance Routes (RESTful API) ====================

# Session questionnaire collection endpoints
@router.get("/{session_id}/questionnaires", response_model=List[QuestionnaireInstanceResponse])
async def get_session_questionnaires(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get all questionnaires for a specific session"""
    return await get_questionnaire_instances(session_id, current_user, db)

@router.post("/{session_id}/questionnaires", response_model=QuestionnaireInstanceResponse, status_code=status.HTTP_201_CREATED)
async def add_questionnaire_to_session(
    session_id: int,
    instance_data: QuestionnaireInstanceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Add a questionnaire to a session"""
    # Ensure session_id in path matches the one in the request body
    instance_data_with_session = QuestionnaireInstanceCreate(
        **instance_data.model_dump(),
        session_id=session_id
    )
    return await create_questionnaire_instance(instance_data_with_session, current_user, db)

# Individual questionnaire endpoints
@router.get("/questionnaires/{questionnaire_id}", response_model=QuestionnaireInstanceResponse)
async def get_questionnaire(
    questionnaire_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get a specific questionnaire"""
    instance = await get_questionnaire_instance_by_id(questionnaire_id, db)
    if not is_trainer_or_admin(current_user):
        # Check if client is enrolled in the session this questionnaire belongs to
        if not await is_client_enrolled_in_session(current_user.id, instance.session_id, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: User is not associated with this questionnaire's session"
            )
    
    return QuestionnaireInstanceResponse.model_validate(instance)

@router.put("/questionnaires/{questionnaire_id}", response_model=QuestionnaireInstanceResponse)
async def update_questionnaire(
    questionnaire_id: int,
    instance_data: QuestionnaireInstanceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Update a specific questionnaire"""
    return await update_questionnaire_instance(questionnaire_id, instance_data, current_user, db)

@router.delete("/questionnaires/{questionnaire_id}", response_model=MessageResponse)
async def delete_questionnaire(
    questionnaire_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Delete a specific questionnaire"""
    return await delete_questionnaire_instance(questionnaire_id, current_user, db)

@router.post("/{session_id}/questionnaires/{questionnaire_id}/activate", response_model=QuestionnaireInstanceResponse)
async def activate_questionnaire(
    session_id: int,
    questionnaire_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Activate a questionnaire instance"""
    # Verify the questionnaire instance belongs to the session
    instance = await get_questionnaire_instance_by_id(questionnaire_id, db)
    if instance.session_id != session_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Questionnaire instance with ID {questionnaire_id} not found in session {session_id}"
        )
    return await activate_questionnaire_instance(questionnaire_id, current_user, db)

@router.post("/{session_id}/questionnaires/{questionnaire_id}/deactivate", response_model=QuestionnaireInstanceResponse)
async def deactivate_questionnaire(
    session_id: int,
    questionnaire_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Deactivate a questionnaire instance"""
    # Verify the questionnaire instance belongs to the session
    instance = await get_questionnaire_instance_by_id(questionnaire_id, db)
    if instance.session_id != session_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Questionnaire instance with ID {questionnaire_id} not found in session {session_id}"
        )
    return await deactivate_questionnaire_instance(questionnaire_id, current_user, db)

# ==================== Client Session Enrollment Routes ====================

@router.post("/{session_id}/enrollments", response_model=ClientSessionEnrollmentResponse, status_code=status.HTTP_201_CREATED)
async def enroll_client_in_session(
    session_id: int,
    enrollment_data: ClientSessionEnrollmentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    if not is_trainer_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers and admins can enroll clients in sessions"
        )
    
    # Validate session exists
    session = await get_session_by_id(session_id, db)
    
    # Validate client exists and is a client
    client = await db.get(User, enrollment_data.client_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Client with ID {enrollment_data.client_id} not found"
        )
    if client.role != UserRole.CLIENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with ID {enrollment_data.client_id} is not a client"
        )
    
    # Check if client is already enrolled
    query: Any = select(ClientSessionEnrollment).where(
        and_(
            ClientSessionEnrollment.client_id == enrollment_data.client_id,
            ClientSessionEnrollment.session_id == session_id
        )
    )
    result = await db.execute(query)
    existing_enrollment = result.scalar_one_or_none()
    
    if existing_enrollment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Client is already enrolled in this session"
        )
    
    # Create enrollment
    new_enrollment = ClientSessionEnrollment(
        **enrollment_data.model_dump(),
        session_id=session_id
    )
    
    db.add(new_enrollment)
    await db.commit()
    
    # Add client and session names to response
    response_data = ClientSessionEnrollmentResponse(
        **new_enrollment.model_dump(),
        client_name=f"{client.first_name} {client.last_name}",
        session_title=session.title
    )
    
    return response_data

@router.get("/{session_id}/enrollments", response_model=List[ClientSessionEnrollmentResponse])
async def get_session_enrollments(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    if not is_trainer_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers and admins can view session enrollments"
        )
    
    # Validate session exists
    await get_session_by_id(session_id, db)
    
    # Get enrollments for session
    query: Any = select(ClientSessionEnrollment).where(
        ClientSessionEnrollment.session_id == session_id
    )
    result = await db.execute(query)
    enrollments = result.scalars().all()
    
    # Add client and session names to responses
    response_data = []
    for enrollment in enrollments:
        client = await db.get(User, enrollment.client_id)
        session = await db.get(SessionModel, enrollment.session_id)
        
        client_name = f"{client.first_name} {client.last_name}" if client else None
        session_title = session.title if session else None
        
        response_data.append(
            ClientSessionEnrollmentResponse(
                **enrollment.model_dump(),
                client_name=client_name,
                session_title=session_title
            )
        )
    
    return response_data

@router.get("/client/{client_id}/enrollments", response_model=List[ClientSessionEnrollmentResponse])
async def get_client_enrollments(
    client_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    # Only allow clients to view their own enrollments, or trainers/admins to view any
    if current_user.role == UserRole.CLIENT and current_user.id != client_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Clients can only view their own enrollments"
        )
    
    # Get enrollments for client
    query: Any = select(ClientSessionEnrollment).where(
        ClientSessionEnrollment.client_id == client_id
    )
    result = await db.execute(query)
    enrollments = result.scalars().all()
    
    # Add client and session names to responses
    response_data = []
    for enrollment in enrollments:
        client = await db.get(User, enrollment.client_id)
        session = await db.get(SessionModel, enrollment.session_id)
        
        client_name = f"{client.first_name} {client.last_name}" if client else None
        session_title = session.title if session else None
        
        response_data.append(
            ClientSessionEnrollmentResponse(
                **enrollment.model_dump(),
                client_name=client_name,
                session_title=session_title
            )
        )
    
    return response_data

# Route to generate a new session code
@router.post("/{session_id}/generate-code", response_model=SessionResponse)
async def generate_new_session_code(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    if not is_trainer_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers and admins can generate session codes"
        )
    
    session = await get_session_by_id(session_id, db)
    
    # Generate a new session code
    session_code = generate_session_code()
    # Ensure the code is unique
    while not await is_session_code_unique(session_code, db):
        session_code = generate_session_code()
    
    session.session_code = session_code
    session.updated_at = datetime.now()
    
    db.add(session)
    await db.commit()
    
    # Add trainer name to response without querying again
    trainer = await db.get(User, session.trainer_id)
    trainer_name = f"{trainer.first_name} {trainer.last_name}" if trainer else None
    
    response_data = SessionResponse(
        **session.model_dump(),
        trainer_name=trainer_name
    )
    
    return response_data

# Route for clients to enroll in a session using a session code
@router.post("/enroll", response_model=ClientSessionEnrollmentResponse)
async def enroll_in_session_by_code(
    session_code: str = Body(..., embed=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    # Allow all user roles to enroll in sessions
    # No role check needed anymore
    
    # Find the session with the given code
    query: Any = select(SessionModel).where(SessionModel.session_code == session_code)
    result = await db.execute(query)
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid session code"
        )
    
    # Check if user is already enrolled
    query: Any = select(ClientSessionEnrollment).where(
        and_(
            ClientSessionEnrollment.client_id == current_user.id,
            ClientSessionEnrollment.session_id == session.id
        )
    )
    result = await db.execute(query)
    existing_enrollment = result.scalar_one_or_none()
    
    if existing_enrollment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already enrolled in this session",
            headers={"X-Session-Id": str(session.id)}
        )
    
    # Create enrollment
    new_enrollment = ClientSessionEnrollment(
        client_id=current_user.id,
        session_id=session.id,
        status="active"
    )
    
    db.add(new_enrollment)
    await db.commit()
    
    # Add client and session names to response
    response_data = ClientSessionEnrollmentResponse(
        **new_enrollment.model_dump(),
        client_name=f"{current_user.first_name} {current_user.last_name}",
        session_title=session.title
    )
    
    return response_data

# Route for users to enroll in a public session
@router.post("/{session_id}/enroll", response_model=ClientSessionEnrollmentResponse)
async def enroll_in_public_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    # Allow all user roles to enroll in sessions
    # No role check needed anymore
    
    # Get the session
    session = await get_session_by_id(session_id, db)
    
    # Check if the session is public
    if not session.is_public:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot directly enroll in a private session. Please use a session code."
        )
    
    # Check if user is already enrolled
    query: Any = select(ClientSessionEnrollment).where(
        and_(
            ClientSessionEnrollment.client_id == current_user.id,
            ClientSessionEnrollment.session_id == session_id
        )
    )
    result = await db.execute(query)
    existing_enrollment = result.scalar_one_or_none()
    
    if existing_enrollment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already enrolled in this session",
            headers={"X-Session-Id": str(session_id)}
        )
    
    # Create enrollment
    new_enrollment = ClientSessionEnrollment(
        client_id=current_user.id,
        session_id=session_id,
        status="active"
    )
    
    db.add(new_enrollment)
    await db.commit()
    
    # Add client and session names to response
    response_data = ClientSessionEnrollmentResponse(
        **new_enrollment.model_dump(),
        client_name=f"{current_user.first_name} {current_user.last_name}",
        session_title=session.title
    )
    
    return response_data

@router.delete("/{session_id}/enrollments/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unenroll_client_from_session(
    session_id: int,
    client_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Unenroll a client from a session"""
    # Allow clients to unenroll themselves, or trainers/admins to unenroll any client
    if current_user.role == UserRole.CLIENT and current_user.id != client_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only unenroll yourself from sessions"
        )
    
    # For trainers/admins, verify the session belongs to the trainer
    if current_user.role in [UserRole.TRAINER, UserRole.ADMINISTRATOR]:
        session_query: Select = select(SessionModel).where(
            and_(
                SessionModel.id == session_id,
                SessionModel.trainer_id == current_user.id
            )
        )
        session_result = await db.execute(session_query)
        session = session_result.scalar_one_or_none()
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found or not authorized"
            )
    
    # Find and delete the enrollment
    enrollment_query: Select = select(ClientSessionEnrollment).where(
        and_(
            ClientSessionEnrollment.client_id == client_id,
            ClientSessionEnrollment.session_id == session_id
        )
    )
    enrollment_result = await db.execute(enrollment_query)
    enrollment = enrollment_result.scalar_one_or_none()
    
    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client is not enrolled in this session"
        )
    
    await db.delete(enrollment)
    await db.commit() 