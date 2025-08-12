#!/usr/bin/env python3
"""
Update Bill Status Only
Lightweight script to check and update bill status changes
Much faster than full fetch - only updates what changed
"""

import requests
import json
from datetime import datetime
from database_config import get_db_connection
import os

# LegiScan API configuration
LEGISCAN_API_KEY = os.getenv('LEGISCAN_API_KEY')
LEGISCAN_BASE_URL = "https://api.legiscan.com/?key=" + LEGISCAN_API_KEY if LEGISCAN_API_KEY else None

def get_bill_status_from_api(bill_id):
    """Get current status of a bill from LegiScan API"""
    if not LEGISCAN_API_KEY:
        print("⚠️ LEGISCAN_API_KEY not set")
        return None
    
    try:
        url = f"{LEGISCAN_BASE_URL}&op=getBill&id={bill_id}"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'OK' and data.get('bill'):
                bill = data['bill']
                return {
                    'status': bill.get('status', 'Unknown'),
                    'last_action_date': bill.get('last_action_date', ''),
                    'last_action': bill.get('last_action', ''),
                    'progress': bill.get('progress', {})
                }
    except Exception as e:
        print(f"   ⚠️ API error for bill {bill_id}: {e}")
    
    return None

def update_bill_statuses(state=None, limit=100):
    """Update bill statuses for recent bills"""
    print(f"🔄 Checking bill status updates...")
    
    updated_count = 0
    checked_count = 0
    
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Get bills to check (prioritize recent activity)
            query = """
                SELECT TOP (?) bill_id, bill_number, status, last_action_date 
                FROM dbo.state_legislation 
                WHERE 1=1
            """
            params = [limit]
            
            if state:
                query += " AND (state = ? OR state_abbr = ?)"
                params.extend([state, state])
            
            query += " ORDER BY last_updated DESC, last_action_date DESC"
            
            cursor.execute(query, params)
            bills_to_check = cursor.fetchall()
            
            print(f"   Checking {len(bills_to_check)} bills for status updates...")
            
            for bill_id, bill_number, current_status, last_action_date in bills_to_check:
                checked_count += 1
                
                # Get current status from API
                api_data = get_bill_status_from_api(bill_id)
                
                if api_data:
                    new_status = api_data['status']
                    new_action_date = api_data['last_action_date']
                    
                    # Check if status changed
                    if new_status != current_status or new_action_date != last_action_date:
                        # Update in database
                        update_query = """
                            UPDATE dbo.state_legislation 
                            SET status = ?, 
                                last_action_date = ?,
                                last_updated = ?
                            WHERE bill_id = ?
                        """
                        
                        cursor.execute(update_query, (
                            new_status,
                            new_action_date,
                            datetime.now(),
                            bill_id
                        ))
                        
                        updated_count += 1
                        print(f"   ✅ Updated {bill_number}: {current_status} → {new_status}")
                
                # Progress indicator
                if checked_count % 10 == 0:
                    print(f"   Progress: {checked_count}/{len(bills_to_check)} checked, {updated_count} updated")
            
            conn.commit()
            
    except Exception as e:
        print(f"❌ Error updating statuses: {e}")
        import traceback
        traceback.print_exc()
    
    return {
        'checked': checked_count,
        'updated': updated_count
    }

def quick_status_check():
    """Quick status check using local API endpoint"""
    print("🚀 Quick status update using local API")
    
    states = ['TX', 'CA', 'CO', 'FL', 'KY', 'NV', 'SC']
    total_updated = 0
    
    for state in states:
        print(f"\n📍 Checking {state}...")
        
        try:
            # Use the existing check-and-update endpoint
            response = requests.post(
                "http://localhost:8000/api/legiscan/check-and-update",
                json={"state": state},
                timeout=60
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"   ✅ {state}: {data.get('message', 'Updated')}")
                total_updated += data.get('bills_processed', 0)
            else:
                print(f"   ❌ {state}: API error {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ {state}: {e}")
    
    print(f"\n📊 Total bills updated: {total_updated}")

def main():
    """Main update process"""
    print("🔄 Bill Status Update Tool")
    print("=" * 60)
    
    # Check if backend is running
    try:
        response = requests.get("http://localhost:8000/api/status", timeout=5)
        backend_running = response.status_code == 200
    except:
        backend_running = False
    
    if backend_running:
        print("✅ Backend is running - using API endpoints")
        quick_status_check()
    else:
        print("⚠️ Backend not running - using direct database updates")
        
        # Update status for all states
        states = ['TX', 'CA', 'CO', 'FL', 'KY', 'NV', 'SC']
        
        for state in states:
            print(f"\n📍 Updating {state}...")
            result = update_bill_statuses(state, limit=50)
            print(f"   Checked: {result['checked']}, Updated: {result['updated']}")
    
    print("\n" + "=" * 60)
    print("✅ Status update complete!")

if __name__ == "__main__":
    main()