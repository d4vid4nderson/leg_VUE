#!/usr/bin/env python3
"""
Final cleanup of ALL remaining Texas bills with SUMMARY formatting
Aggressive cleaning to eliminate all traces of SUMMARY prefixes
"""

import re
import time
from datetime import datetime
from database_config import get_db_connection

def aggressive_clean_summary(text):
    """Aggressively remove all SUMMARY formatting"""
    if not text:
        return ""
    
    # Multiple passes to catch all variations
    original = text
    
    # Pass 1: Remove standard patterns
    cleaned = re.sub(r'^\*\*SUMMARY:\*\*\s*', '', text, flags=re.IGNORECASE)
    cleaned = re.sub(r'^\*\*SUMMARY\*\*\s*', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'^SUMMARY:\s*', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'^SUMMARY\s+', '', cleaned, flags=re.IGNORECASE)
    
    # Pass 2: Remove any remaining variations with surrounding whitespace/newlines
    cleaned = re.sub(r'^\s*\*\*SUMMARY:\*\*\s*', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'^\s*\*\*SUMMARY\*\*\s*', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'^\s*SUMMARY:\s*', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'^\s*SUMMARY\s+', '', cleaned, flags=re.IGNORECASE)
    
    # Pass 3: Remove with newlines
    cleaned = re.sub(r'^\s*\n+\*\*SUMMARY:\*\*\s*', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'^\s*\n+SUMMARY:\s*', '', cleaned, flags=re.IGNORECASE)
    
    # Pass 4: General cleanup
    cleaned = re.sub(r'^\*?SUMMARY\*?:?\s*', '', cleaned, flags=re.IGNORECASE)
    
    # Clean up whitespace and formatting
    cleaned = re.sub(r'^\s*\n+', '', cleaned)
    cleaned = cleaned.strip()
    cleaned = re.sub(r'\n+', ' ', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned)
    
    return cleaned

def final_cleanup():
    """Final cleanup of all remaining Texas bills"""
    print(f"🚀 Final aggressive cleanup of ALL Texas SUMMARY formatting")
    print(f"📅 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    total_cleaned = 0
    start_time = time.time()
    
    # Process in chunks until done
    while True:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Check remaining with very broad search
            cursor.execute("""
                SELECT COUNT(*) 
                FROM dbo.state_legislation
                WHERE state = 'TX'
                AND (
                    UPPER(ai_summary) LIKE '%SUMMARY%' 
                    OR UPPER(ai_executive_summary) LIKE '%SUMMARY%'
                )
            """)
            remaining_count = cursor.fetchone()[0]
            
            if remaining_count == 0:
                print("✅ ALL Texas bills cleaned!")
                break
                
            print(f"📊 Bills with SUMMARY text remaining: {remaining_count}")
            
            # Get chunk to process
            chunk_size = 1000
            cursor.execute(f"""
                SELECT TOP {chunk_size} id, bill_number, ai_summary, ai_executive_summary
                FROM dbo.state_legislation
                WHERE state = 'TX'
                AND (
                    UPPER(ai_summary) LIKE '%SUMMARY%' 
                    OR UPPER(ai_executive_summary) LIKE '%SUMMARY%'
                )
                ORDER BY bill_number
            """)
            
            bills = cursor.fetchall()
            
            if not bills:
                print("✅ No more bills found!")
                break
            
            print(f"🧹 Aggressively cleaning {len(bills)} bills...")
            
            chunk_cleaned = 0
            
            for i, (id_val, bill_number, ai_summary, ai_executive_summary) in enumerate(bills):
                try:
                    # Aggressive cleaning of both fields
                    cleaned_summary = aggressive_clean_summary(ai_summary)
                    cleaned_executive = aggressive_clean_summary(ai_executive_summary)
                    
                    # Use summary for executive if executive is empty
                    if not cleaned_executive and cleaned_summary:
                        cleaned_executive = cleaned_summary
                    
                    # Update if content exists and changed
                    if cleaned_summary or cleaned_executive:
                        cursor.execute("""
                            UPDATE dbo.state_legislation
                            SET ai_summary = ?,
                                ai_executive_summary = ?,
                                ai_version = 'final_aggressive_clean_v1',
                                last_updated = ?
                            WHERE id = ?
                        """, (
                            cleaned_summary[:2000] if cleaned_summary else '',
                            cleaned_executive[:2000] if cleaned_executive else '',
                            datetime.now(),
                            id_val
                        ))
                        
                        chunk_cleaned += 1
                    
                    # Progress every 100 bills
                    if (i + 1) % 100 == 0:
                        print(f"  🧹 Progress: {i+1}/{len(bills)}")
                        
                except Exception as e:
                    print(f"  ❌ Error cleaning {bill_number}: {e}")
            
            # Commit chunk
            conn.commit()
            
            total_cleaned += chunk_cleaned
            elapsed = time.time() - start_time
            rate = total_cleaned / elapsed * 60 if elapsed > 0 else 0
            
            print(f"📊 Chunk complete:")
            print(f"  🧹 Cleaned in chunk: {chunk_cleaned}")
            print(f"  📈 Total cleaned: {total_cleaned}")
            print(f"  ⏱️  Time: {elapsed/60:.1f} minutes")
            print(f"  🔄 Rate: {rate:.1f} bills/minute")
    
    elapsed_total = time.time() - start_time
    print(f"\n🎉 FINAL CLEANUP COMPLETE!")
    print(f"📊 Results:")
    print(f"  🧹 Total bills cleaned: {total_cleaned}")
    print(f"  ⏱️  Total time: {elapsed_total/60:.1f} minutes")
    
    # Final verification
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT COUNT(*) 
            FROM dbo.state_legislation
            WHERE state = 'TX'
            AND (
                UPPER(ai_summary) LIKE '%SUMMARY%' 
                OR UPPER(ai_executive_summary) LIKE '%SUMMARY%'
            )
        """)
        final_remaining = cursor.fetchone()[0]
        
        print(f"🔍 Final verification: {final_remaining} bills still contain 'SUMMARY'")
        
        if final_remaining == 0:
            print("🎉 SUCCESS: All Texas bills completely cleaned!")
        else:
            print("⚠️  Some bills may need manual review")

if __name__ == "__main__":
    final_cleanup()