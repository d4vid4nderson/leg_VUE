#!/usr/bin/env python3
"""
Process remaining Texas Regular Session bills with AI summaries
"""

import sys
import asyncio
import time
from datetime import datetime
import os
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
        State: Texas
        Session: 89th Legislature Regular Session
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

async def process_remaining_texas(batch_size=50):
    """Process remaining Texas Regular Session bills"""
    print(f"\n🔄 Processing remaining Texas Regular Session bills (batch of {batch_size})")
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Get bills without AI summaries
        cursor.execute(f"""
            SELECT TOP {batch_size} id, bill_number, title, description, status
            FROM dbo.state_legislation
            WHERE state = 'TX'
            AND session_name = '89th Legislature Regular Session'
            AND (ai_executive_summary IS NULL OR ai_executive_summary = '')
            ORDER BY bill_number
        """)
        
        bills = cursor.fetchall()
        
        if not bills:
            print(f"✅ No bills to process for Texas Regular Session")
            return 0
        
        print(f"📊 Processing {len(bills)} bills...")
        
        processed = 0
        for bill in bills:
            success = await process_bill(bill)
            if success:
                processed += 1
        
        print(f"✅ Processed {processed}/{len(bills)} bills")
        return processed

async def main():
    batch_size = int(sys.argv[1]) if len(sys.argv) > 1 else 50
    
    start_time = time.time()
    processed = await process_remaining_texas(batch_size)
    elapsed = time.time() - start_time
    
    print(f"\n⏱️ Time: {elapsed/60:.1f} minutes")
    print(f"📈 Rate: {processed/elapsed*60:.1f} bills/minute")

if __name__ == "__main__":
    asyncio.run(main())