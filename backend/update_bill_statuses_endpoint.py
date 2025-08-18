#!/usr/bin/env python3
"""
API endpoint to update bill statuses from LegiScan API
"""

import requests
import os
from datetime import datetime
from database_config import get_db_connection

def get_legiscan_status_mapping():
    """Map LegiScan status codes to readable status"""
    return {
        0: 'Pending',
        1: 'Introduced',
        2: 'Engrossed', 
        3: 'Enrolled',
        4: 'Passed',
        5: 'Vetoed',
        6: 'Failed',
        7: 'Veto Override',
        8: 'Enacted',
        9: 'Committee Referral',
        10: 'Committee Report Pass',
        11: 'Committee Report DNP'
    }

def update_session_statuses(session_id, session_name, limit=None):
    """Update bill statuses for a specific session"""
    
    LEGISCAN_API_KEY = os.getenv('LEGISCAN_API_KEY')
    if not LEGISCAN_API_KEY:
        print(f"❌ No LegiScan API key found for {session_name}")
        return {"error": "No API key"}
    
    api_url = 'https://api.legiscan.com/'
    status_mapping = get_legiscan_status_mapping()
    
    print(f"🔄 Updating statuses for {session_name}...")
    
    # Get master list
    master_params = {
        'key': LEGISCAN_API_KEY,
        'op': 'getMasterList',
        'state': 'TX',
        'id': session_id
    }
    
    try:
        response = requests.get(api_url, params=master_params, timeout=30)
        if response.status_code != 200:
            return {"error": f"API request failed: {response.status_code}"}
        
        data = response.json()
        masterlist = data.get('masterlist', {})
        
        # Extract bill data from API
        api_bills = {}
        for key, value in masterlist.items():
            if key != 'session' and isinstance(value, dict):
                bill_number = value.get('number')
                if bill_number:
                    status_code = value.get('status', 1)
                    status_text = status_mapping.get(status_code, 'Introduced')
                    api_bills[bill_number] = {
                        'status': status_text,
                        'last_action': value.get('last_action', ''),
                        'last_action_date': value.get('last_action_date', '')
                    }
        
        print(f"📊 API has {len(api_bills)} bills for {session_name}")
        
        # Update database
        updated_count = 0
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Get bills to update (limit if specified)
            query = """
                SELECT bill_number, status FROM dbo.state_legislation 
                WHERE state = 'TX' AND session_name = ?
            """
            if limit:
                query += f" ORDER BY bill_number OFFSET 0 ROWS FETCH NEXT {limit} ROWS ONLY"
            
            cursor.execute(query, (session_name,))
            db_bills = cursor.fetchall()
            
            for bill_number, current_status in db_bills:
                if bill_number in api_bills:
                    api_status = api_bills[bill_number]['status']
                    api_last_action = api_bills[bill_number]['last_action']
                    api_last_action_date = api_bills[bill_number]['last_action_date']
                    
                    # Update if status is different or missing action data
                    if (current_status != api_status or 
                        not cursor.execute("SELECT last_action_date FROM dbo.state_legislation WHERE state = 'TX' AND session_name = ? AND bill_number = ?", 
                                         (session_name, bill_number)).fetchone()[0]):
                        
                        cursor.execute("""
                            UPDATE dbo.state_legislation 
                            SET status = ?, 
                                last_action_date = ?,
                                last_updated = ?
                            WHERE state = 'TX' AND session_name = ? AND bill_number = ?
                        """, (
                            api_status,
                            api_last_action_date if api_last_action_date else None,
                            datetime.now(),
                            session_name,
                            bill_number
                        ))
                        
                        updated_count += 1
        
        print(f"✅ Updated {updated_count} bills for {session_name}")
        return {
            "session_name": session_name,
            "total_bills": len(api_bills),
            "updated_count": updated_count,
            "success": True
        }
        
    except Exception as e:
        print(f"❌ Error updating {session_name}: {e}")
        return {"error": str(e), "session_name": session_name}

def update_all_texas_statuses(quick_mode=True):
    """Update bill statuses for all Texas sessions"""
    
    sessions = [
        ('2160', '89th Legislature Regular Session'),
        ('2221', '89th Legislature 1st Special Session'),
        ('2223', '89th Legislature 2nd Special Session')
    ]
    
    print("🔄 UPDATING ALL TEXAS BILL STATUSES")
    print("=" * 50)
    
    results = []
    limit = 100 if quick_mode else None  # Limit updates in quick mode
    
    for session_id, session_name in sessions:
        result = update_session_statuses(session_id, session_name, limit)
        results.append(result)
    
    # Summary
    total_updated = sum(r.get('updated_count', 0) for r in results if r.get('success'))
    total_bills = sum(r.get('total_bills', 0) for r in results if r.get('success'))
    
    print(f"\n📊 SUMMARY:")
    print(f"  Total bills checked: {total_bills:,}")
    print(f"  Total bills updated: {total_updated:,}")
    
    return {
        "success": True,
        "total_updated": total_updated,
        "total_bills": total_bills,
        "sessions": results,
        "quick_mode": quick_mode
    }

if __name__ == "__main__":
    # For testing
    result = update_all_texas_statuses(quick_mode=True)
    print(f"\nResult: {result}")