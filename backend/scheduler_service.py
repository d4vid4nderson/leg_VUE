#!/usr/bin/env python3
"""
Executive Order Scheduler Service
Automatically fetches executive orders at 2 AM Central Time daily
"""

import asyncio
import logging
import pytz
from datetime import datetime, time, timedelta
from typing import Optional
import signal
import sys

from simple_executive_orders import fetch_executive_orders_simple_integration

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/app/logs/scheduler.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class ExecutiveOrderScheduler:
    def __init__(self):
        self.running = False
        self.central_tz = pytz.timezone('America/Chicago')
        self.target_time = time(2, 0)  # 2:00 AM
        
    async def fetch_new_orders(self):
        """Fetch new executive orders and mark them as new"""
        try:
            logger.info("🚀 Starting scheduled executive order fetch...")
            
            # Fetch only new orders (no date limits to get latest)
            result = await fetch_executive_orders_simple_integration(
                start_date=None,  # Let it determine new orders automatically
                end_date=None,
                limit=None,
                session_name=None,
                user_id="scheduler"
            )
            
            if result.get('success'):
                new_count = result.get('processed_count', 0)
                logger.info(f"✅ Scheduled fetch completed: {new_count} new orders processed")
                
                # Mark orders as new if we got any
                if new_count > 0:
                    await self.mark_recent_orders_as_new()
                    
                return {
                    'success': True,
                    'new_orders': new_count,
                    'timestamp': datetime.now(self.central_tz).isoformat()
                }
            else:
                error_msg = result.get('error', 'Unknown error')
                logger.error(f"❌ Scheduled fetch failed: {error_msg}")
                return {
                    'success': False,
                    'error': error_msg,
                    'timestamp': datetime.now(self.central_tz).isoformat()
                }
                
        except Exception as e:
            logger.error(f"❌ Error in scheduled fetch: {e}")
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now(self.central_tz).isoformat()
            }
    
    async def mark_recent_orders_as_new(self):
        """Mark recently fetched orders as new for frontend notification"""
        try:
            from database_config import get_db_connection

            with get_db_connection() as conn:
                cursor = conn.cursor()

                # Mark orders added in the last hour as new
                cursor.execute("""
                    UPDATE executive_orders
                    SET is_new = true,
                        last_updated = CURRENT_TIMESTAMP
                    WHERE created_at >= NOW() - INTERVAL '1 hour'
                    AND (is_new IS NULL OR is_new = false)
                """)

                updated_count = cursor.rowcount
                conn.commit()

                logger.info(f"✅ Marked {updated_count} orders as new")

        except Exception as e:
            logger.error(f"❌ Error marking orders as new: {e}")
    
    def get_seconds_until_target(self) -> int:
        """Calculate seconds until next 2 AM Central Time"""
        now = datetime.now(self.central_tz)
        target_datetime = now.replace(hour=2, minute=0, second=0, microsecond=0)
        
        # If it's already past 2 AM today, schedule for tomorrow
        if now.time() > self.target_time:
            target_datetime = target_datetime.replace(day=target_datetime.day + 1)
        
        time_diff = target_datetime - now
        return int(time_diff.total_seconds())
    
    async def run_scheduler(self):
        """Main scheduler loop"""
        self.running = True
        logger.info("🕐 Executive Order Scheduler started")
        logger.info(f"⏰ Target time: {self.target_time} Central Time")
        
        while self.running:
            try:
                # Calculate time until next 2 AM Central
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
                logger.info("🎯 Target time reached - executing fetch...")
                result = await self.fetch_new_orders()
                
                if result['success']:
                    logger.info(f"✅ Daily fetch successful: {result.get('new_orders', 0)} new orders")
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
        logger.info("🛑 Stopping scheduler...")
        self.running = False

# Global scheduler instance
scheduler_instance: Optional[ExecutiveOrderScheduler] = None

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
    scheduler_instance = ExecutiveOrderScheduler()
    
    try:
        await scheduler_instance.run_scheduler()
    except KeyboardInterrupt:
        logger.info("📡 Received keyboard interrupt")
    finally:
        if scheduler_instance:
            scheduler_instance.stop()

if __name__ == "__main__":
    asyncio.run(main())