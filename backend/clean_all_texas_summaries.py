#!/usr/bin/env python3
"""
Clean ALL Texas state bills with malformed **SUMMARY:** prefix
Runs in batches until all are cleaned
"""

import time
from datetime import datetime
from database_config import get_db_connection
from clean_texas_summaries import clean_summary_text

def clean_all_texas_summaries():
    """Clean all malformed summaries in batches"""
    print(f"\n🚀 Cleaning ALL Texas bills with malformed summary format")
    print(f"📅 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    batch_size = 1000
    total_cleaned = 0
    batch_number = 1
    start_time = time.time()
    
    while True:
        print(f"\n📦 Processing batch #{batch_number} (size: {batch_size})")
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Get remaining count
            cursor.execute("""
                SELECT COUNT(*) 
                FROM dbo.state_legislation
                WHERE state = 'TX'
                AND (ai_summary LIKE '**SUMMARY:**%' OR ai_summary LIKE 'SUMMARY:%')
            """)
            remaining_count = cursor.fetchone()[0]
            
            if remaining_count == 0:
                print("✅ All bills cleaned!")
                break
                
            print(f"📊 Remaining bills to clean: {remaining_count}")
            
            # Get bills to clean (batch)
            cursor.execute(f"""
                SELECT TOP {batch_size} id, bill_number, ai_summary
                FROM dbo.state_legislation
                WHERE state = 'TX'
                AND (ai_summary LIKE '**SUMMARY:**%' OR ai_summary LIKE 'SUMMARY:%')
                ORDER BY bill_number
            """)
            
            bills = cursor.fetchall()
            
            if not bills:
                print("✅ No more bills to clean!")
                break
            
            print(f"🧹 Cleaning {len(bills)} bills...")
            
            batch_cleaned = 0
            
            for i, (id_val, bill_number, ai_summary) in enumerate(bills):
                try:
                    # Clean the summary text
                    cleaned_summary = clean_summary_text(ai_summary)
                    
                    if cleaned_summary and cleaned_summary != ai_summary:
                        # Update both fields
                        cursor.execute("""
                            UPDATE dbo.state_legislation
                            SET ai_summary = ?,
                                ai_executive_summary = ?,
                                ai_version = 'cleaned_format_v1',
                                last_updated = ?
                            WHERE id = ?
                        """, (
                            cleaned_summary[:2000],
                            cleaned_summary[:2000],
                            datetime.now(),
                            id_val
                        ))
                        
                        batch_cleaned += 1
                    
                    # Progress every 100 bills
                    if (i + 1) % 100 == 0:
                        print(f"  🧹 Progress: {i+1}/{len(bills)}")
                        
                except Exception as e:
                    print(f"  ❌ Error cleaning {bill_number}: {e}")
            
            # Commit batch
            conn.commit()
            
            total_cleaned += batch_cleaned
            elapsed = time.time() - start_time
            rate = total_cleaned / elapsed * 60  # bills per minute
            
            print(f"📊 Batch #{batch_number} complete:")
            print(f"  🧹 Cleaned in this batch: {batch_cleaned}")
            print(f"  📈 Total cleaned so far: {total_cleaned}")
            print(f"  ⏱️  Elapsed: {elapsed/60:.1f} minutes")
            print(f"  🔄 Rate: {rate:.1f} bills/minute")
            
            if remaining_count <= batch_size:
                print("🎯 Final batch - should be complete after this!")
            
            batch_number += 1
            
            # Small delay between batches
            time.sleep(1)
    
    elapsed_total = time.time() - start_time
    print(f"\n🎉 All Texas summaries cleaned!")
    print(f"📊 Final Results:")
    print(f"  🧹 Total bills cleaned: {total_cleaned}")
    print(f"  📦 Total batches: {batch_number - 1}")
    print(f"  ⏱️  Total time: {elapsed_total/60:.1f} minutes")
    print(f"  🔄 Average rate: {total_cleaned/elapsed_total*60:.1f} bills/minute")

if __name__ == "__main__":
    clean_all_texas_summaries()