#!/usr/bin/env python3
"""
Fix Texas state bills that have **SUMMARY:** prefix in their AI summaries
This indicates incomplete or malformed AI processing
"""

import asyncio
import sys
from datetime import datetime
from database_config import get_db_connection
from ai import analyze_state_legislation

# Practice area keywords for categorization
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

async def find_malformed_summaries():
    """Find Texas bills with malformed AI summaries"""
    print("🔍 Finding Texas bills with malformed AI summaries...")
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Find bills with **SUMMARY:** prefix in their AI summary
        cursor.execute('''
            SELECT id, bill_number, title, description, ai_executive_summary, ai_summary
            FROM dbo.state_legislation
            WHERE state = 'TX'
            AND (
                ai_executive_summary LIKE '**SUMMARY:**%'
                OR ai_summary LIKE '**SUMMARY:**%'
                OR ai_executive_summary LIKE '%**SUMMARY:**%'
                OR ai_summary LIKE '%**SUMMARY:**%'
            )
            ORDER BY bill_number
        ''')
        
        bills = cursor.fetchall()
        
        print(f"📊 Found {len(bills)} Texas bills with malformed summaries")
        
        if bills:
            print("\n📋 Sample malformed summaries:")
            for i, (id_val, bill_number, title, desc, ai_exec, ai_sum) in enumerate(bills[:5]):
                print(f"  {i+1}. {bill_number}: {(ai_exec or ai_sum or '')[:100]}...")
        
        return bills

async def reprocess_bill(bill_data):
    """Reprocess a single bill with proper AI"""
    id_val, bill_number, title, description, ai_exec, ai_sum = bill_data
    
    try:
        print(f"🔄 Reprocessing {bill_number}...")
        
        # Generate fresh AI analysis
        ai_result = await analyze_state_legislation(
            title=title or 'No title',
            description=description or 'No description', 
            state='TX',
            bill_number=bill_number
        )
        
        if ai_result and ai_result.get('ai_executive_summary'):
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
                    'azure_openai_fixed_format_v1',
                    datetime.now(),
                    id_val
                ))
                conn.commit()
            
            print(f"✅ {bill_number} - Fixed summary, category: {practice_area}")
            return True
            
    except Exception as e:
        print(f"❌ {bill_number} - Error: {e}")
        return False
    
    # Rate limiting - be gentle with Azure AI
    await asyncio.sleep(2)

async def fix_malformed_summaries(limit=None):
    """Fix all malformed summaries"""
    print(f"\n🚀 Fixing Texas bills with malformed AI summaries")
    print(f"📅 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Find malformed summaries
    bills = await find_malformed_summaries()
    
    if not bills:
        print("✅ No malformed summaries found!")
        return
    
    # Apply limit if specified
    if limit:
        bills = bills[:limit]
        print(f"🎯 Processing first {limit} bills")
    
    print(f"\n📝 Processing {len(bills)} bills...")
    
    successful = 0
    failed = 0
    
    for i, bill_data in enumerate(bills):
        bill_number = bill_data[1]
        print(f"\n[{i+1}/{len(bills)}] Processing {bill_number}")
        
        success = await reprocess_bill(bill_data)
        if success:
            successful += 1
        else:
            failed += 1
    
    print(f"\n📊 Processing complete:")
    print(f"  ✅ Successfully fixed: {successful}")
    print(f"  ❌ Failed: {failed}")
    print(f"  📈 Success rate: {(successful/len(bills)*100):.1f}%")

async def main():
    """Main entry point"""
    if len(sys.argv) > 1:
        try:
            limit = int(sys.argv[1])
            print(f"🎯 Processing limit: {limit} bills")
        except ValueError:
            print("❌ Invalid limit. Please provide a number.")
            sys.exit(1)
    else:
        limit = None
        print("🌐 Processing all malformed summaries")
    
    await fix_malformed_summaries(limit)

if __name__ == "__main__":
    asyncio.run(main())