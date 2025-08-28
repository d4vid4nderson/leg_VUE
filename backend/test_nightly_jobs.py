#!/usr/bin/env python3
"""
Test script to debug nightly job failures
"""

import asyncio
import sys
import os
from datetime import datetime

# Add backend to path
sys.path.insert(0, '/app')

async def test_executive_orders():
    """Test the executive orders fetch"""
    print("\n" + "="*60)
    print("Testing Executive Orders Nightly Job")
    print("="*60)
    
    try:
        from simple_executive_orders import fetch_executive_orders_simple_integration
        from database_config import get_db_connection
        
        # Test database connection
        print("Testing database connection...")
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM dbo.executive_orders")
            count = cursor.fetchone()[0]
            print(f"✅ Database connected. Current EO count: {count}")
        
        # Try to fetch with minimal parameters
        print("\nFetching executive orders (test mode - limit 1)...")
        result = await fetch_executive_orders_simple_integration(
            start_date=None,
            end_date=None,
            with_ai=False,  # Skip AI for testing
            limit=1,        # Only fetch 1 for testing
            save_to_db=False,  # Don't save for testing
            only_new=True
        )
        
        print(f"\nResult: {result}")
        
        if result.get('success'):
            print("✅ Executive Orders fetch test PASSED")
            return True
        else:
            print(f"❌ Executive Orders fetch test FAILED: {result.get('error')}")
            return False
            
    except Exception as e:
        print(f"❌ Executive Orders test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_state_bills():
    """Test the state bills update"""
    print("\n" + "="*60)
    print("Testing State Bills Nightly Job")
    print("="*60)
    
    try:
        from database_config import get_db_connection
        
        # Test database connection
        print("Testing database connection...")
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Get status for CA
            cursor.execute('''
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN ai_executive_summary IS NOT NULL AND ai_executive_summary != '' THEN 1 ELSE 0 END) as with_ai
                FROM dbo.state_legislation
                WHERE state = 'CA'
            ''')
            
            result = cursor.fetchone()
            if result:
                total, with_ai = result
                percentage = (with_ai/total*100) if total > 0 else 0
                print(f"✅ Database connected. CA bills: {with_ai}/{total} ({percentage:.1f}%) with AI")
            
        print("✅ State Bills database test PASSED")
        return True
        
    except Exception as e:
        print(f"❌ State Bills test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Run all tests"""
    print(f"\n🚀 Testing Nightly Jobs at {datetime.utcnow().isoformat()}Z")
    print(f"Environment: {os.getenv('ENVIRONMENT', 'local')}\n")
    
    # Test executive orders
    eo_success = await test_executive_orders()
    
    # Test state bills
    sb_success = await test_state_bills()
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    print(f"Executive Orders: {'✅ PASSED' if eo_success else '❌ FAILED'}")
    print(f"State Bills: {'✅ PASSED' if sb_success else '❌ FAILED'}")
    
    if not (eo_success and sb_success):
        print("\n⚠️ Some tests failed. The nightly jobs may fail in production.")
        sys.exit(1)
    else:
        print("\n✅ All tests passed!")
        sys.exit(0)

if __name__ == "__main__":
    asyncio.run(main())