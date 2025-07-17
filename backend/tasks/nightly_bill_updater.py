"""
Nightly Bill Updater Task
Handles automated updates of legislative bills from LegiScan API
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from sqlalchemy import select, insert, update, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from database.db_setup import get_db_session
from models.bills import Bills
from models.update_logs import UpdateLogs
from models.update_notifications import UpdateNotifications
from legiscan_service import LegiScanService
from services.ai_processor import BillAnalyzer
from utils.rate_limiter import RateLimitedClient

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class NightlyBillUpdater:
    def __init__(self):
        self.legiscan = LegiScanService()
        self.ai_analyzer = BillAnalyzer()
        self.rate_limiter = RateLimitedClient(requests_per_minute=60)
        
    async def run_nightly_update(self, force_update: bool = False) -> Dict:
        """
        Main entry point for nightly bill updates
        
        Args:
            force_update: If True, updates all bills regardless of last update time
            
        Returns:
            Dict with update statistics
        """
        start_time = datetime.utcnow()
        total_stats = {
            'sessions_updated': 0,
            'bills_added': 0,
            'bills_updated': 0,
            'ai_processed': 0,
            'errors': []
        }
        
        logger.info(f"Starting nightly bill update at {start_time}")
        
        try:
            # Get active sessions to update
            active_sessions = await self.get_active_sessions()
            logger.info(f"Found {len(active_sessions)} active sessions to update")
            
            # Update each session
            for session in active_sessions:
                try:
                    session_stats = await self.update_session_bills(
                        session, 
                        force_update=force_update
                    )
                    
                    total_stats['sessions_updated'] += 1
                    total_stats['bills_added'] += session_stats['bills_added']
                    total_stats['bills_updated'] += session_stats['bills_updated']
                    total_stats['ai_processed'] += session_stats['ai_processed']
                    
                    logger.info(f"Updated session {session['session_id']}: {session_stats}")
                    
                except Exception as e:
                    error_msg = f"Failed to update session {session['session_id']}: {str(e)}"
                    logger.error(error_msg)
                    total_stats['errors'].append(error_msg)
                    
                    # Log failed session update
                    await self.log_session_update_failed(session, str(e))
                    
                # Rate limiting between sessions
                await self.rate_limiter.wait_if_needed()
                
        except Exception as e:
            error_msg = f"Critical error in nightly update: {str(e)}"
            logger.error(error_msg)
            total_stats['errors'].append(error_msg)
            
        finally:
            # Log overall completion
            end_time = datetime.utcnow()
            duration = (end_time - start_time).total_seconds()
            
            logger.info(f"Nightly update completed in {duration:.2f} seconds")
            logger.info(f"Final stats: {total_stats}")
            
            await self.log_nightly_completion(start_time, end_time, total_stats)
            
        return total_stats

    async def get_active_sessions(self) -> List[Dict]:
        """Get list of active legislative sessions that need updates"""
        async with get_db_session() as session:
            # Get sessions that have been active in the last 60 days
            cutoff_date = datetime.utcnow() - timedelta(days=60)
            
            query = select(Bills.session_id, Bills.state_code).where(
                Bills.last_updated > cutoff_date
            ).distinct()
            
            result = await session.execute(query)
            sessions = result.fetchall()
            
            # Convert to list of dicts
            return [
                {
                    'session_id': row.session_id,
                    'state_code': row.state_code
                }
                for row in sessions
            ]

    async def update_session_bills(self, session_info: Dict, force_update: bool = False) -> Dict:
        """
        Update bills for a specific session
        
        Args:
            session_info: Dict with session_id and state_code
            force_update: If True, updates all bills regardless of last update time
            
        Returns:
            Dict with update statistics for this session
        """
        session_id = session_info['session_id']
        state_code = session_info['state_code']
        
        start_time = datetime.utcnow()
        stats = {
            'bills_added': 0,
            'bills_updated': 0,
            'ai_processed': 0
        }
        
        # Log session update start
        log_id = await self.log_session_update_start(session_info)
        
        try:
            # Get last update time for this session
            last_update_time = await self.get_last_update_time(session_id)
            
            # If force_update is True, treat as if never updated
            if force_update:
                last_update_time = None
                
            # Get updated bills from LegiScan
            updated_bills = await self.legiscan.get_updated_bills(
                session_id=session_id,
                since=last_update_time,
                state_code=state_code
            )
            
            logger.info(f"Found {len(updated_bills)} bills to process for session {session_id}")
            
            # Process each bill
            for bill_data in updated_bills:
                try:
                    # Save or update bill in database
                    is_new_bill = await self.save_or_update_bill(bill_data)
                    
                    if is_new_bill:
                        stats['bills_added'] += 1
                    else:
                        stats['bills_updated'] += 1
                        
                    # Queue for AI processing if significant changes
                    if await self.should_process_with_ai(bill_data, is_new_bill):
                        await self.queue_for_ai_processing(bill_data)
                        stats['ai_processed'] += 1
                        
                except Exception as e:
                    logger.error(f"Failed to process bill {bill_data.get('bill_id', 'unknown')}: {str(e)}")
                    
                # Rate limiting between bills
                await self.rate_limiter.wait_if_needed()
                
            # Log session update completion
            await self.log_session_update_completion(log_id, stats)
            
            # Create user notification if there were significant updates
            if stats['bills_added'] > 0 or stats['bills_updated'] > 5:
                await self.create_update_notification(session_info, stats)
                
        except Exception as e:
            # Log session update failure
            await self.log_session_update_failed(session_info, str(e), log_id)
            raise
            
        return stats

    async def get_last_update_time(self, session_id: str) -> Optional[datetime]:
        """Get the last successful update time for a session"""
        async with get_db_session() as session:
            query = select(UpdateLogs.update_completed).where(
                and_(
                    UpdateLogs.session_id == session_id,
                    UpdateLogs.status == 'completed'
                )
            ).order_by(UpdateLogs.update_completed.desc()).limit(1)
            
            result = await session.execute(query)
            last_update = result.scalar_one_or_none()
            
            return last_update

    async def save_or_update_bill(self, bill_data: Dict) -> bool:
        """
        Save or update a bill in the database
        
        Args:
            bill_data: Dictionary containing bill information
            
        Returns:
            True if new bill was created, False if existing bill was updated
        """
        async with get_db_session() as session:
            # Check if bill already exists
            existing_query = select(Bills).where(Bills.bill_id == bill_data['bill_id'])
            existing_result = await session.execute(existing_query)
            existing_bill = existing_result.scalar_one_or_none()
            
            if existing_bill:
                # Update existing bill
                update_query = update(Bills).where(
                    Bills.bill_id == bill_data['bill_id']
                ).values(
                    title=bill_data.get('title', existing_bill.title),
                    description=bill_data.get('description', existing_bill.description),
                    status=bill_data.get('status', existing_bill.status),
                    legiscan_last_modified=bill_data.get('last_modified'),
                    needs_ai_processing=True,
                    last_updated=datetime.utcnow()
                )
                
                await session.execute(update_query)
                await session.commit()
                return False
                
            else:
                # Create new bill
                new_bill = Bills(
                    bill_id=bill_data['bill_id'],
                    session_id=bill_data['session_id'],
                    state_code=bill_data['state_code'],
                    title=bill_data.get('title', ''),
                    description=bill_data.get('description', ''),
                    status=bill_data.get('status', ''),
                    legiscan_last_modified=bill_data.get('last_modified'),
                    needs_ai_processing=True,
                    last_updated=datetime.utcnow()
                )
                
                session.add(new_bill)
                await session.commit()
                return True

    async def should_process_with_ai(self, bill_data: Dict, is_new_bill: bool) -> bool:
        """
        Determine if a bill should be processed with AI
        
        Args:
            bill_data: Dictionary containing bill information
            is_new_bill: Whether this is a new bill
            
        Returns:
            True if should process with AI
        """
        # Always process new bills
        if is_new_bill:
            return True
            
        # Process if status changed significantly
        significant_status_changes = [
            'passed', 'failed', 'vetoed', 'enrolled', 'signed'
        ]
        
        current_status = bill_data.get('status', '').lower()
        return any(status in current_status for status in significant_status_changes)

    async def queue_for_ai_processing(self, bill_data: Dict):
        """Queue a bill for AI processing"""
        # Mark bill as needing AI processing
        async with get_db_session() as session:
            update_query = update(Bills).where(
                Bills.bill_id == bill_data['bill_id']
            ).values(needs_ai_processing=True)
            
            await session.execute(update_query)
            await session.commit()

    async def log_session_update_start(self, session_info: Dict) -> int:
        """Log the start of a session update"""
        async with get_db_session() as session:
            insert_query = insert(UpdateLogs).values(
                session_id=session_info['session_id'],
                state_code=session_info['state_code'],
                update_started=datetime.utcnow(),
                status='running',
                update_type='nightly'
            )
            
            result = await session.execute(insert_query)
            await session.commit()
            return result.inserted_primary_key[0]

    async def log_session_update_completion(self, log_id: int, stats: Dict):
        """Log the completion of a session update"""
        async with get_db_session() as session:
            update_query = update(UpdateLogs).where(
                UpdateLogs.id == log_id
            ).values(
                update_completed=datetime.utcnow(),
                status='completed',
                bills_added=stats['bills_added'],
                bills_updated=stats['bills_updated']
            )
            
            await session.execute(update_query)
            await session.commit()

    async def log_session_update_failed(self, session_info: Dict, error: str, log_id: int = None):
        """Log a failed session update"""
        async with get_db_session() as session:
            if log_id:
                # Update existing log
                update_query = update(UpdateLogs).where(
                    UpdateLogs.id == log_id
                ).values(
                    update_completed=datetime.utcnow(),
                    status='failed',
                    error_message=error
                )
                await session.execute(update_query)
            else:
                # Create new log entry
                insert_query = insert(UpdateLogs).values(
                    session_id=session_info['session_id'],
                    state_code=session_info['state_code'],
                    update_started=datetime.utcnow(),
                    update_completed=datetime.utcnow(),
                    status='failed',
                    error_message=error,
                    update_type='nightly'
                )
                await session.execute(insert_query)
                
            await session.commit()

    async def log_nightly_completion(self, start_time: datetime, end_time: datetime, stats: Dict):
        """Log the completion of the entire nightly update"""
        duration = (end_time - start_time).total_seconds()
        
        logger.info(f"Nightly update completed:")
        logger.info(f"  Duration: {duration:.2f} seconds")
        logger.info(f"  Sessions updated: {stats['sessions_updated']}")
        logger.info(f"  Bills added: {stats['bills_added']}")
        logger.info(f"  Bills updated: {stats['bills_updated']}")
        logger.info(f"  AI processed: {stats['ai_processed']}")
        logger.info(f"  Errors: {len(stats['errors'])}")

    async def create_update_notification(self, session_info: Dict, stats: Dict):
        """Create a notification for users about updates"""
        async with get_db_session() as session:
            insert_query = insert(UpdateNotifications).values(
                session_id=session_info['session_id'],
                state_code=session_info['state_code'],
                new_bills_count=stats['bills_added'],
                updated_bills_count=stats['bills_updated'],
                notification_created=datetime.utcnow(),
                notification_type='bill_update'
            )
            
            await session.execute(insert_query)
            await session.commit()


# CLI entry point for manual execution
async def main():
    """Main entry point for manual execution"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Run nightly bill updates')
    parser.add_argument('--force', action='store_true', help='Force update all bills')
    args = parser.parse_args()
    
    updater = NightlyBillUpdater()
    result = await updater.run_nightly_update(force_update=args.force)
    
    print(f"Update completed: {result}")


if __name__ == "__main__":
    asyncio.run(main())