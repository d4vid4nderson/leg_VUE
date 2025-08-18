#!/usr/bin/env python3
"""
Smart Texas Fetch - Compare API vs Database and fetch missing bills
This script implements the smart fetch functionality requested by the user
"""

import os
import sys
import json
import time
from pathlib import Path
from datetime import datetime
from database_config import get_db_connection
from legiscan_api import LegiScanAPI

def analyze_database_status():
    """Analyze current database status for Texas bills"""
    print('📊 Analyzing current database status...')
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Get bill counts by session
        cursor.execute('''
            SELECT 
                session_name,
                COUNT(*) as total_bills,
                COUNT(DISTINCT bill_number) as unique_bills,
                MIN(bill_number) as first_bill,
                MAX(bill_number) as last_bill
            FROM dbo.state_legislation 
            WHERE state = 'TX'
            GROUP BY session_name
            ORDER BY total_bills DESC
        ''')
        
        db_status = {}
        total_db_bills = 0
        
        print('\nDatabase Status:')
        print('Session | Count | Unique | Range')
        print('-' * 60)
        
        for row in cursor.fetchall():
            session, total, unique, first, last = row
            db_status[session] = {
                'total': total,
                'unique': unique,
                'range': f'{first} to {last}'
            }
            total_db_bills += total
            print(f'{session:<35} | {total:>5} | {unique:>6} | {first} to {last}')
        
        print(f'\nTotal bills in database: {total_db_bills}')
        
        return db_status, total_db_bills

def analyze_local_files():
    """Analyze local bill files in data directory"""
    print('\n📁 Analyzing local data files...')
    
    local_status = {}
    base_path = Path('/app/data/TX')
    
    if not base_path.exists():
        print('❌ No local data directory found')
        return local_status
    
    for session_dir in base_path.iterdir():
        if session_dir.is_dir():
            bill_dir = session_dir / 'bill'
            if bill_dir.exists():
                bill_files = list(bill_dir.glob('*.json'))
                session_name = session_dir.name
                local_status[session_name] = {
                    'file_count': len(bill_files),
                    'files': [f.stem for f in bill_files]
                }
                print(f'  {session_name}: {len(bill_files)} files')
    
    return local_status

def get_db_bill_numbers(session_name):
    """Get list of bill numbers already in database for a session"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT DISTINCT bill_number 
            FROM dbo.state_legislation 
            WHERE state = 'TX' AND session_name = ?
        ''', (session_name,))
        
        return set([row[0] for row in cursor.fetchall()])

def import_local_file(file_path, session_name):
    """Import a single local JSON file to database"""
    try:
        with open(file_path, 'r') as f:
            bill_data = json.load(f)
        
        # Extract bill information from JSON structure
        if 'bill' in bill_data:
            bill = bill_data['bill']
        else:
            bill = bill_data
        
        # Map the data to our database structure
        bill_record = {
            'state': 'TX',
            'bill_number': bill.get('bill_number', ''),
            'title': bill.get('title', ''),
            'description': bill.get('description', ''),
            'session_name': session_name,
            'introduced_date': bill.get('introduced_date'),
            'last_action_date': bill.get('last_action_date'),
            'status': bill.get('status', ''),
            'last_updated': datetime.now()
        }
        
        # Insert into database
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO dbo.state_legislation 
                (state, bill_number, title, description, session_name, 
                 introduced_date, last_action_date, status, last_updated)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                bill_record['state'],
                bill_record['bill_number'],
                bill_record['title'],
                bill_record['description'],
                bill_record['session_name'],
                bill_record['introduced_date'],
                bill_record['last_action_date'],
                bill_record['status'],
                bill_record['last_updated']
            ))
            conn.commit()
        
        return True
        
    except Exception as e:
        print(f'❌ Error importing {file_path}: {e}')
        return False

def import_missing_local_bills():
    """Import bills from local files that aren't in database"""
    print('\n🔄 Importing missing bills from local files...')
    
    local_status = analyze_local_files()
    imported_count = 0
    
    # Map local directory names to database session names
    session_mapping = {
        '2025-2025_89th_Legislature_1st_Special_Session': '89th Legislature 1st Special Session'
        # Add more mappings as needed
    }
    
    for local_session, info in local_status.items():
        if local_session in session_mapping:
            db_session_name = session_mapping[local_session]
            print(f'\nProcessing {local_session} -> {db_session_name}')
            
            # Get existing bill numbers in database
            existing_bills = get_db_bill_numbers(db_session_name)
            print(f'  Database has {len(existing_bills)} bills')
            print(f'  Local files: {info["file_count"]} files')
            
            # Find missing bills
            local_bills = set(info['files'])
            missing_bills = local_bills - existing_bills
            
            print(f'  Missing bills: {len(missing_bills)}')
            
            if missing_bills:
                print(f'  Importing {len(missing_bills)} missing bills...')
                
                base_path = Path('/app/data/TX') / local_session / 'bill'
                
                for bill_num in missing_bills:
                    file_path = base_path / f'{bill_num}.json'
                    if file_path.exists():
                        if import_local_file(file_path, db_session_name):
                            imported_count += 1
                            if imported_count % 10 == 0:
                                print(f'    Imported {imported_count} bills...')
    
    print(f'\n✅ Imported {imported_count} bills from local files')
    return imported_count

