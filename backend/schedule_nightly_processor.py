#!/usr/bin/env python3
"""
Scheduler for Nightly State Legislation Processing

This script can be run as a cron job or scheduled task to automatically
process state legislation every night.

Add to crontab for nightly execution at 2 AM:
0 2 * * * cd /path/to/backend && python schedule_nightly_processor.py

Or run manually for testing:
python schedule_nightly_processor.py
"""

import asyncio
import logging
import sys
from datetime import datetime
from nightly_state_legislation_processor import StatelegislationProcessor

# Configure logging for scheduler
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - SCHEDULER - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('nightly_scheduler.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

async def run_nightly_processing():
    """Run the nightly processing with error handling and recovery"""
    try:
        logger.info("🌙 Starting scheduled nightly state legislation processing")
        
        processor = StatelegislationProcessor()
        await processor.run()
        
        logger.info("✅ Scheduled processing completed successfully")
        return True
        
    except Exception as e:
        logger.error(f"❌ Nightly processing failed: {e}")
        return False

async def main():
    """Main entry point for scheduler"""
    start_time = datetime.now()
    logger.info(f"Scheduler started at {start_time}")
    
    success = await run_nightly_processing()
    
    end_time = datetime.now()
    duration = end_time - start_time
    
    logger.info(f"Scheduler completed at {end_time}")
    logger.info(f"Total duration: {duration}")
    
    if success:
        logger.info("🎉 All processing completed successfully")
        sys.exit(0)
    else:
        logger.error("💥 Processing failed - check logs for details")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())