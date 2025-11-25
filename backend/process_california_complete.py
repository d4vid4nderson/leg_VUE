#!/usr/bin/env python3
"""
Complete California Bills Processing
- AI summaries
- Fix missing dates
- Add practice area tags
- Update session data
"""

import asyncio
import json
import glob
import time
from datetime import datetime
from database_config import get_db_connection
from ai import analyze_executive_order

# California practice area mapping based on bill content
PRACTICE_AREA_KEYWORDS = {
    'healthcare': ['health', 'medical', 'hospital', 'insurance', 'medicare', 'medicaid', 'patient', 'doctor', 'physician', 'nurse', 'pharmacy', 'drug', 'mental health', 'public health'],
    'education': ['school', 'education', 'student', 'teacher', 'university', 'college', 'curriculum', 'academic', 'scholarship', 'district'],
    'tax': ['tax', 'revenue', 'fiscal', 'budget', 'appropriation', 'finance', 'treasury', 'assessment', 'levy'],
    'environment': ['environment', 'climate', 'pollution', 'emission', 'renewable', 'energy', 'conservation', 'wildlife', 'park', 'water quality', 'air quality'],
    'criminal-justice': ['criminal', 'crime', 'police', 'prison', 'jail', 'sentence', 'conviction', 'prosecutor', 'defense', 'parole', 'probation'],
    'labor': ['labor', 'employment', 'worker', 'wage', 'union', 'workplace', 'compensation', 'unemployment', 'workforce', 'employee'],
    'housing': ['housing', 'rent', 'tenant', 'landlord', 'eviction', 'mortgage', 'homeless', 'affordable housing', 'zoning'],
    'transportation': ['transportation', 'highway', 'road', 'vehicle', 'traffic', 'transit', 'rail', 'airport', 'dmv', 'license'],
    'agriculture': ['agriculture', 'farm', 'crop', 'livestock', 'ranch', 'irrigation', 'pesticide', 'organic', 'dairy'],
    'technology': ['technology', 'internet', 'digital', 'cyber', 'data', 'privacy', 'artificial intelligence', 'software', 'broadband'],
    'civil-rights': ['civil rights', 'discrimination', 'equality', 'voting', 'disability', 'accessibility', 'fair housing', 'equal opportunity'],
    'consumer-protection': ['consumer', 'fraud', 'scam', 'warranty', 'refund', 'product safety', 'false advertising', 'credit'],
}

def determine_practice_area(title, description):
    """Determine practice area based on bill content"""
    text = f"{title or ''} {description or ''}".lower()
    
    for area, keywords in PRACTICE_AREA_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text:
                return area
    
    return 'government-operations'  # Default category

def extract_dates_from_json(json_path):
    """Extract dates from California bill JSON"""
    try:
        with open(json_path, 'r') as f:
            data = json.load(f)
            bill = data.get('bill', data)
            
            # Get introduced date from history
            introduced_date = None
            history = bill.get('history', [])
            if history and len(history) > 0:
                introduced_date = history[0].get('date', '')
            
            # Fallback to status_date
            if not introduced_date:
                introduced_date = bill.get('status_date', '')
            
            # Get session info
            session = bill.get('session', {})
            session_name = session.get('session_name', '') if isinstance(session, dict) else ''
            if not session_name:
                # Try to extract from session_id or year
                year = bill.get('year', '')
                if year:
                    session_name = f"{year} Regular Session"
            
            return {
                'bill_id': str(bill.get('bill_id', '')),
                'introduced_date': introduced_date,
                'last_action_date': bill.get('status_date', ''),
                'session_name': session_name
            }
    except Exception as e:
        return None

async def process_california_batch(bills_batch):
    """Process a batch of California bills with AI"""
    processed = 0
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        for bill in bills_batch:
            id_val, bill_number, title, description, status = bill
            
            try:
                # Create context for AI
                bill_context = f"""
                Bill Number: {bill_number}
                Title: {title or 'No title'}
                Description: {description or 'No description'}
                Status: {status or 'Unknown'}
                State: California
                """
                
                # Generate AI analysis
                ai_result = await analyze_executive_order(bill_context)
                
                if ai_result and isinstance(ai_result, dict):
                    # Extract string values
                    executive_summary = ai_result.get('ai_executive_summary', '')
                    talking_points = ai_result.get('ai_talking_points', '')
                    business_impact = ai_result.get('ai_business_impact', '')
                    
                    # Determine practice area
                    practice_area = determine_practice_area(title, description)
                    
                    # Update database
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
                        str(executive_summary)[:2000],  # Copy to ai_summary for frontend
                        practice_area,
                        datetime.now(),
                        id_val
                    ))
                    
                    processed += 1
                    print(f"   ✅ {bill_number} - AI processed, category: {practice_area}")
                    
            except Exception as e:
                print(f"   ❌ {bill_number} - Error: {e}")
            
            # Rate limiting
            await asyncio.sleep(1)
        
        conn.commit()
    
    return processed

