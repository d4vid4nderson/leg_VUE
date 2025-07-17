"""
LegiScan Service Module
Comprehensive LegiScan API integration with AI analysis and database management
"""

import os
import asyncio
import aiohttp
import traceback
from datetime import datetime
from typing import Dict, List, Optional, Any
from pydantic import BaseModel
import pyodbc

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Get LegiScan API key
LEGISCAN_API_KEY = None
for var_name in ['LEGISCAN_API_KEY', 'legiscan_api_key', 'LEGISCAN_KEY']:
    LEGISCAN_API_KEY = os.getenv(var_name)
    if LEGISCAN_API_KEY:
        print(f"✅ Found LegiScan API key in {var_name}")
        break

if not LEGISCAN_API_KEY:
    print("⚠️ LegiScan API key not found - check environment variables")

# AI Client setup
enhanced_ai_client = None

def get_ai_client():
    """Get AI client for bill analysis"""
    try:
        # Check if you're using OpenAI or Azure OpenAI
        if os.getenv('AZURE_ENDPOINT') and os.getenv('AZURE_KEY'):
            # Azure OpenAI setup
            import openai
            client = openai.AzureOpenAI(
                api_key=os.getenv('AZURE_KEY'),
                api_version="2024-02-15-preview",
                azure_endpoint=os.getenv('AZURE_ENDPOINT'),
                azure_deployment=os.getenv('AZURE_MODEL_NAME', 'gpt-4')
            )
            print("✅ Azure OpenAI client initialized")
            return client
        elif os.getenv('OPENAI_API_KEY'):
            # Regular OpenAI setup
            import openai
            client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
            print("✅ OpenAI client initialized")
            return client
        else:
            print("⚠️ No AI client configured - set AZURE_ENDPOINT+AZURE_KEY or OPENAI_API_KEY")
            return None
    except Exception as e:
        print(f"❌ AI client setup failed: {e}")
        return None

# Initialize AI client
enhanced_ai_client = get_ai_client()

async def enhanced_bill_analysis(bill_data: Dict, search_context: str = "") -> Dict:
    """Enhanced AI analysis for bills"""
    try:
        if not enhanced_ai_client:
            return {
                'ai_summary': '<p>AI analysis not available - no client configured</p>',
                'ai_talking_points': '<p>AI analysis not available</p>',
                'ai_business_impact': '<p>AI analysis not available</p>',
                'category': 'not_applicable',
                'ai_version': 'unavailable'
            }

        # Create analysis prompt
        bill_text = f"""
        Title: {bill_data.get('title', 'N/A')}
        Description: {bill_data.get('description', 'N/A')}
        Status: {bill_data.get('status', 'N/A')}
        State: {bill_data.get('state', 'N/A')}
        Search Context: {search_context}
        """

        # Generate AI analysis
        response = await enhanced_ai_client.chat.completions.create(
            model=os.getenv('AZURE_MODEL_NAME', 'gpt-4'),
            messages=[
                {"role": "system", "content": "You are a policy analyst. Analyze this bill and provide a summary, talking points, and business impact assessment."},
                {"role": "user", "content": bill_text}
            ],
            max_tokens=1500
        )

        analysis = response.choices[0].message.content

        # Parse analysis (basic implementation - enhance as needed)
        return {
            'ai_summary': f'<p>{analysis}</p>',
            'ai_talking_points': f'<p>Key points from AI analysis</p>',
            'ai_business_impact': f'<p>Business impact assessment</p>',
            'category': 'not_applicable',  # Enhance with categorization logic
            'ai_version': '1.0'
        }

    except Exception as e:
        print(f"❌ Enhanced AI analysis failed: {e}")
        return {
            'ai_summary': f'<p>AI analysis failed: {str(e)}</p>',
            'ai_talking_points': '<p>AI analysis not available</p>',
            'ai_business_impact': '<p>AI analysis not available</p>',
            'category': 'not_applicable',
            'ai_version': 'error'
        }

def convert_status_to_text(bill_data: Dict) -> str:
    """Convert LegiScan status to readable text"""
    status = bill_data.get('status', {})
    if isinstance(status, dict):
        return status.get('text', 'Unknown')
    return str(status) if status else 'Unknown'

