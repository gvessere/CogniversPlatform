from typing import Optional, List, Annotated, Dict
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
import logging
from sqlalchemy import select, and_
from database import get_async_session
from models.user import User, UserRole
from jose import JWTError, jwt
import os
from fastapi.security import OAuth2PasswordBearer
from schemas import (
    ClientWithSessions,
    ClientSessionInfo,
    SessionStatus,
    UserResponse,
    UserCreate,
    UserUpdate
)
from auth.dependencies import get_current_user
from models.questionnaire import Session as SessionModel, ClientSessionEnrollment

# Configure logging to exclude sensitive data
logger = logging.getLogger(__name__)

class SensitiveDataFilter(logging.Filter):
    def filter(self, record):
        # Remove sensitive data from logs
        sensitive_fields = ['password', 'current_password', 'new_password', 'password_hash']
        for field in sensitive_fields:
            if hasattr(record, 'msg') and field in str(record.msg):
                record.msg = str(record.msg).replace(getattr(record.msg, field, ''), '[FILTERED]')
        return True

logger.addFilter(SensitiveDataFilter())

router = APIRouter(prefix="/users", tags=["users"])
ph = PasswordHasher()

# Security config from auth.utils
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

@router.get("", response_model=List[UserResponse])
async def get_users(
    role: Optional[UserRole] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    Get users with optional role filtering.
    
    Access controls:
    - Admins can see all users
    - Trainers can see all trainers, admins, and their clients
    - Clients can only see trainers and admins
    """
    # Base query
    query = select(User)
    
    # Apply role filter if provided
    if role:
        query = query.where(User.role == role)
    
    # Apply access control filters based on user role
    if current_user.role == UserRole.CLIENT:
        # Clients can only see trainers and admins
        if not role:  # Only apply if no specific role filter was requested
            query = query.where(User.role.in_([UserRole.TRAINER, UserRole.ADMINISTRATOR]))
    elif current_user.role == UserRole.TRAINER:
        # Trainers can see all trainers, admins, and their clients
        # For now, we allow trainers to see all clients since client-trainer relationships
        # are not yet implemented in the data model
        pass  # No additional filters needed
    # Admins can see everything, so no additional filters
    
    result = await db.execute(query)
    users = result.scalars().all()
    
    return [UserResponse.from_orm(user) for user in users]

@router.get("/clients", response_model=List[ClientWithSessions])
async def get_trainer_clients(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get all clients for a trainer with their session information"""
    if current_user.role != UserRole.TRAINER and current_user.role != UserRole.ADMINISTRATOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers can view their clients"
        )
    
    # Get all sessions where the current user is the trainer
    sessions_query = select(SessionModel).where(SessionModel.trainer_id == current_user.id)
    sessions_result = await db.execute(sessions_query)
    trainer_sessions = sessions_result.scalars().all()
    
    if not trainer_sessions:
        return []
    
    # Get all enrollments for these sessions
    session_ids = [session.id for session in trainer_sessions]
    enrollments_query = select(ClientSessionEnrollment).where(
        ClientSessionEnrollment.session_id.in_(session_ids)
    )
    enrollments_result = await db.execute(enrollments_query)
    enrollments = enrollments_result.scalars().all()
    
    # Get unique client IDs from enrollments, including the current user if they are enrolled
    client_ids = list(set(enrollment.client_id for enrollment in enrollments))
    if current_user.id not in client_ids:
        client_ids.append(current_user.id)
    
    # Get all clients who are enrolled in the trainer's sessions
    clients_query = select(User).where(User.id.in_(client_ids))
    clients_result = await db.execute(clients_query)
    clients = clients_result.scalars().all()
    
    # Create a mapping of client IDs to their sessions
    client_sessions: Dict[int, List[ClientSessionInfo]] = {}
    for enrollment in enrollments:
        session = next(s for s in trainer_sessions if s.id == enrollment.session_id)
        if enrollment.client_id not in client_sessions:
            client_sessions[enrollment.client_id] = []
        
        client_sessions[enrollment.client_id].append(ClientSessionInfo(
            session_id=session.id,
            session_name=session.title,
            status=SessionStatus(session.status),
            enrolled_at=enrollment.enrolled_at,
            trainer_id=session.trainer_id,
            trainer_name=f"{session.trainer.first_name} {session.trainer.last_name}"
        ))
    
    # Create the response with client and session information
    return [
        ClientWithSessions(
            id=client.id,
            email=client.email,
            first_name=client.first_name,
            last_name=client.last_name,
            role=client.role,
            sessions=client_sessions.get(client.id, [])
        )
        for client in clients
    ]

