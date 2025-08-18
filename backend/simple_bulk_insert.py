#!/usr/bin/env python3
"""
Simple bulk insert for 2nd Special Session bills
Using direct SQL Server connection to avoid wrapper issues
"""

import pyodbc
import requests
import os
from datetime import datetime

def get_simple_connection():
    """Get a simple pyodbc connection"""
    connection_string = os.getenv('DATABASE_CONNECTION_STRING')
    if connection_string:
        return pyodbc.connect(connection_string)
    else:
        # Fallback to individual components
        server = os.getenv('DATABASE_SERVER')
        database = os.getenv('DATABASE_NAME')
        username = os.getenv('DATABASE_USERNAME')
        password = os.getenv('DATABASE_PASSWORD')
        
        connection_string = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE={database};UID={username};PWD={password}'
        return pyodbc.connect(connection_string)

def simple_bulk_insert():
    """Simple bulk insert of missing 2nd Special Session bills"""
    
    LEGISCAN_API_KEY = os.getenv('LEGISCAN_API_KEY')
    if not LEGISCAN_API_KEY:
        print("❌ No LegiScan API key found")
        return
        
    api_url = 'https://api.legiscan.com/'
    
    # Get master list for 2nd Special Session
    master_params = {
        'key': LEGISCAN_API_KEY,
        'op': 'getMasterList',
        'state': 'TX',
        'id': '2223'
    }
    
    print("🔍 Fetching 2nd Special Session bills...")
    response = requests.get(api_url, params=master_params)
    if response.status_code != 200:
        print(f"❌ Failed to get master list: {response.status_code}")
        return
        
    data = response.json()
    masterlist = data.get('masterlist', {})
    
    # Extract bills from dictionary
    bills = []
    for key, value in masterlist.items():
        if key != 'session' and isinstance(value, dict):
            bills.append(value)
    
    print(f"✅ Found {len(bills)} bills from API")
    
    # Connect to database directly
    try:
        conn = get_simple_connection()
        cursor = conn.cursor()
        
        # Check existing bills
        cursor.execute('''
            SELECT bill_number FROM dbo.state_legislation 
            WHERE state = 'TX' AND session_name = '89th Legislature 2nd Special Session'
        ''')
        existing_bills = {row[0] for row in cursor.fetchall()}
        print(f"📊 Database has {len(existing_bills)} existing bills")
        
        # Filter new bills
        new_bills = []
        for bill in bills:
            bill_number = bill.get('number')
            if bill_number and bill_number not in existing_bills:
                new_bills.append(bill)
        
        print(f"🎯 Need to import: {len(new_bills)} new bills")
        
        if len(new_bills) == 0:
            print("✅ No new bills to import")
            return
        
        # Prepare bulk insert
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        # Insert bills one by one to avoid bulk insert complications
        imported_count = 0
        for bill in new_bills:
            try:
                bill_number = bill.get('number', '')
                bill_id = str(bill.get('bill_id', ''))
                title = (bill.get('title', '') or '')[:1999]
                description = (bill.get('description', '') or '')[:3999]
                status = (bill.get('status', '') or 'Unknown')[:499]
                
                cursor.execute('''
                    INSERT INTO dbo.state_legislation (
                        bill_id, bill_number, title, description, state, 
                        status, session_id, session_name, 
                        created_at, last_updated, reviewed
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', 
                    bill_id,
                    bill_number,
                    title,
                    description,
                    'TX',
                    status,
                    '2223',
                    '89th Legislature 2nd Special Session',
                    current_time,
                    current_time,
                    0
                )
                
                imported_count += 1
                if imported_count % 25 == 0:
                    print(f"  ✅ Imported {imported_count}/{len(new_bills)} bills...")
                    
            except Exception as e:
                print(f"  ❌ Error importing {bill_number}: {e}")
        
        # Commit all changes
        conn.commit()
        print(f"🎉 Successfully imported {imported_count} bills!")
        
        # Verify final count
        cursor.execute('''
            SELECT COUNT(*) FROM dbo.state_legislation 
            WHERE state = 'TX' AND session_name = '89th Legislature 2nd Special Session'
        ''')
        final_count = cursor.fetchone()[0]
        print(f"📊 Final count for 2nd Special Session: {final_count} bills")
        
    except Exception as e:
        print(f"❌ Database error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    simple_bulk_insert()