class EnhancedLegiScanClient:
    """Enhanced LegiScan client with comprehensive AI integration"""
    
    def __init__(self, api_key: str = None, rate_limit_delay: float = 0.5):
        self.api_key = api_key or LEGISCAN_API_KEY
        self.rate_limit_delay = rate_limit_delay
        self.base_url = "https://api.legiscan.com"
        
        if not self.api_key:
            raise ValueError("LegiScan API key is required")
        
        print(f"✅ Enhanced LegiScan client initialized with key: {self.api_key[:4]}***")
    
    def _build_url(self, operation: str, params: Optional[Dict] = None) -> str:
        """Build LegiScan API URL"""
        if params is None:
            params = {}
        
        param_str = '&'.join([f"{k}={v}" for k, v in params.items()])
        return f"{self.base_url}/?key={self.api_key}&op={operation}&{param_str}"
    
    async def _api_request(self, url: str) -> Dict[str, Any]:
        """Make async API request with error handling"""
        try:
            print("🔍 Making enhanced LegiScan API request...")
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    response.raise_for_status()
                    data = await response.json()
                    
                    if data.get('status') == "ERROR":
                        error_msg = data.get('alert', {}).get('message', 'Unknown API error')
                        raise Exception(f"LegiScan API Error: {error_msg}")
                    
                    await asyncio.sleep(self.rate_limit_delay)
                    return data
                    
        except Exception as e:
            print(f"❌ Enhanced LegiScan API request failed: {e}")
            raise
    
    async def search_bills_enhanced(self, state: str, query: str, limit: int = 100, year_filter: str = 'all', max_pages: int = 5) -> Dict:
        """Enhanced bill search with comprehensive data and pagination"""
        try:
            all_results = []
            total_found = 0
            pages_fetched = 0
            
            # Set year parameter based on filter
            # LegiScan year parameter: 1=All years, 2=Current year, 4=Recent years
            year_param = 1  # Default to all years to get maximum results
            if year_filter == 'current':
                year_param = 2  # Current year only
            elif year_filter == 'recent':
                year_param = 4  # Recent years (current + prior)
            
            print(f"🔍 Enhanced search for {state} with year filter '{year_filter}' (param: {year_param})")
            
            # Fetch multiple pages
            for page in range(1, max_pages + 1):
                params = {
                    'query': query, 
                    'year': year_param, 
                    'page': page
                }
                if state:
                    params['state'] = state
                
                url = self._build_url('search', params)
                data = await self._api_request(url)
                search_result = data.get('searchresult', {})
                
                # Extract summary from first page
                if page == 1:
                    summary = search_result.get('summary', {})
                    total_found = summary.get('count', 0)
                    print(f"📊 Total bills available: {total_found}")
                
                # Extract results from current page
                page_results = [search_result[key] for key in search_result if key != 'summary' and isinstance(search_result[key], dict)]
                
                if not page_results:
                    print(f"📄 No more results on page {page}")
                    break
                
                all_results.extend(page_results)
                pages_fetched = page
                
                print(f"📄 Page {page}: Found {len(page_results)} bills (Total so far: {len(all_results)})")
                
                # Check if we have enough results or if this was the last page
                if len(all_results) >= limit or len(page_results) < 50:  # LegiScan typically returns 50 per page
                    break
                
                # Rate limiting between page requests
                await asyncio.sleep(self.rate_limit_delay)
            
            # Apply final limit
            if limit and len(all_results) > limit:
                all_results = all_results[:limit]
            
            print(f"✅ Enhanced search completed: {len(all_results)} bills returned from {pages_fetched} pages")
            
            return {
                'success': True,
                'summary': {
                    'count': total_found,
                    'pages_fetched': pages_fetched,
                    'year_filter': year_filter,
                    'returned_count': len(all_results)
                },
                'results': all_results,
                'bills_found': len(all_results)
            }
            
        except Exception as e:
            print(f"❌ Error in enhanced search: {e}")
            return {
                'success': False,
                'error': str(e),
                'results': []
            }
    
    async def get_bill_detailed(self, bill_id: int) -> Dict:
        """Get detailed bill information"""
        try:
            url = self._build_url('getBill', {'id': bill_id})
            data = await self._api_request(url)
            
            bill = data.get('bill', {})
            if bill:
                print(f"✅ Successfully fetched detailed bill {bill_id}")
            
            return bill
            
        except Exception as e:
            print(f"❌ Error fetching detailed bill {bill_id}: {e}")
            return {}
    
    async def get_session_list(self, state: str) -> Dict:
        """Get list of sessions for a state"""
        try:
            url = self._build_url('getSessionList', {'state': state})
            data = await self._api_request(url)
            
            sessions = data.get('sessions', {})
            if sessions:
                print(f"✅ Successfully fetched sessions for {state}")
            
            return {
                'success': True,
                'state': state,
                'sessions': sessions,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"❌ Error fetching sessions for {state}: {e}")
            return {
                'success': False,
                'error': str(e),
                'state': state,
                'sessions': {}
            }
    
    async def check_active_sessions(self, states: List[str]) -> Dict:
        """Check for active sessions across multiple states"""
        try:
            active_sessions = {}
            session_details = {}
            
            for state in states:
                print(f"🔍 Checking sessions for {state}...")
                session_data = await self.get_session_list(state)
                
                if not session_data.get('success'):
                    continue
                
                sessions = session_data.get('sessions', {})
                state_active_sessions = []
                
                # Handle both dict and list formats from LegiScan API
                if isinstance(sessions, list):
                    # Convert list to dict format
                    sessions_dict = {}
                    for i, session in enumerate(sessions):
                        if isinstance(session, dict):
                            session_id = session.get('session_id', f'session_{i}')
                            sessions_dict[session_id] = session
                    sessions = sessions_dict
                
                # Process each session
                for session_key, session_info in sessions.items():
                    if isinstance(session_info, dict):
                        # Check if session is currently active
                        # LegiScan sessions have various status indicators
                        session_name = session_info.get('session_name', '')
                        year = session_info.get('year_start', 0)
                        current_year = datetime.now().year
                        
                        # Consider a session active if:
                        # 1. It's from current year or recent years
                        # 2. It doesn't have an explicit end marker
                        is_recent = (current_year - int(year)) <= 1 if year else False
                        
                        # Check if this is a special session that's prefileable or upcoming
                        is_special = session_info.get('special', 0) == 1
                        is_prefile = session_info.get('prefile', 0) == 1
                        
                        # Additional heuristics for active sessions
                        is_likely_active = (
                            is_recent and (
                                # Regular sessions from current/recent years
                                ('special' not in session_name.lower()) or
                                # Special sessions that are marked as prefile (upcoming)
                                (is_special and is_prefile) or
                                # Special sessions with current year
                                (is_special and str(current_year) in session_name)
                            )
                        )
                        
                        session_entry = {
                            'session_id': session_key,
                            'session_name': session_name,
                            'year_start': year,
                            'year_end': session_info.get('year_end', ''),
                            'session_start_date': session_info.get('session_start_date', ''),
                            'session_end_date': session_info.get('session_end_date', ''),
                            'sine_die': session_info.get('sine_die', ''),
                            'is_likely_active': is_likely_active,
                            'session_info': session_info
                        }
                        
                        if is_likely_active:
                            state_active_sessions.append(session_entry)
                        
                        # Store all session details for reference
                        if state not in session_details:
                            session_details[state] = []
                        session_details[state].append(session_entry)
                
                if state_active_sessions:
                    active_sessions[state] = state_active_sessions
                    print(f"✅ Found {len(state_active_sessions)} likely active sessions in {state}")
                else:
                    print(f"📭 No active sessions detected in {state}")
            
            return {
                'success': True,
                'active_sessions': active_sessions,
                'all_sessions': session_details,
                'states_checked': states,
                'states_with_active_sessions': list(active_sessions.keys()),
                'total_active_sessions': sum(len(sessions) for sessions in active_sessions.values()),
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"❌ Error checking active sessions: {e}")
            return {
                'success': False,
                'error': str(e),
                'active_sessions': {},
                'states_checked': states,
                'timestamp': datetime.now().isoformat()
            }
    
    async def enhanced_search_and_analyze(self, state: str, query: str, limit: int = 100, 
                                        year_filter: str = 'current', max_pages: int = 10,
                                        with_ai: bool = True, db_manager = None) -> Dict:
        """Enhanced search and analyze workflow with one-by-one processing"""
        try:
            print(f"🚀 Enhanced search and analyze: {query} in {state}")
            
            # Step 1: Search for bills
            search_result = await self.search_bills_enhanced(state, query, limit, year_filter, max_pages)
            
            if not search_result.get('success') or not search_result.get('results'):
                return {
                    'success': False,
                    'error': 'No bills found for search query',
                    'bills': []
                }
            
            search_results = search_result['results']
            analyzed_bills = []
            
            # Step 2: Process each bill one by one
            for i, bill_summary in enumerate(search_results, 1):
                try:
                    bill_id = bill_summary.get('bill_id')
                    if not bill_id:
                        continue
                    
                    print(f"📋 Processing bill {i}/{len(search_results)}: {bill_id}")
                    
                    # Step 2a: Get detailed bill data
                    detailed_bill = await self.get_bill_detailed(int(bill_id))
                    if not detailed_bill:
                        print(f"⚠️ No detailed data for bill {bill_id}, skipping")
                        continue
                    
                    # Step 2b: Enhanced AI analysis if requested
                    ai_analysis = {}
                    if with_ai and enhanced_ai_client:
                        try:
                            ai_analysis = await enhanced_bill_analysis(detailed_bill, f"Search: {query}")
                            print(f"✅ Enhanced AI analysis completed for bill {bill_id}")
                        except Exception as e:
                            print(f"❌ Enhanced AI analysis failed for bill {bill_id}: {e}")
                            ai_analysis = {
                                'ai_summary': f'<p>AI analysis failed: {str(e)}</p>',
                                'ai_talking_points': '<p>AI analysis not available</p>',
                                'ai_business_impact': '<p>AI analysis not available</p>',
                                'category': 'not_applicable',
                                'ai_version': 'error'
                            }
                    
                    complete_bill = {
                        'bill_id': bill_id,
                        'bill_number': detailed_bill.get('bill_number', ''),
                        'title': detailed_bill.get('title', ''),
                        'description': detailed_bill.get('description', ''),
                        'state': state,
                        'state_abbr': state,
                        'status': convert_status_to_text(detailed_bill),
                        'session_id': detailed_bill.get('session', {}).get('session_id', ''),
                        'session_name': detailed_bill.get('session', {}).get('session_name', ''),
                        'bill_type': detailed_bill.get('bill_type', 'bill'),
                        'body': detailed_bill.get('body', ''),
                        'introduced_date': detailed_bill.get('status_date', ''),
                        'last_action_date': detailed_bill.get('status_date', ''),
                        'legiscan_url': detailed_bill.get('state_link', ''),
                        'pdf_url': '',
                        'sponsors': detailed_bill.get('sponsors', []),
                        'committee': detailed_bill.get('committee', []),
                        'history': detailed_bill.get('history', []),
                        'texts': detailed_bill.get('texts', []),
                        'search_query': query,
                        'search_relevance': bill_summary.get('relevance', 0),
                        'source': 'Enhanced LegiScan API',
                        'created_at': datetime.now().isoformat(),
                        'last_updated': datetime.now().isoformat(),
                        'reviewed': False
                    }
                    
                    # Step 2d: Add AI analysis results
                    complete_bill.update(ai_analysis)
                    
                    # Step 2e: Save to database if manager provided
                    if db_manager:
                        try:
                            success = db_manager.save_bill(complete_bill)
                            if success:
                                print(f"✅ Saved bill {bill_id} to database")
                            else:
                                print(f"❌ Failed to save bill {bill_id} to database")
                        except Exception as e:
                            print(f"❌ Database save error for bill {bill_id}: {e}")
                    
                    analyzed_bills.append(complete_bill)
                    print(f"✅ Completed processing bill {bill_id}")
                    
                except Exception as e:
                    print(f"❌ Error processing bill {i}: {e}")
                    continue
            
            print(f"✅ Enhanced analysis completed: {len(analyzed_bills)} bills processed")
            
            return {
                'success': True,
                'bills': analyzed_bills,
                'bills_found': len(search_results),
                'bills_processed': len(analyzed_bills),
                'query': query,
                'state': state,
                'timestamp': datetime.now().isoformat(),
                'processing_results': {
                    'total_fetched': len(search_results),
                    'total_processed': len(analyzed_bills),
                    'total_saved': len(analyzed_bills) if db_manager else 0,
                    'errors': []
                }
            }
            
        except Exception as e:
            print(f"❌ Error in enhanced search and analyze: {e}")
            traceback.print_exc()
            return {
                'success': False,
                'error': str(e),
                'bills': []
            }

