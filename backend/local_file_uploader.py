#!/usr/bin/env python3
"""
Local File Uploader - Process JSON and MD5 hash files directly
No web interface needed - processes files from local filesystem
"""

import json
import os
import sys
import asyncio
from datetime import datetime
from pathlib import Path
from database_config import get_db_connection

# Practice area keywords for categorization
PRACTICE_AREA_KEYWORDS = {
    'healthcare': ['health', 'medical', 'hospital', 'insurance', 'medicare', 'patient', 'pharmacy', 'doctor'],
    'education': ['school', 'education', 'student', 'teacher', 'university', 'college', 'curriculum'],
    'tax': ['tax', 'revenue', 'fiscal', 'budget', 'appropriation', 'finance', 'treasury'],
    'environment': ['environment', 'climate', 'pollution', 'renewable', 'conservation', 'wildlife'],
    'criminal-justice': ['criminal', 'crime', 'police', 'prison', 'sentence', 'conviction', 'felony'],
    'labor': ['labor', 'employment', 'worker', 'wage', 'union', 'workplace', 'unemployment'],
    'housing': ['housing', 'rent', 'tenant', 'landlord', 'eviction', 'mortgage', 'zoning'],
    'transportation': ['transportation', 'highway', 'road', 'vehicle', 'traffic', 'transit', 'motor'],
    'agriculture': ['agriculture', 'farm', 'crop', 'livestock', 'ranch', 'agricultural'],
    'technology': ['technology', 'internet', 'digital', 'cyber', 'data', 'privacy', 'software'],
}

def determine_practice_area(title: str, description: str) -> str:
    """Determine practice area based on content"""
    text = f"{title or ''} {description or ''}".lower()
    
    for area, keywords in PRACTICE_AREA_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text:
                return area
    
    return 'government-operations'

def process_json_file(file_path: str, upload_type: str, state: str = None) -> dict:
    """Process JSON file"""
    print(f"🔍 Processing JSON file: {file_path}")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Extract items from various JSON formats
        items = []
        if isinstance(data, list):
            items = data
        elif isinstance(data, dict):
            # Try common array keys
            items = (data.get('items') or 
                    data.get('bills') or 
                    data.get('orders') or 
                    data.get('data') or 
                    data.get('results') or
                    [])
        
        if not items:
            return {"success": False, "error": "No items found in JSON file"}
        
        print(f"📊 Found {len(items)} items in JSON file")
        return process_items(items, upload_type, state, file_path)
        
    except Exception as e:
        return {"success": False, "error": f"JSON processing error: {str(e)}"}

def process_md5_file(file_path: str, upload_type: str, state: str = None) -> dict:
    """Process MD5 hash file"""
    print(f"🔍 Processing MD5 hash file: {file_path}")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        lines = [line.strip() for line in content.strip().split('\n') if line.strip()]
        items = []
        
        for line in lines:
            parts = line.split(None, 1)  # Split on whitespace, max 1 split
            if len(parts) >= 2:
                hash_value = parts[0]
                filename = parts[1]
                
                # Extract bill number from filename
                bill_number = filename.split('.')[0] if '.' in filename else filename
                
                item = {
                    'hash': hash_value,
                    'filename': filename,
                    'bill_number': bill_number,
                    'title': f"Document: {filename}",
                    'description': f"File: {filename} (Hash: {hash_value})",
                    'session_name': '89th Legislature Regular Session' if state == 'TX' else 'Current Session'
                }
                items.append(item)
        
        if not items:
            return {"success": False, "error": "No valid entries found in MD5 file"}
        
        print(f"📊 Found {len(items)} hash entries in file")
        return process_items(items, upload_type, state, file_path)
        
    except Exception as e:
        return {"success": False, "error": f"MD5 processing error: {str(e)}"}

def process_items(items: list, upload_type: str, state: str, source_file: str) -> dict:
    """Process items and save to database"""
    print(f"💾 Processing {len(items)} items for {upload_type}")
    
    results = {
        "success": True,
        "total": len(items),
        "processed": 0,
        "successful": 0,
        "failed": 0,
        "errors": [],
        "source_file": source_file
    }
    
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            for i, item in enumerate(items):
                try:
                    if upload_type == 'state_legislation':
                        success = save_state_legislation(cursor, item, state)
                    else:  # executive_orders
                        success = save_executive_order(cursor, item)
                    
                    results["processed"] += 1
                    if success:
                        results["successful"] += 1
                        if (i + 1) % 10 == 0:
                            print(f"  ✅ Processed {i + 1}/{len(items)} items...")
                    else:
                        results["failed"] += 1
                        
                except Exception as e:
                    results["failed"] += 1
                    error_msg = f"Item {i+1}: {str(e)}"
                    results["errors"].append(error_msg)
                    print(f"  ❌ {error_msg}")
            
            # Commit all changes
            conn.commit()
            print(f"✅ Database committed - {results['successful']} items saved")
            
    except Exception as e:
        results["success"] = False
        results["errors"].append(f"Database error: {str(e)}")
        print(f"❌ Database error: {e}")
    
    return results

