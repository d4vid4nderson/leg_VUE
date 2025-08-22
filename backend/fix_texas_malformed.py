#!/usr/bin/env python3
"""
Fix Texas state bills with malformed **SUMMARY:** format
Uses the same pattern as existing Texas processing scripts
"""

import sys
import asyncio
import time
from datetime import datetime
from database_config import get_db_connection

# Import the AI function that works
try:
    from ai import analyze_state_legislation
    print("✅ AI module imported successfully")
except Exception as e:
    print(f"❌ Error importing AI module: {e}")
    sys.exit(1)

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

async def process_bill(bill_data):
    """Process a single bill with AI (matching existing pattern)"""
    id_val, bill_number, title, description, status = bill_data
    
    try:
        print(f"🔄 Processing {bill_number}...")
        
        # Generate AI analysis using the same function as existing scripts
        ai_result = await analyze_state_legislation(
            title=title or 'No title',
            description=description or 'No description', 
            state='TX',
            bill_number=bill_number
        )
        
        if ai_result and isinstance(ai_result, dict):
            # Extract summary
            executive_summary = ai_result.get('ai_executive_summary', '')
            
            # Determine practice area
            practice_area = determine_practice_area(title, description)
            
            # Update database (matching existing pattern)
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
                    'azure_openai_fixed_format_v2',
                    datetime.now(),
                    id_val
                ))
                conn.commit()
            
            print(f"✅ {bill_number} - Fixed - {practice_area}")
            return True
            
    except Exception as e:
        print(f"❌ {bill_number} - Error: {e}")
        return False
    
    # Rate limiting - be gentle with Azure AI (matching existing scripts)
    await asyncio.sleep(2)

async def fix_malformed_texas_bills(batch_size=50):
    """Fix Texas bills with malformed summaries"""
    print(f"\n🚀 Fixing Texas bills with malformed **SUMMARY:** format")
    print(f"📅 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"📦 Batch size: {batch_size}")
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Get total count first
        cursor.execute("""
            SELECT COUNT(*) 
            FROM dbo.state_legislation
            WHERE state = 'TX'
            AND (
                ai_executive_summary LIKE '**SUMMARY:**%'
                OR ai_summary LIKE '**SUMMARY:**%'
                OR ai_executive_summary LIKE '%**SUMMARY:**%'
                OR ai_summary LIKE '%**SUMMARY:**%'
            )
        """)
        total_count = cursor.fetchone()[0]
        print(f"📊 Total bills with malformed summaries: {total_count}")
        
        if total_count == 0:
            print("✅ No malformed summaries found!")
            return
        
        # Get bills to fix (limited batch)
        cursor.execute(f"""
            SELECT TOP {batch_size} id, bill_number, title, description, status
            FROM dbo.state_legislation
            WHERE state = 'TX'
            AND (
                ai_executive_summary LIKE '**SUMMARY:**%'
                OR ai_summary LIKE '**SUMMARY:**%'
                OR ai_executive_summary LIKE '%**SUMMARY:**%'
                OR ai_summary LIKE '%**SUMMARY:**%'
            )
            ORDER BY bill_number
        """)
        
        bills = cursor.fetchall()
        
        if not bills:
            print("✅ No bills found to process!")
            return
        
        print(f"📝 Processing {len(bills)} bills from total {total_count}...")
        
        successful = 0
        failed = 0
        
        start_time = time.time()
        
        for i, bill_data in enumerate(bills):
            bill_number = bill_data[1]
            print(f"\n[{i+1}/{len(bills)}] Processing {bill_number}")
            
            success = await process_bill(bill_data)
            if success:
                successful += 1
            else:
                failed += 1
            
            # Progress update every 10 bills
            if (i + 1) % 10 == 0:
                elapsed = time.time() - start_time
                rate = (i + 1) / elapsed * 60  # bills per minute
                remaining = len(bills) - (i + 1)
                eta_minutes = remaining / rate if rate > 0 else 0
                print(f"📈 Progress: {i+1}/{len(bills)} ({((i+1)/len(bills)*100):.1f}%) - Rate: {rate:.1f} bills/min - ETA: {eta_minutes:.1f}m")
        
        elapsed_total = time.time() - start_time
        
        print(f"\n📊 Batch processing complete:")
        print(f"  ✅ Successfully fixed: {successful}")
        print(f"  ❌ Failed: {failed}")
        print(f"  📈 Success rate: {(successful/len(bills)*100):.1f}%")
        print(f"  ⏱️  Time: {elapsed_total/60:.1f} minutes")
        print(f"  🔄 Rate: {len(bills)/elapsed_total*60:.1f} bills/minute")
        
        # Check remaining count
        cursor.execute("""
            SELECT COUNT(*) 
            FROM dbo.state_legislation
            WHERE state = 'TX'
            AND (
                ai_executive_summary LIKE '**SUMMARY:**%'
                OR ai_summary LIKE '**SUMMARY:**%'
                OR ai_executive_summary LIKE '%**SUMMARY:**%'
                OR ai_summary LIKE '%**SUMMARY:**%'
            )
        """)
        remaining_count = cursor.fetchone()[0]
        print(f"  📊 Remaining malformed: {remaining_count}")
        
        if remaining_count > 0:
            print(f"\n💡 To continue fixing, run the script again:")
            print(f"   docker exec backend python /app/fix_texas_malformed.py {batch_size}")

async def main():
    """Main entry point"""
    batch_size = 50  # Default batch size
    
    if len(sys.argv) > 1:
        try:
            batch_size = int(sys.argv[1])
            print(f"🎯 Using batch size: {batch_size}")
        except ValueError:
            print("❌ Invalid batch size. Please provide a number.")
            sys.exit(1)
    
    await fix_malformed_texas_bills(batch_size)

if __name__ == "__main__":
    asyncio.run(main())