class StateLegislationDatabaseManager:
    """Database manager for one-by-one bill processing"""
    
    def __init__(self, connection):
        self.connection = connection
    
    def save_bill(self, bill_data: dict):
        """Save a single bill to the database"""
        try:
            cursor = self.connection.cursor()
            
            # Check if bill already exists
            check_query = "SELECT id FROM dbo.state_legislation WHERE bill_id = ?"
            cursor.execute(check_query, bill_data.get('bill_id'))
            existing = cursor.fetchone()
            
            if existing:
                # Update existing bill
                update_query = """
                UPDATE dbo.state_legislation SET
                    bill_number = ?, title = ?, description = ?, summary = ?, state = ?, state_abbr = ?,
                    status = ?, category = ?, introduced_date = ?, last_action_date = ?,
                    session_id = ?, session_name = ?, bill_type = ?, body = ?,
                    legiscan_url = ?, pdf_url = ?, ai_summary = ?, ai_executive_summary = ?,
                    ai_talking_points = ?, ai_key_points = ?, ai_business_impact = ?,
                    ai_potential_impact = ?, ai_version = ?, last_updated = ?, reviewed = ?
                WHERE bill_id = ?
                """
                
                values = (
                    bill_data.get('bill_number', ''),
                    bill_data.get('title', ''),
                    bill_data.get('description', ''),
                    bill_data.get('summary', ''),  # Add summary field
                    bill_data.get('state', ''),
                    bill_data.get('state_abbr', ''),
                    bill_data.get('status', ''),
                    bill_data.get('category', ''),
                    bill_data.get('introduced_date'),
                    bill_data.get('last_action_date'),
                    bill_data.get('session_id', ''),
                    bill_data.get('session_name', ''),
                    bill_data.get('bill_type', ''),
                    bill_data.get('body', ''),
                    bill_data.get('legiscan_url', ''),
                    bill_data.get('pdf_url', ''),
                    bill_data.get('ai_summary', ''),
                    bill_data.get('ai_executive_summary', ''),
                    bill_data.get('ai_talking_points', ''),
                    bill_data.get('ai_key_points', ''),
                    bill_data.get('ai_business_impact', ''),
                    bill_data.get('ai_potential_impact', ''),
                    bill_data.get('ai_version', '1.0'),
                    datetime.utcnow(),
                    bill_data.get('reviewed', False),
                    bill_data.get('bill_id')
                )
                
                cursor.execute(update_query, values)
                print(f"✅ Updated existing bill: {bill_data.get('bill_id')}")
                
            else:
                # Insert new bill
                insert_query = """
                INSERT INTO dbo.state_legislation (
                    bill_id, bill_number, title, description, summary, state, state_abbr,
                    status, category, introduced_date, last_action_date,
                    session_id, session_name, bill_type, body,
                    legiscan_url, pdf_url, ai_summary, ai_executive_summary,
                    ai_talking_points, ai_key_points, ai_business_impact,
                    ai_potential_impact, ai_version, created_at, last_updated, reviewed
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """
                
                values = (
                    bill_data.get('bill_id', ''),
                    bill_data.get('bill_number', ''),
                    bill_data.get('title', ''),
                    bill_data.get('description', ''),
                    bill_data.get('summary', ''),  # Add summary field
                    bill_data.get('state', ''),
                    bill_data.get('state_abbr', ''),
                    bill_data.get('status', ''),
                    bill_data.get('category', ''),
                    bill_data.get('introduced_date'),
                    bill_data.get('last_action_date'),
                    bill_data.get('session_id', ''),
                    bill_data.get('session_name', ''),
                    bill_data.get('bill_type', ''),
                    bill_data.get('body', ''),
                    bill_data.get('legiscan_url', ''),
                    bill_data.get('pdf_url', ''),
                    bill_data.get('ai_summary', ''),
                    bill_data.get('ai_executive_summary', ''),
                    bill_data.get('ai_talking_points', ''),
                    bill_data.get('ai_key_points', ''),
                    bill_data.get('ai_business_impact', ''),
                    bill_data.get('ai_potential_impact', ''),
                    bill_data.get('ai_version', '1.0'),
                    datetime.utcnow(),
                    datetime.utcnow(),
                    bill_data.get('reviewed', False)
                )
                
                cursor.execute(insert_query, values)
                print(f"✅ Inserted new bill: {bill_data.get('bill_id')}")
            
            self.connection.commit()
            return True
            
        except Exception as e:
            print(f"❌ Error saving bill {bill_data.get('bill_id', 'unknown')}: {e}")
            self.connection.rollback()
            return False

