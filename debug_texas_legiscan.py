#!/usr/bin/env python3
"""
DEBUG SCRIPT: Test LegiScan API for Texas bills filed on 2025-07-14
This script will help identify why only 1 bill (HB34) is being returned instead of 47+ bills
"""

import os
import sys
import requests
import json
from datetime import datetime, timedelta
import time

# Set up environment
os.environ['LEGISCAN_API_KEY'] = 'e3bd77ddffa618452dbe7e9bd3ea3a35'

# Add current directory to path
sys.path.insert(0, '/Users/david.anderson/Downloads/PoliticalVue/backend')

def test_raw_legiscan_api():
    """Test raw LegiScan API calls directly"""
    api_key = os.getenv('LEGISCAN_API_KEY')
    base_url = "https://api.legiscan.com/"
    
    print("🔍 TESTING RAW LEGISCAN API CALLS FOR TEXAS")
    print("=" * 60)
    print(f"API Key: {api_key[:8]}...")
    print(f"Base URL: {base_url}")
    print()
    
    # Test 1: Basic getSearch without any filters
    print("TEST 1: Basic getSearch for Texas without any filters")
    print("-" * 50)
    
    params = {
        'key': api_key,
        'op': 'getSearch',
        'state': 'TX'
    }
    
    try:
        response = requests.get(base_url, params=params, timeout=30)
        print(f"URL: {response.url}")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response status: {data.get('status')}")
            
            if 'searchresult' in data:
                search_result = data['searchresult']
                print(f"Search result type: {type(search_result)}")
                
                if isinstance(search_result, dict) and 'summary' in search_result:
                    summary = search_result['summary']
                    print(f"Summary: {summary}")
                    
                    # Count actual results
                    result_count = 0
                    for key, value in search_result.items():
                        if key != 'summary' and isinstance(value, dict):
                            result_count += 1
                    
                    print(f"Actual results found: {result_count}")
                    
                    # Show first few results
                    print("\nFirst 5 results:")
                    count = 0
                    for key, value in search_result.items():
                        if key != 'summary' and isinstance(value, dict) and count < 5:
                            bill_num = value.get('bill_number', 'N/A')
                            title = value.get('title', 'N/A')
                            intro_date = value.get('introduced_date', 'N/A')
                            last_action = value.get('last_action_date', 'N/A')
                            print(f"  {count+1}. {bill_num} - {title[:50]}...")
                            print(f"     Introduced: {intro_date}, Last Action: {last_action}")
                            count += 1
                
                elif isinstance(search_result, list):
                    print(f"Results list length: {len(search_result)}")
                else:
                    print(f"Unexpected search result format: {search_result}")
            else:
                print("No 'searchresult' field in response")
                print(f"Response keys: {list(data.keys())}")
        else:
            print(f"HTTP Error: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n" + "=" * 60)
    
    # Test 2: Search with year=1 (all years)
    print("TEST 2: getSearch with year=1 (all years)")
    print("-" * 50)
    
    params = {
        'key': api_key,
        'op': 'getSearch',
        'state': 'TX',
        'year': 1
    }
    
    try:
        response = requests.get(base_url, params=params, timeout=30)
        print(f"URL: {response.url}")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response status: {data.get('status')}")
            
            if 'searchresult' in data:
                search_result = data['searchresult']
                
                if isinstance(search_result, dict) and 'summary' in search_result:
                    summary = search_result['summary']
                    print(f"Summary: {summary}")
                    
                    # Count actual results
                    result_count = 0
                    for key, value in search_result.items():
                        if key != 'summary' and isinstance(value, dict):
                            result_count += 1
                    
                    print(f"Actual results found: {result_count}")
            
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n" + "=" * 60)
    
    # Test 3: Search with year=2 (current year only)
    print("TEST 3: getSearch with year=2 (current year 2025)")
    print("-" * 50)
    
    params = {
        'key': api_key,
        'op': 'getSearch',
        'state': 'TX',
        'year': 2
    }
    
    try:
        response = requests.get(base_url, params=params, timeout=30)
        print(f"URL: {response.url}")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response status: {data.get('status')}")
            
            if 'searchresult' in data:
                search_result = data['searchresult']
                
                if isinstance(search_result, dict) and 'summary' in search_result:
                    summary = search_result['summary']
                    print(f"Summary: {summary}")
                    
                    # Count actual results and look for recent dates
                    result_count = 0
                    recent_bills = []
                    
                    for key, value in search_result.items():
                        if key != 'summary' and isinstance(value, dict):
                            result_count += 1
                            
                            # Check dates
                            intro_date = value.get('introduced_date', '')
                            last_action = value.get('last_action_date', '')
                            bill_num = value.get('bill_number', 'N/A')
                            
                            # Look for 2025-07-14 or recent dates
                            if '2025-07-14' in intro_date or '2025-07-14' in last_action:
                                recent_bills.append({
                                    'bill_number': bill_num,
                                    'introduced_date': intro_date,
                                    'last_action_date': last_action,
                                    'title': value.get('title', 'N/A')[:50]
                                })
                    
                    print(f"Actual results found: {result_count}")
                    print(f"Bills with 2025-07-14 dates: {len(recent_bills)}")
                    
                    if recent_bills:
                        print("\nBills with 2025-07-14 dates:")
                        for bill in recent_bills[:10]:  # Show first 10
                            print(f"  {bill['bill_number']} - {bill['title']}")
                            print(f"    Intro: {bill['introduced_date']}, Action: {bill['last_action_date']}")
            
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n" + "=" * 60)
    
    # Test 4: Search with pagination
    print("TEST 4: getSearch with pagination (pages 1-3)")
    print("-" * 50)
    
    all_bills = []
    
    for page in range(1, 4):
        print(f"\nPage {page}:")
        
        params = {
            'key': api_key,
            'op': 'getSearch',
            'state': 'TX',
            'year': 2,  # Current year
            'page': page
        }
        
        try:
            response = requests.get(base_url, params=params, timeout=30)
            print(f"  URL: {response.url}")
            print(f"  Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"  Response status: {data.get('status')}")
                
                if 'searchresult' in data:
                    search_result = data['searchresult']
                    
                    if isinstance(search_result, dict) and 'summary' in search_result:
                        if page == 1:
                            summary = search_result['summary']
                            print(f"  Summary: {summary}")
                        
                        # Count results on this page
                        page_count = 0
                        for key, value in search_result.items():
                            if key != 'summary' and isinstance(value, dict):
                                page_count += 1
                                all_bills.append(value)
                        
                        print(f"  Results on page {page}: {page_count}")
                    else:
                        print(f"  No results on page {page}")
                        break
                else:
                    print(f"  No searchresult field on page {page}")
                    break
            else:
                print(f"  HTTP Error on page {page}: {response.status_code}")
                break
        
        except Exception as e:
            print(f"  Error on page {page}: {e}")
            break
        
        # Rate limiting
        time.sleep(1.1)
    
    print(f"\nTotal bills collected from all pages: {len(all_bills)}")
    
    # Look for bills from 2025-07-14
    july_14_bills = []
    for bill in all_bills:
        intro_date = bill.get('introduced_date', '')
        last_action = bill.get('last_action_date', '')
        
        if '2025-07-14' in intro_date or '2025-07-14' in last_action:
            july_14_bills.append(bill)
    
    print(f"Bills with 2025-07-14 dates: {len(july_14_bills)}")
    
    if july_14_bills:
        print("\nBills from 2025-07-14:")
        for bill in july_14_bills:
            bill_num = bill.get('bill_number', 'N/A')
            title = bill.get('title', 'N/A')[:50]
            intro_date = bill.get('introduced_date', '')
            last_action = bill.get('last_action_date', '')
            print(f"  {bill_num} - {title}")
            print(f"    Intro: {intro_date}, Action: {last_action}")

def test_legiscan_api_class():
    """Test using the LegiScan API class"""
    print("\n" + "=" * 60)
    print("TESTING LEGISCAN API CLASS")
    print("=" * 60)
    
    try:
        from legiscan_api import LegiScanAPI
        
        api = LegiScanAPI()
        print("✅ LegiScan API class initialized")
        
        # Test search_bills method with different parameters
        print("\nTesting search_bills method:")
        
        # Test with year_filter='all'
        print("\n1. Testing with year_filter='all'")
        result = api.search_bills('TX', query=None, limit=100, year_filter='all', max_pages=3)
        print(f"   Success: {result.get('success')}")
        print(f"   Bills found: {len(result.get('bills', []))}")
        print(f"   Total available: {result.get('total_found', 'N/A')}")
        
        if result.get('bills'):
            bills = result['bills']
            print(f"   Sample bill dates:")
            for i, bill in enumerate(bills[:5]):
                intro_date = bill.get('introduced_date', 'N/A')
                last_action = bill.get('last_action_date', 'N/A')
                bill_num = bill.get('bill_number', 'N/A')
                print(f"     {bill_num}: Intro={intro_date}, Action={last_action}")
        
        # Test with year_filter='current'
        print("\n2. Testing with year_filter='current'")
        result = api.search_bills('TX', query=None, limit=100, year_filter='current', max_pages=3)
        print(f"   Success: {result.get('success')}")
        print(f"   Bills found: {len(result.get('bills', []))}")
        print(f"   Total available: {result.get('total_found', 'N/A')}")
        
        if result.get('bills'):
            bills = result['bills']
            july_14_count = 0
            for bill in bills:
                intro_date = bill.get('introduced_date', '')
                last_action = bill.get('last_action_date', '')
                if '2025-07-14' in intro_date or '2025-07-14' in last_action:
                    july_14_count += 1
            
            print(f"   Bills with 2025-07-14 dates: {july_14_count}")
        
    except Exception as e:
        print(f"❌ Error testing LegiScan API class: {e}")
        import traceback
        traceback.print_exc()

def analyze_legiscan_parameters():
    """Analyze what parameters might be restricting results"""
    print("\n" + "=" * 60)
    print("PARAMETER ANALYSIS")
    print("=" * 60)
    
    print("LegiScan API getSearch parameters used in the code:")
    print("- op: 'getSearch'")
    print("- state: 'TX'")
    print("- page: 1, 2, 3, ... (pagination)")
    print("- year: 1 (all years) or 2 (current year)")
    print("- query: None (no search query)")
    print()
    
    print("Potential issues:")
    print("1. Year parameter restriction")
    print("   - year=2 might be limiting to current year only")
    print("   - Texas legislature might have specific session timing")
    print()
    
    print("2. Pagination limits")
    print("   - LegiScan might paginate results")
    print("   - Default page size might be small")
    print()
    
    print("3. API rate limiting")
    print("   - 1 request per second limit")
    print("   - May affect result completeness")
    print()
    
    print("4. Session-based filtering")
    print("   - Bills might be organized by legislative session")
    print("   - Current session might not include all recent bills")
    print()
    
    print("5. Date-based filtering")
    print("   - LegiScan might filter by session dates, not calendar dates")
    print("   - 'introduced_date' vs 'last_action_date' differences")

if __name__ == "__main__":
    print("🧪 DEBUGGING TEXAS LEGISCAN API ISSUE")
    print("Looking for why only 1 bill (HB34) returns instead of 47+ bills")
    print("Expected: Bills filed on 2025-07-14 in Texas")
    print()
    
    # Run all tests
    test_raw_legiscan_api()
    test_legiscan_api_class()
    analyze_legiscan_parameters()
    
    print("\n" + "=" * 60)
    print("DEBUGGING COMPLETE")
    print("Check the output above to identify the root cause")
    print("=" * 60)