@router.delete("/clients/{client_id}/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unenroll_client_from_session(
    client_id: int,
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Unenroll a client from a session"""
    if current_user.role != UserRole.TRAINER and current_user.role != UserRole.ADMINISTRATOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers can unenroll clients from sessions"
        )
    
    # Verify the session belongs to the trainer
    session_query = select(SessionModel).where(
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
    enrollment_query = select(ClientSessionEnrollment).where(
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

@router.post("/create", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
) -> UserResponse:
    """Create a new user (admin only)"""
    if current_user.role != UserRole.ADMINISTRATOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can create users"
        )
    
    # Check if email already exists
    result = await db.execute(
        select(User).where(User.email == user_data.email)
    )
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Hash password
    hashed_password = ph.hash(user_data.password)
    
    # Create user
    new_user = User(
        email=user_data.email,
        password_hash=hashed_password,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        role=user_data.role,
        dob=user_data.dob
    )
    
    db.add(new_user)
    await db.commit()
    
    # Create a new response object directly from the user object
    # without querying the database again
    return UserResponse.from_orm(new_user)

@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get the current user's profile"""
    # The get_current_user dependency already fetches the user
    # Just return it as a response model
    return UserResponse.from_orm(current_user)

@router.patch("/me", response_model=UserResponse)
async def update_user_profile(
    update_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Update the current user's profile"""
    # Handle password change if provided
    if update_data.current_password and update_data.new_password:
        try:
            # Verify current password
            password_valid = ph.verify(current_user.password_hash, update_data.current_password.get_secret_value())
            
            if not password_valid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Current password is incorrect"
                )
            
            # Update password
            current_user.password_hash = ph.hash(update_data.new_password.get_secret_value())
            
        except VerifyMismatchError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )
    
    # Update other fields
    update_dict = update_data.dict(
        exclude={"current_password", "new_password"},
        exclude_unset=True
    )
    
    # Don't allow role changes for self-update
    if "role" in update_dict:
        del update_dict["role"]
    
    for key, value in update_dict.items():
        setattr(current_user, key, value)
    
    # Save changes
    db.add(current_user)
    await db.commit()
    
    # Get a fresh copy of the user data
    from database import AsyncSessionLocal
    async with AsyncSessionLocal() as new_session:
        result = await new_session.execute(
            select(User).where(User.id == current_user.id)
        )
        updated_user = result.scalar_one()
        return UserResponse.from_orm(updated_user)

@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    update_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Update a user (admin only)"""
    if current_user.role != UserRole.ADMINISTRATOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can update other users"
        )
    
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update password if provided
    if update_data.new_password:
        user.password_hash = ph.hash(update_data.new_password.get_secret_value())
    
    # Update other fields
    update_dict = update_data.dict(
        exclude={"current_password", "new_password"},
        exclude_unset=True
    )
    
    for key, value in update_dict.items():
        setattr(user, key, value)
    
    # Save changes
    db.add(user)
    await db.commit()
    
    # Get a fresh copy of the user data
    from database import AsyncSessionLocal
    async with AsyncSessionLocal() as new_session:
        result = await new_session.execute(
            select(User).where(User.id == user_id)
        )
        updated_user = result.scalar_one()
        return UserResponse.from_orm(updated_user)

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Delete a user (admin only)"""
    if current_user.role != UserRole.ADMINISTRATOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete users"
        )
    
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    await db.delete(user)
    await db.commit()

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get a specific user"""
    # Only admins can view any user, others can only view themselves
    if current_user.role != UserRole.ADMINISTRATOR and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this user"
        )
    
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserResponse.from_orm(user)

@router.get("/clients/{client_id}/sessions", response_model=List[ClientSessionEnrollment])
async def get_client_sessions(
    client_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get all sessions for a specific client"""
    if current_user.role != UserRole.TRAINER and current_user.role != UserRole.ADMINISTRATOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers can view client sessions"
        )
    
    # Verify the client exists
    client_query = select(User).where(User.id == client_id)
    client_result = await db.execute(client_query)
    client = client_result.scalar_one_or_none()
    
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )
    
    # Get all sessions where the current user is the trainer
    sessions_query = select(SessionModel).where(SessionModel.trainer_id == current_user.id)
    sessions_result = await db.execute(sessions_query)
    trainer_sessions = sessions_result.scalars().all()
    
    if not trainer_sessions:
        return []
    
    # Get all enrollments for this client in the trainer's sessions
    session_ids = [session.id for session in trainer_sessions]
    enrollments_query = select(ClientSessionEnrollment).where(
        and_(
            ClientSessionEnrollment.client_id == client_id,
            ClientSessionEnrollment.session_id.in_(session_ids)
        )
    )
    enrollments_result = await db.execute(enrollments_query)
    enrollments = enrollments_result.scalars().all()
    
    # Create a mapping of session IDs to session objects for easy lookup
    session_map = {session.id: session for session in trainer_sessions}
    
    # Create the response with session information
    return [
        ClientSessionEnrollment(
            id=enrollment.id,
            client_id=enrollment.client_id,
            session_id=enrollment.session_id,
            status=enrollment.status,
            enrolled_at=enrollment.enrolled_at,
            client_name=f"{client.first_name} {client.last_name}",
            session_title=session_map[enrollment.session_id].name
        )
        for enrollment in enrollments
    ]

@router.get("/enrollments", response_model=List[ClientSessionInfo])
async def get_user_enrollments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get all enrollments for the current user"""
    # Get all enrollments for the current user
    enrollments_query = select(ClientSessionEnrollment).where(
        ClientSessionEnrollment.client_id == current_user.id
    )
    enrollments_result = await db.execute(enrollments_query)
    enrollments = enrollments_result.scalars().all()
    
    if not enrollments:
        return []
    
    # Get all sessions for these enrollments
    session_ids = [enrollment.session_id for enrollment in enrollments]
    sessions_query = select(SessionModel).where(SessionModel.id.in_(session_ids))
    sessions_result = await db.execute(sessions_query)
    sessions = sessions_result.scalars().all()
    
    # Create a mapping of session IDs to session objects
    session_map = {session.id: session for session in sessions}
    
    # Create the response with session information
    return [
        ClientSessionInfo(
            session_id=enrollment.session_id,
            session_name=session_map[enrollment.session_id].title,
            status=SessionStatus(session_map[enrollment.session_id].status),
            enrolled_at=enrollment.enrolled_at,
            trainer_id=session_map[enrollment.session_id].trainer_id,
            trainer_name=f"{session_map[enrollment.session_id].trainer.first_name} {session_map[enrollment.session_id].trainer.last_name}"
        )
        for enrollment in enrollments
    ]