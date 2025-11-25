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
    start_time = datetime.now()
    execution_name = os.getenv('CONTAINER_APP_REPLICA_NAME', f"job-executive-orders-nightly--{start_time.strftime('%Y%m%d%H%M%S')}")
    job_name = "job-executive-orders-nightly"

    logger.info("🚀 Starting Azure Container Job: Nightly Executive Order Fetch")
    logger.info(f"📋 Execution name: {execution_name}")
    logger.info(f"⏰ Execution time: {datetime.utcnow().isoformat()}Z")
    logger.info(f"🌐 Environment: {os.getenv('ENVIRONMENT', 'unknown')}")
    
    try:
        # Add parent directory to path for imports
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        sys.path.insert(0, backend_dir)
        
        # Explicitly add to PYTHONPATH
        os.environ['PYTHONPATH'] = backend_dir + ':' + os.environ.get('PYTHONPATH', '')
        
        # Import here to ensure all dependencies are available
        from simple_executive_orders import fetch_executive_orders_simple_integration
        from database_config import get_db_connection
        from job_execution_summaries import save_job_summary, generate_summary_message, create_job_summaries_table

        logger.info("📦 Dependencies loaded successfully")

        # Create summaries table if it doesn't exist
        create_job_summaries_table()
        
        # Test database connection
        logger.info("🗄️ Testing database connection...")
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM executive_orders")
            count = cursor.fetchone()[0]
            logger.info(f"✅ Database connected. Current EO count: {count}")
        
        # Fetch new executive orders with AI processing
        # TEMPORARY FIX: AI disabled until Azure environment variables are configured
        logger.info("🔍 Fetching new executive orders (AI temporarily disabled)...")
        result = await fetch_executive_orders_simple_integration(
            start_date=None,  # Auto-determine new orders
            end_date=None,
            with_ai=False,    # TEMP: Disable AI until Azure env vars fixed
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
                        UPDATE executive_orders
                        SET is_new = true,
                            last_updated = CURRENT_TIMESTAMP
                        WHERE created_at >= NOW() - INTERVAL '1 hour'
                        AND (is_new IS NULL OR is_new = false)
                    """)
                    updated_count = cursor.rowcount
                    conn.commit()
                    logger.info(f"✅ Marked {updated_count} orders as new")

                    # Verify AI processing by checking database
                    cursor.execute("""
                        SELECT COUNT(*) FROM executive_orders
                        WHERE ai_executive_summary IS NOT NULL
                        AND ai_executive_summary != ''
                        AND created_at >= NOW() - INTERVAL '1 hour'
                    """)
                    ai_count = cursor.fetchone()[0]
                    logger.info(f"🔍 Verification: {ai_count} recent orders have AI summaries in database")

            # Save execution summary to database
            end_time = datetime.now()
            summary_msg = generate_summary_message('executive-orders', new_count)
            logger.info(f"💾 Saving execution summary: {summary_msg}")

            save_job_summary(
                execution_name=execution_name,
                job_name=job_name,
                job_type='executive-orders',
                status='Succeeded',
                summary=summary_msg,
                items_processed=new_count,
                items_total=new_count,
                is_manual=False,  # This is a scheduled execution
                start_time=start_time,
                end_time=end_time
            )

            logger.info(f"📊 Final summary: {summary_msg}")
            logger.info("🎉 Azure Container Job completed successfully!")
            sys.exit(0)  # Success exit code
            
        else:
            error_msg = result.get('error', 'Unknown error')
            logger.error(f"❌ Nightly fetch failed: {error_msg}")

            # Save failure summary
            end_time = datetime.now()
            save_job_summary(
                execution_name=execution_name,
                job_name=job_name,
                job_type='executive-orders',
                status='Failed',
                summary=f"Job failed: {error_msg}",
                items_processed=0,
                items_total=0,
                is_manual=False,
                start_time=start_time,
                end_time=end_time
            )

            logger.error("💥 Azure Container Job failed!")
            sys.exit(1)  # Failure exit code
            
    except Exception as e:
        logger.error(f"❌ Critical error in Azure Container Job: {e}")
        logger.error(f"📋 Traceback: {traceback.format_exc()}")

        # Save exception summary
        try:
            from job_execution_summaries import save_job_summary
            end_time = datetime.now()
            save_job_summary(
                execution_name=execution_name,
                job_name=job_name,
                job_type='executive-orders',
                status='Failed',
                summary=f"Job failed with exception: {str(e)}",
                items_processed=0,
                items_total=0,
                is_manual=False,
                start_time=start_time,
                end_time=end_time
            )
        except:
            pass  # Don't fail if we can't save the summary

        logger.error("💥 Azure Container Job failed with exception!")
        sys.exit(1)  # Failure exit code

if __name__ == "__main__":
    asyncio.run(main())