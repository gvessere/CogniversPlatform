from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, and_
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

# ==================== Questionnaire Instance Routes ====================

@router.post("/instances", response_model=QuestionnaireInstanceResponse, status_code=status.HTTP_201_CREATED)
async def create_questionnaire_instance(
    instance_data: QuestionnaireInstanceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    if not is_trainer_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers and admins can create questionnaire instances"
        )
    
    # Validate session exists
    session = await get_session_by_id(instance_data.session_id, db)
    
    # Validate questionnaire exists
    questionnaire = await db.get(Questionnaire, instance_data.questionnaire_id)
    if not questionnaire:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Questionnaire with ID {instance_data.questionnaire_id} not found"
        )
    
    # Create instance
    new_instance = QuestionnaireInstance(**instance_data.model_dump())
    
    db.add(new_instance)
    await db.commit()
    
    # Add questionnaire title to response without querying again
    response_data = QuestionnaireInstanceResponse(
        **new_instance.model_dump(),
        questionnaire_title=questionnaire.title
    )
    
    return response_data

@router.get("/instances/{session_id}", response_model=List[QuestionnaireInstanceResponse])
async def get_questionnaire_instances(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    if not is_trainer_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers and admins can view questionnaire instances"
        )
    
    # Validate session exists
    await get_session_by_id(session_id, db)
    
    # Get instances for session
    query: Any = select(QuestionnaireInstance).where(
        QuestionnaireInstance.session_id == session_id
    )
    result = await db.execute(query)
    instances = result.scalars().all()
    
    # Add questionnaire titles to responses
    response_data = []
    for instance in instances:
        questionnaire = await db.get(Questionnaire, instance.questionnaire_id)
        questionnaire_title = questionnaire.title if questionnaire else None
        
        response_data.append(
            QuestionnaireInstanceResponse(
                **instance.model_dump(),
                questionnaire_title=questionnaire_title
            )
        )
    
    return response_data

@router.put("/instances/{instance_id}", response_model=QuestionnaireInstanceResponse)
async def update_questionnaire_instance(
    instance_id: int,
    instance_data: QuestionnaireInstanceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    if not is_trainer_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers and admins can update questionnaire instances"
        )
    
    instance = await get_questionnaire_instance_by_id(instance_id, db)
    
    # Update fields if provided
    update_data = instance_data.model_dump(exclude_unset=True)
    
    for key, value in update_data.items():
        setattr(instance, key, value)
    
    instance.updated_at = datetime.now()
    
    db.add(instance)
    await db.commit()
    
    # Add questionnaire title to response without querying again
    questionnaire = await db.get(Questionnaire, instance.questionnaire_id)
    questionnaire_title = questionnaire.title if questionnaire else None
    
    response_data = QuestionnaireInstanceResponse(
        **instance.model_dump(),
        questionnaire_title=questionnaire_title
    )
    
    return response_data

@router.delete("/instances/{instance_id}", response_model=MessageResponse)
async def delete_questionnaire_instance(
    instance_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    if not is_trainer_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers and admins can delete questionnaire instances"
        )
    
    instance = await get_questionnaire_instance_by_id(instance_id, db)
    
    await db.delete(instance)
    await db.commit()
    
    return MessageResponse(message=f"Questionnaire instance with ID {instance_id} deleted successfully")

# Route to check if a questionnaire is attached to any sessions
@router.get("/questionnaire/{questionnaire_id}/is-attached", response_model=dict)
async def check_questionnaire_attachment(
    questionnaire_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    if not is_trainer_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers and admins can check questionnaire attachment"
        )
    
    # Validate questionnaire exists
    questionnaire = await db.get(Questionnaire, questionnaire_id)
    if not questionnaire:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Questionnaire with ID {questionnaire_id} not found"
        )
    
    is_attached = await is_questionnaire_attached_to_sessions(questionnaire_id, db)
    
    return {
        "questionnaire_id": questionnaire_id,
        "is_attached": is_attached
    }

# Route to activate a questionnaire instance
@router.post("/instances/{instance_id}/activate", response_model=QuestionnaireInstanceResponse)
async def activate_questionnaire_instance(
    instance_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    if not is_trainer_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers and admins can activate questionnaire instances"
        )
    
    instance = await get_questionnaire_instance_by_id(instance_id, db)
    
    instance.is_active = True
    instance.updated_at = datetime.now()
    
    db.add(instance)
    await db.commit()
    
    # Add questionnaire title to response without querying again
    questionnaire = await db.get(Questionnaire, instance.questionnaire_id)
    questionnaire_title = questionnaire.title if questionnaire else None
    
    response_data = QuestionnaireInstanceResponse(
        **instance.model_dump(),
        questionnaire_title=questionnaire_title
    )
    
    return response_data

# Route to deactivate a questionnaire instance
@router.post("/instances/{instance_id}/deactivate", response_model=QuestionnaireInstanceResponse)
async def deactivate_questionnaire_instance(
    instance_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    if not is_trainer_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers and admins can deactivate questionnaire instances"
        )
    
    instance = await get_questionnaire_instance_by_id(instance_id, db)
    
    instance.is_active = False
    instance.updated_at = datetime.now()
    
    db.add(instance)
    await db.commit()
    
    # Add questionnaire title to response without querying again
    questionnaire = await db.get(Questionnaire, instance.questionnaire_id)
    questionnaire_title = questionnaire.title if questionnaire else None
    
    response_data = QuestionnaireInstanceResponse(
        **instance.model_dump(),
        questionnaire_title=questionnaire_title
    )
    
    return response_data

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
@router.post("/enroll-by-code", response_model=ClientSessionEnrollmentResponse)
async def enroll_in_session_by_code(
    session_code: str,
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
            detail="You are already enrolled in this session"
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
            detail="You are already enrolled in this session"
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