#!/usr/bin/env python3
"""Monitor California processing progress"""

import time
from database_config import get_db_connection

def check_progress():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN ai_executive_summary IS NOT NULL AND ai_executive_summary != '' THEN 1 ELSE 0 END) as with_ai,
                SUM(CASE WHEN introduced_date IS NOT NULL AND introduced_date != '' THEN 1 ELSE 0 END) as with_dates,
                SUM(CASE WHEN category != 'not-applicable' AND category IS NOT NULL THEN 1 ELSE 0 END) as with_category,
                SUM(CASE WHEN session_name IS NOT NULL AND session_name != '' THEN 1 ELSE 0 END) as with_session
            FROM dbo.state_legislation
            WHERE state = 'CA'
        """)
        
        total, with_ai, with_dates, with_category, with_session = cursor.fetchone()
        
        # Get recent updates
        cursor.execute("""
            SELECT TOP 5 bill_number, category, last_updated
            FROM dbo.state_legislation
            WHERE state = 'CA'
            AND ai_executive_summary IS NOT NULL
            ORDER BY last_updated DESC
        """)
        
        recent = cursor.fetchall()
        
        return {
            'total': total,
            'with_ai': with_ai,
            'with_dates': with_dates,
            'with_category': with_category,
            'with_session': with_session,
            'recent': recent
        }

print("🔍 California Processing Monitor")
print("=" * 60)

# Initial check
initial = check_progress()
print(f"Starting status:")
print(f"  Total: {initial['total']} bills")
print(f"  With AI: {initial['with_ai']} ({initial['with_ai']/initial['total']*100:.1f}%)")
print(f"  With dates: {initial['with_dates']} ({initial['with_dates']/initial['total']*100:.1f}%)")
print(f"  With categories: {initial['with_category']} ({initial['with_category']/initial['total']*100:.1f}%)")
print(f"  With sessions: {initial['with_session']} ({initial['with_session']/initial['total']*100:.1f}%)")

print("\nMonitoring progress (updates every 30 seconds)...")
print("-" * 60)

# Monitor progress
last_ai_count = initial['with_ai']
iterations = 0

while True:
    time.sleep(30)
    iterations += 1
    
    current = check_progress()
    
    # Calculate progress
    new_ai = current['with_ai'] - last_ai_count
    remaining = current['total'] - current['with_ai']
    
    print(f"\n[{time.strftime('%H:%M:%S')}] Update #{iterations}")
    print(f"  AI summaries: {current['with_ai']}/{current['total']} ({current['with_ai']/current['total']*100:.1f}%)")
    print(f"  New this period: +{new_ai}")
    print(f"  Remaining: {remaining}")
    
    if new_ai > 0:
        rate = new_ai / 0.5  # per minute (30 sec = 0.5 min)
        eta_minutes = remaining / rate if rate > 0 else 0
        print(f"  Rate: {rate:.1f} bills/min")
        print(f"  ETA: {eta_minutes:.1f} minutes ({eta_minutes/60:.1f} hours)")
    
    # Show recent bills
    if current['recent']:
        print(f"  Recent bills:")
        for bill_num, category, updated in current['recent'][:3]:
            print(f"    - {bill_num} ({category}) at {str(updated)[:19]}")
    
    last_ai_count = current['with_ai']
    
    # Check if complete
    if remaining == 0:
        print("\n🎉 California processing complete!")
        break
    
    print("-" * 60)