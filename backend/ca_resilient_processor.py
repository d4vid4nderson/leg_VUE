#!/usr/bin/env python3
"""
Resilient California processor with connection retry logic
"""
import asyncio
import time
from database_config import get_db_connection
from ai import analyze_executive_order

async def process_single_bill_with_retry(bill_data, max_retries=3):
    """Process a single bill with database retry logic"""
    id_val, bill_number, title, description, status = bill_data
    
    # Skip bills with no content
    if not title and not description:
        print(f"⚠️ Skipping {bill_number}: No content")
        return False
    
    # Use title as description if description is missing
    if not description:
        description = title
    
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
            timeout=60
        )
        
        if result and isinstance(result, dict):
            # Extract values
            executive_summary = result.get('ai_executive_summary', '')[:2000]
            talking_points = result.get('ai_talking_points', '')[:2000]
            business_impact = result.get('ai_business_impact', '')[:2000]
            
            # Determine practice area
            text = f"{title or ''} {description or ''}".lower()
            practice_area = 'government-operations'
            
            if 'health' in text or 'medical' in text:
                practice_area = 'healthcare'
            elif 'school' in text or 'education' in text:
                practice_area = 'education'
            elif 'crime' in text or 'criminal' in text:
                practice_area = 'criminal-justice'
            elif 'tax' in text or 'revenue' in text:
                practice_area = 'tax'
            elif 'environment' in text or 'climate' in text:
                practice_area = 'environment'
            
            # Save to database with retry logic
            for retry in range(max_retries):
                try:
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
                            executive_summary,
                            talking_points,
                            business_impact,
                            executive_summary,
                            practice_area,
                            id_val
                        ))
                        conn.commit()
                    
                    print(f"✅ {bill_number} - {practice_area}")
                    return True
                    
                except Exception as db_error:
                    if retry < max_retries - 1:
                        print(f"⚠️ Database error, retry {retry+1}/{max_retries}")
                        await asyncio.sleep(5)
                    else:
                        print(f"❌ {bill_number}: Database save failed after {max_retries} retries")
                        return False
            
    except asyncio.TimeoutError:
        print(f"⏰ {bill_number}: AI timeout")
        return False
    except Exception as e:
        print(f"❌ {bill_number}: {str(e)[:100]}")
        return False

async def process_batch():
    """Process a batch of bills with connection handling"""
    print(f"\n🚀 Processing batch at {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Get bills with retry logic
    for retry in range(3):
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT TOP 10 id, bill_number, title, description, status
                    FROM dbo.state_legislation
                    WHERE state = 'CA'
                    AND (ai_executive_summary IS NULL OR ai_executive_summary = '')
                    AND NOT (title IS NULL AND description IS NULL)
                    ORDER BY bill_number
                """)
                
                bills = cursor.fetchall()
                break
        except Exception as e:
            if retry < 2:
                print(f"⚠️ Database connection error, retry {retry+1}/3")
                await asyncio.sleep(5)
            else:
                print(f"❌ Failed to get bills after 3 retries")
                return 0
    
    if not bills:
        print("✅ No more bills to process")
        return 0
    
    print(f"📦 Processing {len(bills)} bills...")
    
    processed = 0
    for bill in bills:
        success = await process_single_bill_with_retry(bill)
        if success:
            processed += 1
        await asyncio.sleep(3)  # Delay between bills
    
    print(f"✅ Batch complete: {processed}/{len(bills)} processed")
    return processed

async def main():
    """Main processing loop"""
    print("🔄 Resilient California Processor")
    print("=" * 60)
    
    total_processed = 0
    iterations = 0
    no_progress_count = 0
    
    while iterations < 200:  # Increased limit for final push
        iterations += 1
        
        # Check remaining with retry
        remaining = -1
        for retry in range(3):
            try:
                with get_db_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute("""
                        SELECT COUNT(*) 
                        FROM dbo.state_legislation 
                        WHERE state = 'CA' 
                        AND (ai_executive_summary IS NULL OR ai_executive_summary = '')
                    """)
                    remaining = cursor.fetchone()[0]
                    break
            except Exception as e:
                if retry < 2:
                    print(f"⚠️ Database check failed, retry {retry+1}/3")
                    await asyncio.sleep(5)
                else:
                    print(f"❌ Cannot check remaining bills")
        
        if remaining == -1:
            print("⚠️ Cannot connect to database, waiting 30 seconds...")
            await asyncio.sleep(30)
            continue
            
        print(f"\n[Iteration {iterations}] Remaining: {remaining} bills")
        
        if remaining == 0:
            print("🎉 All bills processed!")
            break
        
        # Process batch
        processed = await process_batch()
        total_processed += processed
        
        if processed == 0:
            no_progress_count += 1
            if no_progress_count >= 5:
                print("❌ No progress after 5 attempts")
                break
            print("⚠️ No progress, waiting 30 seconds...")
            await asyncio.sleep(30)
        else:
            no_progress_count = 0
            print(f"📊 Total processed: {total_processed}")
            print("⏳ Waiting 5 seconds...")
            await asyncio.sleep(5)
    
    print(f"\n🏁 Completed {total_processed} bills in {iterations} iterations")

if __name__ == "__main__":
    asyncio.run(main())