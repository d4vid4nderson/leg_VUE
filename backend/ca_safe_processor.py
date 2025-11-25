#!/usr/bin/env python3
"""
Safe California processor that skips problematic bills
"""
import asyncio
import time
from database_config import get_db_connection
from ai import analyze_executive_order

async def process_single_bill(bill_data):
    """Process a single bill with error handling"""
    id_val, bill_number, title, description, status = bill_data
    
    # Skip bills with no content
    if not title and not description:
        print(f"⚠️ Skipping {bill_number}: No content")
        return False
    
    # Use title as description if description is missing
    if not description:
        description = title
    
    # Skip if title is too short
    if title and len(title) < 5:
        print(f"⚠️ Skipping {bill_number}: Title too short")
        return False
    
    try:
        print(f"📝 Processing {bill_number}...")
        
        # Create context
        bill_context = f"""
        Bill Number: {bill_number}
        Title: {title or 'No title'}
        Description: {description or 'No description'}
        Status: {status or 'Unknown'}
        State: California
        """
        
        # Call AI with timeout
        result = await asyncio.wait_for(
            analyze_executive_order(bill_context),
            timeout=60  # 60 second timeout per bill
        )
        
        if result and isinstance(result, dict):
            # Extract values
            executive_summary = result.get('ai_executive_summary', '')
            talking_points = result.get('ai_talking_points', '')
            business_impact = result.get('ai_business_impact', '')
            
            # Determine practice area
            text = f"{title or ''} {description or ''}".lower()
            practice_area = 'government-operations'  # Default
            
            area_keywords = {
                'healthcare': ['health', 'medical', 'hospital', 'patient'],
                'education': ['school', 'education', 'student', 'teacher'],
                'criminal-justice': ['criminal', 'crime', 'police', 'prison'],
                'tax': ['tax', 'revenue', 'fiscal', 'budget'],
                'environment': ['environment', 'climate', 'pollution'],
            }
            
            for area, keywords in area_keywords.items():
                if any(keyword in text for keyword in keywords):
                    practice_area = area
                    break
            
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
                        last_updated = GETDATE()
                    WHERE id = ?
                """, (
                    str(executive_summary)[:2000],
                    str(talking_points)[:2000],
                    str(business_impact)[:2000],
                    str(executive_summary)[:2000],
                    practice_area,
                    id_val
                ))
                conn.commit()
            
            print(f"✅ {bill_number} - {practice_area}")
            return True
            
    except asyncio.TimeoutError:
        print(f"⏰ {bill_number}: AI timeout")
        return False
    except Exception as e:
        print(f"❌ {bill_number}: {str(e)[:100]}")
        return False

async def process_batch():
    """Process a batch of bills"""
    print(f"\n🚀 Processing batch at {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Get 20 bills to process (smaller batch)
        cursor.execute("""
            SELECT TOP 20 id, bill_number, title, description, status
            FROM dbo.state_legislation
            WHERE state = 'CA'
            AND (ai_executive_summary IS NULL OR ai_executive_summary = '')
            AND NOT (title IS NULL AND description IS NULL)
            ORDER BY bill_number
        """)
        
        bills = cursor.fetchall()
        
        if not bills:
            print("✅ No more bills to process")
            return 0
        
        print(f"📦 Processing {len(bills)} bills...")
        
        processed = 0
        for bill in bills:
            success = await process_single_bill(bill)
            if success:
                processed += 1
            # Small delay between bills
            await asyncio.sleep(2)
        
        print(f"✅ Batch complete: {processed}/{len(bills)} processed")
        return processed

async def main():
    """Main processing loop"""
    print("🔄 Safe California Processor")
    print("=" * 60)
    
    total_processed = 0
    iterations = 0
    
    while iterations < 100:  # Safety limit
        iterations += 1
        
        # Check remaining
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT COUNT(*) 
                FROM dbo.state_legislation 
                WHERE state = 'CA' 
                AND (ai_executive_summary IS NULL OR ai_executive_summary = '')
            """)
            remaining = cursor.fetchone()[0]
        
        print(f"\n[Iteration {iterations}] Remaining: {remaining} bills")
        
        if remaining == 0:
            print("🎉 All bills processed!")
            break
        
        # Process batch
        processed = await process_batch()
        total_processed += processed
        
        if processed == 0:
            print("⚠️ No progress made, stopping")
            break
        
        print(f"📊 Total processed so far: {total_processed}")
        print("⏳ Waiting 10 seconds before next batch...")
        await asyncio.sleep(10)
    
    print(f"\n🏁 Completed {total_processed} bills in {iterations} iterations")

if __name__ == "__main__":
    asyncio.run(main())