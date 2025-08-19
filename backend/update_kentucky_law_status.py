#!/usr/bin/env python3
"""
Update Kentucky bill status for bills that became law
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
        response = requests.get(url)
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

def update_kentucky_laws():
    """Update status for Kentucky bills that became law"""
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Get all Kentucky bills with status 4 (Passed)
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
        
        updated_count = 0
        checked_count = 0
        
        for bill_id, bill_number, current_status in passed_bills:
            if checked_count >= 50:  # Limit to 50 for testing
                break
                
            print(f"\nChecking {bill_number} (ID: {bill_id})...", end='')
            
            # Get detailed bill info from LegiScan
            bill_data = get_bill_details(bill_id)
            
            if bill_data:
                is_law, law_date = check_if_became_law(bill_data)
                
                if is_law:
                    print(f" ✅ BECAME LAW!")
                    
                    # Update status to 9 (Effective)
                    cursor.execute('''
                        UPDATE dbo.state_legislation
                        SET status = '9',
                            legiscan_status = 'Effective/Law'
                        WHERE bill_id = ?
                    ''', (bill_id,))
                    
                    updated_count += 1
                else:
                    print(f" Still passed, not yet law")
            else:
                print(f" ❌ Could not fetch details")
            
            checked_count += 1
            time.sleep(0.5)  # Rate limiting
        
        conn.commit()
        print(f"\n" + "=" * 50)
        print(f"Checked {checked_count} bills")
        print(f"Updated {updated_count} bills to Law status")

if __name__ == "__main__":
    update_kentucky_laws()
