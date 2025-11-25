#!/usr/bin/env python3
"""Fix missing introduced_date fields from LegiScan JSON data"""

import json
import os
import glob
from datetime import datetime
from database_config import get_db_connection

def extract_dates_from_json(json_path):
    """Extract introduced date from LegiScan JSON"""
    try:
        with open(json_path, 'r') as f:
            data = json.load(f)
            bill = data.get('bill', data)
            
            # Get introduced date from history
            introduced_date = None
            history = bill.get('history', [])
            if history and len(history) > 0:
                # First history entry is usually the introduction
                introduced_date = history[0].get('date', '')
            
            # Fallback to status_date if no history
            if not introduced_date:
                introduced_date = bill.get('status_date', '')
            
            # Get last action date
            last_action_date = bill.get('status_date', '')
            
            return {
                'bill_id': str(bill.get('bill_id', '')),
                'bill_number': bill.get('bill_number', ''),
                'introduced_date': introduced_date,
                'last_action_date': last_action_date
            }
    except Exception as e:
        print(f"Error reading {json_path}: {e}")
        return None

def fix_colorado_dates():
    """Fix missing dates for Colorado bills"""
    print("🔄 Fixing missing dates for Colorado bills...")
    
    # Find all Colorado bill JSON files
    co_bills = glob.glob('/app/data/CO/2025-2025_Regular_Session/bill/*.json')
    print(f"📁 Found {len(co_bills)} Colorado bill JSON files")
    
    if not co_bills:
        print("❌ No Colorado bill files found")
        return
    
    updated_count = 0
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Get bills with missing dates
        cursor.execute("""
            SELECT bill_id, bill_number, introduced_date
            FROM dbo.state_legislation
            WHERE state = 'CO'
            AND (introduced_date IS NULL OR introduced_date = '')
        """)
        
        missing_dates = {row[0]: row[1] for row in cursor.fetchall()}
        print(f"🔍 Found {len(missing_dates)} bills missing introduced_date")
        
        # Process each JSON file
        for json_path in co_bills:
            bill_data = extract_dates_from_json(json_path)
            if not bill_data:
                continue
            
            bill_id = bill_data['bill_id']
            
            # Check if this bill needs updating
            if bill_id in missing_dates:
                if bill_data['introduced_date']:
                    cursor.execute("""
                        UPDATE dbo.state_legislation
                        SET introduced_date = ?
                        WHERE bill_id = ? AND state = 'CO'
                    """, (bill_data['introduced_date'], bill_id))
                    
                    if cursor.rowcount > 0:
                        updated_count += 1
                        if updated_count % 50 == 0:
                            print(f"   Updated {updated_count} bills...")
        
        conn.commit()
        print(f"✅ Updated {updated_count} bills with introduced dates")
        
        # Verify results
        cursor.execute("""
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN introduced_date IS NULL OR introduced_date = '' THEN 1 ELSE 0 END) as missing
            FROM dbo.state_legislation
            WHERE state = 'CO'
        """)
        
        total, missing = cursor.fetchone()
        print(f"\n📊 Final status:")
        print(f"   Total CO bills: {total}")
        print(f"   Still missing dates: {missing}")
        print(f"   Fixed: {total - missing} ({(total - missing)/total*100:.1f}%)")

if __name__ == "__main__":
    fix_colorado_dates()