def save_state_legislation(cursor, item: dict, state: str) -> bool:
    """Save state legislation item to database"""
    try:
        # Extract data
        bill_number = item.get('bill_number') or item.get('number') or item.get('bill_id', 'UNKNOWN')
        title = item.get('title', '')[:500]  # Limit length
        description = item.get('description', '')[:1000]
        status = item.get('status', '')
        introduced_date = item.get('introduced_date') or item.get('introduction_date')
        session_name = item.get('session_name', '89th Legislature Regular Session')
        bill_id = item.get('bill_id') or f"{state}_{bill_number}"
        
        # Determine category
        category = determine_practice_area(title, description)
        
        # Check if already exists
        cursor.execute("""
            SELECT COUNT(*) FROM dbo.state_legislation
            WHERE state = ? AND bill_number = ?
        """, (state, bill_number))
        
        exists = cursor.fetchone()[0] > 0
        
        if exists:
            # Update existing
            cursor.execute("""
                UPDATE dbo.state_legislation
                SET title = ?,
                    description = ?,
                    status = ?,
                    introduced_date = ?,
                    session_name = ?,
                    category = ?,
                    last_updated = ?
                WHERE state = ? AND bill_number = ?
            """, (
                title, description, status, introduced_date, session_name,
                category, datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                state, bill_number
            ))
        else:
            # Insert new
            cursor.execute("""
                INSERT INTO dbo.state_legislation (
                    state, bill_id, bill_number, title, description,
                    status, introduced_date, session_name, category,
                    created_at, last_updated, reviewed
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                state, bill_id, bill_number, title, description,
                status, introduced_date, session_name, category,
                datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                0  # reviewed = false
            ))
        
        return True
        
    except Exception as e:
        print(f"Error saving state legislation {bill_number}: {e}")
        return False

def save_executive_order(cursor, item: dict) -> bool:
    """Save executive order to database"""
    try:
        # Extract data
        eo_number = item.get('executive_order_number') or item.get('number') or item.get('eo_number', 'UNKNOWN')
        title = item.get('title', '')[:500]
        summary = item.get('summary', '')[:1000]
        signing_date = item.get('signing_date') or item.get('date_signed')
        
        # Determine category
        category = determine_practice_area(title, summary)
        
        # Check if exists
        cursor.execute("""
            SELECT COUNT(*) FROM dbo.executive_orders
            WHERE eo_number = ?
        """, (eo_number,))
        
        exists = cursor.fetchone()[0] > 0
        
        if exists:
            # Update existing
            cursor.execute("""
                UPDATE dbo.executive_orders
                SET title = ?,
                    summary = ?,
                    signing_date = ?,
                    category = ?,
                    last_updated = ?
                WHERE eo_number = ?
            """, (
                title, summary, signing_date, category,
                datetime.now(), eo_number
            ))
        else:
            # Insert new
            cursor.execute("""
                INSERT INTO dbo.executive_orders (
                    eo_number, title, summary, signing_date, category,
                    created_at, last_updated, reviewed
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                eo_number, title, summary, signing_date, category,
                datetime.now(), datetime.now(), 0
            ))
        
        return True
        
    except Exception as e:
        print(f"Error saving executive order {eo_number}: {e}")
        return False

def main():
    """Main function"""
    print("=" * 80)
    print("LOCAL FILE UPLOADER - Process JSON and MD5 Hash Files")
    print("=" * 80)
    
    if len(sys.argv) < 4:
        print("Usage: python local_file_uploader.py <file_path> <upload_type> <state>")
        print()
        print("Arguments:")
        print("  file_path    : Path to your JSON or MD5 hash file")
        print("  upload_type  : 'state_legislation' or 'executive_orders'") 
        print("  state        : State code (e.g., 'TX') - required for state_legislation")
        print()
        print("Examples:")
        print("  python local_file_uploader.py texas_bills.json state_legislation TX")
        print("  python local_file_uploader.py bills.hash.md5 state_legislation TX")
        print("  python local_file_uploader.py orders.json executive_orders")
        print()
        print("Supported file formats:")
        print("  .json      : Standard JSON with bill/order arrays")
        print("  .hash.md5  : Hash and filename pairs")
        print("  .md5       : Hash and filename pairs")
        return
    
    file_path = sys.argv[1]
    upload_type = sys.argv[2]
    state = sys.argv[3] if len(sys.argv) > 3 else None
    
    # Validate inputs
    if not os.path.exists(file_path):
        print(f"❌ File not found: {file_path}")
        return
    
    if upload_type not in ['state_legislation', 'executive_orders']:
        print(f"❌ Invalid upload_type: {upload_type}")
        print("Must be 'state_legislation' or 'executive_orders'")
        return
    
    if upload_type == 'state_legislation' and not state:
        print("❌ State code required for state_legislation")
        return
    
    # Process file based on extension
    file_ext = Path(file_path).suffix.lower()
    
    print(f"📁 File: {file_path}")
    print(f"📝 Type: {upload_type}")
    print(f"🏛️ State: {state or 'N/A'}")
    print(f"🔧 Format: {file_ext}")
    print()
    
    if file_ext == '.json':
        results = process_json_file(file_path, upload_type, state)
    elif file_ext in ['.md5', '.hash.md5'] or file_path.endswith('.hash.md5'):
        results = process_md5_file(file_path, upload_type, state)
    else:
        print(f"❌ Unsupported file format: {file_ext}")
        print("Supported: .json, .md5, .hash.md5")
        return
    
    # Display results
    print("\n" + "=" * 80)
    print("PROCESSING RESULTS")
    print("=" * 80)
    
    if results["success"]:
        print(f"✅ Processing completed successfully!")
        print(f"📊 Total items: {results['total']}")
        print(f"✅ Successful: {results['successful']}")
        print(f"❌ Failed: {results['failed']}")
        
        if results["errors"]:
            print(f"\n⚠️ Errors ({len(results['errors'])}):")
            for error in results["errors"][:5]:  # Show first 5 errors
                print(f"  • {error}")
            if len(results["errors"]) > 5:
                print(f"  ... and {len(results['errors']) - 5} more")
    else:
        print(f"❌ Processing failed: {results.get('error', 'Unknown error')}")
    
    print(f"\n🎉 Done! Your data has been uploaded to the database.")

if __name__ == "__main__":
    main()