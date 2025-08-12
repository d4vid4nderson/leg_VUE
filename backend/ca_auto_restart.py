#!/usr/bin/env python3
"""
Auto-restarting California AI processor
Continuously processes CA bills and restarts on completion/failure
"""

import os
import time
import subprocess
from database_config import get_db_connection

def check_remaining_bills():
    """Check how many CA bills still need processing"""
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
        return 0

def run_ca_processing():
    """Run the main CA processing script"""
    try:
        print("🚀 Starting California AI processing...")
        result = subprocess.run([
            'python', '/app/process_california_complete.py'
        ], capture_output=True, text=True, timeout=3600)  # 1 hour timeout
        
        print("Process completed with return code:", result.returncode)
        if result.stdout:
            print("STDOUT:", result.stdout[-1000:])  # Last 1000 chars
        if result.stderr:
            print("STDERR:", result.stderr[-1000:])
            
        return result.returncode == 0
    except subprocess.TimeoutExpired:
        print("⏰ Process timed out after 1 hour")
        return False
    except Exception as e:
        print(f"❌ Error running process: {e}")
        return False

def main():
    """Main auto-restart loop"""
    print("🔄 California Auto-Restart AI Processor")
    print("=" * 60)
    
    iteration = 0
    
    while True:
        iteration += 1
        print(f"\n[Iteration {iteration}] {time.strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Check remaining bills
        remaining = check_remaining_bills()
        print(f"📊 Remaining bills to process: {remaining}")
        
        if remaining == 0:
            print("🎉 All California bills processed! Exiting.")
            break
        
        # Run processing
        success = run_ca_processing()
        
        if success:
            print("✅ Processing batch completed successfully")
        else:
            print("⚠️ Processing encountered issues, restarting...")
        
        # Check progress made
        new_remaining = check_remaining_bills()
        processed_this_round = remaining - new_remaining
        
        print(f"📈 Progress: {processed_this_round} bills processed this round")
        print(f"📊 Remaining: {new_remaining} bills")
        
        if processed_this_round == 0:
            print("⚠️ No progress made, waiting 2 minutes before retry...")
            time.sleep(120)
        else:
            print("⏳ Waiting 30 seconds before next batch...")
            time.sleep(30)
        
        # Safety check: don't run indefinitely
        if iteration > 50:
            print("🛑 Maximum iterations reached, exiting for safety")
            break

if __name__ == "__main__":
    main()