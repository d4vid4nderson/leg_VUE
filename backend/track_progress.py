#!/usr/bin/env python3
"""Track Colorado AI processing progress"""

import time
from database_config import get_db_connection

def get_stats():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT COUNT(*) FROM dbo.state_legislation 
            WHERE state = 'CO' AND ai_executive_summary IS NOT NULL AND ai_executive_summary != ''
        """)
        processed = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM dbo.state_legislation WHERE state = 'CO'")
        total = cursor.fetchone()[0]
        
        cursor.execute("""
            SELECT TOP 1 bill_number, last_updated 
            FROM dbo.state_legislation 
            WHERE state = 'CO' AND ai_executive_summary IS NOT NULL AND ai_executive_summary != ''
            ORDER BY last_updated DESC
        """)
        
        latest = cursor.fetchone()
        latest_bill = latest[0] if latest else "None"
        latest_time = latest[1] if latest else "None"
        
        return processed, total, latest_bill, latest_time

print("🔍 Colorado AI Processing Tracker")
print("=" * 50)

start_processed, total, _, _ = get_stats()
print(f"📊 Starting: {start_processed}/{total} bills processed")
print(f"📅 Monitoring every 5 minutes...")
print()

while True:
    time.sleep(300)  # Wait 5 minutes
    
    try:
        processed, total, latest_bill, latest_time = get_stats()
        remaining = total - processed
        progress_pct = processed / total * 100
        
        print(f"⏰ {time.strftime('%H:%M:%S')} - Progress: {processed}/{total} ({progress_pct:.1f}%)")
        print(f"📈 Latest: {latest_bill} at {latest_time}")
        print(f"🔢 Remaining: {remaining} bills")
        
        if remaining == 0:
            print("🎉 All Colorado bills processed!")
            break
            
        # Calculate rate
        session_processed = processed - start_processed
        if session_processed > 0:
            elapsed_minutes = (time.time() - start_time) / 60
            rate_per_minute = session_processed / elapsed_minutes
            eta_minutes = remaining / rate_per_minute if rate_per_minute > 0 else 0
            print(f"🚀 Rate: {rate_per_minute:.1f} bills/min, ETA: {eta_minutes:.1f} min")
        
        print("-" * 50)
        
    except KeyboardInterrupt:
        print("\n👋 Monitoring stopped")
        break
    except Exception as e:
        print(f"❌ Error: {e}")
        time.sleep(60)  # Wait longer on error