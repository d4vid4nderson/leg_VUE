#!/usr/bin/env python3
"""
Process state bills with AI summaries for any state
Usage: python process_state_bills.py [STATE] [BATCH_SIZE]
Example: python process_state_bills.py KY 50
"""

import sys
import asyncio
import time
from datetime import datetime
from database_config import get_db_connection
from ai import analyze_state_legislation

# Practice area keywords mapping for categorization
PRACTICE_AREA_KEYWORDS = {
    'healthcare': ['health', 'medical', 'hospital', 'insurance', 'medicare', 'patient', 'pharmacy', 'medicaid'],
    'education': ['school', 'education', 'student', 'teacher', 'university', 'college', 'learning'],
    'engineering': ['infrastructure', 'engineering', 'construction', 'bridge', 'road', 'technology', 'broadband'],
    'civic': ['government', 'federal', 'agency', 'department', 'administration', 'policy', 'regulation', 'civic', 'election', 'voting', 'tax', 'revenue', 'fiscal', 'budget'],
}

def determine_practice_area(title, description):
    """Determine practice area based on content"""
    text = f"{title or ''} {description or ''}".lower()
    
    for area, keywords in PRACTICE_AREA_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text:
                return area
    
    return 'not-applicable'

async def process_bill(bill_data, state):
    """Process a single bill with AI"""
    id_val, bill_number, title, description, status = bill_data
    
    try:
        print(f"🔄 Processing {bill_number}...")
        
        # Generate AI analysis using the updated function
        ai_result = await analyze_state_legislation(
            title=title or 'No title',
            description=description or 'No description', 
            state=state,
            bill_number=bill_number
        )
        
        if ai_result and isinstance(ai_result, dict):
            # Extract summary
            executive_summary = ai_result.get('ai_executive_summary', '')
            
            # Determine practice area
            practice_area = determine_practice_area(title, description)
            
            # Update database
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE dbo.state_legislation
                    SET ai_executive_summary = ?,
                        ai_summary = ?,
                        category = ?,
                        ai_version = ?,
                        last_updated = ?
                    WHERE id = ?
                """, (
                    executive_summary[:2000] if executive_summary else '',
                    executive_summary[:2000] if executive_summary else '',  # Copy to ai_summary for frontend
                    practice_area,
                    'azure_openai_v2_simplified',
                    datetime.now(),
                    id_val
                ))
                conn.commit()
            
            print(f"✅ {bill_number} - {practice_area}")
            return True
            
    except Exception as e:
        print(f"❌ {bill_number} - Error: {e}")
        return False
    
    # Rate limiting - be gentle with Azure AI
    await asyncio.sleep(1.5)  # 1.5 second delay between requests

async def process_state_bills(state, batch_size=50):
    """Process state bills for a specific state"""
    print(f"\n🚀 Processing {state} state bills")
    print(f"📅 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Get bills that don't have AI summaries
        cursor.execute(f"""
            SELECT TOP {batch_size} id, bill_number, title, description, status
            FROM dbo.state_legislation
            WHERE state = ?
            AND (ai_executive_summary IS NULL OR ai_executive_summary = '')
            ORDER BY bill_number
        """, (state,))
        
        bills = cursor.fetchall()
        
        if not bills:
            print("✅ No bills to process - all bills already have summaries")
            return 0
        
        print(f"📊 Found {len(bills)} bills to process in this batch...")
        
        processed = 0
        errors = 0
        start_time = time.time()
        
        for i, bill in enumerate(bills, 1):
            print(f"\n[{i}/{len(bills)}] ", end="")
            
            try:
                success = await process_bill(bill, state)
                if success:
                    processed += 1
                else:
                    errors += 1
                    
                # Progress update every 10 bills
                if i % 10 == 0:
                    elapsed = time.time() - start_time
                    rate = processed / (elapsed / 60) if elapsed > 0 else 0
                    print(f"\n📈 Progress: {processed}/{i} successful ({rate:.1f} bills/min)")
                    
            except Exception as e:
                print(f"💥 Unexpected error processing bill {i}: {e}")
                errors += 1
                continue
        
        # Final results
        total_time = time.time() - start_time
        print(f"\n" + "="*60)
        print(f"🎉 {state} State Bills Processing Batch Complete!")
        print(f"📊 Results:")
        print(f"   • Total bills processed: {processed}")
        print(f"   • Errors: {errors}")
        print(f"   • Total time: {total_time/60:.1f} minutes")
        print(f"   • Average rate: {processed/(total_time/60):.1f} bills/minute")
        print(f"📅 Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        return processed

async def main():
    """Main function"""
    if len(sys.argv) < 2:
        print("Usage: python process_state_bills.py STATE [batch_size]")
        print("States: KY, NV, SC, TX")
        print("Example: python process_state_bills.py KY 50")
        sys.exit(1)
    
    state = sys.argv[1].upper()
    batch_size = int(sys.argv[2]) if len(sys.argv) > 2 else 50
    
    try:
        processed = await process_state_bills(state, batch_size)
        
        if processed > 0:
            print(f"\n🔄 Checking overall state status...")
            # Check final status
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN ai_executive_summary IS NOT NULL AND ai_executive_summary != '' THEN 1 ELSE 0 END) as with_summaries
                    FROM dbo.state_legislation
                    WHERE state = ?
                """, (state,))
                
                total, with_summaries = cursor.fetchone()
                remaining = total - with_summaries
                print(f"📊 {state} Overall Status:")
                print(f"   • Total bills: {total:,}")
                print(f"   • Bills with AI summaries: {with_summaries:,}")
                print(f"   • Remaining to process: {remaining:,}")
                print(f"   • Completion rate: {with_summaries/total*100:.1f}%")
        
        print(f"\n✅ Processing complete! Run again to continue with more bills.")
        
    except Exception as e:
        print(f"❌ Error in main processing: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())