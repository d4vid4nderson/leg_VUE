# legiscan_api.py - The ACTUAL LegiScan API class with Real AI Integration

import os
import requests
import json
import time
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from urllib.parse import urlencode

class LegiScanAPI:
    """Complete LegiScan API integration class with real AI analysis"""
    
    def __init__(self):
        # Get API key from environment
        self.api_key = os.getenv('LEGISCAN_API_KEY')
        if not self.api_key:
            raise ValueError("LEGISCAN_API_KEY environment variable not set")
        
        self.base_url = "https://api.legiscan.com/"
        self.session = requests.Session()
        self.rate_limit_delay = 1.1  # Slightly over 1 second to be safe
        self.last_request_time = 0
        
        # State abbreviation mapping
        self.state_mapping = {
            'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
            'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
            'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
            'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
            'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
            'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
            'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
            'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
            'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
            'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
            'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
            'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
            'Wisconsin': 'WI', 'Wyoming': 'WY'
        }
        
        print(f"✅ LegiScan API initialized with key: {self.api_key[:8]}...")
    
    def _rate_limit(self):
        """Enforce rate limiting to respect LegiScan's 1 request per second limit"""
        current_time = time.time()
        time_since_last = current_time - self.last_request_time
        if time_since_last < self.rate_limit_delay:
            sleep_time = self.rate_limit_delay - time_since_last
            print(f"⏱️ Rate limiting: sleeping for {sleep_time:.2f} seconds")
            time.sleep(sleep_time)
        self.last_request_time = time.time()
    
    def _make_request(self, endpoint: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        """Make API request with rate limiting and error handling"""
        self._rate_limit()
        
        if params is None:
            params = {}
        
        params['key'] = self.api_key
        
        try:
            print(f"🔍 Making LegiScan API request to: {endpoint}")
            print(f"   Parameters: {[k for k in params.keys() if k != 'key']}")
            
            # Debug parameter values (excluding API key)
            debug_params = {k: v for k, v in params.items() if k != 'key'}
            print(f"   Parameter values: {debug_params}")
            
            response = self.session.get(f"{self.base_url}{endpoint}", params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            if data.get('status') == 'ERROR':
                error_msg = data.get('alert', 'Unknown error')
                print(f"❌ LegiScan API Error: {error_msg}")
                raise Exception(f"LegiScan API Error: {error_msg}")
            
            print(f"✅ LegiScan API request successful")
            
            # Debug response structure
            if isinstance(data, dict):
                print(f"📂 Response top-level keys: {list(data.keys())}")
                if 'searchresult' in data:
                    searchresult = data['searchresult']
                    if isinstance(searchresult, dict):
                        print(f"🔍 Searchresult keys: {list(searchresult.keys())}")
                        if 'summary' in searchresult:
                            print(f"📈 Summary: {searchresult['summary']}")
            else:
                print(f"⚠️ Response is not a dict: {type(data)}")
            
            return data
            
        except requests.exceptions.RequestException as e:
            print(f"❌ LegiScan HTTP request failed: {str(e)}")
            raise Exception(f"HTTP request failed: {str(e)}")
        except json.JSONDecodeError as e:
            print(f"❌ LegiScan JSON decode error: {str(e)}")
            raise Exception(f"Invalid JSON response: {str(e)}")
        except Exception as e:
            print(f"❌ LegiScan request error: {str(e)}")
            raise
    
    def get_state_abbreviation(self, state: str) -> str:
        """Convert state name to abbreviation"""
        if len(state) == 2:
            return state.upper()
        return self.state_mapping.get(state.title(), state.upper())
    
    def get_state_name(self, state_abbr: str) -> str:
        """Convert state abbreviation to full name"""
        reverse_mapping = {v: k for k, v in self.state_mapping.items()}
        return reverse_mapping.get(state_abbr.upper(), state_abbr)
    
    def search_bills(self, state: str, query: str = None, limit: int = 100, year_filter: str = 'all', max_pages: int = 5) -> Dict[str, Any]:
        """Search for bills in a specific state with pagination and year filtering"""
        try:
            state_abbr = self.get_state_abbreviation(state)
            print(f"🔍 Searching bills for {state} ({state_abbr}) with year filter '{year_filter}'")
            
            all_bills = []
            pages_fetched = 0
            total_available = 0
            
            # Set year parameter based on filter
            # IMPORTANT: LegiScan year parameter works differently:
            # year=1: All years (default for getting all available bills)
            # year=2: Current year only 
            # year=3: Prior year only
            # year=4: Recent years (current + prior)
            year_param = 1  # Default to all years to get maximum results
            if year_filter == 'current':
                year_param = 2  # Current year only
            elif year_filter == 'recent':
                year_param = 4  # Recent years (current + prior)
            
            # SMART SEARCH STRATEGY: Try multiple approaches to get recent bills
            search_query = query
            smart_query_applied = False
            
            if not query and year_filter in ['current', 'recent']:
                from datetime import datetime
                # Try specific date first (most likely to get July 14 bills)
                current_date = datetime.now().strftime('%Y-%m-%d')  # e.g., "2025-07-15"
                yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')  # "2025-07-14"
                
                # First try yesterday's date (July 14)
                search_query = yesterday
                smart_query_applied = True
                print(f"🎯 No query provided - using smart date query '{search_query}' to find recent bills")
            elif query:
                search_query = query
            
            # Fetch multiple pages
            for page in range(1, max_pages + 1):
                params = {
                    'op': 'getSearch',
                    'state': state_abbr,
                    'page': page
                }
                
                if search_query:
                    params['query'] = search_query
                    if page == 1:
                        print(f"🔍 Search query: '{search_query}'")
                        if search_query != query:
                            print(f"💡 Smart query applied: '{search_query}' (original: {query or 'None'})")
                else:
                    if page == 1:
                        print(f"🔍 No query - using default LegiScan sorting")
                
                if year_param:
                    params['year'] = year_param
                    if page == 1:
                        year_desc = 'All years' if year_param == 1 else 'Current year' if year_param == 2 else 'Recent years' if year_param == 4 else f'Year {year_param}'
                        print(f"📅 Year filter: {year_param} ({year_desc})")
                else:
                    if page == 1:
                        print(f"📅 No year parameter - LegiScan will use default")
            
                response = self._make_request('', params)
                
                if 'searchresult' not in response:
                    if page == 1:
                        print("⚠️ No searchresult field in LegiScan response")
                        return {
                            'success': False,
                            'error': 'No search results returned from LegiScan',
                            'bills': []
                        }
                    else:
                        print(f"📄 No more results on page {page}")
                        break
                
                search_results = response['searchresult']
                page_bills = []
                
                # Extract summary on first page
                if page == 1 and isinstance(search_results, dict) and 'summary' in search_results:
                    summary = search_results.get('summary', {})
                    total_available = summary.get('count', 0)
                    print(f"📊 Total bills available: {total_available}")
                    print(f"📄 Summary details: {summary}")
                elif page == 1:
                    print(f"⚠️ No summary found in response. Response keys: {list(search_results.keys()) if isinstance(search_results, dict) else type(search_results)}")
                
                # Handle different response formats from LegiScan
                if isinstance(search_results, dict) and 'summary' in search_results:
                    # This is a summary response, extract the actual results
                    for key, value in search_results.items():
                        if key != 'summary' and isinstance(value, dict):
                            page_bills.append(value)
                elif isinstance(search_results, dict):
                    page_bills = [search_results]
                elif isinstance(search_results, list):
                    page_bills = search_results
                
                if not page_bills:
                    print(f"📄 No bills found on page {page}")
                    break
                
                all_bills.extend(page_bills)
                pages_fetched = page
                
                print(f"📄 Page {page}: Found {len(page_bills)} bills (Total: {len(all_bills)})")
                
                # Debug: Show sample bill info from first page
                if page == 1 and page_bills:
                    sample_bill = page_bills[0]
                    print(f"📝 Sample bill: {sample_bill.get('bill_number', 'N/A')} - {sample_bill.get('title', 'No title')[:50]}...")
                    print(f"📅 Sample bill dates: intro={sample_bill.get('introduced_date')}, action={sample_bill.get('last_action_date')}")
                    print(f"🔢 Sample bill raw data keys: {list(sample_bill.keys()) if isinstance(sample_bill, dict) else 'Not a dict'}")
                elif page == 1:
                    print(f"⚠️ No bills found on page 1. Search results type: {type(search_results)}")
                
                # Check if we have enough results or if this was a partial page
                if len(all_bills) >= limit or len(page_bills) < 50:
                    break
                
                # Rate limiting between requests
                time.sleep(self.rate_limit_delay)
            
            # Apply final limit
            if limit and len(all_bills) > limit:
                all_bills = all_bills[:limit]
            
            print(f"🔍 Processing {len(all_bills)} bills from {pages_fetched} pages")
            
            processed_bills = []
            for i, result in enumerate(all_bills):
                try:
                    bill_data = self._extract_bill_data(result, state_abbr)
                    if bill_data:
                        processed_bills.append(bill_data)
                        if i < 5:  # Only log first 5 to avoid spam
                            print(f"✅ Processed bill {i+1}: {bill_data.get('bill_number', 'Unknown')}")
                except Exception as e:
                    print(f"❌ Error processing bill result {i+1}: {e}")
                    continue
            
            # Debug: Show date range of bills fetched
            if processed_bills:
                dates = []
                bill_numbers = []
                for bill in processed_bills[:5]:  # Check first 5 bills
                    intro_date = bill.get('introduced_date')
                    last_action = bill.get('last_action_date')
                    bill_number = bill.get('bill_number')
                    if intro_date:
                        dates.append(f"Intro: {intro_date}")
                    if last_action:
                        dates.append(f"Action: {last_action}")
                    if bill_number:
                        bill_numbers.append(bill_number)
                if dates:
                    print(f"📅 Sample bill dates: {dates[:3]}")
                if bill_numbers:
                    print(f"📝 Sample bill numbers: {bill_numbers[:5]}")
            else:
                print(f"⚠️ No processed bills to show dates for!")
            
            print(f"✅ Successfully processed {len(processed_bills)} bills from {pages_fetched} pages (Total available: {total_available})")
            
            # If we used a smart query but got few results, try multiple fallback searches
            if (smart_query_applied and len(processed_bills) < 10 and max_pages > 1):
                print(f"🔄 Smart query returned few results ({len(processed_bills)}), trying fallback searches...")
                
                fallback_queries = []
                from datetime import datetime, timedelta
                
                # Add multiple date-based fallback queries
                for days_back in [0, 1, 2, 7]:  # Today, yesterday, 2 days ago, week ago
                    date = (datetime.now() - timedelta(days=days_back)).strftime('%Y-%m-%d')
                    fallback_queries.append(date)
                
                # Add month-based query
                current_month = datetime.now().strftime('%Y-%m')
                fallback_queries.append(current_month)
                
                # Add generic queries
                fallback_queries.extend(['introduced', 'filed', None])  # None = no query
                
                for i, fallback_query in enumerate(fallback_queries):
                    if len(processed_bills) >= limit:
                        break
                        
                    try:
                        print(f"🔍 Trying fallback {i+1}: query='{fallback_query}'")
                        fallback_result = self.search_bills(state, query=fallback_query, limit=min(50, limit - len(processed_bills)), 
                                                           year_filter=year_filter, max_pages=2)
                        
                        if fallback_result['success'] and fallback_result['bills']:
                            # Merge results, avoiding duplicates
                            existing_ids = {bill.get('bill_id') for bill in processed_bills}
                            new_bills = [bill for bill in fallback_result['bills'] 
                                       if bill.get('bill_id') not in existing_ids]
                            
                            if new_bills:
                                processed_bills.extend(new_bills)
                                print(f"➕ Added {len(new_bills)} bills from fallback query '{fallback_query}'")
                                break  # Stop after first successful fallback
                    except Exception as e:
                        print(f"⚠️ Fallback search '{fallback_query}' failed: {e}")
                        continue
            
            return {
                'success': True,
                'bills': processed_bills,
                'total_found': total_available,
                'pages_fetched': pages_fetched,
                'returned_count': len(processed_bills),
                'year_filter': year_filter,
                'query': query,
                'smart_query_used': search_query != query,
                'state': state_abbr
            }
            
        except Exception as e:
            print(f"❌ Error in search_bills: {e}")
            return {
                'success': False,
                'error': str(e),
                'bills': []
            }
    
    def get_bill_details(self, bill_id: str) -> Dict[str, Any]:
        """Get detailed information for a specific bill"""
        try:
            print(f"🔍 Getting bill details for ID: {bill_id}")
            
            params = {
                'op': 'getBill',
                'id': bill_id
            }
            
            response = self._make_request('', params)
            
            if 'bill' not in response:
                print(f"⚠️ Bill {bill_id} not found in response")
                return {'success': False, 'error': 'Bill not found'}
            
            bill_data = response['bill']
            detailed_bill = self._extract_detailed_bill_data(bill_data)
            
            if detailed_bill:
                print(f"✅ Got detailed bill data for {bill_id}")
                return {
                    'success': True,
                    'bill': detailed_bill
                }
            else:
                return {'success': False, 'error': 'Failed to extract bill data'}
            
        except Exception as e:
            print(f"❌ Error getting bill details for {bill_id}: {e}")
            return {'success': False, 'error': str(e)}
    
    def _extract_bill_data(self, result: Dict[str, Any], state_abbr: str) -> Dict[str, Any]:
        """Extract bill data from search result - FIXED to match your database schema"""
        try:
            # Handle different result formats from LegiScan
            bill_id = result.get('bill_id', '')
            bill_number = result.get('bill_number', '')
            title = result.get('title', '')
            description = result.get('description', '')
            
            bill_data = {
                # Core identification - matching your EXACT Azure SQL schema
                'bill_id': str(bill_id),
                'bill_number': bill_number,
                'title': title,
                'description': description,
                'state': self.get_state_name(state_abbr),
                'state_abbr': state_abbr,
                'status': self._convert_status_to_text(result),
                'legiscan_status': self._convert_status_to_text(result),
                'category': self._determine_category(title + ' ' + description),
                
                # Session information - ONLY fields that exist in your database
                'session_id': result.get('session_id', ''),
                'session_name': result.get('session_name', ''),
                'bill_type': result.get('bill_type', 'bill'),
                'body': result.get('body', ''),
                
                # Dates - ONLY the fields that exist in your database
                'introduced_date': self._parse_date(result.get('introduced_date')),
                'last_action_date': self._parse_date(result.get('last_action_date')),
                
                # URLs
                'legiscan_url': result.get('url', result.get('state_link', '')),
                'pdf_url': '',
            }
            
            # Add AI analysis fields
            bill_data.update(self._generate_basic_analysis(bill_data))
            
            return bill_data
            
        except Exception as e:
            print(f"❌ Error extracting bill data: {e}")
            return None
    
    def _extract_detailed_bill_data(self, bill: Dict[str, Any]) -> Dict[str, Any]:
        """Extract detailed bill data - FIXED to match your database schema"""
        try:
            state_abbr = bill.get('state', '')
            
            bill_data = {
                # Core identification
                'bill_id': str(bill.get('bill_id', '')),
                'bill_number': bill.get('bill_number', ''),
                'title': bill.get('title', ''),
                'description': bill.get('description', ''),
                'state': self.get_state_name(state_abbr),
                'state_abbr': state_abbr,
                'status': bill.get('status_text', ''),
                'legiscan_status': bill.get('status_text', ''),
                'category': self._determine_category(bill.get('title', '') + ' ' + bill.get('description', '')),
                
                # Session information - ONLY fields that exist in your database
                'session_id': bill.get('session', {}).get('session_id', '') if isinstance(bill.get('session'), dict) else '',
                'session_name': bill.get('session', {}).get('session_name', '') if isinstance(bill.get('session'), dict) else str(bill.get('session', '')),
                'bill_type': bill.get('bill_type', 'bill'),
                'body': bill.get('body', ''),
                
                # Dates - ONLY the fields that exist in your database
                'introduced_date': self._parse_date(self._get_first_history_date(bill.get('history', []))),
                'last_action_date': self._parse_date(self._get_last_history_date(bill.get('history', []))),
                
                # URLs
                'legiscan_url': bill.get('state_link', ''),
                'pdf_url': self._get_pdf_url(bill.get('texts', [])),
            }
            
            # Add AI analysis
            bill_data.update(self._generate_basic_analysis(bill_data))
            
            return bill_data
            
        except Exception as e:
            print(f"❌ Error extracting detailed bill data: {e}")
            return None
    
    def _determine_category(self, text: str) -> str:
        """Determine bill category based on content"""
        if not text:
            return 'civic'
            
        text_lower = text.lower()
        
        # Category keywords
        if any(word in text_lower for word in ['education', 'school', 'university', 'student', 'teacher', 'academic']):
            return 'education'
        elif any(word in text_lower for word in ['health', 'medical', 'hospital', 'insurance', 'medicare', 'medicaid']):
            return 'healthcare'
        elif any(word in text_lower for word in ['business', 'commerce', 'trade', 'economic', 'tax', 'finance']):
            return 'business'
        elif any(word in text_lower for word in ['environment', 'climate', 'pollution', 'energy', 'green', 'renewable']):
            return 'environment'
        elif any(word in text_lower for word in ['transportation', 'highway', 'transit', 'vehicle', 'road', 'infrastructure']):
            return 'transportation'
        elif any(word in text_lower for word in ['crime', 'criminal', 'justice', 'police', 'court', 'law enforcement']):
            return 'criminal-justice'
        elif any(word in text_lower for word in ['housing', 'property', 'real estate', 'zoning', 'development']):
            return 'housing'
        else:
            return 'civic'
    
    def _get_first_history_date(self, history: List[Dict]) -> str:
        """Get the first date from bill history"""
        if history and len(history) > 0:
            return history[0].get('date', '')
        return ''
    
    def _get_last_history_date(self, history: List[Dict]) -> str:
        """Get the last date from bill history"""
        if history and len(history) > 0:
            return history[-1].get('date', '')
        return ''
    
    def _convert_status_to_text(self, result: Dict[str, Any]) -> str:
        """Convert LegiScan status codes to readable text"""
        # First try to get status_text if available
        status_text = result.get('status_text', '')
        if status_text and status_text.strip():
            return status_text.strip()
        
        # If no status_text, convert numeric status code
        status_code = result.get('status', '')
        
        # LegiScan status code mapping
        status_mapping = {
            '1': 'Introduced',
            '2': 'Engrossed', 
            '3': 'Enrolled',
            '4': 'Passed',
            '5': 'Vetoed',
            '6': 'Failed/Dead',
            '7': 'Indefinitely Postponed',
            '8': 'Signed by Governor',
            '9': 'Effective',
            1: 'Introduced',
            2: 'Engrossed',
            3: 'Enrolled', 
            4: 'Passed',
            5: 'Vetoed',
            6: 'Failed/Dead',
            7: 'Indefinitely Postponed',
            8: 'Signed by Governor',
            9: 'Effective'
        }
        
        # Convert status code to text
        if status_code in status_mapping:
            return status_mapping[status_code]
        elif str(status_code) in status_mapping:
            return status_mapping[str(status_code)]
        
        # If we have some status but can't map it, return as-is
        if status_code:
            return str(status_code)
        
        # Default fallback
        return 'Unknown'
    
    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """Parse date string to datetime object"""
        if not date_str:
            return None
        
        try:
            # Try different date formats
            for fmt in ['%Y-%m-%d', '%m/%d/%Y', '%Y-%m-%d %H:%M:%S', '%m-%d-%Y']:
                try:
                    return datetime.strptime(str(date_str), fmt)
                except ValueError:
                    continue
            return None
        except Exception:
            return None
    
    def _get_pdf_url(self, texts: List[Dict[str, Any]]) -> str:
        """Extract PDF URL from bill texts"""
        try:
            if texts and len(texts) > 0:
                return texts[0].get('state_link', '')
            return ''
        except Exception:
            return ''
    
    def _generate_basic_analysis(self, bill: Dict[str, Any]) -> Dict[str, Any]:
        """Generate basic AI analysis for bills - matching your Azure SQL schema"""
        try:
            title = bill.get('title', '')
            description = bill.get('description', '')
            category = bill.get('category', 'civic')
            
            # Generate summaries based on category and content
            if title:
                summary = f"{category.title()} legislation: {title[:150]}{'...' if len(title) > 150 else ''}"
            else:
                summary = f"Bill relating to {category}"
            
            talking_points = []
            if category == 'education':
                talking_points = ["Impact on schools and students", "Educational funding implications", "Teacher and staff effects"]
            elif category == 'healthcare':
                talking_points = ["Healthcare access implications", "Insurance and coverage effects", "Public health impact"]
            elif category == 'business':
                talking_points = ["Economic impact assessment", "Business regulatory effects", "Tax implications"]
            elif category == 'environment':
                talking_points = ["Environmental protection measures", "Climate change considerations", "Sustainability requirements"]
            else:
                talking_points = ["Legislative policy changes", "Implementation requirements", "Stakeholder impacts"]
            
            return {
                # Matching your Azure SQL schema field names
                'ai_summary': summary,
                'ai_executive_summary': f"This {category} bill addresses legislative matters in the {category} sector.",
                'ai_talking_points': "; ".join(talking_points),
                'ai_key_points': f"Key focus: {category.title()} policy reform",
                'ai_business_impact': 'Business impact assessment pending detailed analysis',
                'ai_potential_impact': f'Potential impact on {category} sector and related stakeholders',
                'ai_version': '1.0'
            }
            
        except Exception as e:
            print(f"❌ Error generating analysis: {e}")
            return {
                'ai_summary': 'Analysis pending',
                'ai_executive_summary': 'Executive summary pending',
                'ai_talking_points': 'Talking points pending',
                'ai_key_points': 'Key points pending',
                'ai_business_impact': 'Business impact pending',
                'ai_potential_impact': 'Potential impact pending',
                'ai_version': '1.0'
            }
    
    def search_and_analyze_bills(self, state: str, query: str, limit: int = 50, 
                               ai_client=None, db_manager=None, process_one_by_one: bool = False) -> Dict[str, Any]:
        """
        *** MAIN METHOD CALLED BY YOUR MAIN.PY ***
        Search and analyze bills with AI summaries
        Now supports one-by-one processing to database with REAL AI
        """
        try:
            print(f"🔍 LegiScan: Starting search_and_analyze_bills")
            print(f"   - State: {state}")
            print(f"   - Query: '{query}'")
            print(f"   - Limit: {limit}")
            print(f"   - Process one-by-one: {process_one_by_one}")
            
            # Search for bills with new parameters
            search_result = self.search_bills(state, query, limit, year_filter='all', max_pages=5)
            
            if not search_result['success']:
                print(f"❌ Search failed: {search_result.get('error')}")
                return search_result
            
            bills = search_result['bills']
            print(f"🔍 Got {len(bills)} bills from search")
            
            # Processing results tracking
            detailed_bills = []
            processing_results = {
                'total_fetched': len(bills),
                'total_processed': 0,
                'total_saved': 0,
                'errors': []
            }
            
            # Get detailed information for each bill
            for i, bill in enumerate(bills[:limit]):
                try:
                    bill_number = bill.get('bill_number', f'Bill {i+1}')
                    print(f"🔍 Processing bill {i+1}/{len(bills)}: {bill_number}")
                    
                    # Get detailed bill info
                    detailed_bill = self._get_detailed_bill_info(bill, i+1)
                    
                    # If processing one-by-one, handle AI analysis and database save here
                    if process_one_by_one and ai_client and db_manager:
                        try:
                            # Step 1: Real AI Analysis
                            print(f"🤖 Running REAL AI analysis for bill {bill_number}")
                            ai_analysis = self._run_ai_analysis(detailed_bill, ai_client)
                            detailed_bill.update(ai_analysis)
                            
                            # Step 2: Prepare for database
                            db_data = self._prepare_bill_for_database(detailed_bill)
                            
                            # Step 3: Save to database
                            if self._save_bill_to_database(db_data, db_manager):
                                processing_results['total_saved'] += 1
                                print(f"✅ Bill {bill_number} saved to database with REAL AI analysis")
                            else:
                                print(f"❌ Failed to save bill {bill_number} to database")
                                
                        except Exception as ai_db_error:
                            error_msg = f"AI/DB error for bill {bill_number}: {str(ai_db_error)}"
                            print(f"❌ {error_msg}")
                            processing_results['errors'].append(error_msg)
                    
                    detailed_bills.append(detailed_bill)
                    processing_results['total_processed'] += 1
                    print(f"✅ Processed bill {i+1}")
                        
                except Exception as e:
                    error_msg = f"Error processing bill {i+1}: {str(e)}"
                    print(f"❌ {error_msg}")
                    processing_results['errors'].append(error_msg)
                    # Still add the bill with basic data
                    detailed_bills.append(bill)
            
            print(f"✅ LegiScan: Returning {len(detailed_bills)} analyzed bills")
            
            result = {
                'success': True,
                'bills': detailed_bills,
                'bills_found': len(detailed_bills),
                'query': query,
                'state': state,
                'timestamp': datetime.now().isoformat()
            }
            
            # Add processing results if one-by-one processing was used
            if process_one_by_one:
                result['processing_results'] = processing_results
            
            return result
            
        except Exception as e:
            print(f"❌ Error in search_and_analyze_bills: {e}")
            import traceback
            traceback.print_exc()
            return {
                'success': False,
                'error': str(e),
                'bills': []
            }
    
    def _get_detailed_bill_info(self, bill: Dict[str, Any], bill_num: int) -> Dict[str, Any]:
        """Get detailed bill information"""
        try:
            # Try to get detailed info if we have a bill_id
            if bill.get('bill_id') and str(bill.get('bill_id')).strip():
                print(f"   Getting details for bill_id: {bill.get('bill_id')}")
                detail_result = self.get_bill_details(str(bill['bill_id']))
                if detail_result.get('success'):
                    return detail_result['bill']
                else:
                    print(f"⚠️ Used search data for bill {bill_num} (detail fetch failed)")
                    return bill
            else:
                print(f"⚠️ No bill_id for bill {bill_num}, using search data")
                return bill
        except Exception as e:
            print(f"❌ Error getting detailed info for bill {bill_num}: {e}")
            return bill
    
    def _run_ai_analysis(self, bill: Dict[str, Any], ai_client) -> Dict[str, Any]:
        """Run AI analysis on a single bill using your REAL ai.py module"""
        try:
            print(f"🤖 Running REAL AI analysis for bill {bill.get('bill_number', 'Unknown')}")
            
            # Import and use your real AI module
            try:
                from ai import analyze_legiscan_bill
                print("✅ Successfully imported real AI module (ai.py)")
                
                # Handle async properly - your AI function is async
                try:
                    # Try to run in existing event loop
                    loop = asyncio.get_event_loop()
                    if loop.is_running():
                        # We're in an async context, but need to run sync
                        # Create a new thread to run the async function
                        import concurrent.futures
                        with concurrent.futures.ThreadPoolExecutor() as executor:
                            future = executor.submit(asyncio.run, analyze_legiscan_bill(bill))
                            ai_analysis = future.result(timeout=60)  # 60 second timeout
                    else:
                        # No loop running, create new one
                        ai_analysis = asyncio.run(analyze_legiscan_bill(bill))
                        
                except RuntimeError:
                    # Fallback: create new event loop in thread
                    import concurrent.futures
                    with concurrent.futures.ThreadPoolExecutor() as executor:
                        future = executor.submit(asyncio.run, analyze_legiscan_bill(bill))
                        ai_analysis = future.result(timeout=60)
                
                print(f"✅ REAL AI analysis completed for bill {bill.get('bill_number', 'Unknown')}")
                print(f"   AI version: {ai_analysis.get('ai_version', 'unknown')}")
                
                return ai_analysis
                
            except ImportError as e:
                print(f"❌ Could not import AI module: {e}")
                print("   Falling back to basic analysis")
                return self._generate_basic_analysis(bill)
                
        except Exception as e:
            print(f"❌ Real AI analysis error for bill {bill.get('bill_number', 'Unknown')}: {e}")
            # Return fallback analysis
            return {
                'ai_summary': f'<p>AI analysis encountered an error: {str(e)}</p>',
                'ai_executive_summary': f'<p>AI analysis encountered an error: {str(e)}</p>',
                'ai_talking_points': f'<p>AI analysis encountered an error: {str(e)}</p>',
                'ai_key_points': f'<p>AI analysis encountered an error: {str(e)}</p>',
                'ai_business_impact': f'<p>AI analysis encountered an error: {str(e)}</p>',
                'ai_potential_impact': f'<p>AI analysis encountered an error: {str(e)}</p>',
                'ai_version': 'error_fallback_v1'
            }
    
    def _prepare_bill_text_for_ai(self, bill: Dict[str, Any]) -> str:
        """Extract and clean bill text for AI analysis"""
        text_parts = []
        
        if bill.get('title'):
            text_parts.append(f"Title: {bill['title']}")
        if bill.get('description'):
            text_parts.append(f"Description: {bill['description']}")
        if bill.get('text'):
            text_parts.append(f"Full Text: {bill['text']}")
        
        return "\n\n".join(text_parts)
    
    def _prepare_bill_for_database(self, bill: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare bill data for database insertion - FIXES the session parameter issue"""
        try:
            # Clean and format dates
            introduced_date = self._safe_date_convert(bill.get('introduced_date'))
            last_action_date = self._safe_date_convert(bill.get('last_action_date'))
            
            # Prepare database data - REMOVE problematic fields
            db_data = {
                "bill_id": str(bill.get('bill_id', '')),
                "bill_number": bill.get('bill_number', ''),
                "title": bill.get('title', ''),
                "description": bill.get('description', ''),
                "state": bill.get('state', ''),
                "state_abbr": bill.get('state_abbr', ''),
                "status": bill.get('status', ''),
                "category": bill.get('category', ''),
                "introduced_date": introduced_date,
                "last_action_date": last_action_date,
                "session_id": bill.get('session_id', ''),
                "session_name": bill.get('session_name', ''),
                "bill_type": bill.get('bill_type', ''),
                "body": bill.get('body', ''),
                "legiscan_url": bill.get('legiscan_url', ''),
                "pdf_url": bill.get('pdf_url', ''),
                # AI analysis fields
                "ai_summary": bill.get('ai_summary', ''),
                "ai_executive_summary": bill.get('ai_executive_summary', ''),
                "ai_talking_points": bill.get('ai_talking_points', ''),
                "ai_key_points": bill.get('ai_key_points', ''),
                "ai_business_impact": bill.get('ai_business_impact', ''),
                "ai_potential_impact": bill.get('ai_potential_impact', ''),
                "ai_version": bill.get('ai_version', '1.0'),
                # Timestamps
                "created_at": datetime.utcnow(),
                "last_updated": datetime.utcnow()
            }
            
            # Remove any None values
            db_data = {k: v for k, v in db_data.items() if v is not None}
            
            return db_data
            
        except Exception as e:
            print(f"❌ Error preparing bill data for database: {e}")
            raise
    
    def _safe_date_convert(self, date_value) -> Optional[str]:
        """Safely convert date values to string format"""
        if not date_value:
            return None
            
        try:
            if isinstance(date_value, str):
                # Handle different date formats
                if ' 00:00:00' in date_value:
                    return date_value.split(' ')[0]  # Remove time part
                return date_value
            elif hasattr(date_value, 'strftime'):
                return date_value.strftime('%Y-%m-%d')
            else:
                return str(date_value)
        except Exception as e:
            print(f"⚠️ Error converting date {date_value}: {e}")
            return None
    
    def _save_bill_to_database(self, db_data: Dict[str, Any], db_manager) -> bool:
        """Save individual bill to database"""
        try:
            # Use the database manager's save_bill method
            result = db_manager.save_bill(db_data)
            return result is not None
                
        except Exception as e:
            print(f"❌ Error saving bill {db_data.get('bill_id', 'unknown')}: {e}")
            return False
    
    def optimized_bulk_fetch(self, state: str, limit: int = 50, recent_only: bool = False, year_filter: str = 'all', max_pages: int = 10) -> Dict[str, Any]:
        """
        *** BULK FETCH METHOD CALLED BY YOUR MAIN.PY ***
        Optimized bulk fetch for state legislation with enhanced parameters
        """
        try:
            print(f"🔍 LegiScan: Starting optimized_bulk_fetch")
            print(f"   - State: {state}")
            print(f"   - Limit: {limit}")
            print(f"   - Recent only: {recent_only}")
            print(f"   - Year filter: {year_filter}")
            print(f"   - Max pages: {max_pages}")
            
            # Use new parameter or fallback to recent_only logic
            if recent_only and year_filter == 'all':
                year_filter = 'current'
            
            # Use search without query to get recent bills (smart query will be applied automatically)
            print(f"🔍 Calling search_bills with: state={state}, query=None, limit={limit}, year_filter={year_filter}, max_pages={max_pages}")
            result = self.search_bills(state, query=None, limit=limit, year_filter=year_filter, max_pages=max_pages)
            
            if result['success']:
                bills = result['bills']
                print(f"✅ Bulk fetch successful: {len(bills)} bills")
                
                return {
                    'success': True,
                    'bills': bills,
                    'bills_processed': len(bills),
                    'state': state,
                    'timestamp': datetime.now().isoformat()
                }
            else:
                print(f"❌ Bulk fetch failed: {result.get('error')}")
                return {
                    'success': False,
                    'error': result.get('error'),
                    'bills': []
                }
                
        except Exception as e:
            print(f"❌ Error in optimized_bulk_fetch: {e}")
            return {
                'success': False,
                'error': str(e),
                'bills': []
            }

# Test function to verify the API works
def test_legiscan_api():
    """Test function to verify LegiScan API is working"""
    try:
        print("🧪 Testing LegiScan API initialization...")
        api = LegiScanAPI()
        
        print("🧪 Testing search functionality...")
        result = api.search_bills("CA", "test", 1, year_filter='all', max_pages=1)
        
        print(f"✅ LegiScan API test result: {result.get('success')}")
        if result.get('success'):
            print(f"   Found {len(result.get('bills', []))} bills")
        else:
            print(f"   Error: {result.get('error')}")
            
        return result.get('success', False)
    except Exception as e:
        print(f"❌ LegiScan API test failed: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Testing LegiScan API...")
    test_legiscan_api()