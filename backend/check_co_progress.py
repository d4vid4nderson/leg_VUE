#!/usr/bin/env python3
"""Check Colorado AI processing progress"""

from database_config import get_db_connection

try:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Count processed bills
        cursor.execute("""
            SELECT COUNT(*) 
            FROM dbo.state_legislation 
            WHERE state = 'CO' 
            AND ai_executive_summary IS NOT NULL 
            AND ai_executive_summary != ''
        """)
        processed = cursor.fetchone()[0]
        
        # Count total bills
        cursor.execute("SELECT COUNT(*) FROM dbo.state_legislation WHERE state = 'CO'")
        total = cursor.fetchone()[0]
        
        print(f"Colorado AI Progress: {processed}/{total} bills processed ({processed/total*100:.1f}%)")
        
        # Show recent processed bills
        cursor.execute("""
            SELECT TOP 5 bill_number, last_updated
            FROM dbo.state_legislation 
            WHERE state = 'CO' 
            AND ai_executive_summary IS NOT NULL 
            AND ai_executive_summary != ''
            ORDER BY last_updated DESC
        """)
        
        print("\nRecently processed bills:")
        for bill_number, last_updated in cursor.fetchall():
            print(f"  {bill_number} - {last_updated}")
            
except Exception as e:
    print(f"Error: {e}")