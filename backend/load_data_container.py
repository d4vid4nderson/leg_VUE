#!/usr/bin/env python3
"""Load LegiScan data - Container version"""
import json
import os
from datetime import datetime
from database_config import get_db_connection
import glob

data_dir = '/app/data'  # Container path

def load_bill_from_json(filepath, state_abbr):
    try:
        with open(filepath, 'r') as f:
            data = json.load(f)
            bill = data.get('bill', data)
            return {
                'bill_id': str(bill.get('bill_id', '')),
                'bill_number': bill.get('bill_number', ''),
                'title': bill.get('title', ''),
                'description': bill.get('description', ''),
                'state': state_abbr,
                'state_abbr': state_abbr,
                'status': bill.get('status', 'Unknown'),
                'introduced_date': bill.get('introduced', ''),
                'last_action_date': bill.get('status_date', ''),
                'session_id': str(bill.get('session_id', '')),
                'bill_type': bill.get('type', ''),
                'body': bill.get('body', ''),
                'url': bill.get('url', ''),
                'texts': bill.get('texts', [])
            }
    except Exception as e:
        return None

print("Loading LegiScan data from container")
print("=" * 50)

total_inserted = 0
total_skipped = 0

# Process each state
for item in os.listdir(data_dir):
    state_dir = os.path.join(data_dir, item)
    if not os.path.isdir(state_dir):
        continue
    
    state_abbr = item.upper()
    if ' ' in state_abbr:
        state_abbr = state_abbr.split()[0]
    
    if state_abbr in ['LEGISLATION.DB', 'EXECUTIVE_ORDERS.DB']:
        continue
    
    print(f"\nProcessing {state_abbr}...")
    
    # Find bill files
    bill_files = glob.glob(os.path.join(state_dir, '*/bill/*.json'))
    
    if not bill_files:
        print(f"   No bills found")
        continue
    
    print(f"   Found {len(bill_files)} bill files")
    
    # Load bills
    bills = []
    for bill_file in bill_files:
        bill = load_bill_from_json(bill_file, state_abbr)
        if bill:
            bills.append(bill)
    
    print(f"   Loaded {len(bills)} bills")
    
    # Insert into database
    if bills:
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Check existing
                cursor.execute("""
                    SELECT bill_id FROM dbo.state_legislation 
                    WHERE state = ? OR state_abbr = ?
                """, (state_abbr, state_abbr))
                
                existing_ids = set(str(row[0]) for row in cursor.fetchall())
                print(f"   Existing in DB: {len(existing_ids)}")
                
                # Insert new bills
                inserted = 0
                skipped = 0
                
                insert_query = """
                    INSERT INTO dbo.state_legislation (
                        bill_id, bill_number, title, description,
                        state, state_abbr, status, category,
                        introduced_date, last_action_date,
                        session_id, session_name, bill_type, body,
                        legiscan_url, pdf_url, created_at, last_updated
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """
                
                for bill in bills:
                    if bill['bill_id'] in existing_ids:
                        skipped += 1
                        continue
                    
                    pdf_url = ''
                    if bill.get('texts'):
                        for text in bill['texts']:
                            if text.get('url'):
                                pdf_url = text.get('url', '')
                                break
                    
                    cursor.execute(insert_query, (
                        bill['bill_id'],
                        bill['bill_number'],
                        (bill['title'] or '')[:500],
                        (bill['description'] or '')[:2000],
                        state_abbr,
                        state_abbr,
                        bill['status'],
                        'not-applicable',
                        bill['introduced_date'],
                        bill['last_action_date'],
                        bill['session_id'],
                        '',
                        bill['bill_type'],
                        bill['body'],
                        bill.get('url', ''),
                        pdf_url,
                        datetime.now(),
                        datetime.now()
                    ))
                    
                    inserted += 1
                    
                    if inserted % 100 == 0:
                        conn.commit()
                        print(f"   Inserted {inserted} bills...")
                
                conn.commit()
                print(f"   Done: Inserted {inserted}, Skipped {skipped}")
                
                total_inserted += inserted
                total_skipped += skipped
                
        except Exception as e:
            print(f"   Database error: {e}")

print(f"\n" + "=" * 50)
print(f"Complete! Inserted {total_inserted}, Skipped {total_skipped}")

# Show final counts
try:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT state, COUNT(*) as count 
            FROM dbo.state_legislation 
            GROUP BY state 
            ORDER BY state
        """)
        
        print(f"\nDatabase totals:")
        for state, count in cursor.fetchall():
            print(f"   {state}: {count:,}")
            
except Exception as e:
    print(f"Error getting counts: {e}")