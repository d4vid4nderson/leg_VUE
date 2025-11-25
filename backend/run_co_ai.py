#!/usr/bin/env python3
"""
Process All Colorado Bills with AI - Production Version
Uses your existing AI infrastructure
"""

import asyncio
import time
from datetime import datetime
from database_config import get_db_connection
from ai import analyze_executive_order

async def process_all_colorado_bills():
    """Process all Colorado bills without AI summaries"""
    print("🏛️ Processing ALL Colorado Bills with AI")
    print("=" * 60)
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Get all CO bills without AI summaries
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
        print(f"⏱️ Estimated time: ~{total*2//60} minutes")
        print()
        
        processed = 0
        failed = 0
        start_time = time.time()
        
        for i, bill in enumerate(bills):
            id_val, bill_number, title, description, status = bill
            
            # Progress indicator
            if i % 10 == 0:
                elapsed = time.time() - start_time
                rate = i / elapsed if elapsed > 0 else 0
                remaining = (total - i) / rate if rate > 0 else 0
                print(f"📈 Progress: {i}/{total} ({i/total*100:.1f}%) - ETA: {remaining/60:.1f} min")
            
            print(f"   [{i+1}/{total}] {bill_number}")
            
            try:
                # Create context for AI
                bill_context = f"""
                Bill Number: {bill_number}
                Title: {title or 'No title'}
                Description: {description or 'No description'}
                Status: {status or 'Unknown'}
                State: Colorado
                """
                
                # Generate AI summary using your existing function
                ai_summary = await analyze_executive_order(bill_context)
                
                if ai_summary:
                    # Update database
                    cursor.execute("""
                        UPDATE dbo.state_legislation
                        SET ai_executive_summary = ?,
                            ai_version = '1.0',
                            last_updated = ?
                        WHERE id = ?
                    """, (ai_summary, datetime.now(), id_val))
                    
                    processed += 1
                    
                    # Commit every 20 bills
                    if processed % 20 == 0:
                        conn.commit()
                        print(f"      💾 Saved progress ({processed} bills)")
                else:
                    failed += 1
                    print(f"      ❌ No AI result")
                    
            except Exception as e:
                failed += 1
                print(f"      ❌ Error: {e}")
            
            # Rate limiting - 2 seconds between calls
            await asyncio.sleep(2)
        
        # Final commit
        conn.commit()
        
        # Results
        total_time = time.time() - start_time
        print("\n" + "=" * 60)
        print("🎉 Colorado AI Processing Complete!")
        print(f"   📊 Total processed: {processed}")
        print(f"   ❌ Failed: {failed}")
        print(f"   ⏱️ Total time: {total_time/60:.1f} minutes")
        print(f"   📈 Success rate: {processed/(processed+failed)*100:.1f}%")
        print(f"   ⚡ Average rate: {processed/(total_time/60):.1f} bills/minute")

# Run the processing
if __name__ == "__main__":
    asyncio.run(process_all_colorado_bills())