# Pydantic models for requests
class LegiScanConfigRequest(BaseModel):
    """Configuration for LegiScan API requests"""
    default_limit: int = 100
    default_year_filter: str = 'all'  # 'all', 'current', 'recent'
    default_max_pages: int = 5
    enable_pagination: bool = True
    rate_limit_delay: float = 1.1

class LegiScanSearchRequest(BaseModel):
    query: str
    state: str
    limit: int = 100
    save_to_db: bool = True
    process_one_by_one: bool = False
    with_ai_analysis: bool = True
    enhanced_ai: bool = True
    year_filter: str = 'all'  # 'all', 'current', 'recent'
    max_pages: int = 5

class StateLegislationFetchRequest(BaseModel):
    states: List[str]
    save_to_db: bool = True
    bills_per_state: int = 50
    year_filter: str = 'all'
    max_pages: int = 3

class SessionStatusRequest(BaseModel):
    states: List[str]
    include_all_sessions: bool = False

async def check_legiscan_connection():
    """Check if LegiScan API is properly configured and working"""
    try:
        if not LEGISCAN_API_KEY:
            print("❌ LegiScan API key not configured")
            return "not_configured"
        
        import aiohttp
        
        # Test with a simple LegiScan API call
        url = f"https://api.legiscan.com/?key={LEGISCAN_API_KEY}&op=getSessionList&state=CA"
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get('status') == 'OK':
                        print("✅ LegiScan API connection successful")
                        return "connected"
                    else:
                        print(f"❌ LegiScan API error: {data.get('alert', 'Unknown error')}")
                        return "api_error"
                else:
                    print(f"❌ LegiScan API HTTP error: {response.status}")
                    return "http_error"
        
    except ImportError:
        print("❌ aiohttp not available for LegiScan test")
        return "dependency_error"
    except Exception as e:
        print(f"❌ LegiScan API test failed: {e}")
        return "connection_error"

