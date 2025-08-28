#!/usr/bin/env python3
"""
Azure Container Job: Nightly Executive Order Fetcher
Designed to run as a scheduled Azure Container Job
"""

import asyncio
import logging
import sys
import os
from datetime import datetime
import traceback

# Setup logging for Azure Container Jobs
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

async def main():
    """Main entry point for Azure Container Job"""
    logger.info("🚀 Starting Azure Container Job: Nightly Executive Order Fetch")
    logger.info(f"⏰ Execution time: {datetime.utcnow().isoformat()}Z")
    logger.info(f"🌐 Environment: {os.getenv('ENVIRONMENT', 'unknown')}")
    
    try:
        # Add parent directory to path for imports
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        
        # Import here to ensure all dependencies are available
        from simple_executive_orders import fetch_executive_orders_simple_integration
        from database_config import get_db_connection
        
        logger.info("📦 Dependencies loaded successfully")
        
        # Test database connection
        logger.info("🗄️ Testing database connection...")
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM dbo.executive_orders")
            count = cursor.fetchone()[0]
            logger.info(f"✅ Database connected. Current EO count: {count}")
        
        # Fetch new executive orders with AI processing
        logger.info("🔍 Fetching new executive orders with AI foundry processing...")
        result = await fetch_executive_orders_simple_integration(
            start_date=None,  # Auto-determine new orders
            end_date=None,
            with_ai=True,     # Enable AI foundry processing
            limit=None,
            save_to_db=True,  # Save to database
            only_new=True     # Only process new orders
        )
        
        if result.get('success'):
            new_count = result.get('processed_count', 0)
            ai_processed = result.get('ai_successful', 0)
            ai_failed = result.get('ai_failed', 0)
            
            logger.info(f"✅ Nightly fetch completed successfully!")
            logger.info(f"📊 New executive orders processed: {new_count}")
            logger.info(f"🤖 AI foundry analysis results:")
            logger.info(f"  ✅ Successfully analyzed: {ai_processed}")
            logger.info(f"  ❌ Failed analysis: {ai_failed}")
            
            # Mark new orders for frontend notification
            if new_count > 0:
                logger.info("🏷️ Marking new orders for frontend notification...")
                with get_db_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute("""
                        UPDATE dbo.executive_orders 
                        SET is_new = 1, 
                            last_updated = GETDATE()
                        WHERE created_at >= DATEADD(hour, -1, GETDATE())
                        AND (is_new IS NULL OR is_new = 0)
                    """)
                    updated_count = cursor.rowcount
                    conn.commit()
                    logger.info(f"✅ Marked {updated_count} orders as new")
                    
                    # Verify AI processing by checking database
                    cursor.execute("""
                        SELECT COUNT(*) FROM dbo.executive_orders 
                        WHERE ai_executive_summary IS NOT NULL 
                        AND ai_executive_summary != ''
                        AND created_at >= DATEADD(hour, -1, GETDATE())
                    """)
                    ai_count = cursor.fetchone()[0]
                    logger.info(f"🔍 Verification: {ai_count} recent orders have AI summaries in database")
            
            logger.info("🎉 Azure Container Job completed successfully!")
            sys.exit(0)  # Success exit code
            
        else:
            error_msg = result.get('error', 'Unknown error')
            logger.error(f"❌ Nightly fetch failed: {error_msg}")
            logger.error("💥 Azure Container Job failed!")
            sys.exit(1)  # Failure exit code
            
    except Exception as e:
        logger.error(f"❌ Critical error in Azure Container Job: {e}")
        logger.error(f"📋 Traceback: {traceback.format_exc()}")
        logger.error("💥 Azure Container Job failed with exception!")
        sys.exit(1)  # Failure exit code

if __name__ == "__main__":
    asyncio.run(main())