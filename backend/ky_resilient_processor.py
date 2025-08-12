#!/usr/bin/env python3
"""
Resilient Kentucky AI processor with timeout and error recovery
Handles problematic bills without getting stuck
"""

import os
import time
import asyncio
import signal
from datetime import datetime
from database_config import get_db_connection
from ai import analyze_executive_order

# Track failed bills to skip them temporarily
FAILED_BILLS = set()
MAX_RETRIES = 2

# Practice area keywords mapping
PRACTICE_AREA_KEYWORDS = {
    'healthcare': ['health', 'medical', 'hospital', 'insurance', 'medicare', 'patient', 'pharmacy', 'medicaid'],
    'education': ['school', 'education', 'student', 'teacher', 'university', 'college', 'curriculum'],
    'tax': ['tax', 'revenue', 'fiscal', 'budget', 'appropriation', 'finance', 'treasury'],
    'environment': ['environment', 'climate', 'pollution', 'renewable', 'conservation', 'water', 'air quality'],
    'criminal-justice': ['criminal', 'crime', 'police', 'prison', 'sentence', 'conviction', 'court', 'jail'],
    'labor': ['labor', 'employment', 'worker', 'wage', 'union', 'workplace', 'unemployment'],
    'housing': ['housing', 'rent', 'tenant', 'landlord', 'eviction', 'mortgage', 'zoning'],
    'transportation': ['transportation', 'highway', 'road', 'vehicle', 'traffic', 'transit', 'bridge'],
    'agriculture': ['agriculture', 'farm', 'crop', 'livestock', 'ranch', 'dairy', 'tobacco'],
    'technology': ['technology', 'internet', 'digital', 'cyber', 'data', 'privacy', 'broadband'],
}

def determine_practice_area(title, description):
    """Determine practice area based on content"""
    text = f"{title or ''} {description or ''}".lower()
    
    for area, keywords in PRACTICE_AREA_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text:
                return area
    
    return 'government-operations'

