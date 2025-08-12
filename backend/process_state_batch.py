#!/usr/bin/env python3
"""
Process state bills in batches with AI summaries
Usage: python process_state_batch.py CA 50
"""

import sys
import asyncio
import time
from datetime import datetime
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

async def process_bill(bill_data, state):
    """Process a single bill with AI"""
    id_val, bill_number, title, description, status = bill_data
    
    try:
        # Create context
        bill_context = f"""
        Bill Number: {bill_number}
        Title: {title or 'No title'}
        Description: {description or 'No description'}
        Status: {status or 'Unknown'}
        State: {state}
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

async def process_batch(state, batch_size=50):
    """Process a batch of bills for a state"""
    print(f"\n🔄 Processing {state} bills (batch of {batch_size})")
    print("=" * 60)
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Get current status
        cursor.execute("""
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN ai_executive_summary IS NOT NULL AND ai_executive_summary != '' THEN 1 ELSE 0 END) as with_ai
            FROM dbo.state_legislation
            WHERE state = ?
        """, (state,))
        
        total, with_ai = cursor.fetchone()
        remaining = total - with_ai
        print(f"📊 Status: {with_ai}/{total} complete ({with_ai/total*100:.1f}%), {remaining} remaining")
        
        # Get bills without AI summaries
        cursor.execute(f"""
            SELECT TOP {batch_size} id, bill_number, title, description, status
            FROM dbo.state_legislation
            WHERE state = ?
            AND (ai_executive_summary IS NULL OR ai_executive_summary = '')
            ORDER BY bill_number
        """, (state,))
        
        bills = cursor.fetchall()
        
        if not bills:
            print(f"✅ No bills to process for {state}")
            return 0
        
        print(f"📦 Processing {len(bills)} bills...")
        print("-" * 60)
        
        processed = 0
        for i, bill in enumerate(bills, 1):
            print(f"[{i}/{len(bills)}] Processing {bill[1]}...")
            success = await process_bill(bill, state)
            if success:
                processed += 1
            
            # Progress update every 10 bills
            if i % 10 == 0:
                print(f"   Progress: {i}/{len(bills)} ({processed} successful)")
        
        print("-" * 60)
        print(f"✅ Batch complete: {processed}/{len(bills)} bills processed successfully")
        return processed

async def main():
    if len(sys.argv) < 2:
        print("Usage: python process_state_batch.py STATE [batch_size]")
        print("States: CA, TX, NV, KY, SC, CO")
        sys.exit(1)
    
    state = sys.argv[1].upper()
    batch_size = int(sys.argv[2]) if len(sys.argv) > 2 else 50
    
    print(f"🌟 State Bill AI Processor")
    print(f"State: {state}")
    print(f"Batch size: {batch_size}")
    
    start_time = time.time()
    processed = await process_batch(state, batch_size)
    elapsed = time.time() - start_time
    
    if processed > 0:
        print(f"\n📊 Performance Stats:")
        print(f"  ⏱️ Time: {elapsed/60:.1f} minutes")
        print(f"  📈 Rate: {processed/elapsed*60:.1f} bills/minute")
        print(f"  ⚡ Avg: {elapsed/processed:.1f} seconds/bill")

if __name__ == "__main__":
    asyncio.run(main())