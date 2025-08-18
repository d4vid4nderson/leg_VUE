#!/usr/bin/env python3
"""
Update database status codes to readable status names
"""

from database_config import get_db_connection

def update_status_to_readable():
    """Convert numeric status codes to readable status names"""
    
    # Mapping from numeric codes to readable names (based on LegiScan API)
    status_mapping = {
        '0': 'Pending',
        '1': 'Introduced',
        '2': 'Engrossed', 
        '3': 'Enrolled',
        '4': 'Passed',
        '5': 'Vetoed',
        '6': 'Failed/Defeated',
        'Unknown': 'Introduced',  # Default unknown to Introduced
        '': 'Introduced'  # Default empty to Introduced
    }
    
    print("🔄 UPDATING STATUS CODES TO READABLE NAMES")
    print("=" * 50)
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Check current status distribution
        print("📊 Current status distribution:")
        cursor.execute("""
            SELECT status, COUNT(*) as count
            FROM dbo.state_legislation 
            WHERE state = 'TX'
            GROUP BY status
            ORDER BY count DESC
        """)
        
        for row in cursor.fetchall():
            status, count = row
            readable = status_mapping.get(status, status)
            print(f"  '{status}' → '{readable}': {count:,} bills")
        
        print(f"\n🔧 Updating status codes...")
        updated_total = 0
        
        for numeric_code, readable_name in status_mapping.items():
            cursor.execute("""
                UPDATE dbo.state_legislation 
                SET status = ?
                WHERE state = 'TX' AND status = ?
            """, (readable_name, numeric_code))
            
            updated = cursor.rowcount
            if updated > 0:
                updated_total += updated
                print(f"  ✅ Updated {updated:,} bills: '{numeric_code}' → '{readable_name}'")
        
        print(f"\n📊 Updated {updated_total:,} bills total")
        
        # Verify new distribution
        print(f"\n✅ New status distribution:")
        cursor.execute("""
            SELECT status, COUNT(*) as count
            FROM dbo.state_legislation 
            WHERE state = 'TX'
            GROUP BY status
            ORDER BY count DESC
        """)
        
        for row in cursor.fetchall():
            status, count = row
            percentage = (count / 12372 * 100)
            print(f"  '{status}': {count:,} bills ({percentage:.1f}%)")
        
        print(f"\n🎯 AVAILABLE STATUS FILTERS FOR FRONTEND:")
        unique_statuses = set()
        cursor.execute("""
            SELECT DISTINCT status 
            FROM dbo.state_legislation 
            WHERE state = 'TX' AND status IS NOT NULL AND status != ''
            ORDER BY status
        """)
        
        for row in cursor.fetchall():
            status = row[0]
            unique_statuses.add(status)
            print(f"  • {status}")
        
        print(f"\n✅ Frontend can now filter by these {len(unique_statuses)} status options!")

if __name__ == "__main__":
    update_status_to_readable()