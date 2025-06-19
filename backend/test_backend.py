#!/usr/bin/env python3
"""
Integration test script for your FastAPI backend
Run this after adding the endpoints to verify everything works
"""

import requests
import json
import time
from typing import Dict

BACKEND_URL = "http://localhost:8000"

def test_endpoint(method: str, endpoint: str, data=None, params=None):
    """Test a single endpoint and return results"""
    url = f"{BACKEND_URL}{endpoint}"
    
    try:
        print(f"\n🔍 Testing {method.upper()} {endpoint}")
        if params:
            print(f"   Parameters: {params}")
        
        if method.upper() == "GET":
            response = requests.get(url, params=params, timeout=30)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, timeout=30)
        else:
            return {"error": f"Unsupported method: {method}"}
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            try:
                result = response.json()
                if isinstance(result, dict):
                    print(f"   ✅ Success - Response keys: {list(result.keys())}")
                    if 'count' in result:
                        print(f"   📊 Count: {result['count']}")
                    if 'results' in result and isinstance(result['results'], list):
                        print(f"   📋 Results: {len(result['results'])} items")
                else:
                    print(f"   ✅ Success - Response length: {len(str(result))}")
                return {"success": True, "data": result}
            except json.JSONDecodeError:
                print(f"   ✅ Success - Non-JSON response")
                return {"success": True, "data": response.text}
        elif response.status_code == 404:
            print(f"   ❌ 404 Not Found - Endpoint missing!")
            return {"success": False, "error": "Endpoint not found"}
        else:
            print(f"   ❌ Error {response.status_code}: {response.text[:100]}")
            return {"success": False, "error": response.text}
            
    except requests.exceptions.ConnectionError:
        print(f"   ❌ Connection Error - Is your backend running on {BACKEND_URL}?")
        return {"success": False, "error": "Connection refused"}
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return {"success": False, "error": str(e)}

def main():
    """Run comprehensive backend integration tests"""
    print("🚀 BACKEND INTEGRATION TEST")
    print("=" * 50)
    print(f"Testing backend at: {BACKEND_URL}")
    
    tests = []
    
    # 1. Test root endpoint
    result = test_endpoint("GET", "/")
    tests.append(("Root endpoint", result["success"]))
    
    # 2. Test the missing endpoint that causes 404 (THE CRITICAL ONE)
    result = test_endpoint("GET", "/api/state-legislation")
    tests.append(("State legislation (no params)", result["success"]))
    
    # 3. Test with CA parameter
    result = test_endpoint("GET", "/api/state-legislation", params={"state": "CA"})
    tests.append(("State legislation (CA)", result["success"]))
    
    # 4. Test with California parameter  
    result = test_endpoint("GET", "/api/state-legislation", params={"state": "California"})
    tests.append(("State legislation (California)", result["success"]))
    
    # 5. Test database connection
    result = test_endpoint("GET", "/api/test-database")
    tests.append(("Database test", result["success"]))
    
    # 6. Test LegiScan API
    result = test_endpoint("GET", "/api/test-legiscan")
    tests.append(("LegiScan API test", result["success"]))
    
    # 7. Test stats endpoint
    result = test_endpoint("GET", "/api/state-legislation/stats")
    tests.append(("Statistics", result["success"]))
    
    # 8. Test debug endpoint
    result = test_endpoint("GET", "/api/debug/state-legislation", params={"state": "CA"})
    tests.append(("Debug endpoint", result["success"]))
    
    # 9. Test search and analyze (if LegiScan is working)
    search_data = {
        "state": "CA",
        "query": "healthcare", 
        "limit": 5,
        "save_to_db": False  # Don't save during test
    }
    result = test_endpoint("POST", "/api/legiscan/search-and-analyze", data=search_data)
    tests.append(("Search and analyze", result["success"]))
    
    # Print summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    passed = sum(1 for _, success in tests if success)
    total = len(tests)
    
    for test_name, success in tests:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
    
    print(f"\n🎯 RESULTS: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        print("Your backend is fully integrated and working correctly.")
        print("\n📋 Next steps:")
        print("1. Your React frontend should now work without 404 errors")
        print("2. Try accessing California legislation in your app")
        print("3. Test the fetch functionality with different topics")
        
    elif passed >= 6:  # Most critical tests passed
        print(f"\n✅ MOSTLY WORKING ({passed}/{total} passed)")
        print("Your backend is working for the core functionality.")
        print("The 404 error should be fixed!")
        
    else:
        print(f"\n⚠️ NEEDS ATTENTION ({passed}/{total} passed)")
        print("\n🔧 TROUBLESHOOTING:")
        print("1. Make sure you added all the endpoints to your FastAPI app")
        print("2. Check that your imports are correct")
        print("3. Verify your database model matches the code")
        print("4. Ensure your LegiScan API key is set in .env")
        print("5. Restart your FastAPI server completely")
        
    print(f"\n📍 FastAPI docs: {BACKEND_URL}/docs")
    print(f"📍 Main endpoint: {BACKEND_URL}/api/state-legislation?state=CA")

if __name__ == "__main__":
    main()