# Traditional LegiScan API support
LEGISCAN_AVAILABLE = False
LEGISCAN_INITIALIZED = False
LegiScanAPI = None

# Import LegiScan API - with fallback handling
try:
    from legiscan_api import LegiScanAPI
    LEGISCAN_AVAILABLE = True
    print("✅ LegiScan API imported successfully")
    
    # Test initialization
    try:
        test_legiscan = LegiScanAPI()
        LEGISCAN_INITIALIZED = True
        print("✅ LegiScan API can be initialized")
        del test_legiscan
    except Exception as e:
        print(f"⚠️ LegiScan API import successful but initialization failed: {e}")
        LEGISCAN_INITIALIZED = False

except ImportError as e:
    print(f"❌ LegiScan API import failed: {e}")
    print("   Make sure legiscan_api.py is in the same directory as main.py")
    LEGISCAN_AVAILABLE = False
    LEGISCAN_INITIALIZED = False

except Exception as e:
    print(f"❌ Unexpected error importing LegiScan API: {e}")
    LEGISCAN_AVAILABLE = False
    LEGISCAN_INITIALIZED = False

def get_legiscan_status():
    """Get current LegiScan service status"""
    return {
        "api_key_configured": bool(LEGISCAN_API_KEY),
        "traditional_api_available": LEGISCAN_AVAILABLE,
        "traditional_api_initialized": LEGISCAN_INITIALIZED,
        "enhanced_client_available": True,
        "ai_client_available": bool(enhanced_ai_client)
    }

print("✅ LegiScan Service Module loaded successfully")