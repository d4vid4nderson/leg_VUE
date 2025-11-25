#!/usr/bin/env python3
"""
Fix bill status for ALL states - check which passed bills became law
"""

import sys
import time
import requests
import os
import asyncio
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

def check_if_became_law(bill_data):
    """Check if bill became law based on history"""
    if not bill_data:
        return False, None, None
        
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
            'without governor',
            'chaptered'
        ]):
            return True, action.get('date'), 'Enacted'
    
    # Check for vetoed bills
    for action in history:
        action_text = action.get('action', '').lower()
        if any(phrase in action_text for phrase in [
            'vetoed',
            'veto'
        ]):
            return True, action.get('date'), 'Vetoed'
    
    # Check status code
    status = bill_data.get('status')
    if status in [8, 9, '8', '9']:  # Signed or Effective
        return True, bill_data.get('status_date'), 'Enacted'
    elif status in [5, '5']:  # Vetoed
        return True, bill_data.get('status_date'), 'Vetoed'
        
    return False, None, None

def process_state(state, max_bills=100):
    """Process passed bills for a specific state"""
    
    print(f"\n{'='*60}")
    print(f"PROCESSING {state} STATE")
    print(f"{'='*60}")
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Get passed bills for this state (limiting for testing)
        if state == 'TX':
            # Texas uses text status
            cursor.execute(f'''
                SELECT TOP {max_bills} bill_id, bill_number, status
                FROM dbo.state_legislation
                WHERE state = ?
                AND status = 'Passed'
                AND bill_id IS NOT NULL
                ORDER BY last_action_date DESC
            ''', (state,))
        else:
            # Other states use numeric codes
            cursor.execute(f'''
                SELECT TOP {max_bills} bill_id, bill_number, status
                FROM dbo.state_legislation
                WHERE state = ?
                AND status = '4'
                AND bill_id IS NOT NULL
                ORDER BY last_action_date DESC
            ''', (state,))
        
        passed_bills = cursor.fetchall()
        
        if not passed_bills:
            print(f"No passed bills found for {state}")
            return 0, 0, 0
        
        print(f"Found {len(passed_bills)} passed bills to check")
        
        enacted_count = 0
        vetoed_count = 0
        error_count = 0
        
        for i, (bill_id, bill_number, current_status) in enumerate(passed_bills, 1):
            print(f"[{i:3d}/{len(passed_bills)}] {bill_number:10s}", end='')
            
            # Get detailed bill info from LegiScan
            bill_data = get_bill_details(bill_id)
            
            if bill_data:
                became_law, law_date, new_status = check_if_became_law(bill_data)
                
                if became_law:
                    if new_status == 'Enacted':
                        print(f" ✅ LAW")
                        enacted_count += 1
                    else:  # Vetoed
                        print(f" ❌ VETOED")
                        vetoed_count += 1
                    
                    # Update database
                    cursor.execute('''
                        UPDATE dbo.state_legislation
                        SET status = ?,
                            legiscan_status = ?
                        WHERE bill_id = ?
                    ''', (new_status, new_status, bill_id))
                    
                else:
                    print(f" ⏳ Still Passed")
            else:
                print(f" ❌ Error")
                error_count += 1
                if error_count > 20:  # Stop if too many errors
                    print(f"\n⚠️  Too many errors for {state}, stopping...")
                    break
            
            # Rate limiting
            time.sleep(0.4)
        
        conn.commit()
        return enacted_count, vetoed_count, error_count

def main():
    """Process all states"""
    states_to_process = [
        ('CO', 100),   # Colorado - moderate number
        ('CA', 150),   # California - larger sample
        ('TX', 200),   # Texas - largest sample (but text status)
        ('NV', 100),   # Nevada - moderate
        ('SC', 100),   # South Carolina - moderate
    ]
    
    total_enacted = 0
    total_vetoed = 0
    
    start_time = time.time()
    
    for state, max_bills in states_to_process:
        try:
            enacted, vetoed, errors = process_state(state, max_bills)
            total_enacted += enacted
            total_vetoed += vetoed
            
            print(f"\n{state} RESULTS:")
            print(f"  ✅ Enacted: {enacted}")
            print(f"  ❌ Vetoed: {vetoed}") 
            print(f"  ⚠️  Errors: {errors}")
            
        except Exception as e:
            print(f"\n❌ Error processing {state}: {e}")
            continue
    
    elapsed = time.time() - start_time
    
    print(f"\n{'='*60}")
    print(f"FINAL SUMMARY:")
    print(f"{'='*60}")
    print(f"Total bills updated to Enacted: {total_enacted}")
    print(f"Total bills updated to Vetoed: {total_vetoed}") 
    print(f"Time elapsed: {elapsed/60:.1f} minutes")
    print(f"\nNext step: Update all states to use text status values instead of numeric codes")

if __name__ == "__main__":
    main()
