#!/usr/bin/env python3
"""
Load Bill Data from Hash/MD5 Files into Azure SQL
Handles various formats of bill data files
"""

import json
import hashlib
import os
import csv
from datetime import datetime
from database_config import get_db_connection
import glob
import pickle

def detect_file_format(filepath):
    """Detect the format of the data file"""
    ext = os.path.splitext(filepath)[1].lower()
    
    # Try to detect format by extension
    if ext in ['.json']:
        return 'json'
    elif ext in ['.csv']:
        return 'csv'
    elif ext in ['.pkl', '.pickle']:
        return 'pickle'
    elif ext in ['.md5', '.hash']:
        # MD5 files might contain references or be binary
        try:
            with open(filepath, 'r') as f:
                first_line = f.readline()
                if first_line.startswith('{') or first_line.startswith('['):
                    return 'json'
                elif ',' in first_line:
                    return 'csv'
        except:
            return 'binary'
    
    # Try to detect by content
    try:
        with open(filepath, 'r') as f:
            content = f.read(100)
            if content.startswith('{') or content.startswith('['):
                return 'json'
    except:
        pass
    
    return 'unknown'

def load_json_data(filepath):
    """Load data from JSON file"""
    with open(filepath, 'r') as f:
        data = json.load(f)
        if isinstance(data, dict):
            return data.get('bills', data.get('results', data.get('data', [])))
        return data

