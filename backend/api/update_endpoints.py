"""
Update Status API Endpoints
Handles update status, manual refresh, and notification management
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, desc
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel

from database.db_setup import get_db_session
from models.bills import Bills
from models.update_logs import UpdateLogs
from models.update_notifications import UpdateNotifications
from tasks.nightly_bill_updater import NightlyBillUpdater
from services.ai_processor import BillAnalyzer

router = APIRouter(prefix="/api/updates", tags=["updates"])

# Request/Response Models
class UpdateStatusResponse(BaseModel):
    last_update: Optional[str]
    update_in_progress: bool
    new_updates_available: bool
    notifications_count: int
    recent_updates: List[Dict]

class ManualRefreshRequest(BaseModel):
    state_code: Optional[str] = None
    session_id: Optional[str] = None
    force_update: bool = False

class ManualRefreshResponse(BaseModel):
    task_id: str
    message: str
    estimated_duration: int

class NotificationResponse(BaseModel):
    notifications: List[Dict]
    total_count: int
    unread_count: int

# Global task tracking
active_tasks = {}

@router.get("/status", response_model=UpdateStatusResponse)
async def get_update_status(
    state_code: Optional[str] = None,
    session_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Get current update status and recent update information
    
    Args:
        state_code: Optional state filter
        session_id: Optional session filter
        db: Database session
        
    Returns:
        UpdateStatusResponse with current status
    """
    try:
        # Build query filters
        filters = []
        if state_code:
            filters.append(UpdateLogs.state_code == state_code)
        if session_id:
            filters.append(UpdateLogs.session_id == session_id)
        
        # Get last completed update
        last_update_query = select(UpdateLogs).where(
            and_(
                UpdateLogs.status == 'completed',
                *filters
            )
        ).order_by(desc(UpdateLogs.update_completed)).limit(1)
        
        last_update_result = await db.execute(last_update_query)
        last_update = last_update_result.scalar_one_or_none()
        
        # Check for updates in progress
        in_progress_query = select(UpdateLogs).where(
            and_(
                UpdateLogs.status == 'running',
                *filters
            )
        )
        
        in_progress_result = await db.execute(in_progress_query)
        update_in_progress = in_progress_result.scalar_one_or_none() is not None
        
        # Get recent updates (last 24 hours)
        recent_cutoff = datetime.utcnow() - timedelta(hours=24)
        recent_updates_query = select(UpdateLogs).where(
            and_(
                UpdateLogs.update_completed > recent_cutoff,
                UpdateLogs.status == 'completed',
                *filters
            )
        ).order_by(desc(UpdateLogs.update_completed)).limit(10)
        
        recent_updates_result = await db.execute(recent_updates_query)
        recent_updates = recent_updates_result.scalars().all()
        
        # Get unread notifications
        notifications_query = select(UpdateNotifications).where(
            and_(
                UpdateNotifications.notification_read == False,
                *filters if filters else []
            )
        )
        
        notifications_result = await db.execute(notifications_query)
        notifications = notifications_result.scalars().all()
        
        # Check if new updates are available
        new_updates_available = len(notifications) > 0
        
        return UpdateStatusResponse(
            last_update=last_update.update_completed.isoformat() if last_update else None,
            update_in_progress=update_in_progress,
            new_updates_available=new_updates_available,
            notifications_count=len(notifications),
            recent_updates=[update.to_dict() for update in recent_updates]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting update status: {str(e)}")


@router.post("/manual-refresh", response_model=ManualRefreshResponse)
async def trigger_manual_refresh(
    request: ManualRefreshRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Trigger a manual refresh of bill data
    
    Args:
        request: Manual refresh request parameters
        background_tasks: FastAPI background tasks
        db: Database session
        
    Returns:
        ManualRefreshResponse with task information
    """
    try:
        # Check if there's already an update in progress
        existing_task_query = select(UpdateLogs).where(
            UpdateLogs.status == 'running'
        )
        
        if request.state_code:
            existing_task_query = existing_task_query.where(
                UpdateLogs.state_code == request.state_code
            )
        
        if request.session_id:
            existing_task_query = existing_task_query.where(
                UpdateLogs.session_id == request.session_id
            )
        
        existing_task_result = await db.execute(existing_task_query)
        existing_task = existing_task_result.scalar_one_or_none()
        
        if existing_task and not request.force_update:
            raise HTTPException(
                status_code=409,
                detail="Update already in progress. Use force_update=true to override."
            )
        
        # Generate task ID
        task_id = f"manual_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        
        # Add task to background processing
        background_tasks.add_task(
            run_manual_update,
            task_id=task_id,
            state_code=request.state_code,
            session_id=request.session_id,
            force_update=request.force_update
        )
        
        # Track active task
        active_tasks[task_id] = {
            'status': 'started',
            'start_time': datetime.utcnow(),
            'state_code': request.state_code,
            'session_id': request.session_id
        }
        
        # Estimate duration based on scope
        estimated_duration = 300  # 5 minutes default
        if request.state_code:
            estimated_duration = 120  # 2 minutes for single state
        if request.session_id:
            estimated_duration = 60   # 1 minute for single session
        
        return ManualRefreshResponse(
            task_id=task_id,
            message="Manual refresh started",
            estimated_duration=estimated_duration
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error starting manual refresh: {str(e)}")


@router.get("/task-status/{task_id}")
async def get_task_status(task_id: str, db: AsyncSession = Depends(get_db_session)):
    """
    Get the status of a manual refresh task
    
    Args:
        task_id: Task identifier
        db: Database session
        
    Returns:
        Task status information
    """
    try:
        # Check active tasks first
        if task_id in active_tasks:
            task_info = active_tasks[task_id]
            
            # Check if task completed in database
            completed_query = select(UpdateLogs).where(
                and_(
                    UpdateLogs.update_type == 'manual',
                    UpdateLogs.update_started >= task_info['start_time'],
                    UpdateLogs.status.in_(['completed', 'failed'])
                )
            )
            
            completed_result = await db.execute(completed_query)
            completed_task = completed_result.scalar_one_or_none()
            
            if completed_task:
                # Task completed, remove from active tasks
                del active_tasks[task_id]
                return {
                    'task_id': task_id,
                    'status': completed_task.status,
                    'start_time': completed_task.update_started.isoformat(),
                    'end_time': completed_task.update_completed.isoformat() if completed_task.update_completed else None,
                    'bills_updated': completed_task.bills_updated,
                    'bills_added': completed_task.bills_added,
                    'error_message': completed_task.error_message
                }
            else:
                # Task still running
                return {
                    'task_id': task_id,
                    'status': 'running',
                    'start_time': task_info['start_time'].isoformat(),
                    'end_time': None,
                    'bills_updated': 0,
                    'bills_added': 0,
                    'error_message': None
                }
        
        # Task not found in active tasks, check database
        db_query = select(UpdateLogs).where(
            UpdateLogs.update_type == 'manual'
        ).order_by(desc(UpdateLogs.update_started)).limit(10)
        
        db_result = await db.execute(db_query)
        recent_tasks = db_result.scalars().all()
        
        # Try to find matching task (this is approximate)
        for task in recent_tasks:
            if task_id in str(task.update_started):
                return {
                    'task_id': task_id,
                    'status': task.status,
                    'start_time': task.update_started.isoformat(),
                    'end_time': task.update_completed.isoformat() if task.update_completed else None,
                    'bills_updated': task.bills_updated,
                    'bills_added': task.bills_added,
                    'error_message': task.error_message
                }
        
        raise HTTPException(status_code=404, detail="Task not found")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting task status: {str(e)}")


@router.get("/notifications", response_model=NotificationResponse)
async def get_notifications(
    limit: int = 50,
    unread_only: bool = False,
    state_code: Optional[str] = None,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Get update notifications
    
    Args:
        limit: Maximum number of notifications to return
        unread_only: Only return unread notifications
        state_code: Optional state filter
        db: Database session
        
    Returns:
        NotificationResponse with notifications
    """
    try:
        # Build query filters
        filters = []
        if unread_only:
            filters.append(UpdateNotifications.notification_read == False)
        if state_code:
            filters.append(UpdateNotifications.state_code == state_code)
        
        # Get notifications
        notifications_query = select(UpdateNotifications).where(
            and_(*filters) if filters else True
        ).order_by(desc(UpdateNotifications.notification_created)).limit(limit)
        
        notifications_result = await db.execute(notifications_query)
        notifications = notifications_result.scalars().all()
        
        # Get total count
        total_count_query = select(UpdateNotifications).where(
            and_(*filters) if filters else True
        )
        total_count_result = await db.execute(total_count_query)
        total_count = len(total_count_result.scalars().all())
        
        # Get unread count
        unread_count_query = select(UpdateNotifications).where(
            and_(
                UpdateNotifications.notification_read == False,
                *([UpdateNotifications.state_code == state_code] if state_code else [])
            )
        )
        unread_count_result = await db.execute(unread_count_query)
        unread_count = len(unread_count_result.scalars().all())
        
        return NotificationResponse(
            notifications=[notification.to_dict() for notification in notifications],
            total_count=total_count,
            unread_count=unread_count
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting notifications: {str(e)}")


@router.post("/notifications/{notification_id}/mark-read")
async def mark_notification_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Mark a notification as read
    
    Args:
        notification_id: Notification ID
        db: Database session
        
    Returns:
        Success message
    """
    try:
        update_query = update(UpdateNotifications).where(
            UpdateNotifications.id == notification_id
        ).values(notification_read=True)
        
        result = await db.execute(update_query)
        await db.commit()
        
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Notification not found")
        
        return {"message": "Notification marked as read"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error marking notification as read: {str(e)}")


@router.post("/notifications/mark-all-read")
async def mark_all_notifications_read(
    state_code: Optional[str] = None,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Mark all notifications as read
    
    Args:
        state_code: Optional state filter
        db: Database session
        
    Returns:
        Success message with count
    """
    try:
        filters = [UpdateNotifications.notification_read == False]
        if state_code:
            filters.append(UpdateNotifications.state_code == state_code)
        
        update_query = update(UpdateNotifications).where(
            and_(*filters)
        ).values(notification_read=True)
        
        result = await db.execute(update_query)
        await db.commit()
        
        return {"message": f"Marked {result.rowcount} notifications as read"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error marking notifications as read: {str(e)}")


@router.delete("/notifications/{notification_id}")
async def delete_notification(
    notification_id: int,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Delete a notification
    
    Args:
        notification_id: Notification ID
        db: Database session
        
    Returns:
        Success message
    """
    try:
        delete_query = delete(UpdateNotifications).where(
            UpdateNotifications.id == notification_id
        )
        
        result = await db.execute(delete_query)
        await db.commit()
        
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Notification not found")
        
        return {"message": "Notification deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting notification: {str(e)}")


# Background task function
async def run_manual_update(
    task_id: str,
    state_code: Optional[str] = None,
    session_id: Optional[str] = None,
    force_update: bool = False
):
    """
    Run manual update as background task
    
    Args:
        task_id: Task identifier
        state_code: Optional state filter
        session_id: Optional session filter
        force_update: Force update even if recently updated
    """
    try:
        updater = NightlyBillUpdater()
        
        # Update task status
        if task_id in active_tasks:
            active_tasks[task_id]['status'] = 'running'
        
        # Run the update
        if session_id:
            # Update specific session
            session_info = {'session_id': session_id, 'state_code': state_code}
            result = await updater.update_session_bills(session_info, force_update=force_update)
        else:
            # Run full update
            result = await updater.run_nightly_update(force_update=force_update)
        
        # Update task status
        if task_id in active_tasks:
            active_tasks[task_id]['status'] = 'completed'
            active_tasks[task_id]['result'] = result
        
    except Exception as e:
        # Update task status
        if task_id in active_tasks:
            active_tasks[task_id]['status'] = 'failed'
            active_tasks[task_id]['error'] = str(e)
        
        # Log error
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Manual update task {task_id} failed: {str(e)}")


# Add router to main app
def include_update_routes(app):
    """Include update routes in main FastAPI app"""
    app.include_router(router)