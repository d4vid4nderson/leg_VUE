#!/usr/bin/env python3
"""Check Kentucky bills status"""

from database_config import get_db_connection

with get_db_connection() as conn:
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN ai_executive_summary IS NOT NULL AND ai_executive_summary != '' THEN 1 ELSE 0 END) as with_ai,
            SUM(CASE WHEN introduced_date IS NULL OR introduced_date = '' THEN 1 ELSE 0 END) as missing_dates,
            SUM(CASE WHEN category = 'not-applicable' OR category IS NULL THEN 1 ELSE 0 END) as no_category,
            SUM(CASE WHEN session_name IS NULL OR session_name = '' THEN 1 ELSE 0 END) as no_session
        FROM dbo.state_legislation
        WHERE state = 'KY'
    """)
    
    total, with_ai, missing_dates, no_category, no_session = cursor.fetchone()
    
    print('📊 Kentucky Bills Status:')
    print(f'Total bills: {total}')
    print(f'With AI summaries: {with_ai} ({with_ai/total*100:.1f}%)')
    print(f'Missing dates: {missing_dates} ({missing_dates/total*100:.1f}%)')
    print(f'Without category: {no_category} ({no_category/total*100:.1f}%)')
    print(f'Without session: {no_session} ({no_session/total*100:.1f}%)')
    print(f'\nNeed AI processing: {total - with_ai} bills')