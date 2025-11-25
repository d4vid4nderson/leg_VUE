#!/usr/bin/env python3
"""
Direct LegiScan API fetch using getMasterList operation
"""

import asyncio
import aiohttp
import os
import sys
from datetime import datetime
from database_config import get_db_connection

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

LEGISCAN_API_KEY = os.getenv('LEGISCAN_API_KEY')

async def direct_master_list(session_id=2223):
    """Fetch master list directly from LegiScan API"""
    url = f"https://api.legiscan.com/?key={LEGISCAN_API_KEY}&op=getMasterList&id={session_id}"
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                response.raise_for_status()
                data = await response.json()
                
                if data.get('status') == "ERROR":
                    print(f"❌ API Error: {data.get('alert', {}).get('message', 'Unknown error')}")
                    return None
                
                masterlist = data.get('masterlist', [])
                print(f"✅ Retrieved {len(masterlist)} bills from master list")
                
                return masterlist
                
    except Exception as e:
        print(f"❌ Error fetching master list: {e}")
        return None

async def direct_bill_fetch(bill_id):
    """Fetch bill details directly"""
    url = f"https://api.legiscan.com/?key={LEGISCAN_API_KEY}&op=getBill&id={bill_id}"
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                response.raise_for_status()
                data = await response.json()
                
                if data.get('status') == "ERROR":
                    print(f"❌ Bill {bill_id} Error: {data.get('alert', {}).get('message', 'Unknown error')}")
                    return None
                
                bill_data = data.get('bill', {})
                return bill_data
                
    except Exception as e:
        print(f"❌ Error fetching bill {bill_id}: {e}")
        return None

def get_existing_bill_ids():
    """Get existing bill IDs from database"""
    existing_ids = set()
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
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
                existing_ids.add(str(bill_id))
                
        print(f"Found {len(existing_ids)} existing bills in database")
        
    return existing_ids

def save_bill_to_database(bill_data):
    """Save bill to database"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Extract bill information
            bill_id = bill_data.get('bill_id')
            bill_number = bill_data.get('bill_number', '')
            title = bill_data.get('title', '')
            description = bill_data.get('description', '')
            status = bill_data.get('status_desc', '')
            
            # Handle dates
            introduced_date = bill_data.get('history', [{}])[0].get('date') if bill_data.get('history') else None
            last_action_date = bill_data.get('history', [{}])[-1].get('date') if bill_data.get('history') else None
            
            # Session info
            session_info = bill_data.get('session', {})
            session_name = session_info.get('session_name', 'Texas 89th Legislature 2nd Special Session')
            
            # Insert into database
            cursor.execute("""
                INSERT INTO dbo.state_legislation (
                    bill_id, state, session_name, bill_number,
                    title, description, status,
                    introduced_date, last_action_date,
                    last_updated, category, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                str(bill_id),
                'TX',
                session_name,
                bill_number,
                title[:500] if title else None,
                description[:2000] if description else None,
                status[:200] if status else None,
                introduced_date,
                last_action_date,
                datetime.now(),
                'not-applicable',  # Default category
                datetime.now()  # created_at
            ))
            
            conn.commit()
            print(f"✅ Saved {bill_number} ({bill_id}) to database")
            return True
            
    except Exception as e:
        if "duplicate key" in str(e):
            print(f"⏭️  {bill_number} ({bill_id}) already exists - skipping")
            return True  # Consider this a success since bill exists
        else:
            print(f"❌ Error saving bill {bill_id}: {e}")
            return False

async def main():
    """Main execution"""
    print("🚀 Starting direct LegiScan fetch for Texas 89th 2nd Special Session")
    
    # Get existing bills
    existing_ids = get_existing_bill_ids()
    
    # Fetch master list
    masterlist = await direct_master_list()
    if not masterlist:
        print("❌ Failed to get master list")
        return
    
    # Find missing bills
    missing_bills = []
    for key, bill_summary in masterlist.items():
        # Skip the session info entry
        if key == 'session':
            continue
            
        bill_id = str(bill_summary.get('bill_id', ''))
        if bill_id not in existing_ids:
            missing_bills.append(bill_summary)
    
    print(f"📊 Found {len(missing_bills)} missing bills to fetch")
    
    if not missing_bills:
        print("✅ No missing bills - database is up to date")
        return
    
    # Process missing bills
    processed = 0
    failed = 0
    
    for i, bill_summary in enumerate(missing_bills, 1):  # Process all missing bills
        bill_id = bill_summary.get('bill_id')
        bill_number = bill_summary.get('bill_number', 'Unknown')
        
        print(f"[{i}/{len(missing_bills)}] Fetching {bill_number} ({bill_id})")
        
        # Fetch detailed bill information
        bill_details = await direct_bill_fetch(bill_id)
        
        if bill_details:
            # Save to database
            if save_bill_to_database(bill_details):
                processed += 1
            else:
                failed += 1
        else:
            failed += 1
            
        # Rate limiting
        await asyncio.sleep(1)
    
    print(f"📊 Summary:")
    print(f"  - Processed: {processed}")
    print(f"  - Failed: {failed}")
    print(f"  - Total Bills: {len(missing_bills)}")

if __name__ == "__main__":
    asyncio.run(main())