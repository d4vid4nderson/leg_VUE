#!/usr/bin/env python3
"""
Robust California AI processor with better error handling
"""
import time
import subprocess
import sys
from database_config import get_db_connection

def get_remaining_bills():
    """Get count of California bills without AI summaries"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT COUNT(*) 
                FROM dbo.state_legislation 
                WHERE state = 'CA' 
                AND (ai_executive_summary IS NULL OR ai_executive_summary = '')
            """)
            return cursor.fetchone()[0]
    except Exception as e:
        print(f"Error checking bills: {e}")
        return -1

def run_single_batch():
    """Run a single batch of processing"""
    try:
        print(f"🚀 Starting processing batch at {time.strftime('%Y-%m-%d %H:%M:%S')}")
        result = subprocess.run(
            ['python', '/app/process_california_complete.py'],
            cwd='/app',
            capture_output=True,
            text=True,
            timeout=2400  # 40 minute timeout
        )
        
        if result.returncode == 0:
            print("✅ Batch completed successfully")
            return True
        else:
            print(f"⚠️ Batch completed with return code: {result.returncode}")
            if result.stderr:
                print(f"Error (last 500 chars): {result.stderr[-500:]}")
            return False
            
    except subprocess.TimeoutExpired:
        print("⏰ Processing timed out after 40 minutes")
        return False
    except Exception as e:
        print(f"❌ Error running processing: {e}")
        return False

def main():
    print("🔄 California Robust AI Processing")
    print("=" * 60)
    
    max_iterations = 100  # Safety limit
    iteration = 0
    no_progress_count = 0
    
    while iteration < max_iterations:
        iteration += 1
        
        # Check remaining bills
        remaining = get_remaining_bills()
        
        if remaining == -1:
            print("❌ Database error, waiting 2 minutes...")
            time.sleep(120)
            continue
            
        print(f"\n[Iteration {iteration}] {time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"📊 Remaining bills: {remaining}")
        
        if remaining == 0:
            print("🎉 All California bills have AI summaries!")
            break
        
        # Run single batch
        success = run_single_batch()
        
        # Check progress
        new_remaining = get_remaining_bills()
        if new_remaining != -1 and remaining != -1:
            processed = remaining - new_remaining
            print(f"📈 Processed {processed} bills this batch")
            
            if processed == 0:
                no_progress_count += 1
                print(f"⚠️ No progress made ({no_progress_count} times)")
                
                if no_progress_count >= 3:
                    print("❌ No progress after 3 attempts, exiting")
                    break
                    
                print("Waiting 3 minutes before retry...")
                time.sleep(180)
            else:
                no_progress_count = 0  # Reset counter on progress
                print("✅ Progress made, continuing immediately...")
                time.sleep(10)  # Short pause
        else:
            print("⏳ Waiting 1 minute before next batch...")
            time.sleep(60)
    
    print(f"\n🏁 Processing ended after {iteration} iterations")
    
    # Final status
    final_remaining = get_remaining_bills()
    if final_remaining > 0:
        print(f"⚠️ {final_remaining} bills still need processing")
        print("Run this script again to continue")
    else:
        print("✅ All bills processed!")

if __name__ == "__main__":
    main()