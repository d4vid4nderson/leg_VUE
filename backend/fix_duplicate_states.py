#!/usr/bin/env python3
"""
Fix duplicate state entries by standardizing state names to abbreviations
This script consolidates entries like "Texas" -> "TX", "California" -> "CA"
"""

from database_config import get_db_connection

# State name to abbreviation mapping
STATE_MAPPINGS = {
    'Texas': 'TX',
    'California': 'CA', 
    'Colorado': 'CO',
    'Florida': 'FL',
    'Kentucky': 'KY',
    'Nevada': 'NV',
    'South Carolina': 'SC'
}

def fix_duplicate_states():
    """Update state names to use abbreviations consistently"""
    print("🔧 Starting state name standardization...")
    
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Check current state distribution
            print("\n📊 Current state distribution:")
            cursor.execute("SELECT state, COUNT(*) as count FROM dbo.state_legislation GROUP BY state ORDER BY state")
            current_states = cursor.fetchall()
            
            for state, count in current_states:
                print(f"   {state}: {count}")
            
            # Update full state names to abbreviations
            total_updated = 0
            
            for full_name, abbr in STATE_MAPPINGS.items():
                print(f"\n🔄 Converting '{full_name}' to '{abbr}'...")
                
                # Update the state field
                update_query = """
                    UPDATE dbo.state_legislation 
                    SET state = ?, state_abbr = ? 
                    WHERE state = ? OR state_abbr = ?
                """
                
                cursor.execute(update_query, (abbr, abbr, full_name, full_name))
                updated_count = cursor.rowcount
                total_updated += updated_count
                
                print(f"   ✅ Updated {updated_count} records")
            
            # Commit changes
            conn.commit()
            print(f"\n✅ Successfully updated {total_updated} records")
            
            # Show final state distribution
            print("\n📊 Final state distribution:")
            cursor.execute("SELECT state, COUNT(*) as count FROM dbo.state_legislation GROUP BY state ORDER BY state")
            final_states = cursor.fetchall()
            
            for state, count in final_states:
                print(f"   {state}: {count}")
                
            print("\n🎉 State standardization complete!")
            
    except Exception as e:
        print(f"❌ Error fixing duplicate states: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    fix_duplicate_states()