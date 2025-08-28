#!/usr/bin/env python3
"""
Azure Container Job: Nightly State Bills Updater
Designed to run as a scheduled Azure Container Job
"""

import asyncio
import logging
import sys
import os
import argparse
from datetime import datetime, timedelta
import traceback

# Setup logging for Azure Container Jobs
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

# Define target states for processing
TARGET_STATES = ['CA', 'TX', 'NV', 'KY', 'SC', 'CO']

async def check_and_process_state_updates():
    """Check for state bill updates and process them"""
    logger.info("🔍 Checking for state bill updates...")
    
    try:
        # Add parent directory to path for imports
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        
        from database_config import get_db_connection
        
        # Test database connection
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Get current status of each state
            logger.info("📊 Current state processing status:")
            for state in TARGET_STATES:
                cursor.execute('''
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN ai_executive_summary IS NOT NULL AND ai_executive_summary != '' THEN 1 ELSE 0 END) as with_ai,
                        MAX(last_updated) as most_recent_update
                    FROM dbo.state_legislation
                    WHERE state = ?
                ''', (state,))
                
                result = cursor.fetchone()
                if result:
                    total, with_ai, most_recent = result
                    percentage = (with_ai/total*100) if total > 0 else 0
                    logger.info(f"  {state}: {with_ai}/{total} ({percentage:.1f}%) - Last update: {most_recent}")
            
            # Check for bills updated in last 24 hours
            yesterday = datetime.now() - timedelta(days=1)
            cursor.execute('''
                SELECT 
                    state,
                    COUNT(*) as updated_count
                FROM dbo.state_legislation
                WHERE last_updated >= ?
                GROUP BY state
                ORDER BY updated_count DESC
            ''', (yesterday,))
            
            recent_updates = cursor.fetchall()
            if recent_updates:
                logger.info("📈 Bills updated in last 24 hours:")
                for state, count in recent_updates:
                    logger.info(f"  {state}: {count} bills")
            else:
                logger.info("📭 No bills were updated in the last 24 hours")
            
            # For now, we'll focus on states that need AI processing
            # In future versions, this could integrate with LegiScan API to check for new bills
            
            # Find states with bills needing AI processing
            states_needing_ai = []
            for state in TARGET_STATES:
                cursor.execute('''
                    SELECT COUNT(*) 
                    FROM dbo.state_legislation
                    WHERE state = ?
                    AND (ai_executive_summary IS NULL OR ai_executive_summary = '')
                ''', (state,))
                
                needs_ai_count = cursor.fetchone()[0]
                if needs_ai_count > 0:
                    states_needing_ai.append((state, needs_ai_count))
            
            if states_needing_ai:
                logger.info("🤖 States needing AI processing:")
                for state, count in states_needing_ai:
                    logger.info(f"  {state}: {count} bills")
                
                # For now, just log this information
                # In production, you could trigger AI processing here
                logger.info("ℹ️  AI processing would be triggered here in full implementation")
            else:
                logger.info("✅ All target states have complete AI processing")
            
            return {
                'success': True,
                'states_checked': len(TARGET_STATES),
                'recent_updates': len(recent_updates) if recent_updates else 0,
                'states_needing_ai': len(states_needing_ai)
            }
            
    except Exception as e:
        logger.error(f"❌ Error checking state updates: {e}")
        return {
            'success': False,
            'error': str(e)
        }

async def main():
    """Main entry point for Azure Container Job"""
    parser = argparse.ArgumentParser(description='Nightly State Bills Updater')
    parser.add_argument('--production', action='store_true', help='Run in production mode')
    parser.add_argument('--force', action='store_true', help='Force update all bills')
    args = parser.parse_args()
    
    logger.info("🚀 Starting Azure Container Job: Nightly State Bills Update")
    logger.info(f"⏰ Execution time: {datetime.utcnow().isoformat()}Z")
    logger.info(f"🌐 Environment: {os.getenv('ENVIRONMENT', 'unknown')}")
    logger.info(f"🏭 Production mode: {args.production}")
    logger.info(f"⚡ Force update: {args.force}")
    
    try:
        # Check current database status
        result = await check_and_process_state_updates()
        
        if result['success']:
            logger.info("✅ State bills check completed successfully!")
            logger.info(f"📊 Summary:")
            logger.info(f"  - States checked: {result['states_checked']}")
            logger.info(f"  - Recent updates: {result['recent_updates']}")
            logger.info(f"  - States needing AI: {result['states_needing_ai']}")
            logger.info("🎉 Azure Container Job completed successfully!")
            sys.exit(0)  # Success exit code
        else:
            error_msg = result.get('error', 'Unknown error')
            logger.error(f"❌ State bills check failed: {error_msg}")
            logger.error("💥 Azure Container Job failed!")
            sys.exit(1)  # Failure exit code
            
    except Exception as e:
        logger.error(f"❌ Critical error in Azure Container Job: {e}")
        logger.error(f"📋 Traceback: {traceback.format_exc()}")
        logger.error("💥 Azure Container Job failed with exception!")
        sys.exit(1)  # Failure exit code

if __name__ == "__main__":
    asyncio.run(main())