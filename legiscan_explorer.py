import requests
import json
from datetime import datetime
from typing import Dict, List, Any, Optional

class LegiScanSessionExplorer:
    """
    LegiScan API Session Explorer
    Helps you discover available sessions and pull legislative data
    """
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.legiscan.com/"
        self.session = requests.Session()
    
    def _make_request(self, operation: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        """Make an API request to LegiScan"""
        try:
            url_params = {
                'key': self.api_key,
                'op': operation
            }
            
            if params:
                url_params.update(params)
            
            print(f"🔍 Making LegiScan API request: {operation}")
            response = self.session.get(self.base_url, params=url_params)
            response.raise_for_status()
            
            data = response.json()
            
            if data.get('status') == "ERROR":
                error_msg = data.get('alert', {}).get('message', 'Unknown API error')
                raise Exception(f"LegiScan API Error: {error_msg}")
            
            return data
            
        except Exception as e:
            print(f"❌ Error making API request: {e}")
            raise
    
    def get_dataset_list(self, state: str = None, year: int = None) -> List[Dict]:
        """
        Get list of available datasets (sessions) for a state or year
        This shows you what sessions are available to pull data from
        """
        try:
            params = {}
            if state:
                params['state'] = state
            if year:
                params['year'] = year
            
            print(f"📋 Getting dataset list for state: {state}, year: {year}")
            response = self._make_request('getDatasetList', params)
            
            datasets = response.get('datasetlist', [])
            print(f"✅ Found {len(datasets)} datasets")
            
            # Pretty print the session information
            for i, dataset in enumerate(datasets):
                session_info = dataset.get('session', {})
                print(f"  {i+1}. Session ID: {dataset.get('session_id')}")
                print(f"     Name: {session_info.get('session_name', 'N/A')}")
                print(f"     Year: {session_info.get('year_start')}-{session_info.get('year_end')}")
                print(f"     Special: {'Yes' if session_info.get('special') else 'No'}")
                print(f"     Dataset Size: {dataset.get('dataset_size', 'N/A')} bytes")
                print(f"     Access Key: {dataset.get('access_key', 'N/A')}")
                print()
            
            return datasets
            
        except Exception as e:
            print(f"❌ Error getting dataset list: {e}")
            return []
    
    def get_session_list(self, state: str) -> List[Dict]:
        """
        Get list of sessions for a specific state
        This is another way to see what sessions are available
        """
        try:
            print(f"📋 Getting session list for {state}")
            response = self._make_request('getSessionList', {'state': state})
            
            sessions = response.get('sessions', [])
            print(f"✅ Found {len(sessions)} sessions for {state}")
            
            # Display session information
            for i, session in enumerate(sessions):
                print(f"  {i+1}. Session ID: {session.get('session_id')}")
                print(f"     Name: {session.get('session_name')}")
                print(f"     Title: {session.get('session_title')}")
                print(f"     Years: {session.get('year_start')}-{session.get('year_end')}")
                print(f"     Special: {'Yes' if session.get('special') else 'No'}")
                print()
            
            return sessions
            
        except Exception as e:
            print(f"❌ Error getting session list: {e}")
            return []
    
    def get_master_list(self, state: str = None, session_id: int = None) -> Dict[str, Any]:
        """
        Get master list of bills for current session (by state) or specific session (by ID)
        This shows you what bills are available in a session
        """
        try:
            params = {}
            if state:
                params['state'] = state
                print(f"📋 Getting master list for current session in {state}")
            elif session_id:
                params['id'] = session_id
                print(f"📋 Getting master list for session ID: {session_id}")
            else:
                raise ValueError("Must provide either state or session_id")
            
            response = self._make_request('getMasterList', params)
            
            master_list = response.get('masterlist', {})
            if not master_list:
                print("⚠️ No master list data found")
                return {}
            
            # Extract session info
            session = master_list.get('session', {})
            bills = master_list.get('bill', {})
            
            print(f"✅ Master List Retrieved")
            print(f"   Session: {session.get('session_name', 'Unknown')}")
            print(f"   Session ID: {session.get('session_id', 'Unknown')}")
            print(f"   State: {session.get('state_name', 'Unknown')} ({session.get('state', 'Unknown')})")
            print(f"   Years: {session.get('year_start')}-{session.get('year_end')}")
            print(f"   Bills Found: {len(bills)}")
            
            # Show sample of bills
            print(f"\n📄 Sample Bills:")
            for i, (bill_id, bill_data) in enumerate(list(bills.items())[:5]):
                print(f"  {i+1}. Bill ID: {bill_id}")
                print(f"     Number: {bill_data.get('bill_number')}")
                print(f"     Title: {bill_data.get('title', 'No title')[:80]}...")
                print(f"     Status: {bill_data.get('status_text', 'Unknown')}")
                print(f"     Last Action: {bill_data.get('last_action_date')}")
                print()
            
            return master_list
            
        except Exception as e:
            print(f"❌ Error getting master list: {e}")
            return {}
    
    def get_bill_details(self, bill_id: int) -> Dict[str, Any]:
        """Get detailed information for a specific bill"""
        try:
            print(f"📄 Getting bill details for ID: {bill_id}")
            response = self._make_request('getBill', {'id': bill_id})
            
            bill = response.get('bill', {})
            if not bill:
                print("⚠️ No bill data found")
                return {}
            
            # Display key bill information
            print(f"✅ Bill Details Retrieved")
            print(f"   Bill Number: {bill.get('bill_number')}")
            print(f"   Title: {bill.get('title')}")
            print(f"   Description: {bill.get('description', 'No description')[:100]}...")
            print(f"   Status: {bill.get('status_text')}")
            print(f"   State: {bill.get('state')}")
            
            session = bill.get('session', {})
            if session:
                print(f"   Session: {session.get('session_name')}")
                print(f"   Session Years: {session.get('year_start')}-{session.get('year_end')}")
            
            # Show sponsors
            sponsors = bill.get('sponsors', [])
            if sponsors:
                print(f"   Sponsors: {len(sponsors)} sponsor(s)")
                for sponsor in sponsors[:3]:  # Show first 3 sponsors
                    print(f"     - {sponsor.get('name')} ({sponsor.get('role')})")
            
            # Show history
            history = bill.get('history', [])
            if history:
                print(f"   Recent Actions: {len(history)} action(s)")
                for action in history[-3:]:  # Show last 3 actions
                    print(f"     - {action.get('date')}: {action.get('action')}")
            
            return bill
            
        except Exception as e:
            print(f"❌ Error getting bill details: {e}")
            return {}
    
    def search_bills(self, state: str, query: str = "", limit: int = 20) -> List[Dict]:
        """Search for bills in a state with optional query"""
        try:
            params = {
                'state': state,
                'query': query
            }
            
            print(f"🔍 Searching bills in {state} with query: '{query}'")
            response = self._make_request('search', params)
            
            search_results = response.get('searchresult', [])
            
            # Handle different response formats
            if isinstance(search_results, dict):
                # Extract bills from the results
                bills = []
                for key, value in search_results.items():
                    if key != 'summary' and isinstance(value, dict):
                        bills.append(value)
                search_results = bills
            
            print(f"✅ Found {len(search_results)} bills")
            
            # Show sample results
            for i, bill in enumerate(search_results[:limit]):
                print(f"  {i+1}. Bill: {bill.get('bill_number', 'Unknown')}")
                print(f"     Title: {bill.get('title', 'No title')[:60]}...")
                print(f"     Status: {bill.get('status_text', 'Unknown')}")
                print(f"     Relevance: {bill.get('relevance', 'N/A')}%")
                print()
            
            return search_results[:limit]
            
        except Exception as e:
            print(f"❌ Error searching bills: {e}")
            return []

# Example usage and testing functions
def explore_texas_sessions(api_key: str):
    """Example: Explore Texas legislative sessions"""
    print("=" * 60)
    print("🏛️  EXPLORING TEXAS LEGISLATIVE SESSIONS")
    print("=" * 60)
    
    explorer = LegiScanSessionExplorer(api_key)
    
    # 1. Get available datasets for Texas
    print("\n1️⃣ Getting available datasets for Texas...")
    datasets = explorer.get_dataset_list(state='TX')
    
    # 2. Get session list for Texas
    print("\n2️⃣ Getting session list for Texas...")
    sessions = explorer.get_session_list('TX')
    
    # 3. Get master list for current Texas session
    print("\n3️⃣ Getting master list for current Texas session...")
    master_list = explorer.get_master_list(state='TX')
    
    # 4. If we found bills, get details for the first one
    if master_list and 'bill' in master_list:
        bills = master_list['bill']
        if bills:
            first_bill_id = list(bills.keys())[0]
            print(f"\n4️⃣ Getting details for first bill (ID: {first_bill_id})...")
            bill_details = explorer.get_bill_details(int(first_bill_id))
    
    # 5. Search for bills about education
    print("\n5️⃣ Searching for education-related bills...")
    education_bills = explorer.search_bills('TX', 'education', limit=5)
    
    return {
        'datasets': datasets,
        'sessions': sessions,
        'master_list': master_list,
        'education_bills': education_bills
    }

def main():
    """Main function to test the API explorer"""
    # Replace with your actual API key
    API_KEY = "e3bd77ddffa618452dbe7e9bd3ea3a35"
    
    try:
        # Test with Texas
        texas_data = explore_texas_sessions(API_KEY)
        
        print("\n" + "=" * 60)
        print("✅ EXPLORATION COMPLETE!")
        print("=" * 60)
        print(f"📊 Summary:")
        print(f"   - Datasets found: {len(texas_data.get('datasets', []))}")
        print(f"   - Sessions found: {len(texas_data.get('sessions', []))}")
        print(f"   - Bills in current session: {len(texas_data.get('master_list', {}).get('bill', {}))}")
        print(f"   - Education bills found: {len(texas_data.get('education_bills', []))}")
        
    except Exception as e:
        print(f"❌ Error in main execution: {e}")

if __name__ == "__main__":
    main()