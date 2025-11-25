#!/usr/bin/env python3
"""
Monitor and continuously run California AI processing
"""
import time
import subprocess
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

def main():
    print("🔄 California Continuous AI Processing Monitor")
    print("=" * 60)
    
    iteration = 0
    
    while True:
        iteration += 1
        
        # Check remaining bills
        remaining = get_remaining_bills()
        
        if remaining == -1:
            print("❌ Error checking database, waiting 1 minute...")
            time.sleep(60)
            continue
            
        print(f"\n[Iteration {iteration}] {time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"📊 Remaining bills: {remaining}")
        
        if remaining == 0:
            print("✅ All California bills have AI summaries!")
            break
        
        # Run the processing script
        print("🚀 Starting processing batch...")
        try:
            result = subprocess.run(
                ['python', '/app/process_california_complete.py'],
                cwd='/app',
                capture_output=True,
                text=True,
                timeout=1800  # 30 minute timeout
            )
            
            if result.returncode == 0:
                print("✅ Batch completed successfully")
            else:
                print(f"⚠️ Batch completed with return code: {result.returncode}")
                if result.stderr:
                    print(f"Error output: {result.stderr[:500]}")
                    
        except subprocess.TimeoutExpired:
            print("⏰ Processing timed out after 30 minutes")
        except Exception as e:
            print(f"❌ Error running processing: {e}")
        
        # Check new count
        new_remaining = get_remaining_bills()
        if new_remaining != -1 and remaining != -1:
            processed = remaining - new_remaining
            print(f"📈 Processed {processed} bills this batch")
            
            if processed == 0:
                print("⚠️ No progress made, waiting 2 minutes...")
                time.sleep(120)
            else:
                print("⏳ Waiting 30 seconds before next batch...")
                time.sleep(30)
        else:
            print("⏳ Waiting 30 seconds before next batch...")
            time.sleep(30)

if __name__ == "__main__":
    main()