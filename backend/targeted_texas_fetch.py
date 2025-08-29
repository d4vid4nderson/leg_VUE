#!/usr/bin/env python3
"""
Targeted fetch for missing Texas 89th 2nd Special Session bills
This script fetches the remaining bills from LegiScan API to close the gap.
"""

import sys
import os
import asyncio
import logging
from datetime import datetime, date
from database_config import get_db_connection

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from legiscan_service import EnhancedLegiScanClient

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class TargetedTexasFetch:
    def __init__(self):
        self.client = EnhancedLegiScanClient()
        self.session_id = 2223  # Texas 89th 2nd Special Session
        self.state_abbr = 'TX'
        
    def get_existing_bill_ids(self):
        """Get list of bill IDs already in database for this session"""
        existing_ids = set()
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Get all Texas bills that might be from this session
            cursor.execute("""
                SELECT bill_id, bill_number, session_name
                FROM dbo.state_legislation
                WHERE state = 'TX'
                AND (session_name LIKE '%89th%special%' 
                     OR session_name LIKE '%89th%2nd%'
                     OR session_name LIKE '%2nd%special%')
            """)
            
            results = cursor.fetchall()
            for bill_id, bill_num, session in results:
                if bill_id:
                    existing_ids.add(int(bill_id))
                    
            logger.info(f"Found {len(existing_ids)} existing bills in database")
            
        return existing_ids
        
    async def fetch_master_list(self):
        """Fetch complete master list from LegiScan for session 2223"""
        logger.info(f"Fetching bills for Texas session {self.session_id}")
        
        try:
            # Use enhanced search with session_id to get all bills
            search_result = await self.client.search_bills_enhanced(
                state=self.state_abbr,
                query="*",  # Wildcard to get all bills
                session_id=self.session_id,
                limit=2000,
                max_pages=10
            )
            
            if not search_result or not search_result.get('success'):
                logger.error("Failed to get bills from API")
                return []
                
            bills = search_result.get('bills', [])
            logger.info(f"Retrieved {len(bills)} bills from LegiScan API")
            
            return bills
            
        except Exception as e:
            logger.error(f"Error fetching bills: {e}")
            return []
            
    def identify_missing_bills(self, api_bills, existing_ids):
        """Identify which bills are missing from our database"""
        missing_bills = []
        
        for bill in api_bills:
            bill_id = int(bill.get('bill_id', 0))
            
            if bill_id not in existing_ids:
                missing_bills.append(bill)
                
        logger.info(f"Identified {len(missing_bills)} missing bills")
        return missing_bills
        
    async def fetch_bill_details(self, bill_id):
        """Fetch detailed bill information"""
        try:
            bill_details = await self.client.get_bill_detailed(bill_id)
            
            if bill_details and 'bill' in bill_details:
                return bill_details['bill']
            else:
                logger.warning(f"No details found for bill {bill_id}")
                return None
                
        except Exception as e:
            logger.error(f"Error fetching bill {bill_id}: {e}")
            return None
            
    def save_bill_to_database(self, bill_data):
        """Save bill to database"""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Extract bill information
                bill_id = bill_data.get('bill_id')
                bill_number = bill_data.get('bill_number', '')
                title = bill_data.get('title', '')
                description = bill_data.get('description', '')
                status = bill_data.get('status', '')
                status_date = bill_data.get('status_date', '')
                
                # Handle dates
                introduced_date = bill_data.get('introduced', '')
                last_action_date = bill_data.get('last_action_date', '')
                
                # Parse dates if they exist
                if introduced_date:
                    try:
                        introduced_date = datetime.strptime(introduced_date, '%Y-%m-%d').date()
                    except:
                        introduced_date = None
                        
                if last_action_date:
                    try:
                        last_action_date = datetime.strptime(last_action_date, '%Y-%m-%d').date()
                    except:
                        last_action_date = None
                        
                # Session info
                session_info = bill_data.get('session', {})
                session_name = session_info.get('session_name', 'Texas 89th Legislature 2nd Special Session')
                
                # Insert into database
                cursor.execute("""
                    INSERT INTO dbo.state_legislation (
                        bill_id, state, session_name, bill_number,
                        title, description, status, status_date,
                        introduced_date, last_action_date,
                        last_updated, category
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    bill_id,
                    self.state_abbr,
                    session_name,
                    bill_number,
                    title[:500] if title else None,
                    description[:2000] if description else None,
                    status[:200] if status else None,
                    status_date if status_date else None,
                    introduced_date,
                    last_action_date,
                    datetime.now(),
                    'not-applicable'  # Default category
                ))
                
                conn.commit()
                logger.info(f"✅ Saved {bill_number} ({bill_id}) to database")
                return True
                
        except Exception as e:
            logger.error(f"❌ Error saving bill {bill_id}: {e}")
            return False
            
    async def run_targeted_fetch(self):
        """Main execution method"""
        logger.info("🚀 Starting targeted fetch for missing Texas bills")
        
        # Step 1: Get existing bills from database
        existing_ids = self.get_existing_bill_ids()
        
        # Step 2: Fetch complete master list from API
        api_bills = await self.fetch_master_list()
        if not api_bills:
            logger.error("Failed to get bills from API")
            return False
            
        # Step 3: Identify missing bills
        missing_bills = self.identify_missing_bills(api_bills, existing_ids)
        
        if not missing_bills:
            logger.info("✅ No missing bills found - database is up to date")
            return True
            
        logger.info(f"📥 Processing {len(missing_bills)} missing bills")
        
        # Step 4: Fetch and save missing bills
        processed = 0
        failed = 0
        
        for i, bill_summary in enumerate(missing_bills, 1):
            bill_id = bill_summary.get('bill_id')
            bill_number = bill_summary.get('number', 'Unknown')
            
            logger.info(f"[{i}/{len(missing_bills)}] Fetching {bill_number} ({bill_id})")
            
            # Fetch detailed bill information
            bill_details = await self.fetch_bill_details(bill_id)
            
            if bill_details:
                # Save to database
                if self.save_bill_to_database(bill_details):
                    processed += 1
                else:
                    failed += 1
            else:
                failed += 1
                
            # Rate limiting
            await asyncio.sleep(0.5)
            
        logger.info(f"📊 Fetch Summary:")
        logger.info(f"  - Processed: {processed}")
        logger.info(f"  - Failed: {failed}")
        logger.info(f"  - Total: {len(missing_bills)}")
        
        return processed > 0
        
async def main():
    """Main entry point"""
    fetcher = TargetedTexasFetch()
    success = await fetcher.run_targeted_fetch()
    
    if success:
        logger.info("🎉 Targeted fetch completed successfully")
    else:
        logger.error("💥 Targeted fetch failed")
        sys.exit(1)
        
if __name__ == "__main__":
    asyncio.run(main())