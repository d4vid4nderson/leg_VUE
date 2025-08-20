#!/usr/bin/env python3
"""
State Legislation Scheduler Service
Automatically fetches state legislation at 3 AM Central Time daily
"""

import asyncio
import logging
import pytz
from datetime import datetime, time, timedelta
from typing import Optional, List
import signal
import sys
import threading
import aiohttp
import json

from database_config import get_db_connection

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/app/logs/state_scheduler.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class StateLegislationScheduler:
    def __init__(self):
        self.running = False
        self.central_tz = pytz.timezone('America/Chicago')
        self.target_time = time(3, 0)  # 3:00 AM
        self.active_states = ['CA', 'TX', 'NV', 'KY', 'SC', 'CO']  # States to process
        self.api_base_url = "http://localhost:8000"
        
    async def get_states_with_new_sessions(self) -> List[str]:
        """Check which states have new sessions to process"""
        try:
            states_to_process = []
            
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Get states ordered by processing priority
                cursor.execute("""
                    SELECT state, COUNT(*) as bill_count
                    FROM dbo.state_legislation 
                    WHERE state IN ('CA', 'TX', 'NV', 'KY', 'SC', 'CO')
                    GROUP BY state
                    ORDER BY 
                        CASE state
                            WHEN 'CA' THEN 1
                            WHEN 'NV' THEN 2
                            WHEN 'SC' THEN 3
                            WHEN 'KY' THEN 4
                            WHEN 'TX' THEN 5
                            WHEN 'CO' THEN 6
                            ELSE 7
                        END
                """)
                
                state_results = cursor.fetchall()
                available_states = [row[0] for row in state_results]
                
                # Always process at least one state per night, prioritize by current processing status
                if available_states:
                    states_to_process = available_states[:2]  # Process up to 2 states per night
                else:
                    # Fallback to priority order if no states found
                    states_to_process = ['CA']
                
                logger.info(f"States selected for processing: {states_to_process}")
                return states_to_process
                
        except Exception as e:
            logger.error(f"Error determining states to process: {e}")
            # Fallback to California if there's an error
            return ['CA']
    
    async def fetch_state_legislation(self, state: str) -> dict:
        """Fetch legislation for a specific state using the existing API endpoint"""
        try:
            logger.info(f"🚀 Starting legislation fetch for {state}...")
            
            # Use the existing incremental-state-fetch endpoint
            async with aiohttp.ClientSession() as session:
                payload = {
                    "state": state,
                    "batch_size": 25  # Smaller batch for overnight processing
                }
                
                async with session.post(
                    f"{self.api_base_url}/api/legiscan/incremental-state-fetch",
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=300)  # 5 minute timeout
                ) as response:
                    
                    if response.status == 200:
                        result = await response.json()
                        job_id = result.get('job_id')
                        
                        if job_id:
                            # Monitor the job progress
                            return await self.monitor_job_progress(job_id, state)
                        else:
                            return {
                                'success': False,
                                'error': 'No job ID returned',
                                'state': state
                            }
                    else:
                        error_text = await response.text()
                        return {
                            'success': False,
                            'error': f"HTTP {response.status}: {error_text}",
                            'state': state
                        }
                        
        except Exception as e:
            logger.error(f"❌ Error fetching legislation for {state}: {e}")
            return {
                'success': False,
                'error': str(e),
                'state': state
            }
    
    async def monitor_job_progress(self, job_id: str, state: str, max_wait_minutes: int = 30) -> dict:
        """Monitor the progress of a background job"""
        try:
            start_time = datetime.now()
            max_wait_time = timedelta(minutes=max_wait_minutes)
            
            logger.info(f"📊 Monitoring job {job_id} for {state} (max wait: {max_wait_minutes}m)")
            
            async with aiohttp.ClientSession() as session:
                while datetime.now() - start_time < max_wait_time:
                    try:
                        async with session.get(
                            f"{self.api_base_url}/api/legiscan/job-status/{job_id}",
                            timeout=aiohttp.ClientTimeout(total=30)
                        ) as response:
                            
                            if response.status == 200:
                                job_status = await response.json()
                                status = job_status.get('status', 'unknown')
                                processed = job_status.get('processed', 0)
                                total = job_status.get('total', 0)
                                message = job_status.get('message', '')
                                
                                if status == 'completed':
                                    logger.info(f"✅ Job {job_id} completed for {state}: {processed}/{total} processed")
                                    return {
                                        'success': True,
                                        'state': state,
                                        'processed': processed,
                                        'total': total,
                                        'job_id': job_id
                                    }
                                elif status == 'failed':
                                    logger.error(f"❌ Job {job_id} failed for {state}: {message}")
                                    return {
                                        'success': False,
                                        'error': f"Job failed: {message}",
                                        'state': state
                                    }
                                elif status == 'running':
                                    logger.info(f"⏳ Job {job_id} running for {state}: {processed}/{total} - {message}")
                                
                            # Wait before next check
                            await asyncio.sleep(60)  # Check every minute
                            
                    except Exception as e:
                        logger.warning(f"Error checking job status: {e}")
                        await asyncio.sleep(30)
                
                # Timeout reached
                logger.warning(f"⏰ Job {job_id} for {state} timed out after {max_wait_minutes} minutes")
                return {
                    'success': False,
                    'error': f"Job monitoring timed out after {max_wait_minutes} minutes",
                    'state': state
                }
                
        except Exception as e:
            logger.error(f"❌ Error monitoring job {job_id}: {e}")
            return {
                'success': False,
                'error': str(e),
                'state': state
            }
    
    async def mark_recent_bills_as_new(self, state: str):
        """Mark recently processed bills as new for frontend notification"""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Mark recently created bills as new (use id as proxy for recent creation)
                cursor.execute("""
                    UPDATE dbo.state_legislation 
                    SET is_new = 1, 
                        last_updated = CONVERT(VARCHAR, GETDATE(), 120)
                    WHERE state = ?
                    AND id IN (
                        SELECT TOP 50 id 
                        FROM dbo.state_legislation 
                        WHERE state = ?
                        ORDER BY id DESC
                    )
                    AND (is_new IS NULL OR is_new = 0)
                """, (state, state))
                
                updated_count = cursor.rowcount
                conn.commit()
                
                logger.info(f"✅ Marked {updated_count} bills as new for {state}")
                
        except Exception as e:
            logger.error(f"❌ Error marking bills as new for {state}: {e}")
    
    async def process_daily_fetch(self):
        """Execute the daily fetch for all selected states"""
        try:
            logger.info("🎯 Starting daily state legislation fetch...")
            
            # Get states to process
            states_to_process = await self.get_states_with_new_sessions()
            
            if not states_to_process:
                logger.info("📋 No states selected for processing")
                return {
                    'success': True,
                    'processed_states': 0,
                    'message': 'No states needed processing'
                }
            
            results = []
            successful_states = 0
            
            # Process each state
            for state in states_to_process:
                logger.info(f"🏛️ Processing state: {state}")
                
                result = await self.fetch_state_legislation(state)
                results.append(result)
                
                if result.get('success'):
                    successful_states += 1
                    processed_count = result.get('processed', 0)
                    
                    # Mark new bills for notification
                    if processed_count > 0:
                        await self.mark_recent_bills_as_new(state)
                    
                    logger.info(f"✅ {state}: {processed_count} bills processed")
                else:
                    logger.error(f"❌ {state}: {result.get('error', 'Unknown error')}")
                
                # Brief pause between states
                await asyncio.sleep(30)
            
            # Summary
            total_processed = sum(r.get('processed', 0) for r in results if r.get('success'))
            
            return {
                'success': True,
                'processed_states': successful_states,
                'total_states': len(states_to_process),
                'total_bills_processed': total_processed,
                'results': results,
                'timestamp': datetime.now(self.central_tz).isoformat()
            }
            
        except Exception as e:
            logger.error(f"❌ Error in daily fetch: {e}")
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now(self.central_tz).isoformat()
            }
    
    def get_seconds_until_target(self) -> int:
        """Calculate seconds until next 3 AM Central Time"""
        now = datetime.now(self.central_tz)
        target_datetime = now.replace(hour=3, minute=0, second=0, microsecond=0)
        
        # If it's already past 3 AM today, schedule for tomorrow
        if now.time() > self.target_time:
            target_datetime = target_datetime.replace(day=target_datetime.day + 1)
        
        time_diff = target_datetime - now
        return int(time_diff.total_seconds())
    
    async def run_scheduler(self):
        """Main scheduler loop"""
        self.running = True
        logger.info("🕐 State Legislation Scheduler started")
        logger.info(f"⏰ Target time: {self.target_time} Central Time")
        logger.info(f"🏛️ Active states: {', '.join(self.active_states)}")
        
        while self.running:
            try:
                # Calculate time until next 3 AM Central
                seconds_until_target = self.get_seconds_until_target()
                target_datetime = datetime.now(self.central_tz) + timedelta(seconds=seconds_until_target)
                
                logger.info(f"⏳ Next fetch scheduled for: {target_datetime.strftime('%Y-%m-%d %H:%M:%S %Z')}")
                logger.info(f"⏱️  Waiting {seconds_until_target // 3600}h {(seconds_until_target % 3600) // 60}m...")
                
                # Wait until target time (with periodic checks every hour)
                while seconds_until_target > 0 and self.running:
                    # Check every hour or remaining time, whichever is smaller
                    sleep_time = min(3600, seconds_until_target)
                    await asyncio.sleep(sleep_time)
                    
                    if not self.running:
                        break
                        
                    seconds_until_target = self.get_seconds_until_target()
                
                if not self.running:
                    break
                
                # Execute the fetch
                logger.info("🎯 Target time reached - executing daily fetch...")
                result = await self.process_daily_fetch()
                
                if result['success']:
                    processed_states = result.get('processed_states', 0)
                    total_bills = result.get('total_bills_processed', 0)
                    logger.info(f"✅ Daily fetch successful: {processed_states} states, {total_bills} bills processed")
                else:
                    logger.error(f"❌ Daily fetch failed: {result.get('error')}")
                
                # Small delay before next cycle
                await asyncio.sleep(60)
                
            except Exception as e:
                logger.error(f"❌ Error in scheduler loop: {e}")
                # Wait 5 minutes before retrying on error
                await asyncio.sleep(300)
    
    def stop(self):
        """Stop the scheduler"""
        logger.info("🛑 Stopping state legislation scheduler...")
        self.running = False

# Global scheduler instance
scheduler_instance: Optional[StateLegislationScheduler] = None

def signal_handler(signum, frame):
    """Handle shutdown signals gracefully"""
    global scheduler_instance
    logger.info(f"📡 Received signal {signum}")
    if scheduler_instance:
        scheduler_instance.stop()
    sys.exit(0)

async def main():
    """Main entry point"""
    global scheduler_instance
    
    # Setup signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Create and start scheduler
    scheduler_instance = StateLegislationScheduler()
    
    try:
        await scheduler_instance.run_scheduler()
    except KeyboardInterrupt:
        logger.info("📡 Received keyboard interrupt")
    finally:
        if scheduler_instance:
            scheduler_instance.stop()

if __name__ == "__main__":
    asyncio.run(main())