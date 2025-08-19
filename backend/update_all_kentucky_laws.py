#!/usr/bin/env python3
"""
Update ALL Kentucky bill status for bills that became law
"""

import sys
import time
import requests
import os
from database_config import get_db_connection

LEGISCAN_API_KEY = os.getenv('LEGISCAN_API_KEY')
LEGISCAN_BASE_URL = "https://api.legiscan.com/?key={0}&op=getBill&id={1}"

def get_bill_details(bill_id):
    """Fetch detailed bill info from LegiScan API"""
    try:
        url = LEGISCAN_BASE_URL.format(LEGISCAN_API_KEY, bill_id)
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if data.get('status') == 'OK':
            return data.get('bill', {})
        return None
    except Exception as e:
        print(f"Error fetching bill {bill_id}: {e}")
        return None

def check_if_became_law(bill_data):
    """Check if bill became law based on history"""
    if not bill_data:
        return False, None
        
    # Check history for law-related actions
    history = bill_data.get('history', [])
    for action in history:
        action_text = action.get('action', '').lower()
        if any(phrase in action_text for phrase in [
            'became law',
            'signed by governor',
            'approved by governor',
            'enacted',
            'acts ch',
            'without governor'
        ]):
            return True, action.get('date')
    
    # Check status code
    status = bill_data.get('status')
    if status in [8, 9, '8', '9']:  # Signed or Effective
        return True, bill_data.get('status_date')
        
    return False, None

def update_all_kentucky_laws():
    """Update status for ALL Kentucky bills that became law"""
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Get all Kentucky bills with status 4 (Passed) that we haven't checked yet
        cursor.execute('''
            SELECT bill_id, bill_number, status
            FROM dbo.state_legislation
            WHERE state = 'KY'
            AND status = '4'
            AND bill_id IS NOT NULL
            ORDER BY last_action_date DESC
        ''')
        
        passed_bills = cursor.fetchall()
        print(f"Found {len(passed_bills)} passed Kentucky bills to check")
        print("Starting from where we left off...\n")
        
        updated_count = 0
        checked_count = 0
        error_count = 0
        
        for bill_id, bill_number, current_status in passed_bills:
            checked_count += 1
            
            # Progress indicator
            if checked_count % 10 == 0:
                print(f"\nProgress: {checked_count}/{len(passed_bills)} checked, {updated_count} updated to law status")
            
            print(f"Checking {bill_number} ({checked_count}/{len(passed_bills)})...", end='')
            
            # Get detailed bill info from LegiScan
            bill_data = get_bill_details(bill_id)
            
            if bill_data:
                is_law, law_date = check_if_became_law(bill_data)
                
                if is_law:
                    print(f" ✅ LAW!")
                    
                    # Update status to 9 (Effective)
                    cursor.execute('''
                        UPDATE dbo.state_legislation
                        SET status = '9',
                            legiscan_status = 'Effective/Law'
                        WHERE bill_id = ?
                    ''', (bill_id,))
                    
                    updated_count += 1
                else:
                    print(f" ⏳ Passed")
            else:
                print(f" ❌ Error")
                error_count += 1
                if error_count > 10:
                    print("\nToo many errors, stopping...")
                    break
            
            # Rate limiting - be gentle with the API
            time.sleep(0.3)
        
        conn.commit()
        
        print(f"\n" + "=" * 60)
        print(f"FINAL RESULTS:")
        print(f"  Total bills checked: {checked_count}")
        print(f"  Updated to Law status: {updated_count}")
        print(f"  Still Passed (not law): {checked_count - updated_count - error_count}")
        print(f"  Errors: {error_count}")
        
        # Show final distribution
        cursor.execute('''
            SELECT 
                status,
                COUNT(*) as count
            FROM dbo.state_legislation
            WHERE state = 'KY'
            AND status IN ('4', '9')
            GROUP BY status
        ''')
        
        print(f"\nUpdated Status Distribution:")
        for status, count in cursor.fetchall():
            if status == '4':
                print(f"  Status 4 (Passed): {count} bills")
            elif status == '9':
                print(f"  Status 9 (Law): {count} bills ✅")

if __name__ == "__main__":
    update_all_kentucky_laws()