async def process_bill_with_timeout(bill_data, timeout=30):
    """Process a single bill with timeout"""
    id_val, bill_number, title, description, status = bill_data
    
    # Skip if previously failed multiple times
    if bill_number in FAILED_BILLS:
        print(f"  ⏭️ Skipping {bill_number} (previously failed)")
        return False
    
    try:
        # Create context
        bill_context = f"""
        Bill Number: {bill_number}
        Title: {title or 'No title'}
        Description: {description or 'No description'}
        Status: {status or 'Unknown'}
        State: Kentucky (KY)
        """
        
        print(f"  Processing {bill_number}...", end="", flush=True)
        
        # Process with timeout
        try:
            ai_result = await asyncio.wait_for(
                analyze_executive_order(bill_context),
                timeout=timeout
            )
        except asyncio.TimeoutError:
            print(f" ⏱️ Timeout!")
            FAILED_BILLS.add(bill_number)
            return False
        
        if ai_result and isinstance(ai_result, dict):
            # Extract values
            executive_summary = ai_result.get('ai_executive_summary', '')
            talking_points = ai_result.get('ai_talking_points', '')
            business_impact = ai_result.get('ai_business_impact', '')
            
            # Determine practice area
            practice_area = determine_practice_area(title, description)
            
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
                        ai_version = '1.0',
                        last_updated = ?
                    WHERE id = ?
                """, (
                    str(executive_summary)[:2000],
                    str(talking_points)[:2000],
                    str(business_impact)[:2000],
                    str(executive_summary)[:2000],
                    practice_area,
                    datetime.now(),
                    id_val
                ))
                conn.commit()
            
            print(f" ✅ {practice_area}")
            return True
        else:
            print(f" ❌ No result")
            FAILED_BILLS.add(bill_number)
            return False
            
    except Exception as e:
        print(f" ❌ Error: {str(e)[:50]}")
        FAILED_BILLS.add(bill_number)
        return False

async def process_batch_resilient(batch_size=25):
    """Process a batch with resilient error handling"""
    print(f"\n🔄 Processing Kentucky bills (resilient batch of {batch_size})")
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Get bills without AI summaries, excluding known problem bills
        if FAILED_BILLS:
            placeholders = ','.join(['?' for _ in FAILED_BILLS])
            query = f"""
                SELECT TOP {batch_size} id, bill_number, title, description, status
                FROM dbo.state_legislation
                WHERE state = 'KY'
                AND (ai_executive_summary IS NULL OR ai_executive_summary = '')
                AND bill_number NOT IN ({placeholders})
                ORDER BY bill_number
            """
            cursor.execute(query, list(FAILED_BILLS))
        else:
            cursor.execute(f"""
                SELECT TOP {batch_size} id, bill_number, title, description, status
                FROM dbo.state_legislation
                WHERE state = 'KY'
                AND (ai_executive_summary IS NULL OR ai_executive_summary = '')
                ORDER BY bill_number
            """)
        
        bills = cursor.fetchall()
        
        if not bills:
            # If no bills found, clear failed bills and try again
            if FAILED_BILLS:
                print(f"🔄 Clearing {len(FAILED_BILLS)} failed bills and retrying...")
                FAILED_BILLS.clear()
                return 0
            print(f"✅ No bills to process for Kentucky")
            return -1
        
        print(f"📊 Processing {len(bills)} bills (skipping {len(FAILED_BILLS)} problematic)...")
        
        processed = 0
        batch_start = time.time()
        
        for i, bill in enumerate(bills):
            # Add delay between bills to avoid rate limiting
            if i > 0:
                await asyncio.sleep(1)
            
            # Check if batch is taking too long (10 minutes max per batch)
            if time.time() - batch_start > 600:
                print(f"⏰ Batch timeout - processed {processed} bills")
                break
            
            success = await process_bill_with_timeout(bill, timeout=30)
            if success:
                processed += 1
        
        print(f"✅ Processed {processed}/{len(bills)} bills in this batch")
        return processed

def check_remaining_bills():
    """Check how many KY bills still need processing"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT COUNT(*) 
                FROM dbo.state_legislation 
                WHERE state = 'KY' 
                AND (ai_executive_summary IS NULL OR ai_executive_summary = '')
            """)
            return cursor.fetchone()[0]
    except Exception as e:
        print(f"Error checking bills: {e}")
        return 0

def log_progress():
    """Log current progress to file"""
    try:
        with open('/tmp/ky_progress.log', 'a') as f:
            remaining = check_remaining_bills()
            f.write(f"{datetime.now()}: Remaining {remaining} bills, Failed {len(FAILED_BILLS)}\n")
    except:
        pass

async def main():
    """Main resilient processing loop"""
    print("🛡️ Kentucky Resilient AI Processor")
    print("=" * 60)
    print("Features: Timeout protection, error recovery, skip problematic bills")
    
    iteration = 0
    batch_size = 25  # Smaller batches for better control
    max_iterations = 200
    consecutive_failures = 0
    
    while True:
        iteration += 1
        print(f"\n[Iteration {iteration}] {time.strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Check remaining bills
        remaining = check_remaining_bills()
        print(f"📊 Remaining bills: {remaining}")
        
        if remaining == 0:
            print("🎉 All Kentucky bills processed!")
            break
        
        # Process batch
        try:
            processed = await process_batch_resilient(batch_size)
            
            if processed == -1:
                print("✅ Processing complete!")
                break
            elif processed > 0:
                print(f"📈 Progress: {processed} bills processed")
                consecutive_failures = 0
                log_progress()
                
                # Short wait between batches
                print("⏳ Waiting 20 seconds...")
                await asyncio.sleep(20)
            else:
                consecutive_failures += 1
                print(f"⚠️ No progress (attempt {consecutive_failures})")
                
                if consecutive_failures >= 3:
                    print("🔄 Clearing failed bills list...")
                    FAILED_BILLS.clear()
                    consecutive_failures = 0
                
                print("⏳ Waiting 60 seconds...")
                await asyncio.sleep(60)
                
        except KeyboardInterrupt:
            print("\n⛔ Interrupted by user")
            break
        except Exception as e:
            print(f"❌ Batch error: {e}")
            print("⏳ Waiting 2 minutes...")
            await asyncio.sleep(120)
        
        # Safety check
        if iteration >= max_iterations:
            print(f"🛑 Maximum iterations ({max_iterations}) reached")
            print(f"📊 Final: {remaining} bills remaining, {len(FAILED_BILLS)} failed")
            break
    
    # Final report
    if FAILED_BILLS:
        print(f"\n⚠️ Failed bills ({len(FAILED_BILLS)}):")
        for bill in list(FAILED_BILLS)[:10]:
            print(f"  - {bill}")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n⛔ Stopped by user")