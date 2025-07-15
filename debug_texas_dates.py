#!/usr/bin/env python3
"""
DEBUG SCRIPT: Search for specific recent Texas bills and analyze date patterns
"""

import os
import sys
import requests
import json
from datetime import datetime, timedelta
import time

# Set up environment
os.environ['LEGISCAN_API_KEY'] = 'e3bd77ddffa618452dbe7e9bd3ea3a35'

def search_specific_texas_bills():
    """Search for specific recent Texas bills and date patterns"""
    api_key = os.getenv('LEGISCAN_API_KEY')
    base_url = "https://api.legiscan.com/"
    
    print("🔍 SEARCHING FOR RECENT TEXAS BILLS")
    print("=" * 60)
    
    # Test searching by specific queries
    queries_to_test = [
        None,  # No query - get all bills
        "HB34",  # The specific bill that's showing up
        "2025-07-14",  # Search for the date
        "July 14",  # Alternative date format
        "filed"  # Search for recently filed bills
    ]
    
    for query in queries_to_test:
        print(f"\nTesting query: {query or 'None (all bills)'}")
        print("-" * 40)
        
        params = {
            'key': api_key,
            'op': 'getSearch',
            'state': 'TX',
            'year': 2  # Current year
        }
        
        if query:
            params['query'] = query
        
        try:
            response = requests.get(base_url, params=params, timeout=30)
            print(f"URL: {response.url}")
            
            if response.status_code == 200:
                data = response.json()
                
                if 'searchresult' in data:
                    search_result = data['searchresult']
                    
                    if isinstance(search_result, dict) and 'summary' in search_result:
                        summary = search_result['summary']
                        print(f"Summary: {summary}")
                        
                        # Look for recent bills
                        recent_bills = []
                        july_bills = []
                        
                        for key, value in search_result.items():
                            if key != 'summary' and isinstance(value, dict):
                                bill_num = value.get('bill_number', 'N/A')
                                intro_date = value.get('introduced_date', '')
                                last_action = value.get('last_action_date', '')
                                title = value.get('title', 'N/A')
                                
                                # Check for July 2025 dates
                                if intro_date and '2025-07' in str(intro_date):
                                    july_bills.append({
                                        'bill_number': bill_num,
                                        'title': title[:50],
                                        'introduced_date': intro_date,
                                        'last_action_date': last_action
                                    })
                                
                                if last_action and '2025-07' in str(last_action):
                                    july_bills.append({
                                        'bill_number': bill_num,
                                        'title': title[:50],
                                        'introduced_date': intro_date,
                                        'last_action_date': last_action
                                    })
                        
                        print(f"Bills with July 2025 dates: {len(july_bills)}")
                        
                        if july_bills:
                            print("July 2025 bills found:")
                            for bill in july_bills[:10]:  # Show first 10
                                print(f"  {bill['bill_number']} - {bill['title']}")
                                print(f"    Intro: {bill['introduced_date']}")
                                print(f"    Action: {bill['last_action_date']}")
                    
                    elif isinstance(search_result, list):
                        print(f"Got list with {len(search_result)} results")
                    else:
                        print("Unexpected search result format")
                        print(f"Type: {type(search_result)}")
                        if hasattr(search_result, 'keys'):
                            print(f"Keys: {list(search_result.keys())}")
                else:
                    print("No searchresult in response")
                    print(f"Response keys: {list(data.keys())}")
            else:
                print(f"HTTP Error: {response.status_code}")
                
        except Exception as e:
            print(f"Error: {e}")
        
        time.sleep(1.2)  # Rate limiting
    
    # Test pagination to find more recent bills
    print(f"\n" + "=" * 60)
    print("TESTING PAGINATION FOR RECENT BILLS")
    print("=" * 60)
    
    all_recent_bills = []
    
    # Search through multiple pages for recent bills
    for page in range(1, 11):  # Check first 10 pages
        print(f"\nChecking page {page}...")
        
        params = {
            'key': api_key,
            'op': 'getSearch',
            'state': 'TX',
            'year': 2,  # Current year
            'page': page
        }
        
        try:
            response = requests.get(base_url, params=params, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                
                if 'searchresult' in data:
                    search_result = data['searchresult']
                    
                    if isinstance(search_result, dict):
                        # Look for bills from July 2025
                        page_july_bills = 0
                        page_recent_bills = []
                        
                        for key, value in search_result.items():
                            if key != 'summary' and isinstance(value, dict):
                                bill_num = value.get('bill_number', 'N/A')
                                intro_date = str(value.get('introduced_date', ''))
                                last_action = str(value.get('last_action_date', ''))
                                
                                # Check for July 2025 dates
                                if '2025-07' in intro_date or '2025-07' in last_action:
                                    page_july_bills += 1
                                    page_recent_bills.append({
                                        'bill_number': bill_num,
                                        'introduced_date': intro_date,
                                        'last_action_date': last_action,
                                        'title': value.get('title', 'N/A')[:50]
                                    })
                        
                        print(f"  Page {page}: {page_july_bills} July 2025 bills")
                        
                        if page_recent_bills:
                            all_recent_bills.extend(page_recent_bills)
                            
                            # Show some examples
                            for bill in page_recent_bills[:3]:
                                print(f"    {bill['bill_number']}: {bill['title']}")
                                print(f"      Intro: {bill['introduced_date']}")
                                print(f"      Action: {bill['last_action_date']}")
                        
                        # If no July bills on this page, continue to next
                        if page_july_bills == 0 and page > 5:
                            print(f"  No July 2025 bills found on page {page}, stopping search")
                            break
                    else:
                        print(f"  Page {page}: No results")
                        break
                else:
                    print(f"  Page {page}: No searchresult field")
                    break
            else:
                print(f"  Page {page}: HTTP Error {response.status_code}")
                break
                
        except Exception as e:
            print(f"  Page {page}: Error - {e}")
            break
        
        time.sleep(1.2)  # Rate limiting
    
    print(f"\n" + "=" * 60)
    print("SUMMARY OF FINDINGS")
    print("=" * 60)
    print(f"Total July 2025 bills found across all pages: {len(all_recent_bills)}")
    
    if all_recent_bills:
        print("\nAll July 2025 bills found:")
        for bill in all_recent_bills:
            print(f"  {bill['bill_number']} - {bill['title']}")
            print(f"    Intro: {bill['introduced_date']}")
            print(f"    Action: {bill['last_action_date']}")
        
        # Look specifically for 2025-07-14
        july_14_bills = [b for b in all_recent_bills if '2025-07-14' in b['introduced_date'] or '2025-07-14' in b['last_action_date']]
        print(f"\nBills specifically from 2025-07-14: {len(july_14_bills)}")
        
        for bill in july_14_bills:
            print(f"  {bill['bill_number']} - {bill['title']}")
            print(f"    Intro: {bill['introduced_date']}")
            print(f"    Action: {bill['last_action_date']}")
    else:
        print("❌ No July 2025 bills found in LegiScan")
        print("This suggests the issue might be:")
        print("1. LegiScan data lag - recent bills not yet indexed")
        print("2. Texas legislative session timing")
        print("3. Different date field usage by LegiScan")
        print("4. Bills might be in a different status/category")

def check_texas_sessions():
    """Check Texas legislative sessions"""
    api_key = os.getenv('LEGISCAN_API_KEY')
    base_url = "https://api.legiscan.com/"
    
    print(f"\n" + "=" * 60)
    print("CHECKING TEXAS LEGISLATIVE SESSIONS")
    print("=" * 60)
    
    params = {
        'key': api_key,
        'op': 'getSessionList',
        'state': 'TX'
    }
    
    try:
        response = requests.get(base_url, params=params, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            if 'sessions' in data:
                sessions = data['sessions']
                print(f"Found {len(sessions)} Texas legislative sessions")
                
                # Look for current/recent sessions
                current_sessions = []
                for session_id, session_info in sessions.items():
                    if isinstance(session_info, dict):
                        session_name = session_info.get('session_name', 'N/A')
                        year_start = session_info.get('year_start', 0)
                        year_end = session_info.get('year_end', 0)
                        
                        if year_start >= 2024 or year_end >= 2024:
                            current_sessions.append({
                                'id': session_id,
                                'name': session_name,
                                'year_start': year_start,
                                'year_end': year_end
                            })
                
                print(f"\nCurrent/Recent sessions (2024+):")
                for session in sorted(current_sessions, key=lambda x: x['year_start'], reverse=True):
                    print(f"  {session['id']}: {session['name']} ({session['year_start']}-{session['year_end']})")
                
                # Check if there's a specific session for 2025
                session_2025 = [s for s in current_sessions if s['year_start'] == 2025 or s['year_end'] == 2025]
                if session_2025:
                    print(f"\n2025 sessions found: {len(session_2025)}")
                    for session in session_2025:
                        print(f"  {session['name']}")
                else:
                    print("\n❌ No 2025 legislative session found")
                    print("This might explain why recent 2025 bills are not appearing")
            else:
                print("No sessions found in response")
                print(f"Response keys: {list(data.keys())}")
        else:
            print(f"HTTP Error: {response.status_code}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    search_specific_texas_bills()
    check_texas_sessions()