#!/usr/bin/env python3
"""
Clean ALL remaining Texas state bills with any SUMMARY text
Fast batch processing to clean everything
"""

import re
import time
from datetime import datetime
from database_config import get_db_connection

def clean_summary_text(text):
    """Clean summary text by removing formatting artifacts"""
    if not text:
        return ""
    
    # Remove **SUMMARY:** prefix
    cleaned = re.sub(r'^\*\*SUMMARY:\*\*\s*', '', text, flags=re.IGNORECASE)
    
    # Remove **SUMMARY** (without colon)
    cleaned = re.sub(r'^\*\*SUMMARY\*\*\s*', '', cleaned, flags=re.IGNORECASE)
    
    # Remove SUMMARY: prefix (without **)
    cleaned = re.sub(r'^SUMMARY:\s*', '', cleaned, flags=re.IGNORECASE)
    
    # Remove just SUMMARY (without colon or **)
    cleaned = re.sub(r'^SUMMARY\s+', '', cleaned, flags=re.IGNORECASE)
    
    # Remove any variations with different formatting
    cleaned = re.sub(r'^\*?SUMMARY\*?:?\s*', '', cleaned, flags=re.IGNORECASE)
    
    # Remove extra whitespace and newlines at the beginning
    cleaned = cleaned.strip()
    
    # Remove any remaining newline artifacts
    cleaned = re.sub(r'\n+', ' ', cleaned)
    
    # Clean up extra spaces
    cleaned = re.sub(r'\s+', ' ', cleaned)
    
    return cleaned

def clean_all_remaining():
    """Clean all remaining Texas bills with SUMMARY in any form"""
    print(f"\n🚀 Final cleanup of ALL Texas bills with SUMMARY text")
    print(f"📅 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    total_cleaned = 0
    start_time = time.time()
    
    while True:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Get bills with SUMMARY in either field
            cursor.execute("""
                SELECT COUNT(*) 
                FROM dbo.state_legislation
                WHERE state = 'TX'
                AND (
                    ai_summary LIKE '%SUMMARY%' 
                    OR ai_executive_summary LIKE '%SUMMARY%'
                    OR ai_summary LIKE '**SUMMARY%'
                    OR ai_summary LIKE 'SUMMARY:%'
                )
            """)
            remaining_count = cursor.fetchone()[0]
            
            if remaining_count == 0:
                print("✅ All Texas bills cleaned!")
                break
                
            print(f"📊 Remaining bills with SUMMARY: {remaining_count}")
            
            # Process in large batches
            batch_size = 2000
            cursor.execute(f"""
                SELECT TOP {batch_size} id, bill_number, ai_summary, ai_executive_summary
                FROM dbo.state_legislation
                WHERE state = 'TX'
                AND (
                    ai_summary LIKE '%SUMMARY%' 
                    OR ai_executive_summary LIKE '%SUMMARY%'
                    OR ai_summary LIKE '**SUMMARY%'
                    OR ai_summary LIKE 'SUMMARY:%'
                )
                ORDER BY bill_number
            """)
            
            bills = cursor.fetchall()
            
            if not bills:
                print("✅ No more bills to clean!")
                break
            
            print(f"🧹 Cleaning {len(bills)} bills...")
            
            batch_cleaned = 0
            
            for i, (id_val, bill_number, ai_summary, ai_executive_summary) in enumerate(bills):
                try:
                    # Clean both fields
                    cleaned_summary = clean_summary_text(ai_summary) if ai_summary else ''
                    cleaned_executive = clean_summary_text(ai_executive_summary) if ai_executive_summary else cleaned_summary
                    
                    # Update if changed
                    if (cleaned_summary != (ai_summary or '')) or (cleaned_executive != (ai_executive_summary or '')):
                        cursor.execute("""
                            UPDATE dbo.state_legislation
                            SET ai_summary = ?,
                                ai_executive_summary = ?,
                                ai_version = 'final_clean_v1',
                                last_updated = ?
                            WHERE id = ?
                        """, (
                            cleaned_summary[:2000],
                            cleaned_executive[:2000] or cleaned_summary[:2000],
                            datetime.now(),
                            id_val
                        ))
                        
                        batch_cleaned += 1
                    
                    # Progress every 200 bills
                    if (i + 1) % 200 == 0:
                        print(f"  🧹 Progress: {i+1}/{len(bills)}")
                        
                except Exception as e:
                    print(f"  ❌ Error cleaning {bill_number}: {e}")
            
            # Commit batch
            conn.commit()
            
            total_cleaned += batch_cleaned
            elapsed = time.time() - start_time
            rate = total_cleaned / elapsed * 60 if elapsed > 0 else 0
            
            print(f"📊 Batch complete:")
            print(f"  🧹 Cleaned in this batch: {batch_cleaned}")
            print(f"  📈 Total cleaned: {total_cleaned}")
            print(f"  ⏱️  Time: {elapsed/60:.1f} minutes")
            print(f"  🔄 Rate: {rate:.1f} bills/minute")
            
            if remaining_count <= batch_size:
                print("🎯 This should be the final batch!")
    
    elapsed_total = time.time() - start_time
    print(f"\n🎉 ALL Texas summaries completely cleaned!")
    print(f"📊 Final Results:")
    print(f"  🧹 Total bills cleaned: {total_cleaned}")
    print(f"  ⏱️  Total time: {elapsed_total/60:.1f} minutes")
    print(f"  🔄 Average rate: {total_cleaned/elapsed_total*60:.1f} bills/minute")

if __name__ == "__main__":
    clean_all_remaining()