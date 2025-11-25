#!/usr/bin/env python3
"""
Sync missing bills from Texas 89th 2nd Special Session
"""

import sys
import asyncio
import time
import requests
import os
from datetime import datetime
sys.path.append('/app')

from database_config import get_db_connection
from ai import analyze_executive_order

# Practice area keywords mapping
PRACTICE_AREA_KEYWORDS = {
    'healthcare': ['health', 'medical', 'hospital', 'insurance', 'medicare', 'patient', 'pharmacy'],
    'education': ['school', 'education', 'student', 'teacher', 'university', 'college'],
    'tax': ['tax', 'revenue', 'fiscal', 'budget', 'appropriation', 'finance'],
    'environment': ['environment', 'climate', 'pollution', 'renewable', 'conservation'],
    'criminal-justice': ['criminal', 'crime', 'police', 'prison', 'sentence', 'conviction'],
    'labor': ['labor', 'employment', 'worker', 'wage', 'union', 'workplace'],
    'housing': ['housing', 'rent', 'tenant', 'landlord', 'eviction', 'mortgage'],
    'transportation': ['transportation', 'highway', 'road', 'vehicle', 'traffic', 'transit'],
    'agriculture': ['agriculture', 'farm', 'crop', 'livestock', 'ranch'],
    'technology': ['technology', 'internet', 'digital', 'cyber', 'data', 'privacy'],
}

def determine_practice_area(title, description):
    """Determine practice area based on content"""
    text = f"{title or ''} {description or ''}".lower()
    
    for area, keywords in PRACTICE_AREA_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text:
                return area
    
    return 'government-operations'

def get_existing_bills():
    """Get existing bills from database"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT bill_number
            FROM dbo.state_legislation
            WHERE state = 'TX' 
            AND session_name = '89th Legislature 2nd Special Session'
        ''')
        
        return {row[0] for row in cursor.fetchall()}

def fetch_legiscan_bills():
    """Fetch all bills from LegiScan for 2nd Special Session"""
    api_key = os.getenv('LEGISCAN_API_KEY', '')
    session_id = 2223  # 89th Legislature 2nd Special Session
    
    print(f"🔍 Fetching bills from LegiScan session {session_id}...")
    
    url = f'https://api.legiscan.com/?key={api_key}&op=getMasterList&id={session_id}'
    response = requests.get(url)
    data = response.json()
    
    if 'masterlist' not in data:
        print("❌ No masterlist found in LegiScan response")
        return []
    
    bills = []
    for key, item in data['masterlist'].items():
        if isinstance(item, dict) and 'number' in item and key != 'session':
            # Convert LegiScan format to our expected format
            bill = {
                'bill_number': item.get('number', ''),
                'title': item.get('title', ''),
                'description': item.get('description', ''),
                'status_name': item.get('last_action', 'Unknown'),
                'state_link': item.get('url', ''),
                'last_action_date': item.get('last_action_date', ''),
                'bill_id': item.get('bill_id', ''),
                'status': item.get('status', '')
            }
            bills.append(bill)
    
    print(f"📊 Found {len(bills)} bills in LegiScan")
    return bills

def insert_missing_bills(missing_bills):
    """Insert missing bills into database"""
    if not missing_bills:
        print("✅ No missing bills to insert")
        return 0
    
    print(f"📥 Inserting {len(missing_bills)} missing bills...")
    
    inserted = 0
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        for bill in missing_bills:
            try:
                cursor.execute("""
                    INSERT INTO dbo.state_legislation (
                        state, bill_number, title, description, status,
                        session_name, legiscan_url, introduced_date, last_action_date,
                        created_at, last_updated, bill_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    'TX',
                    bill.get('bill_number', ''),
                    bill.get('title', ''),
                    bill.get('description', ''),
                    bill.get('status_name', 'Unknown'),
                    '89th Legislature 2nd Special Session',
                    bill.get('state_link', ''),
                    bill.get('last_action_date', ''),  # Use as introduced date fallback
                    bill.get('last_action_date', ''),
                    datetime.now().isoformat(),
                    datetime.now().isoformat(),
                    str(bill.get('bill_id', ''))
                ))
                inserted += 1
                
            except Exception as e:
                print(f"❌ Error inserting {bill.get('bill_number', 'Unknown')}: {e}")
                continue
        
        conn.commit()
    
    print(f"✅ Inserted {inserted} bills")
    return inserted

