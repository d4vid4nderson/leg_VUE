#!/usr/bin/env python3
"""
Bulk Load Bills from JSON Files
Initial one-time load of all bills, then just track status changes
"""

import json
import os
from datetime import datetime
from database_config import get_db_connection
import glob

def load_json_bills(json_path):
    """Load bills from a JSON file"""
    try:
        with open(json_path, 'r') as f:
            data = json.load(f)
            if isinstance(data, dict):
                # Handle both formats: {"bills": [...]} or {"results": [...]}
                return data.get('bills', data.get('results', []))
            elif isinstance(data, list):
                return data
            else:
                print(f"⚠️ Unexpected JSON format in {json_path}")
                return []
    except Exception as e:
        print(f"❌ Error loading {json_path}: {e}")
        return []

def standardize_state(state_name):
    """Standardize state names to abbreviations"""
    state_mappings = {
        'Texas': 'TX', 'California': 'CA', 'Colorado': 'CO',
        'Florida': 'FL', 'Kentucky': 'KY', 'Nevada': 'NV', 
        'South Carolina': 'SC'
    }
    
    # Return abbreviation if full name, otherwise return as-is
    return state_mappings.get(state_name, state_name)

def bulk_insert_bills(bills, state_abbr):
    """Bulk insert bills into database"""
    if not bills:
        return 0
    
    inserted = 0
    skipped = 0
    
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Check existing bills to avoid duplicates
            cursor.execute("""
                SELECT bill_id FROM dbo.state_legislation 
                WHERE state = ? OR state_abbr = ?
            """, (state_abbr, state_abbr))
            
            existing_ids = set(row[0] for row in cursor.fetchall())
            print(f"   Found {len(existing_ids)} existing bills in database")
            
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
            
            batch_data = []
            
            for bill in bills:
                bill_id = str(bill.get('bill_id', ''))
                
                # Skip if already exists
                if bill_id in existing_ids:
                    skipped += 1
                    continue
                
                # Standardize state
                state = standardize_state(bill.get('state', state_abbr))
                
                # Prepare row data
                row = (
                    bill_id,
                    bill.get('bill_number', ''),
                    bill.get('title', '')[:500],  # Truncate long titles
                    bill.get('description', '')[:2000],  # Truncate long descriptions
                    state,  # Use standardized abbreviation
                    state,  # Both fields use abbreviation
                    bill.get('status', 'Unknown'),
                    bill.get('category', 'not-applicable'),
                    bill.get('introduced_date', ''),
                    bill.get('last_action_date', ''),
                    bill.get('session_id', ''),
                    bill.get('session_name', ''),
                    bill.get('bill_type', ''),
                    bill.get('body', ''),
                    bill.get('legiscan_url', bill.get('url', '')),
                    bill.get('pdf_url', bill.get('text_url', '')),
                    datetime.now(),
                    datetime.now()
                )
                
                batch_data.append(row)
                
                # Insert in batches of 100
                if len(batch_data) >= 100:
                    cursor.executemany(insert_query, batch_data)
                    inserted += len(batch_data)
                    print(f"   ✅ Inserted batch of {len(batch_data)} bills (total: {inserted})")
                    batch_data = []
            
            # Insert remaining bills
            if batch_data:
                cursor.executemany(insert_query, batch_data)
                inserted += len(batch_data)
                print(f"   ✅ Inserted final batch of {len(batch_data)} bills")
            
            conn.commit()
            print(f"   📊 Summary: {inserted} inserted, {skipped} skipped (already existed)")
            
    except Exception as e:
        print(f"❌ Database error: {e}")
        import traceback
        traceback.print_exc()
        
    return inserted

def main():
    """Main bulk load process"""
    print("🚀 Starting bulk bill load")
    print("=" * 60)
    
    # Look for JSON files in common locations
    json_patterns = [
        "bills_*.json",
        "state_bills_*.json",
        "*_bills.json",
        "legiscan_*.json",
        "data/bills/*.json",
        "data/*.json"
    ]
    
    json_files = []
    for pattern in json_patterns:
        json_files.extend(glob.glob(pattern))
    
    if not json_files:
        print("❌ No JSON files found. Please place your bill JSON files in the current directory.")
        print("   Expected patterns: bills_*.json, state_bills_*.json, etc.")
        return
    
    print(f"📁 Found {len(json_files)} JSON files:")
    for f in json_files:
        print(f"   - {f}")
    
    # Process each file
    total_inserted = 0
    
    for json_file in json_files:
        print(f"\n📄 Processing: {json_file}")
        
        # Try to determine state from filename
        state_abbr = None
        filename = os.path.basename(json_file).upper()
        
        # Check for state abbreviations in filename
        for state in ['TX', 'CA', 'CO', 'FL', 'KY', 'NV', 'SC']:
            if state in filename:
                state_abbr = state
                break
        
        if not state_abbr:
            state_abbr = input(f"   Enter state abbreviation for {json_file} (e.g., TX): ").upper()
        
        print(f"   Using state: {state_abbr}")
        
        # Load and insert bills
        bills = load_json_bills(json_file)
        print(f"   Loaded {len(bills)} bills from JSON")
        
        if bills:
            inserted = bulk_insert_bills(bills, state_abbr)
            total_inserted += inserted
    
    print("\n" + "=" * 60)
    print(f"🎉 Bulk load complete!")
    print(f"   📊 Total bills inserted: {total_inserted}")
    print(f"   📁 Files processed: {len(json_files)}")
    
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
            
            print(f"\n📊 Final database counts:")
            for state, count in cursor.fetchall():
                print(f"   {state}: {count}")
                
    except Exception as e:
        print(f"❌ Error getting final counts: {e}")

if __name__ == "__main__":
    main()