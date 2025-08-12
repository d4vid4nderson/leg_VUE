#!/usr/bin/env python3
"""
Quick test to verify the NEW method works via the V2 endpoint
"""

import requests
import json

def test_new_method():
    """Test the new V2 endpoint with improved method"""
    
    print("🧪 TESTING NEW METHOD - V2 Endpoint")
    print("=" * 50)
    
    url = "http://localhost:8000/api/legiscan/check-and-update-v2"
    payload = {"state": "TX"}
    
    print(f"📡 Calling: {url}")
    print(f"📋 Payload: {json.dumps(payload, indent=2)}")
    print("⏰ Starting...")
    print()
    
    try:
        response = requests.post(url, json=payload, timeout=60)
        
        print(f"📊 Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("\n✅ SUCCESS!")
            print(f"   Bills found: {data.get('bills_found', 'N/A')}")
            print(f"   Source method: {data.get('source_method', 'N/A')}")
            print(f"   Method used: {data.get('method_used', 'N/A')}")
            print(f"   Message: {data.get('message', 'N/A')}")
            
            bills_found = data.get('bills_found', 0)
            if bills_found > 1000:
                print(f"\n🎉 EXCELLENT! {bills_found} bills - NEW METHOD WORKING!")
            elif bills_found > 100:
                print(f"\n👍 GOOD! {bills_found} bills - Better than before!")
            else:
                print(f"\n⚠️ Only {bills_found} bills - May need investigation")
                
        else:
            print(f"❌ Error: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"❌ Exception: {e}")

if __name__ == "__main__":
    test_new_method()