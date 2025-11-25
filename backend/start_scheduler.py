#!/usr/bin/env python3
"""
Startup script for the Executive Order Scheduler
Can be run as a background service or manually
"""

import asyncio
import logging
import os
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from scheduler_service import ExecutiveOrderScheduler

def setup_logging():
    """Setup logging for the scheduler service"""
    log_dir = Path('/app/logs')
    log_dir.mkdir(exist_ok=True)
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_dir / 'scheduler.log'),
            logging.StreamHandler(sys.stdout)
        ]
    )

async def main():
    """Main entry point for the scheduler service"""
    setup_logging()
    logger = logging.getLogger(__name__)
    
    logger.info("🚀 Starting Executive Order Scheduler Service")
    logger.info(f"📁 Working directory: {os.getcwd()}")
    logger.info(f"🐍 Python path: {sys.path[:3]}...")
    
    scheduler = ExecutiveOrderScheduler()
    
    try:
        await scheduler.run_scheduler()
    except KeyboardInterrupt:
        logger.info("📡 Received keyboard interrupt - shutting down gracefully")
    except Exception as e:
        logger.error(f"❌ Scheduler error: {e}")
        raise
    finally:
        scheduler.stop()
        logger.info("🛑 Scheduler service stopped")

if __name__ == "__main__":
    asyncio.run(main())