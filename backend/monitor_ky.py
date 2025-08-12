#!/usr/bin/env python3
"""Monitor KY processing progress and health"""

import time
from database_config import get_db_connection

def monitor():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Get current stats
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN ai_executive_summary IS NOT NULL AND ai_executive_summary != '' THEN 1 ELSE 0 END) as with_ai
            FROM dbo.state_legislation
            WHERE state = 'KY'
        """)
        
        total, with_ai = cursor.fetchone()
        remaining = total - with_ai
        percent = (with_ai/total)*100 if total > 0 else 0
        
        # Get recent progress
        cursor.execute("""
            SELECT TOP 5 bill_number, last_updated
            FROM dbo.state_legislation
            WHERE state = 'KY' 
            AND ai_executive_summary IS NOT NULL
            ORDER BY last_updated DESC
        """)
        
        recent = cursor.fetchall()
        
        print(f"\n{'='*50}")
        print(f"KY Processing Status - {time.strftime('%H:%M:%S')}")
        print(f"{'='*50}")
        print(f"✅ Processed: {with_ai}/{total} ({percent:.1f}%)")
        print(f"📊 Remaining: {remaining} bills")
        
        if recent:
            print(f"\n📝 Recently processed:")
            for bill, updated in recent:
                print(f"  - {bill}")
        
        # Estimate completion
        if remaining > 0:
            # Assuming ~25 bills per batch, 20 seconds between batches
            estimated_minutes = (remaining / 25) * 0.5
            hours = int(estimated_minutes / 60)
            minutes = int(estimated_minutes % 60)
            print(f"\n⏱️ Estimated time: {hours}h {minutes}m")

if __name__ == "__main__":
    monitor()