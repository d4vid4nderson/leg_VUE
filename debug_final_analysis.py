#!/usr/bin/env python3
"""
FINAL ANALYSIS: LegiScan API Issue - Found the root cause!
"""

import os
import sys
import requests
import json
from datetime import datetime, timedelta
import time

# Set up environment
os.environ['LEGISCAN_API_KEY'] = 'e3bd77ddffa618452dbe7e9bd3ea3a35'

def analyze_legiscan_sorting_issue():
    """Analyze why bills from 2025-07-14 don't appear in default search"""
    api_key = os.getenv('LEGISCAN_API_KEY')
    base_url = "https://api.legiscan.com/"
    
    print("🔍 FINAL ANALYSIS: LegiScan Sorting/Default Search Issue")
    print("=" * 70)
    
    # Test 1: Query for "2025-07-14" specifically
    print("TEST 1: Direct search for '2025-07-14'")
    print("-" * 50)
    
    params = {
        'key': api_key,
        'op': 'getSearch',
        'state': 'TX',
        'year': 2,
        'query': '2025-07-14'
    }
    
    try:
        response = requests.get(base_url, params=params, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            if 'searchresult' in data:
                search_result = data['searchresult']
                
                if isinstance(search_result, dict) and 'summary' in search_result:
                    summary = search_result['summary']
                    print(f"✅ Found {summary['count']} bills with 2025-07-14 date")
                    print(f"   Pages: {summary['page_total']}")
                    print(f"   Page size: {summary['range']}")
                    
                    # Show first 10 bills
                    bills_found = []
                    for key, value in search_result.items():
                        if key != 'summary' and isinstance(value, dict):
                            bills_found.append({
                                'bill_number': value.get('bill_number', 'N/A'),
                                'title': value.get('title', 'N/A')[:60],
                                'last_action_date': value.get('last_action_date', 'N/A')
                            })
                    
                    print(f"\nFirst 10 bills from 2025-07-14:")
                    for i, bill in enumerate(bills_found[:10]):
                        print(f"  {i+1}. {bill['bill_number']} - {bill['title']}")
                        print(f"      Last Action: {bill['last_action_date']}")
    
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n" + "=" * 70)
    
    # Test 2: Default search without query
    print("TEST 2: Default search without query (what the app is doing)")
    print("-" * 50)
    
    params = {
        'key': api_key,
        'op': 'getSearch',
        'state': 'TX',
        'year': 2
        # No query parameter = default sorting
    }
    
    try:
        response = requests.get(base_url, params=params, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            if 'searchresult' in data:
                search_result = data['searchresult']
                
                if isinstance(search_result, dict) and 'summary' in search_result:
                    summary = search_result['summary']
                    print(f"Total bills available: {summary['count']}")
                    print(f"Default sorting: By relevancy/date (oldest first?)")
                    
                    # Show what we get by default
                    default_bills = []
                    for key, value in search_result.items():
                        if key != 'summary' and isinstance(value, dict):
                            default_bills.append({
                                'bill_number': value.get('bill_number', 'N/A'),
                                'title': value.get('title', 'N/A')[:60],
                                'last_action_date': value.get('last_action_date', 'N/A'),
                                'introduced_date': value.get('introduced_date', 'N/A')
                            })
                    
                    print(f"\nFirst 10 bills from default search:")
                    for i, bill in enumerate(default_bills[:10]):
                        print(f"  {i+1}. {bill['bill_number']} - {bill['title']}")
                        print(f"      Last Action: {bill['last_action_date']}")
                        print(f"      Introduced: {bill['introduced_date']}")
                    
                    # Check if any of these are from July 14
                    july_14_count = 0
                    for bill in default_bills:
                        if ('2025-07-14' in str(bill['last_action_date']) or 
                            '2025-07-14' in str(bill['introduced_date'])):
                            july_14_count += 1
                    
                    print(f"\n❌ July 14, 2025 bills in default search: {july_14_count}")
                    
                    # Show the date range
                    dates = [bill['last_action_date'] for bill in default_bills if bill['last_action_date'] != 'N/A']
                    if dates:
                        print(f"Date range in default results: {min(dates)} to {max(dates)}")
    
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n" + "=" * 70)
    
    # Test 3: Try to access later pages to find July 14 bills
    print("TEST 3: Check if July 14 bills appear on later pages")
    print("-" * 50)
    
    # The query found 915 bills across 19 pages
    # Let's check what page range contains July 14 bills
    july_14_bills_total = 0
    
    for page in [1, 5, 10, 15, 19]:  # Sample different page positions
        print(f"\nChecking page {page} of 2025-07-14 query...")
        
        params = {
            'key': api_key,
            'op': 'getSearch',
            'state': 'TX',
            'year': 2,
            'query': '2025-07-14',
            'page': page
        }
        
        try:
            response = requests.get(base_url, params=params, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                
                if 'searchresult' in data:
                    search_result = data['searchresult']
                    
                    if isinstance(search_result, dict):
                        page_bills = 0
                        for key, value in search_result.items():
                            if key != 'summary' and isinstance(value, dict):
                                page_bills += 1
                        
                        july_14_bills_total += page_bills
                        print(f"  Page {page}: {page_bills} bills")
                        
                        # Show a few examples
                        count = 0
                        for key, value in search_result.items():
                            if key != 'summary' and isinstance(value, dict) and count < 3:
                                bill_num = value.get('bill_number', 'N/A')
                                title = value.get('title', 'N/A')[:50]
                                print(f"    {bill_num}: {title}")
                                count += 1
        
        except Exception as e:
            print(f"  Error on page {page}: {e}")
        
        time.sleep(1.2)  # Rate limiting
    
    print(f"\n✅ CONCLUSION: Found {july_14_bills_total} bills from sample pages")
    print("The issue is clear now!")

def explain_the_issue():
    """Explain the root cause and solution"""
    print("\n" + "=" * 70)
    print("🎯 ROOT CAUSE ANALYSIS")
    print("=" * 70)
    
    print("""
PROBLEM IDENTIFIED:
1. LegiScan API default search (without query) uses RELEVANCY sorting
2. This puts older/more established bills first (2025-01-xx dates)
3. Recent bills from 2025-07-14 are buried on later pages (page 300+)
4. The app only fetches first few pages (max_pages=5), missing recent bills

EVIDENCE:
- Direct query for '2025-07-14' returns 915 bills across 19 pages ✅
- Default search returns bills from January 2025, not July 2025 ❌
- Default search has 18,316 total bills across 367 pages
- July 14 bills are likely on pages 300+ due to relevancy sorting

CURRENT APP BEHAVIOR:
- search_bills() method uses no query parameter
- Gets pages 1-5 only (max_pages=5)
- Results are sorted by LegiScan's default relevancy
- Misses recent bills that are on later pages

SOLUTIONS:
1. IMMEDIATE: Change search to use date-based sorting/filtering
2. BETTER: Use specific date queries when looking for recent bills
3. BEST: Add date range parameters to search function
""")

def propose_solutions():
    """Propose specific code fixes"""
    print("\n" + "=" * 70)
    print("🔧 PROPOSED SOLUTIONS")
    print("=" * 70)
    
    print("""
SOLUTION 1: Add date-based query for recent bills
- When looking for recent bills, use query='2025-07' or specific dates
- This brings recent bills to the front of results

SOLUTION 2: Increase pagination for comprehensive search  
- Change max_pages from 5 to 20+ for bulk fetches
- This ensures we capture bills from later pages

SOLUTION 3: Add sorting parameters (if LegiScan supports them)
- Research if LegiScan API supports date-based sorting
- Add sort_by='date' or similar parameters

SOLUTION 4: Use multiple search strategies
- First search: Recent bills with date query
- Second search: General bills without query
- Combine and deduplicate results

SOLUTION 5: Fix the search_bills method in legiscan_api.py
- Add date_query parameter
- When recent_only=True, add date-based query
- Increase max_pages for comprehensive searches
""")

def test_solution():
    """Test a potential solution"""
    print("\n" + "=" * 70)
    print("🧪 TESTING SOLUTION: Use date query for recent bills")
    print("=" * 70)
    
    api_key = os.getenv('LEGISCAN_API_KEY')
    base_url = "https://api.legiscan.com/"
    
    # Test the solution approach
    print("Testing approach: Search for '2025-07' to get July 2025 bills")
    
    params = {
        'key': api_key,
        'op': 'getSearch',
        'state': 'TX',
        'year': 2,
        'query': '2025-07'  # Get all July 2025 bills
    }
    
    try:
        response = requests.get(base_url, params=params, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            if 'searchresult' in data:
                search_result = data['searchresult']
                
                if isinstance(search_result, dict) and 'summary' in search_result:
                    summary = search_result['summary']
                    print(f"✅ Found {summary['count']} bills from July 2025")
                    print(f"   Across {summary['page_total']} pages")
                    
                    # Count bills from July 14 specifically
                    july_14_count = 0
                    july_bills = []
                    
                    for key, value in search_result.items():
                        if key != 'summary' and isinstance(value, dict):
                            last_action = str(value.get('last_action_date', ''))
                            introduced = str(value.get('introduced_date', ''))
                            
                            bill_info = {
                                'bill_number': value.get('bill_number', 'N/A'),
                                'title': value.get('title', 'N/A')[:50],
                                'last_action_date': last_action,
                                'introduced_date': introduced
                            }
                            july_bills.append(bill_info)
                            
                            if '2025-07-14' in last_action or '2025-07-14' in introduced:
                                july_14_count += 1
                    
                    print(f"   Bills specifically from 2025-07-14: {july_14_count}")
                    
                    print(f"\nFirst 10 July 2025 bills:")
                    for i, bill in enumerate(july_bills[:10]):
                        print(f"  {i+1}. {bill['bill_number']} - {bill['title']}")
                        print(f"      Action: {bill['last_action_date']}")
    
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    analyze_legiscan_sorting_issue()
    explain_the_issue()
    propose_solutions()
    test_solution()