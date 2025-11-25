#!/usr/bin/env python3
"""
Clean Texas state bills with malformed **SUMMARY:** prefix
Simple cleanup to remove formatting artifacts and move content to proper fields
"""

import sys
import re
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

def clean_texas_summaries(batch_size=100):
    """Clean malformed summaries in batches"""
    print(f"\n🧹 Cleaning Texas bills with malformed summary format")
    print(f"📅 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"📦 Batch size: {batch_size}")
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Get total count
        cursor.execute("""
            SELECT COUNT(*) 
            FROM dbo.state_legislation
            WHERE state = 'TX'
            AND (ai_summary LIKE '**SUMMARY:**%' OR ai_summary LIKE 'SUMMARY:%')
        """)
        total_count = cursor.fetchone()[0]
        print(f"📊 Total bills with malformed summaries: {total_count}")
        
        if total_count == 0:
            print("✅ No malformed summaries found!")
            return
        
        # Get bills to clean (batch)
        cursor.execute(f"""
            SELECT TOP {batch_size} id, bill_number, ai_summary, ai_executive_summary
            FROM dbo.state_legislation
            WHERE state = 'TX'
            AND (ai_summary LIKE '**SUMMARY:**%' OR ai_summary LIKE 'SUMMARY:%')
            ORDER BY bill_number
        """)
        
        bills = cursor.fetchall()
        
        if not bills:
            print("✅ No bills found to clean!")
            return
        
        print(f"🧹 Cleaning {len(bills)} bills from total {total_count}...")
        
        cleaned_count = 0
        
        for i, (id_val, bill_number, ai_summary, ai_executive_summary) in enumerate(bills):
            try:
                # Clean the summary text
                cleaned_summary = clean_summary_text(ai_summary)
                
                if cleaned_summary and cleaned_summary != ai_summary:
                    # Update both ai_summary and ai_executive_summary
                    cursor.execute("""
                        UPDATE dbo.state_legislation
                        SET ai_summary = ?,
                            ai_executive_summary = ?,
                            ai_version = 'cleaned_format_v1',
                            last_updated = ?
                        WHERE id = ?
                    """, (
                        cleaned_summary[:2000],  # Truncate if too long
                        cleaned_summary[:2000],  # Copy to executive summary
                        datetime.now(),
                        id_val
                    ))
                    
                    cleaned_count += 1
                    
                    if (i + 1) % 25 == 0:  # Progress every 25 bills
                        print(f"🧹 Progress: {i+1}/{len(bills)} cleaned")
                
            except Exception as e:
                print(f"❌ Error cleaning {bill_number}: {e}")
        
        # Commit all changes
        conn.commit()
        
        print(f"\n📊 Cleaning complete:")
        print(f"  🧹 Successfully cleaned: {cleaned_count}")
        print(f"  📈 Success rate: {(cleaned_count/len(bills)*100):.1f}%")
        
        # Check remaining count
        cursor.execute("""
            SELECT COUNT(*) 
            FROM dbo.state_legislation
            WHERE state = 'TX'
            AND (ai_summary LIKE '**SUMMARY:**%' OR ai_summary LIKE 'SUMMARY:%')
        """)
        remaining_count = cursor.fetchone()[0]
        print(f"  📊 Remaining malformed: {remaining_count}")
        
        if remaining_count > 0:
            print(f"\n💡 To continue cleaning, run the script again:")
            print(f"   docker exec backend python /app/clean_texas_summaries.py {batch_size}")

def main():
    """Main entry point"""
    batch_size = 100  # Default batch size
    
    if len(sys.argv) > 1:
        try:
            batch_size = int(sys.argv[1])
            print(f"🎯 Using batch size: {batch_size}")
        except ValueError:
            print("❌ Invalid batch size. Please provide a number.")
            sys.exit(1)
    
    clean_texas_summaries(batch_size)

if __name__ == "__main__":
    main()