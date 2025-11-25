#!/usr/bin/env python3
"""Monitor AI processing rate"""

import time
from database_config import get_db_connection

def get_processed_count():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT COUNT(*) FROM dbo.state_legislation 
            WHERE state = 'CO' AND ai_executive_summary IS NOT NULL AND ai_executive_summary != ''
        """)
        return cursor.fetchone()[0]

# Initial count
initial = get_processed_count()
print(f"Initial count: {initial} bills processed")
print("Monitoring rate for 60 seconds...")

time.sleep(60)

# Check after 1 minute
after = get_processed_count()
rate = after - initial
print(f"After 1 minute: {after} bills processed")
print(f"Rate: {rate} bills per minute")

if rate > 0:
    remaining = 833 - after
    eta_minutes = remaining / rate
    print(f"Remaining: {remaining} bills")
    print(f"ETA: {eta_minutes:.1f} minutes ({eta_minutes/60:.1f} hours)")
else:
    print("No progress detected - process may have stopped")