def load_csv_data(filepath):
    """Load data from CSV file"""
    bills = []
    with open(filepath, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            bills.append(row)
    return bills

def load_pickle_data(filepath):
    """Load data from pickle file"""
    with open(filepath, 'rb') as f:
        return pickle.load(f)

def load_legiscan_dataset(filepath):
    """Load data from LegiScan dataset format"""
    # LegiScan datasets often come as hash.md5 with accompanying data files
    base_dir = os.path.dirname(filepath)
    state_code = os.path.basename(base_dir).upper()
    
    bills = []
    
    # Look for bill JSON files in the directory
    bill_files = glob.glob(os.path.join(base_dir, 'bill', '*.json'))
    
    for bill_file in bill_files:
        try:
            with open(bill_file, 'r') as f:
                data = json.load(f)
                if 'bill' in data:
                    bill = data['bill']
                    # Standardize the structure
                    bills.append({
                        'bill_id': bill.get('bill_id'),
                        'bill_number': bill.get('bill_number'),
                        'title': bill.get('title'),
                        'description': bill.get('description'),
                        'state': state_code,
                        'state_abbr': state_code,
                        'status': bill.get('status'),
                        'introduced_date': bill.get('introduced'),
                        'last_action_date': bill.get('status_date'),
                        'session_id': bill.get('session_id'),
                        'session_name': bill.get('session', {}).get('name', ''),
                        'bill_type': bill.get('type'),
                        'body': bill.get('body'),
                        'url': bill.get('url'),
                        'text_url': bill.get('texts', [{}])[0].get('url', '') if bill.get('texts') else ''
                    })
        except Exception as e:
            print(f"   ⚠️ Error loading {bill_file}: {e}")
    
    return bills

def standardize_state(state_name):
    """Standardize state names to abbreviations"""
    state_mappings = {
        'Texas': 'TX', 'texas': 'TX', 'TEXAS': 'TX',
        'California': 'CA', 'california': 'CA', 'CALIFORNIA': 'CA',
        'Colorado': 'CO', 'colorado': 'CO', 'COLORADO': 'CO',
        'Florida': 'FL', 'florida': 'FL', 'FLORIDA': 'FL',
        'Kentucky': 'KY', 'kentucky': 'KY', 'KENTUCKY': 'KY',
        'Nevada': 'NV', 'nevada': 'NV', 'NEVADA': 'NV',
        'South Carolina': 'SC', 'south carolina': 'SC', 'SOUTH CAROLINA': 'SC'
    }
    
    return state_mappings.get(state_name, state_name.upper() if len(state_name) == 2 else state_name)

def insert_bills_to_azure(bills, source_file):
    """Insert bills into Azure SQL database"""
    if not bills:
        print(f"   ⚠️ No bills to insert from {source_file}")
        return 0
    
    inserted = 0
    skipped = 0
    errors = 0
    
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Get existing bill IDs
            cursor.execute("SELECT bill_id FROM dbo.state_legislation")
            existing_ids = set(str(row[0]) for row in cursor.fetchall())
            
            print(f"   📊 Found {len(existing_ids)} existing bills in database")
            
            # Prepare insert query
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
                try:
                    bill_id = str(bill.get('bill_id', ''))
                    
                    # Skip if exists
                    if bill_id in existing_ids:
                        skipped += 1
                        continue
                    
                    # Standardize state
                    state = standardize_state(bill.get('state', bill.get('state_abbr', '')))
                    
                    # Insert bill
                    cursor.execute(insert_query, (
                        bill_id,
                        bill.get('bill_number', ''),
                        (bill.get('title', '') or '')[:500],
                        (bill.get('description', '') or '')[:2000],
                        state,
                        state,
                        bill.get('status', 'Unknown'),
                        bill.get('category', 'not-applicable'),
                        bill.get('introduced_date', ''),
                        bill.get('last_action_date', ''),
                        bill.get('session_id', ''),
                        bill.get('session_name', ''),
                        bill.get('bill_type', ''),
                        bill.get('body', ''),
                        bill.get('url', bill.get('legiscan_url', '')),
                        bill.get('text_url', bill.get('pdf_url', '')),
                        datetime.now(),
                        datetime.now()
                    ))
                    
                    inserted += 1
                    
                    if inserted % 100 == 0:
                        print(f"   ✅ Inserted {inserted} bills...")
                        conn.commit()
                        
                except Exception as e:
                    errors += 1
                    print(f"   ❌ Error inserting bill {bill.get('bill_number', 'unknown')}: {e}")
            
            conn.commit()
            
    except Exception as e:
        print(f"❌ Database error: {e}")
        import traceback
        traceback.print_exc()
    
    print(f"   📊 Results: {inserted} inserted, {skipped} skipped, {errors} errors")
    return inserted

def main():
    """Main loading process"""
    print("🚀 Bill Data Loader - From Hash/MD5 Files")
    print("=" * 60)
    
    # Find potential data files
    patterns = [
        "*.md5",
        "*hash*",
        "*/hash.md5",
        "data/*.json",
        "data/*.csv",
        "bills/*.json",
        "*/bill/*.json"
    ]
    
    data_files = []
    for pattern in patterns:
        data_files.extend(glob.glob(pattern, recursive=True))
    
    if not data_files:
        print("❌ No data files found")
        print("\nPlease specify the location of your hash.md5 or data files:")
        data_path = input("Enter path to data file or directory: ").strip()
        
        if os.path.isfile(data_path):
            data_files = [data_path]
        elif os.path.isdir(data_path):
            # Check if it's a LegiScan dataset directory
            hash_file = os.path.join(data_path, 'hash.md5')
            if os.path.exists(hash_file):
                data_files = [hash_file]
            else:
                data_files = glob.glob(os.path.join(data_path, '*'))
    
    print(f"\n📁 Found {len(data_files)} potential data files")
    
    total_inserted = 0
    
    for filepath in data_files:
        print(f"\n📄 Processing: {filepath}")
        
        # Detect format
        format_type = detect_file_format(filepath)
        print(f"   Format detected: {format_type}")
        
        bills = []
        
        try:
            if format_type == 'json':
                bills = load_json_data(filepath)
            elif format_type == 'csv':
                bills = load_csv_data(filepath)
            elif format_type == 'pickle':
                bills = load_pickle_data(filepath)
            elif 'hash.md5' in filepath:
                # Likely a LegiScan dataset
                bills = load_legiscan_dataset(filepath)
            else:
                print(f"   ⚠️ Unknown format, skipping")
                continue
                
        except Exception as e:
            print(f"   ❌ Error loading file: {e}")
            continue
        
        if bills:
            print(f"   📊 Loaded {len(bills)} bills")
            inserted = insert_bills_to_azure(bills, filepath)
            total_inserted += inserted
        else:
            print(f"   ⚠️ No bills found in file")
    
    # Show final stats
    print("\n" + "=" * 60)
    print(f"🎉 Loading complete!")
    print(f"   📊 Total bills inserted: {total_inserted}")
    
    # Show database counts
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT state, COUNT(*) as count 
                FROM dbo.state_legislation 
                GROUP BY state 
                ORDER BY state
            """)
            
            print(f"\n📊 Database totals by state:")
            for state, count in cursor.fetchall():
                print(f"   {state}: {count:,}")
                
    except Exception as e:
        print(f"❌ Error getting counts: {e}")

if __name__ == "__main__":
    main()