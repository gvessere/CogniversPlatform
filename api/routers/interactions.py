from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Annotated
from sqlalchemy.ext.asyncio import AsyncSession
import schemas
from database import get_async_session
from models.interaction import InteractionBatch
from tasks import process_interaction_batch, test_task
from auth.dependencies import get_current_user
from models.user import User

router = APIRouter(
    prefix="/interactions",
    tags=["interactions"]
)

@router.post("/batch", response_model=schemas.InteractionBatchResponse)
async def create_interaction_batch(
    batch_data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Create a new interaction batch"""
    try:
        # Create and add interaction batch to the existing transaction
        db_batch = InteractionBatch(
            user_id=current_user.id,
            events=batch_data.get("events", []),
            created_at=datetime.utcnow()
        )
        db.add(db_batch)
        await db.flush()
        
        # Get the ID after flushing but before committing
        batch_id = db_batch.id
        
        # Queue processing task
        task = process_interaction_batch.delay(batch_id)
        
        # Commit the transaction
        await db.commit()
        
        # Return response
        return schemas.InteractionBatchResponse(
            batch_id=batch_id if batch_id is not None else 0,
            task_id=task.id,
            message=f"Processing {len(batch_data.get('events', []))} events"
        )
        
    except Exception as e:
        # The rollback will be handled by the dependency
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("")
async def log_interactions(
    batch: schemas.InteractionBatchCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    if current_user.id != batch.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User mismatch in request"
        )
    
    try:
        # Convert datetime objects to strings
        serialized_events = []
        for event in batch.events:
            event_dict = event.dict()
            # Convert timestamp to ISO format string
            event_dict['timestamp'] = event.timestamp.isoformat()
            serialized_events.append(event_dict)
            
        # Create and add interaction batch to the existing transaction
        db_batch = InteractionBatch(
            user_id=current_user.id,
            events=serialized_events,
            created_at=datetime.utcnow()
        )
        db.add(db_batch)
        await db.flush()
        
        # Get the ID after flushing but before committing
        batch_id = db_batch.id
        
        # Queue processing task
        task = process_interaction_batch.delay(batch_id)
        
        return {
            "message": f"Logged {len(batch.events)} events",
            "processing_task_id": task.id
        }
        
    except Exception as e:
        # The rollback will be handled by the dependency
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/test-interaction", response_model=schemas.InteractionBatchResponse)
async def test_interaction(
    batch: schemas.InteractionBatchCreate,
    db: AsyncSession = Depends(get_async_session)
):
    """Test endpoint to create an interaction batch and process it"""
    try:
        # Convert datetime objects to strings
        serialized_events = []
        for event in batch.events:
            event_dict = event.dict()
            # Convert timestamp to ISO format string
            event_dict['timestamp'] = event.timestamp.isoformat()
            serialized_events.append(event_dict)
        
        # Create and add interaction batch to the existing transaction
        db_batch = InteractionBatch(
            user_id=batch.user_id,
            events=serialized_events
        )
        db.add(db_batch)
        await db.flush()
        
        # Get the ID after flushing but before committing
        batch_id = db_batch.id
        
        # Queue processing task
        task = process_interaction_batch.delay(batch_id)
        
        # Return response
        return schemas.InteractionBatchResponse(
            batch_id=batch_id if batch_id is not None else 0,
            task_id=task.id,
            message=f"Processing {len(batch.events)} events"
        )
        
    except Exception as e:
        # The rollback will be handled by the dependency
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/test-celery")
async def test_celery():
    """Test endpoint to verify Celery task execution"""
    task = test_task.delay(3)
    return {"task_id": task.id, "message": "Task started"} 