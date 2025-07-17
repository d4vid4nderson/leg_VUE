#!/usr/bin/env python3
"""
Test script for LegiScan Service
"""

import asyncio
import sys
import os

# Add the backend directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from legiscan_service import (
    EnhancedLegiScanClient,
    check_legiscan_connection,
    get_legiscan_status,
    LEGISCAN_AVAILABLE,
    LEGISCAN_INITIALIZED
)

async def test_legiscan_service():
    """Test the LegiScan service functionality"""
    print("🧪 Testing LegiScan Service")
    print("=" * 50)
    
    # Test 1: Check status
    print("1️⃣ Checking LegiScan status...")
    status = get_legiscan_status()
    print(f"   Status: {status}")
    
    # Test 2: Check connection
    print("\n2️⃣ Testing LegiScan connection...")
    connection_status = await check_legiscan_connection()
    print(f"   Connection: {connection_status}")
    
    # Test 3: Try to initialize Enhanced client
    print("\n3️⃣ Testing Enhanced LegiScan client initialization...")
    try:
        client = EnhancedLegiScanClient()
        print("   ✅ Enhanced LegiScan client initialized successfully")
        
        # Test 4: Try a simple search (if connection is good)
        if connection_status == "connected":
            print("\n4️⃣ Testing simple search...")
            try:
                result = await client.search_bills_enhanced(
                    state="CA", 
                    query="education", 
                    limit=5, 
                    max_pages=1
                )
                if result.get('success'):
                    print(f"   ✅ Search successful! Found {len(result.get('results', []))} bills")
                else:
                    print(f"   ❌ Search failed: {result.get('error')}")
            except Exception as e:
                print(f"   ❌ Search test failed: {e}")
        else:
            print("   ⏭️ Skipping search test (connection not established)")
            
    except Exception as e:
        print(f"   ❌ Enhanced client initialization failed: {e}")
    
    # Test 5: Check traditional API
    print(f"\n5️⃣ Traditional LegiScan API status:")
    print(f"   Available: {LEGISCAN_AVAILABLE}")
    print(f"   Initialized: {LEGISCAN_INITIALIZED}")
    
    print("\n✅ LegiScan service test completed!")

if __name__ == "__main__":
    asyncio.run(test_legiscan_service())