#!/usr/bin/env python3
"""
Fix Colorado bills in smaller batches
"""

import time
import requests
import os
from database_config import get_db_connection

LEGISCAN_API_KEY = os.getenv('LEGISCAN_API_KEY')
LEGISCAN_BASE_URL = "https://api.legiscan.com/?key={0}&op=getBill&id={1}"

def get_bill_details(bill_id):
    try:
        url = LEGISCAN_BASE_URL.format(LEGISCAN_API_KEY, bill_id)
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if data.get('status') == 'OK':
            return data.get('bill', {})
        return None
    except Exception:
        return None

def check_colorado_bill_status(bill_data):
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
        if 'vetoed' in action_text or 'veto' in action_text:
            return True, action.get('date'), 'Vetoed'
    
    # Check status code
    status = bill_data.get('status')
    if status in [8, 9, '8', '9']:
        return True, bill_data.get('status_date'), 'Enacted'
    elif status in [5, '5']:
        return True, bill_data.get('status_date'), 'Vetoed'
        
    return False, None, None

def process_batch(batch_size=100):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute(f'''
            SELECT TOP {batch_size} bill_id, bill_number, status
            FROM dbo.state_legislation
            WHERE state = 'CO'
            AND status = 'Passed'
            AND bill_id IS NOT NULL
            ORDER BY bill_number
        ''')
        
        bills = cursor.fetchall()
        
        if not bills:
            print('No more bills to process')
            return 0
            
        enacted_count = 0
        
        for i, (bill_id, bill_number, _) in enumerate(bills, 1):
            print(f'[{i:3d}/{len(bills)}] {bill_number:8s}', end='')
            
            bill_data = get_bill_details(bill_id)
            
            if bill_data:
                was_signed, sign_date, new_status = check_colorado_bill_status(bill_data)
                
                if was_signed and new_status == 'Enacted':
                    print(' ✅ ENACTED')
                    enacted_count += 1
                    
                    cursor.execute('''
                        UPDATE dbo.state_legislation
                        SET status = ?,
                            legiscan_status = 'Enacted by Governor'
                        WHERE bill_id = ?
                    ''', ('Enacted', bill_id))
                elif was_signed and new_status == 'Vetoed':
                    print(' ❌ VETOED')
                    cursor.execute('''
                        UPDATE dbo.state_legislation
                        SET status = ?,
                            legiscan_status = 'Vetoed by Governor'
                        WHERE bill_id = ?
                    ''', ('Vetoed', bill_id))
                else:
                    print(' ⏳ Still Passed')
            else:
                print(' ❌ Error')
            
            time.sleep(0.3)
        
        conn.commit()
        print(f'\nBatch complete: {enacted_count} bills updated to Enacted')
        return len(bills)

# Process in batches
total_processed = 0
batch_num = 1

while True:
    print(f'\nBATCH {batch_num}:')
    processed = process_batch(100)
    
    if processed == 0:
        break
        
    total_processed += processed
    batch_num += 1
    
    if batch_num > 6:  # Limit to 6 batches (600 bills)
        break

print(f'\nTotal processed: {total_processed} bills')
