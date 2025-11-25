#!/usr/bin/env python3
"""
Fixed Colorado AI Processing - Extract string from AI results
"""

import asyncio
import time
from datetime import datetime
from database_config import get_db_connection
from ai import analyze_executive_order

async def process_colorado_bills_fixed():
    """Process Colorado bills with proper string extraction"""
    print("🏛️ Processing Colorado Bills - FIXED VERSION")
    print("=" * 60)
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Get bills without AI summaries
        cursor.execute("""
            SELECT id, bill_number, title, description, status
            FROM dbo.state_legislation
            WHERE state = 'CO'
            AND (ai_executive_summary IS NULL OR ai_executive_summary = '')
            ORDER BY bill_number
        """)
        
        bills = cursor.fetchall()
        total = len(bills)
        
        print(f"📊 Found {total} Colorado bills to process")
        
        processed = 0
        failed = 0
        start_time = time.time()
        
        for i, bill in enumerate(bills):
            id_val, bill_number, title, description, status = bill
            
            if i % 10 == 0:
                elapsed = time.time() - start_time
                print(f"📈 Progress: {i}/{total} ({i/total*100:.1f}%)")
            
            try:
                # Create context for AI
                bill_context = f"""
                Bill Number: {bill_number}
                Title: {title or 'No title'}
                Description: {description or 'No description'}
                Status: {status or 'Unknown'}
                State: Colorado
                """
                
                # Generate AI analysis
                ai_result = await analyze_executive_order(bill_context)
                
                # Extract string values from the result
                if ai_result and isinstance(ai_result, dict):
                    executive_summary = ai_result.get('ai_executive_summary', '')
                    talking_points = ai_result.get('ai_talking_points', '')
                    business_impact = ai_result.get('ai_business_impact', '')
                    
                    # Update database with STRING values only
                    cursor.execute("""
                        UPDATE dbo.state_legislation
                        SET ai_executive_summary = ?,
                            ai_talking_points = ?,
                            ai_business_impact = ?,
                            ai_version = '1.0',
                            last_updated = ?
                        WHERE id = ?
                    """, (
                        str(executive_summary)[:2000],  # Ensure string and limit length
                        str(talking_points)[:2000],
                        str(business_impact)[:2000],
                        datetime.now(),
                        id_val
                    ))
                    
                    processed += 1
                    print(f"   ✅ [{i+1}/{total}] {bill_number}")
                    
                    # Commit every 20 bills
                    if processed % 20 == 0:
                        conn.commit()
                        print(f"      💾 Saved {processed} bills")
                else:
                    failed += 1
                    print(f"   ❌ [{i+1}/{total}] {bill_number} - No AI result")
                    
            except Exception as e:
                failed += 1
                print(f"   ❌ [{i+1}/{total}] {bill_number} - Error: {e}")
            
            # Rate limiting
            await asyncio.sleep(1)
        
        # Final commit
        conn.commit()
        
        # Results
        total_time = time.time() - start_time
        print("\n" + "=" * 60)
        print("🎉 Colorado AI Processing Complete!")
        print(f"   ✅ Processed: {processed}")
        print(f"   ❌ Failed: {failed}")
        print(f"   ⏱️ Time: {total_time/60:.1f} minutes")
        print(f"   📈 Success rate: {processed/(processed+failed)*100:.1f}%")

# Run it
if __name__ == "__main__":
    asyncio.run(process_colorado_bills_fixed())