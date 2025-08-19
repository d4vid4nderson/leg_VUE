#!/usr/bin/env python3
"""
Fix Colorado bill status - check which passed bills were signed by governor
"""

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
        print(f"  ❌ API Error: {e}")
        return None

def check_colorado_bill_status(bill_data):
    """Check if Colorado bill was signed by governor"""
    if not bill_data:
        return False, None, None
        
    # Check history for governor signing
    history = bill_data.get('history', [])
    for action in history:
        action_text = action.get('action', '').lower()
        if any(phrase in action_text for phrase in [
            'signed by governor',
            'signed by the governor',
            'governor signed',
            'became law',
            'enacted',
            'chaptered'
        ]):
            return True, action.get('date'), 'Enacted'
    
    # Check for vetoed bills
    for action in history:
        action_text = action.get('action', '').lower()
        if any(phrase in action_text for phrase in [
            'vetoed',
            'veto',
            'governor vetoed'
        ]):
            return True, action.get('date'), 'Vetoed'
    
    # Check status code
    status = bill_data.get('status')
    if status in [8, 9, '8', '9']:  # Signed or Effective
        return True, bill_data.get('status_date'), 'Enacted'
    elif status in [5, '5']:  # Vetoed
        return True, bill_data.get('status_date'), 'Vetoed'
        
    return False, None, None

def main():
    """Fix Colorado bill statuses"""
    
    print('FIXING COLORADO BILL STATUSES')
    print('=' * 50)
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Get Colorado passed bills
        cursor.execute('''
            SELECT bill_id, bill_number, status
            FROM dbo.state_legislation
            WHERE state = 'CO'
            AND status = 'Passed'
            AND bill_id IS NOT NULL
            ORDER BY bill_number
        ''')
        
        passed_bills = cursor.fetchall()
        print(f'Found {len(passed_bills)} Colorado "Passed" bills to check\n')
        
        enacted_count = 0
        vetoed_count = 0
        error_count = 0
        
        for i, (bill_id, bill_number, current_status) in enumerate(passed_bills, 1):
            print(f'[{i:3d}/{len(passed_bills)}] {bill_number:8s}', end='')
            
            # Get detailed bill info from LegiScan
            bill_data = get_bill_details(bill_id)
            
            if bill_data:
                was_signed, sign_date, new_status = check_colorado_bill_status(bill_data)
                
                if was_signed:
                    if new_status == 'Enacted':
                        print(f' ✅ SIGNED BY GOVERNOR')
                        enacted_count += 1
                    else:  # Vetoed
                        print(f' ❌ VETOED BY GOVERNOR')
                        vetoed_count += 1
                    
                    # Update database
                    cursor.execute('''
                        UPDATE dbo.state_legislation
                        SET status = ?,
                            legiscan_status = ?
                        WHERE bill_id = ?
                    ''', (new_status, f'{new_status} by Governor', bill_id))
                    
                else:
                    print(f' ⏳ Still Passed (no governor action yet)')
            else:
                print(f' ❌ Error fetching data')
                error_count += 1
                if error_count > 10:
                    print('\nToo many errors, stopping...')
                    break
            
            # Rate limiting
            time.sleep(0.4)
        
        conn.commit()
        
        print(f'\n' + '=' * 50)
        print(f'COLORADO RESULTS:')
        print(f'  ✅ Updated to Enacted: {enacted_count}')
        print(f'  ❌ Updated to Vetoed: {vetoed_count}')
        print(f'  ⚠️  Errors: {error_count}')
        
        # Show updated distribution
        cursor.execute('''
            SELECT 
                status,
                COUNT(*) as count
            FROM dbo.state_legislation
            WHERE state = 'CO'
            GROUP BY status
            ORDER BY count DESC
        ''')
        
        print(f'\nUpdated Colorado Status Distribution:')
        for status, count in cursor.fetchall():
            indicator = ' ✅' if status == 'Enacted' else ' ❌' if status in ['Vetoed', 'Failed'] else ''
            print(f'  {status}: {count:,} bills{indicator}')

if __name__ == "__main__":
    main()
