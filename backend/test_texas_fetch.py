#!/usr/bin/env python3
"""
Test script to verify Texas bill fetch uses the new improved method
"""

import requests
import json
import time

def test_fetch_button():
    """Test the main Fetch button endpoint that shows in the UI"""
    
    print("🧪 Testing the main Fetch button (check-and-update endpoint)")
    print("=" * 60)
    
    # This is the same endpoint the Fetch button calls
    url = "http://localhost:8000/api/legiscan/check-and-update"
    
    payload = {
        "state": "TX"  # Texas state abbreviation
    }
    
    print(f"📡 Calling: {url}")
    print(f"📋 Payload: {json.dumps(payload, indent=2)}")
    print(f"⏰ Starting at: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    try:
        # Make the request with increased timeout for large datasets
        response = requests.post(
            url,
            json=payload,
            timeout=300  # 5 minute timeout
        )
        
        print(f"📊 Response Status: {response.status_code}")
        print(f"⏰ Completed at: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        
        if response.status_code == 200:
            data = response.json()
            
            print("\n✅ SUCCESS! Response summary:")
            print(f"   📈 Bills found in API: {data.get('bills_found', 'N/A')}")
            print(f"   📊 Bills in database: {data.get('bills_in_database', 'N/A')}")
            print(f"   🆕 Missing bills: {data.get('missing_bills', 'N/A')}")
            print(f"   ✅ Bills processed: {data.get('bills_processed', 'N/A')}")
            print(f"   📝 Message: {data.get('message', 'N/A')}")
            
            # Check if we got significantly more than 723 bills
            bills_found = data.get('bills_found', 0)
            if bills_found > 1000:
                print(f"\n🎉 GREAT! Found {bills_found} bills - much more than the previous 723!")
                print("   This suggests the master list approach is working!")
            elif bills_found > 723:
                print(f"\n👍 GOOD! Found {bills_found} bills - improvement over previous 723")
            else:
                print(f"\n⚠️ Only found {bills_found} bills - may still have issues")
            
        else:
            print(f"\n❌ ERROR Response:")
            print(response.text)
            
    except requests.exceptions.Timeout:
        print("\n⚠️ Request timed out after 5 minutes")
        print("   This might be expected for large datasets like Texas")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")

def test_bulk_fetch_endpoint():
    """Test the bulk fetch endpoint for comparison"""
    
    print("\n" + "=" * 60)
    print("🧪 Testing bulk fetch endpoint for comparison")
    print("=" * 60)
    
    url = "http://localhost:8000/api/state-legislation/fetch"
    
    payload = {
        "states": ["Texas"],
        "bills_per_state": 5000,
        "save_to_db": False,  # Just test fetching, don't save
        "year_filter": "all",
        "max_pages": 15
    }
    
    print(f"📡 Calling: {url}")
    print(f"📋 Payload: {json.dumps(payload, indent=2)}")
    print(f"⏰ Starting at: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    try:
        response = requests.post(
            url,
            json=payload,
            timeout=300
        )
        
        print(f"📊 Response Status: {response.status_code}")
        print(f"⏰ Completed at: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        
        if response.status_code == 200:
            data = response.json()
            
            print("\n✅ Bulk fetch results:")
            print(f"   📈 Total bills fetched: {data.get('total_bills_fetched', 'N/A')}")
            print(f"   📊 States processed: {data.get('states_processed', 'N/A')}")
            
            # Check Texas specifically
            state_results = data.get('state_results', {})
            texas_result = state_results.get('Texas', {})
            if texas_result:
                bills_fetched = texas_result.get('bills_fetched', 0)
                print(f"   🏴 Texas bills fetched: {bills_fetched}")
                
                if bills_fetched > 1000:
                    print("   🎉 EXCELLENT! Bulk fetch is working with master list!")
                    
        else:
            print(f"\n❌ ERROR Response:")
            print(response.text)
            
    except Exception as e:
        print(f"\n❌ Error: {e}")

if __name__ == "__main__":
    print("🔧 TEXAS BILL FETCH TEST")
    print("Testing if the new master list approach works...")
    print()
    
    # Test the main Fetch button endpoint
    test_fetch_button()
    
    # Also test the bulk fetch for comparison
    test_bulk_fetch_endpoint()
    
    print("\n" + "=" * 60)
    print("📋 TEST SUMMARY:")
    print("• If bills_found > 1000: New method is working! 🎉")
    print("• If bills_found ≈ 723: Still using old method ❌")
    print("• Check server logs for 'master list' vs 'search' method used")
    print("=" * 60)