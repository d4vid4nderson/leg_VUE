#!/usr/bin/env python3
"""
Auto-restarting Kentucky AI processor
Continuously processes KY bills and restarts on completion/failure
"""

import os
import time
import asyncio
from datetime import datetime
from database_config import get_db_connection
from ai import analyze_executive_order

# Practice area keywords mapping
PRACTICE_AREA_KEYWORDS = {
    'healthcare': ['health', 'medical', 'hospital', 'insurance', 'medicare', 'patient', 'pharmacy', 'medicaid'],
    'education': ['school', 'education', 'student', 'teacher', 'university', 'college', 'curriculum'],
    'tax': ['tax', 'revenue', 'fiscal', 'budget', 'appropriation', 'finance', 'treasury'],
    'environment': ['environment', 'climate', 'pollution', 'renewable', 'conservation', 'water', 'air quality'],
    'criminal-justice': ['criminal', 'crime', 'police', 'prison', 'sentence', 'conviction', 'court', 'jail'],
    'labor': ['labor', 'employment', 'worker', 'wage', 'union', 'workplace', 'unemployment'],
    'housing': ['housing', 'rent', 'tenant', 'landlord', 'eviction', 'mortgage', 'zoning'],
    'transportation': ['transportation', 'highway', 'road', 'vehicle', 'traffic', 'transit', 'bridge'],
    'agriculture': ['agriculture', 'farm', 'crop', 'livestock', 'ranch', 'dairy', 'tobacco'],
    'technology': ['technology', 'internet', 'digital', 'cyber', 'data', 'privacy', 'broadband'],
}

def determine_practice_area(title, description):
    """Determine practice area based on content"""
    text = f"{title or ''} {description or ''}".lower()
    
    for area, keywords in PRACTICE_AREA_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text:
                return area
    
    return 'government-operations'

async def process_bill(bill_data):
    """Process a single bill with AI"""
    id_val, bill_number, title, description, status = bill_data
    
    try:
        # Create context
        bill_context = f"""
        Bill Number: {bill_number}
        Title: {title or 'No title'}
        Description: {description or 'No description'}
        Status: {status or 'Unknown'}
        State: Kentucky (KY)
        """
        
        # Generate AI analysis
        print(f"  Processing {bill_number}...")
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
            
            print(f"  ✅ {bill_number} - {practice_area}")
            return True
            
    except Exception as e:
        print(f"  ❌ {bill_number} - Error: {e}")
        return False
    
    # Rate limiting
    await asyncio.sleep(1)

async def process_batch(batch_size=50):
    """Process a batch of bills for Kentucky"""
    print(f"\n🔄 Processing Kentucky bills (batch of {batch_size})")
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Get bills without AI summaries
        cursor.execute(f"""
            SELECT TOP {batch_size} id, bill_number, title, description, status
            FROM dbo.state_legislation
            WHERE state = 'KY'
            AND (ai_executive_summary IS NULL OR ai_executive_summary = '')
            ORDER BY bill_number
        """, ())
        
        bills = cursor.fetchall()
        
        if not bills:
            print(f"✅ No bills to process for Kentucky")
            return 0
        
        print(f"📊 Processing {len(bills)} bills...")
        
        processed = 0
        for bill in bills:
            success = await process_bill(bill)
            if success:
                processed += 1
        
        print(f"✅ Processed {processed}/{len(bills)} bills in this batch")
        return processed

def check_remaining_bills():
    """Check how many KY bills still need processing"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT COUNT(*) 
                FROM dbo.state_legislation 
                WHERE state = 'KY' 
                AND (ai_executive_summary IS NULL OR ai_executive_summary = '')
            """)
            return cursor.fetchone()[0]
    except Exception as e:
        print(f"Error checking bills: {e}")
        return 0

def fix_missing_dates():
    """Fix missing dates using last_action_date as fallback"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Use last_action_date as fallback for missing introduced_date
            cursor.execute("""
                UPDATE dbo.state_legislation
                SET introduced_date = last_action_date
                WHERE state = 'KY'
                AND (introduced_date IS NULL OR introduced_date = '')
                AND last_action_date IS NOT NULL
                AND last_action_date != ''
            """)
            
            updated = cursor.rowcount
            conn.commit()
            if updated > 0:
                print(f"📅 Fixed {updated} bills with missing dates")
            return updated
    except Exception as e:
        print(f"Error fixing dates: {e}")
        return 0

async def main():
    """Main auto-restart loop"""
    print("🔄 Kentucky Auto-Restart AI Processor")
    print("=" * 60)
    
    # Fix missing dates first
    print("\n📅 Checking for missing dates...")
    fix_missing_dates()
    
    iteration = 0
    batch_size = 50
    max_iterations = 100  # Increased for KY's larger dataset
    
    while True:
        iteration += 1
        print(f"\n[Iteration {iteration}] {time.strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Check remaining bills
        remaining = check_remaining_bills()
        print(f"📊 Remaining bills to process: {remaining}")
        
        if remaining == 0:
            print("🎉 All Kentucky bills processed! Exiting.")
            break
        
        # Process batch
        try:
            processed = await process_batch(batch_size)
            
            if processed > 0:
                print(f"📈 Progress: {processed} bills processed this batch")
                print("⏳ Waiting 30 seconds before next batch...")
                await asyncio.sleep(30)
            else:
                print("⚠️ No progress made, waiting 2 minutes before retry...")
                await asyncio.sleep(120)
                
        except Exception as e:
            print(f"❌ Error in batch processing: {e}")
            print("⏳ Waiting 2 minutes before retry...")
            await asyncio.sleep(120)
        
        # Safety check: don't run indefinitely
        if iteration >= max_iterations:
            print(f"🛑 Maximum iterations ({max_iterations}) reached, exiting for safety")
            print(f"📊 Final status: {remaining} bills remaining")
            break

if __name__ == "__main__":
    asyncio.run(main())