#!/usr/bin/env python3
"""Sync ai_executive_summary to ai_summary field for frontend compatibility"""

from database_config import get_db_connection

def sync_ai_summaries():
    """Copy ai_executive_summary to ai_summary field"""
    print("🔄 Syncing AI summaries for frontend...")
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Update ai_summary field with ai_executive_summary for all bills
        cursor.execute("""
            UPDATE dbo.state_legislation
            SET ai_summary = ai_executive_summary
            WHERE ai_executive_summary IS NOT NULL
            AND ai_executive_summary != ''
            AND (ai_summary IS NULL OR ai_summary = '')
        """)
        
        affected = cursor.rowcount
        conn.commit()
        print(f"✅ Updated {affected} bills with AI summaries")
        
        # Check counts by state
        cursor.execute("""
            SELECT state, 
                   COUNT(*) as total,
                   SUM(CASE WHEN ai_summary IS NOT NULL AND ai_summary != '' THEN 1 ELSE 0 END) as with_summary,
                   SUM(CASE WHEN ai_executive_summary IS NOT NULL AND ai_executive_summary != '' THEN 1 ELSE 0 END) as with_exec_summary
            FROM dbo.state_legislation
            GROUP BY state
            ORDER BY state
        """)
        
        print("\n📊 AI Summary Status by State:")
        print("State | Total | ai_summary | ai_executive_summary")
        print("-" * 50)
        for row in cursor.fetchall():
            state, total, with_summary, with_exec = row
            print(f"{state:5} | {total:5} | {with_summary:10} | {with_exec:20}")

if __name__ == "__main__":
    sync_ai_summaries()