async def process_bill_with_ai(bill_data):
    """Process a single bill with AI"""
    id_val, bill_number, title, description, status = bill_data
    
    try:
        # Create context
        bill_context = f"""
        Bill Number: {bill_number}
        Title: {title or 'No title'}
        Description: {description or 'No description'}
        Status: {status or 'Unknown'}
        State: Texas
        Session: 89th Legislature 2nd Special Session
        """
        
        # Generate AI analysis
        ai_result = await analyze_executive_order(bill_context)
        
        if ai_result and isinstance(ai_result, dict):
            # Extract values
            executive_summary = ai_result.get('ai_executive_summary', '')
            talking_points = ai_result.get('ai_talking_points', '')
            business_impact = ai_result.get('ai_business_impact', '')
            
            # Determine practice area
            practice_area = determine_practice_area(title, description)
            
            # Update database
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE dbo.state_legislation
                    SET ai_executive_summary = ?,
                        ai_talking_points = ?,
                        ai_business_impact = ?,
                        ai_summary = ?,
                        category = ?,
                        ai_version = '1.0',
                        last_updated = ?
                    WHERE id = ?
                """, (
                    str(executive_summary)[:2000],
                    str(talking_points)[:2000],
                    str(business_impact)[:2000],
                    str(executive_summary)[:2000],
                    practice_area,
                    datetime.now(),
                    id_val
                ))
                conn.commit()
            
            print(f"✅ {bill_number} - {practice_area}")
            return True
            
    except Exception as e:
        print(f"❌ {bill_number} - Error: {e}")
        return False
    
    # Rate limiting
    await asyncio.sleep(1)

async def process_new_bills_with_ai():
    """Process newly inserted bills with AI"""
    print("🤖 Processing new bills with AI...")
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Get bills without AI summaries
        cursor.execute("""
            SELECT id, bill_number, title, description, status
            FROM dbo.state_legislation
            WHERE state = 'TX'
            AND session_name = '89th Legislature 2nd Special Session'
            AND (ai_executive_summary IS NULL OR ai_executive_summary = '')
            ORDER BY bill_number
        """)
        
        bills = cursor.fetchall()
        
        if not bills:
            print("✅ All bills already have AI summaries")
            return 0
        
        print(f"📊 Processing {len(bills)} bills with AI...")
        
        processed = 0
        for bill in bills:
            success = await process_bill_with_ai(bill)
            if success:
                processed += 1
        
        print(f"✅ Processed {processed}/{len(bills)} bills with AI")
        return processed

async def main():
    print("🔄 Syncing Texas 89th 2nd Special Session bills...")
    
    # Step 1: Get existing bills
    existing_bills = get_existing_bills()
    print(f"📊 Database has {len(existing_bills)} existing bills")
    
    # Step 2: Fetch from LegiScan
    legiscan_bills = fetch_legiscan_bills()
    
    # Step 3: Find missing bills
    legiscan_bill_numbers = {bill['bill_number'] for bill in legiscan_bills}
    missing_bill_numbers = legiscan_bill_numbers - existing_bills
    
    print(f"🔍 Found {len(missing_bill_numbers)} missing bills:")
    for bill_num in sorted(list(missing_bill_numbers)[:10]):  # Show first 10
        print(f"  {bill_num}")
    if len(missing_bill_numbers) > 10:
        print(f"  ... and {len(missing_bill_numbers) - 10} more")
    
    # Step 4: Insert missing bills
    missing_bills = [bill for bill in legiscan_bills if bill['bill_number'] in missing_bill_numbers]
    inserted_count = insert_missing_bills(missing_bills)
    
    # Step 5: Process with AI
    if inserted_count > 0:
        processed_count = await process_new_bills_with_ai()
        print(f"✅ Sync complete: {inserted_count} bills added, {processed_count} processed with AI")
    else:
        print("✅ Sync complete: No new bills to add")

if __name__ == "__main__":
    asyncio.run(main())