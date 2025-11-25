#!/usr/bin/env python3
"""
Load LegiScan Dataset Bills into Azure SQL
Loads from backend/data/[STATE]/[SESSION]/bill/*.json structure
"""

import json
import os
from datetime import datetime
from database_config import get_db_connection
import glob

def load_bill_from_json(filepath, state_abbr):
    """Load a single bill from LegiScan JSON format"""
    try:
        with open(filepath, 'r') as f:
            data = json.load(f)
            
            # LegiScan format has the bill nested
            if 'bill' in data:
                bill = data['bill']
            else:
                bill = data
            
            # Extract and standardize data
            return {
                'bill_id': str(bill.get('bill_id', '')),
                'bill_number': bill.get('bill_number', ''),
                'title': bill.get('title', ''),
                'description': bill.get('description', ''),
                'state': state_abbr,
                'state_abbr': state_abbr,
                'status': bill.get('status', 'Unknown'),
                'status_date': bill.get('status_date', ''),
                'introduced_date': bill.get('introduced', ''),
                'last_action_date': bill.get('status_date', ''),
                'session_id': str(bill.get('session_id', '')),
                'session_name': bill.get('session', {}).get('session_name', '') if isinstance(bill.get('session'), dict) else '',
                'bill_type': bill.get('type', ''),
                'body': bill.get('body', ''),
                'url': bill.get('url', ''),
                'state_link': bill.get('state_link', ''),
                'texts': bill.get('texts', [])
            }
    except Exception as e:
        print(f"   ⚠️ Error loading {filepath}: {e}")
        return None

def insert_bills_batch(bills, state_abbr):
    """Insert bills in batches"""
    if not bills:
        return 0
    
    inserted = 0
    skipped = 0
    
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Get existing bill IDs for this state
            cursor.execute("""
                SELECT bill_id FROM dbo.state_legislation 
                WHERE state = ? OR state_abbr = ?
            """, (state_abbr, state_abbr))
            
            existing_ids = set(str(row[0]) for row in cursor.fetchall())
            print(f"   📊 Found {len(existing_ids)} existing {state_abbr} bills in database")
            
            # Prepare batch insert
            insert_query = """
                INSERT INTO dbo.state_legislation (
                    bill_id, bill_number, title, description,
                    state, state_abbr, status, category,
                    introduced_date, last_action_date,
                    session_id, session_name, bill_type, body,
                    legiscan_url, pdf_url, created_at, last_updated
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            
            batch = []
            
            for bill in bills:
                if bill['bill_id'] in existing_ids:
                    skipped += 1
                    continue
                
                # Get PDF URL from texts if available
                pdf_url = ''
                if bill.get('texts'):
                    for text in bill['texts']:
                        if text.get('type') == 'Introduced' or not pdf_url:
                            pdf_url = text.get('url', '')
                
                row = (
                    bill['bill_id'],
                    bill['bill_number'],
                    (bill['title'] or '')[:500],
                    (bill['description'] or '')[:2000],
                    state_abbr,  # Ensure consistent state abbreviation
                    state_abbr,
                    bill['status'],
                    'not-applicable',  # category
                    bill['introduced_date'],
                    bill['last_action_date'],
                    bill['session_id'],
                    bill['session_name'],
                    bill['bill_type'],
                    bill['body'],
                    bill.get('url', ''),
                    pdf_url,
                    datetime.now(),
                    datetime.now()
                )
                
                batch.append(row)
                
                # Insert in batches of 100
                if len(batch) >= 100:
                    cursor.executemany(insert_query, batch)
                    inserted += len(batch)
                    conn.commit()
                    print(f"   ✅ Inserted batch of {len(batch)} bills (total: {inserted})")
                    batch = []
            
            # Insert remaining
            if batch:
                cursor.executemany(insert_query, batch)
                inserted += len(batch)
                conn.commit()
                print(f"   ✅ Inserted final batch of {len(batch)} bills")
            
    except Exception as e:
        print(f"❌ Database error: {e}")
        import traceback
        traceback.print_exc()
    
    return inserted, skipped

def process_state_directory(state_dir):
    """Process all sessions in a state directory"""
    state_abbr = os.path.basename(state_dir).upper()
    
    # Handle "TX 2" -> "TX"
    if ' ' in state_abbr:
        state_abbr = state_abbr.split()[0]
    
    print(f"\n🏛️ Processing {state_abbr}")
    print("=" * 40)
    
    total_inserted = 0
    total_skipped = 0
    
    # Find all session directories
    session_dirs = glob.glob(os.path.join(state_dir, "*_Legislature_*"))
    
    if not session_dirs:
        # Try direct bill directory
        bill_dir = os.path.join(state_dir, "bill")
        if os.path.exists(bill_dir):
            session_dirs = [state_dir]
    
    for session_dir in session_dirs:
        session_name = os.path.basename(session_dir)
        print(f"\n📅 Session: {session_name}")
        
        # Find bill JSON files
        bill_files = glob.glob(os.path.join(session_dir, "bill", "*.json"))
        
        if not bill_files:
            print(f"   ⚠️ No bill files found")
            continue
        
        print(f"   📄 Found {len(bill_files)} bill files")
        
        # Load all bills
        bills = []
        for bill_file in bill_files:
            bill = load_bill_from_json(bill_file, state_abbr)
            if bill:
                bills.append(bill)
        
        print(f"   📊 Loaded {len(bills)} bills successfully")
        
        # Insert into database
        if bills:
            inserted, skipped = insert_bills_batch(bills, state_abbr)
            total_inserted += inserted
            total_skipped += skipped
            print(f"   ✅ Inserted: {inserted}, Skipped: {skipped}")
    
    return total_inserted, total_skipped

def main():
    """Main loading process"""
    print("🚀 LegiScan Dataset Loader")
    print("=" * 60)
    
    data_dir = "/Users/david.anderson/Downloads/PoliticalVue/backend/data"
    
    # Find all state directories
    state_dirs = []
    for item in os.listdir(data_dir):
        item_path = os.path.join(data_dir, item)
        if os.path.isdir(item_path) and item not in ['.', '..', '.DS_Store']:
            # Check if it looks like a state directory
            if len(item) <= 3 or '_Legislature_' in str(os.listdir(item_path)):
                state_dirs.append(item_path)
    
    print(f"📁 Found {len(state_dirs)} state directories:")
    for state_dir in state_dirs:
        print(f"   - {os.path.basename(state_dir)}")
    
    # Process each state
    grand_total_inserted = 0
    grand_total_skipped = 0
    
    for state_dir in state_dirs:
        inserted, skipped = process_state_directory(state_dir)
        grand_total_inserted += inserted
        grand_total_skipped += skipped
    
    # Final summary
    print("\n" + "=" * 60)
    print("🎉 Loading Complete!")
    print(f"   ✅ Total bills inserted: {grand_total_inserted:,}")
    print(f"   ⏭️ Total bills skipped (duplicates): {grand_total_skipped:,}")
    
    # Show database counts
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT state, COUNT(*) as count 
                FROM dbo.state_legislation 
                GROUP BY state 
                ORDER BY count DESC, state
            """)
            
            print(f"\n📊 Database totals by state:")
            total = 0
            for state, count in cursor.fetchall():
                print(f"   {state}: {count:,}")
                total += count
            print(f"   ──────────")
            print(f"   TOTAL: {total:,}")
            
    except Exception as e:
        print(f"❌ Error getting counts: {e}")

if __name__ == "__main__":
    main()