def fetch_missing_2nd_special_session():
    """Fetch 2nd Special Session bills from LegiScan API"""
    print('\n🔍 Fetching 2nd Special Session bills from API...')
    
    try:
        api = LegiScanAPI()
        
        # Search for 2nd Special Session bills
        # We know from previous analysis there should be ~276 bills
        result = api.search_bills('TX', query='89th 2nd special', limit=300, year_filter='all', max_pages=6)
        
        if result.get('success'):
            bills = result.get('bills', [])
            print(f'Found {len(bills)} potential 2nd Special Session bills')
            
            # Filter for actual 2nd Special Session bills
            # Look for bills with 2nd Special in session name or recent dates
            special_2nd_bills = []
            for bill in bills:
                session = bill.get('session_name', '')
                last_action = bill.get('last_action_date', '')
                
                # Look for indicators of 2nd Special Session
                if ('2nd' in session and 'special' in session.lower()) or \
                   (last_action and '2025-08' in str(last_action)):
                    special_2nd_bills.append(bill)
            
            print(f'Filtered to {len(special_2nd_bills)} actual 2nd Special Session bills')
            
            # TODO: Import these bills to database
            # This would need proper bill detail fetching and import logic
            
            return len(special_2nd_bills)
        else:
            print(f'❌ API search failed: {result.get("error")}')
            return 0
            
    except Exception as e:
        print(f'❌ Error fetching 2nd Special Session: {e}')
        return 0

def main():
    """Main smart fetch function"""
    print('🚀 Texas Smart Fetch Analysis & Import')
    print('=' * 80)
    
    # Step 1: Analyze current state
    print('\nStep 1: Database Analysis')
    db_status, total_db = analyze_database_status()
    
    print('\nStep 2: Local Files Analysis')
    local_status = analyze_local_files()
    
    # Step 3: Import missing local bills
    print('\nStep 3: Import Missing Local Bills')
    imported_local = import_missing_local_bills()
    
    # Step 4: Analyze what's still missing
    print('\nStep 4: Post-Import Analysis')
    db_status_after, total_after = analyze_database_status()
    
    # Step 5: Fetch 2nd Special Session from API
    print('\nStep 5: Fetch Missing 2nd Special Session')
    fetched_2nd_special = fetch_missing_2nd_special_session()
    
    # Summary
    print('\n' + '=' * 80)
    print('SMART FETCH SUMMARY')
    print('=' * 80)
    print(f'Initial database bills: {total_db}')
    print(f'Imported from local files: {imported_local}')
    print(f'Final database bills: {total_after}')
    print(f'2nd Special Session bills found: {fetched_2nd_special}')
    
    # Expected vs Actual comparison
    print('\nExpected vs Actual (from LegiScan documentation):')
    print('  Regular Session: Expected ~11,503 | Actual:', db_status_after.get('89th Legislature Regular Session', {}).get('total', 0))
    print('  1st Special: Expected ~593 | Actual:', db_status_after.get('89th Legislature 1st Special Session', {}).get('total', 0))
    print('  2nd Special: Expected ~276 | Actual: 0 (needs API implementation)')
    
    return True

if __name__ == '__main__':
    main()