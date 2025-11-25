#!/usr/bin/env python3
"""Use last_action_date as fallback for missing introduced_date"""

from database_config import get_db_connection

with get_db_connection() as conn:
    cursor = conn.cursor()
    
    # Use last_action_date as fallback
    cursor.execute("""
        UPDATE dbo.state_legislation
        SET introduced_date = last_action_date
        WHERE state = 'CO'
        AND (introduced_date IS NULL OR introduced_date = '')
        AND last_action_date IS NOT NULL
        AND last_action_date != ''
    """)
    
    updated = cursor.rowcount
    conn.commit()
    print(f'✅ Updated {updated} bills using last_action_date as fallback')
    
    # Final status
    cursor.execute("""
        SELECT COUNT(*) as total,
               SUM(CASE WHEN introduced_date IS NULL OR introduced_date = '' THEN 1 ELSE 0 END) as missing
        FROM dbo.state_legislation
        WHERE state = 'CO'
    """)
    
    total, missing = cursor.fetchone()
    print(f'\n📊 Colorado date status:')
    print(f'   Total bills: {total}')
    print(f'   With dates: {total - missing} ({(total - missing)/total*100:.1f}%)')
    print(f'   Still missing: {missing}')