async def process_california_ai():
    """Process all California bills with AI summaries"""
    print("\n🤖 Processing California Bills with AI")
    print("=" * 60)
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Get bills without AI summaries
        cursor.execute("""
            SELECT id, bill_number, title, description, status
            FROM dbo.state_legislation
            WHERE state = 'CA'
            AND (ai_executive_summary IS NULL OR ai_executive_summary = '')
            ORDER BY bill_number
        """)
        
        bills = cursor.fetchall()
        total = len(bills)
        
        print(f"📊 Found {total} California bills to process with AI")
        
        if total == 0:
            print("✅ All California bills already have AI summaries!")
            return
        
        # Process in batches of 50
        batch_size = 50
        total_processed = 0
        
        for i in range(0, total, batch_size):
            batch = bills[i:i+batch_size]
            print(f"\n📦 Processing batch {i//batch_size + 1} ({i+1}-{min(i+batch_size, total)} of {total})")
            
            processed = await process_california_batch(batch)
            total_processed += processed
            
            print(f"   Batch complete: {processed} bills processed")
            print(f"   Overall progress: {total_processed}/{total} ({total_processed/total*100:.1f}%)")
            
            # Save progress every batch
            if total_processed % 100 == 0:
                print(f"   💾 Progress saved: {total_processed} bills")
        
        print(f"\n✅ AI Processing Complete: {total_processed} bills processed")

def fix_california_dates():
    """Fix missing dates for California bills"""
    print("\n📅 Fixing California Bill Dates")
    print("=" * 60)
    
    # Find California bill JSON files
    ca_bills = glob.glob('/app/data/CA/*/bill/*.json')
    print(f"📁 Found {len(ca_bills)} California bill JSON files")
    
    if not ca_bills:
        print("⚠️ No California JSON files found, using fallback dates")
    
    updated_count = 0
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Process JSON files if available
        if ca_bills:
            # Get bills with missing dates
            cursor.execute("""
                SELECT bill_id, bill_number
                FROM dbo.state_legislation
                WHERE state = 'CA'
                AND (introduced_date IS NULL OR introduced_date = '')
            """)
            
            missing_dates = {row[0]: row[1] for row in cursor.fetchall()}
            print(f"🔍 Found {len(missing_dates)} bills missing dates")
            
            for json_path in ca_bills:
                bill_data = extract_dates_from_json(json_path)
                if not bill_data:
                    continue
                
                bill_id = bill_data['bill_id']
                
                if bill_id in missing_dates:
                    if bill_data['introduced_date']:
                        cursor.execute("""
                            UPDATE dbo.state_legislation
                            SET introduced_date = ?,
                                session_name = CASE 
                                    WHEN session_name IS NULL OR session_name = '' 
                                    THEN ? 
                                    ELSE session_name 
                                END
                            WHERE bill_id = ? AND state = 'CA'
                        """, (bill_data['introduced_date'], bill_data['session_name'], bill_id))
                        
                        if cursor.rowcount > 0:
                            updated_count += 1
        
        # Use last_action_date as fallback for remaining bills
        cursor.execute("""
            UPDATE dbo.state_legislation
            SET introduced_date = last_action_date
            WHERE state = 'CA'
            AND (introduced_date IS NULL OR introduced_date = '')
            AND last_action_date IS NOT NULL
            AND last_action_date != ''
        """)
        
        fallback_count = cursor.rowcount
        
        # Update session names for bills without them
        cursor.execute("""
            UPDATE dbo.state_legislation
            SET session_name = '2025-2026 Regular Session'
            WHERE state = 'CA'
            AND (session_name IS NULL OR session_name = '')
            AND (introduced_date LIKE '2025%' OR introduced_date LIKE '2026%')
        """)
        
        session_count = cursor.rowcount
        
        conn.commit()
        
        print(f"✅ Updated {updated_count} bills from JSON files")
        print(f"✅ Updated {fallback_count} bills with fallback dates")
        print(f"✅ Updated {session_count} bills with session names")

async def main():
    """Main processing function"""
    print("🌟 California Bills Complete Processing")
    print("=" * 70)
    
    start_time = time.time()
    
    # Step 1: Fix dates and sessions
    print("\n[Step 1/2] Fixing dates and sessions...")
    fix_california_dates()
    
    # Step 2: Process with AI (includes category assignment)
    print("\n[Step 2/2] Processing with AI and assigning categories...")
    await process_california_ai()
    
    # Final status check
    print("\n" + "=" * 70)
    print("📊 Final California Bills Status:")
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN ai_executive_summary IS NOT NULL AND ai_executive_summary != '' THEN 1 ELSE 0 END) as with_ai,
                SUM(CASE WHEN introduced_date IS NOT NULL AND introduced_date != '' THEN 1 ELSE 0 END) as with_dates,
                SUM(CASE WHEN category != 'not-applicable' AND category IS NOT NULL THEN 1 ELSE 0 END) as with_category,
                SUM(CASE WHEN session_name IS NOT NULL AND session_name != '' THEN 1 ELSE 0 END) as with_session
            FROM dbo.state_legislation
            WHERE state = 'CA'
        """)
        
        total, with_ai, with_dates, with_category, with_session = cursor.fetchone()
        
        elapsed = time.time() - start_time
        
        print(f"Total bills: {total}")
        print(f"With AI summaries: {with_ai} ({with_ai/total*100:.1f}%)")
        print(f"With dates: {with_dates} ({with_dates/total*100:.1f}%)")
        print(f"With categories: {with_category} ({with_category/total*100:.1f}%)")
        print(f"With sessions: {with_session} ({with_session/total*100:.1f}%)")
        print(f"\n⏱️ Total processing time: {elapsed/60:.1f} minutes")
        print("🎉 California processing complete!")

if __name__ == "__main__":
    asyncio.run(main())