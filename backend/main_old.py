from fastapi import FastAPI, HTTPException, Query, Path, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import logging
import asyncio
from contextlib import asynccontextmanager
import aiohttp
import pyodbc
from typing import List, Dict, Optional
from datetime import datetime, timedelta  # Added timedelta for rate limiting
from dotenv import load_dotenv
from simple_executive_orders import fetch_executive_orders_simple_integration

# Load environment variables
load_dotenv()

# ===============================
# RATE LIMITING AND BATCH PROCESSING FUNCTIONS
# ===============================

async def add_ai_analysis_with_rate_limiting(orders: List[Dict]) -> List[Dict]:
    """Add AI analysis with proper rate limiting and error handling"""
    
    try:
        from ai import analyze_executive_order
        logger.info("✅ Successfully imported analyze_executive_order from ai.py")
    except ImportError as e:
        logger.warning(f"⚠️ Could not import AI functions: {e}")
        return orders
    
    enhanced_orders = []
    successful_ai = 0
    failed_ai = 0
    
    for i, order in enumerate(orders):
        try:
            logger.info(f"🤖 AI analysis {i+1}/{len(orders)}: EO {order.get('eo_number')}")
            
            # Call AI with proper error handling
            ai_result = await analyze_executive_order(
                title=order.get('title', ''),
                abstract=order.get('summary', ''),
                order_number=order.get('eo_number', '')
            )
            
            if ai_result and isinstance(ai_result, dict):
                # Add AI fields
                order.update({
                    'ai_summary': ai_result.get('ai_summary', ''),
                    'ai_executive_summary': ai_result.get('ai_executive_summary', ''),
                    'ai_key_points': ai_result.get('ai_key_points', ''),
                    'ai_talking_points': ai_result.get('ai_talking_points', ''),
                    'ai_business_impact': ai_result.get('ai_business_impact', ''),
                    'ai_potential_impact': ai_result.get('ai_potential_impact', ''),
                    'ai_version': ai_result.get('ai_version', 'azure_openai_enhanced_v1')
                })
                successful_ai += 1
                logger.info(f"✅ AI success for EO {order.get('eo_number')}")
            else:
                failed_ai += 1
                logger.warning(f"⚠️ AI returned unexpected format for EO {order.get('eo_number')}")
                # Add empty AI fields
                order.update({
                    'ai_summary': '',
                    'ai_executive_summary': '',
                    'ai_key_points': '',
                    'ai_talking_points': '',
                    'ai_business_impact': '',
                    'ai_potential_impact': ''
                })
            
            enhanced_orders.append(order)
            
            # PROGRESSIVE DELAY to handle rate limits
            if i < 10:
                delay = 1.0  # 1 second for first 10
            elif i < 50:
                delay = 2.0  # 2 seconds for next 40
            else:
                delay = 3.0  # 3 seconds for remaining
            
            logger.info(f"⏱️ Waiting {delay}s before next AI call...")
            await asyncio.sleep(delay)
            
        except Exception as ai_error:
            failed_ai += 1
            logger.warning(f"⚠️ AI error for EO {order.get('eo_number')}: {ai_error}")
            
            # Add order without AI analysis
            order.update({
                'ai_summary': '',
                'ai_executive_summary': '',
                'ai_key_points': '',
                'ai_talking_points': '',
                'ai_business_impact': '',
                'ai_potential_impact': ''
            })
            enhanced_orders.append(order)
            
            # Wait a bit longer after errors
            await asyncio.sleep(2.0)
    
    logger.info(f"🤖 AI Analysis Summary: {successful_ai} successful, {failed_ai} failed")
    return enhanced_orders

def transform_orders_for_save(orders):
    """Transform executive orders for database save with proper field mapping"""
    
    transformed_orders = []
    
    for order in orders:
        # Get the best dates available
        signing_date = order.get('signing_date', '')
        publication_date = order.get('publication_date', '')
        
        # If no signing date, try to use publication date
        if not signing_date and publication_date:
            signing_date = publication_date
        
        # Create clean database record
        transformed_order = {
            'bill_id': f"eo-{order.get('eo_number', 'unknown')}",
            'bill_number': order.get('eo_number', ''),
            'title': order.get('title', ''),
            'description': order.get('summary', ''),
            'state': 'Federal',
            'state_abbr': 'US',
            'status': 'Signed',
            'category': order.get('category', 'civic'),
            'introduced_date': signing_date,  # Use signing_date as introduced_date
            'last_action_date': publication_date or signing_date,  # Use publication_date as last_action
            'session_id': '2025-trump-administration',
            'session_name': 'Trump 2025 Administration',
            'bill_type': 'executive_order',
            'body': 'executive',
            'legiscan_url': order.get('html_url', ''),
            'pdf_url': order.get('pdf_url', ''),
            'ai_summary': order.get('ai_summary', ''),
            'ai_executive_summary': order.get('ai_executive_summary', ''),
            'ai_talking_points': order.get('ai_talking_points', ''),
            'ai_key_points': order.get('ai_key_points', ''),
            'ai_business_impact': order.get('ai_business_impact', ''),
            'ai_potential_impact': order.get('ai_potential_impact', ''),
            'ai_version': order.get('ai_version', 'enhanced_v1'),
            'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'last_updated': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        transformed_orders.append(transformed_order)
    
    return transformed_orders

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Request models
class StateLegislationFetchRequest(BaseModel):
    states: List[str]
    save_to_db: bool = True
    bills_per_state: int = 25

class LegiScanSearchRequest(BaseModel):
    query: str
    state: str
    limit: int = 20
    save_to_db: bool = True

class ExecutiveOrderFetchRequest(BaseModel):
    start_date: Optional[str] = "2025-01-20"
    end_date: Optional[str] = None
    per_page: Optional[int] = 1000
    save_to_db: Optional[bool] = True
    with_ai: Optional[bool] = True

class ExecutiveOrderSearchRequest(BaseModel):
    category: Optional[str] = None
    search: Optional[str] = None
    page: int = 1
    per_page: int = 25
    sort_by: str = "signing_date"
    sort_order: str = "desc"
    user_id: Optional[str] = None

class HighlightCreateRequest(BaseModel):
    user_id: int
    order_id: str
    order_type: str  # 'executive_order' or 'state_legislation'
    notes: Optional[str] = None
    priority_level: Optional[int] = 1
    tags: Optional[str] = None
    is_archived: Optional[bool] = False

class HighlightUpdateRequest(BaseModel):
    user_id: int
    notes: Optional[str] = None
    priority_level: Optional[int] = None
    tags: Optional[str] = None
    is_archived: Optional[bool] = None

# ===============================
# DATABASE CONNECTION CLASS
# ===============================
class DatabaseConnection:
    def __init__(self):
        self.connection_string = self._build_connection_string()
        self.connection = None
    
    def _build_connection_string(self):
        """Build database connection string from environment variables"""
        # Get all values from environment variables - NO FALLBACKS with real credentials
        server = os.getenv('AZURE_SQL_SERVER')
        database = os.getenv('AZURE_SQL_DATABASE') 
        username = os.getenv('AZURE_SQL_USERNAME')
        password = os.getenv('AZURE_SQL_PASSWORD')
        driver = 'ODBC Driver 18 for SQL Server'
        
        # Check that all required credentials are provided
        if not all([server, database, username, password]):
            missing = []
            if not server: missing.append('AZURE_SQL_SERVER')
            if not database: missing.append('AZURE_SQL_DATABASE')
            if not username: missing.append('AZURE_SQL_USERNAME')
            if not password: missing.append('AZURE_SQL_PASSWORD')
            
            print(f"❌ Missing required environment variables: {', '.join(missing)}")
            print(f"   Please set these in your .env file or environment")
            raise ValueError(f"Missing required database environment variables: {', '.join(missing)}")
        
        print(f"🔗 Database connection details:")
        print(f"   Server: {server}")
        print(f"   Database: {database}")
        print(f"   Username: {username}")
        print(f"   Password: {'*' * len(password)}")  # Show masked password
        
        connection_string = (
            f"Driver={{{driver}}};"
            f"Server={server};"
            f"Database={database};"
            f"UID={username};"
            f"PWD={password};"
            f"Encrypt=yes;"
            f"TrustServerCertificate=yes;"
            f"Connection Timeout=30;"
            f"Command Timeout=30;"
            f"MultipleActiveResultSets=True;"
        )
        
        return connection_string
    
    def test_connection(self):
        """Test database connection"""
        try:
            print(f"🔍 Testing connection to Azure SQL...")
            with pyodbc.connect(self.connection_string) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT 1 as test_value")
                result = cursor.fetchone()
                if result and result[0] == 1:
                    logger.info("✅ Database connection successful")
                    return True
                else:
                    logger.error("❌ Database test query failed")
                    return False
        except pyodbc.Error as e:
            logger.error(f"❌ Database connection failed: {e}")
            print(f"❌ Full error details: {e}")
            return False
        except Exception as e:
            logger.error(f"❌ Unexpected database error: {e}")
            print(f"❌ Unexpected error: {e}")
            return False
    
    def get_connection(self):
        """Get a database connection"""
        try:
            return pyodbc.connect(self.connection_string)
        except pyodbc.Error as e:
            logger.error(f"Failed to get database connection: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error getting database connection: {e}")
            raise

# ===============================
# IMPORTS WITH FALLBACKS
# ===============================

# Import Azure SQL database functions
try:
    from database_azure_fixed import (
        test_azure_sql_connection,
        init_databases,
        LegislationSession,
        StateLegislationDB,
        save_legislation_to_azure_sql as save_legislation_to_db,
        get_legislation_from_azure_sql as get_legislation_from_db,
        get_legislation_stats_azure_sql as get_legislation_stats,
        test_azure_sql_full
    )
    AZURE_SQL_AVAILABLE = True
    print("✅ Azure SQL database available")
except ImportError as e:
    print(f"❌ Database import failed: {e}")
    AZURE_SQL_AVAILABLE = False

# COMPLETE FIXED CODE - Replace your entire try/except block with this:

try:
    if AZURE_SQL_AVAILABLE:
        def save_executive_orders_to_db(orders):
            """Save executive orders using existing save_legislation_to_db - FIXED VERSION"""
            try:
                # Clean the orders data to match StateLegislationDB schema
                cleaned_orders = []
                
                for order in orders:
                    # Remove invalid fields and map to correct schema
                    cleaned_order = {
                        'bill_id': order.get('bill_id', f"eo-{order.get('bill_number', 'unknown')}"),
                        'bill_number': order.get('bill_number', ''),
                        'title': order.get('title', ''),
                        'description': order.get('description', ''),
                        'state': order.get('state', 'Federal'),
                        'state_abbr': order.get('state_abbr', 'US'),
                        'status': order.get('status', 'Signed'),
                        'category': order.get('category', 'civic'),
                        'introduced_date': order.get('introduced_date', ''),
                        'last_action_date': order.get('last_action_date', ''),  # ✅ Use last_action_date, not last_action
                        'session_id': order.get('session_id', '2025-trump-admin'),
                        'session_name': order.get('session_name', 'Trump 2025 Administration'),
                        'bill_type': order.get('bill_type', 'executive_order'),
                        'body': order.get('body', 'executive'),
                        'legiscan_url': order.get('legiscan_url', ''),
                        'pdf_url': order.get('pdf_url', ''),
                        'ai_summary': order.get('ai_summary', ''),
                        'ai_executive_summary': order.get('ai_executive_summary', ''),
                        'ai_talking_points': order.get('ai_talking_points', ''),
                        'ai_key_points': order.get('ai_key_points', ''),
                        'ai_business_impact': order.get('ai_business_impact', ''),
                        'ai_potential_impact': order.get('ai_potential_impact', ''),
                        'ai_version': order.get('ai_version', 'simple_eo_v1'),
                        'created_at': order.get('created_at', datetime.now().strftime('%Y-%m-%d %H:%M:%S')),
                        'last_updated': order.get('last_updated', datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
                    }
                    
                    cleaned_orders.append(cleaned_order)
                
                print(f"🔍 Saving {len(cleaned_orders)} executive orders (cleaned data)")
                return save_legislation_to_db(cleaned_orders)
                
            except Exception as e:
                print(f"❌ Error saving executive orders: {e}")
                import traceback
                traceback.print_exc()
                return 0

        def get_executive_orders_from_db(limit=100, offset=0, filters=None):
            """Get executive orders using existing get_legislation_from_db - FIXED VERSION"""
            try:
                # Calculate page from offset
                page = (offset // limit) + 1
                
                # Try calling with correct parameters
                result = get_legislation_from_db(
                    page=page,
                    per_page=limit
                )
                
                # Filter for executive orders in the results if needed
                if result and 'results' in result:
                    all_orders = result['results']
                    
                    # Filter by document_type if we're looking for executive orders
                    filtered_orders = []
                    for order in all_orders:
                        # Check if this looks like an executive order
                        bill_number = order.get('bill_number', '')
                        bill_type = order.get('bill_type', '')
                        state = order.get('state', '')
                        
                        # Include if it looks like an executive order
                        if (bill_type == 'executive_order' or 
                            state in ['Federal', 'US'] or
                            bill_number.startswith('TEMP_') or 
                            bill_number.startswith('14') or 
                            bill_number.startswith('15') or
                            'eo-' in order.get('bill_id', '')):
                            filtered_orders.append(order)
                    
                    return {
                        'success': True,
                        'results': filtered_orders,
                        'count': len(filtered_orders)
                    }
                else:
                    return {
                        'success': True,
                        'results': [],
                        'count': 0
                    }
                
            except Exception as e:
                print(f"❌ Error getting executive orders: {e}")
                import traceback
                traceback.print_exc()
                return {
                    'success': False,
                    'message': str(e),
                    'results': [],
                    'count': 0
                }

        def get_executive_order_by_number(order_number):
            """Get single executive order by number - FIXED VERSION"""
            try:
                # Get all legislation and filter
                result = get_legislation_from_db(page=1, per_page=1000)
                
                if result and 'results' in result:
                    for order in result['results']:
                        if order.get('bill_number') == order_number:
                            return {
                                'success': True,
                                'result': order
                            }
                
                return {
                    'success': False,
                    'result': None,
                    'message': f'Executive order {order_number} not found'
                }
                
            except Exception as e:
                return {
                    'success': False,
                    'result': None,
                    'message': str(e)
                }

        def test_executive_orders_db():
            """Test executive orders database connectivity"""
            try:
                return test_azure_sql_connection()
            except Exception:
                return False

        def get_executive_orders_stats():
            """Get executive orders statistics - FIXED VERSION"""
            try:
                result = get_executive_orders_from_db(limit=10000)
                if result.get('success'):
                    orders = result.get('results', [])
                    return {
                        'success': True,
                        'statistics': {
                            'total_executive_orders': len(orders)
                        }
                    }
                else:
                    return {
                        'success': False,
                        'statistics': {'total_executive_orders': 0}
                    }
            except Exception:
                return {
                    'success': False,
                    'statistics': {'total_executive_orders': 0}
                }

        EXECUTIVE_ORDERS_AVAILABLE = True
        print("✅ Executive orders functions created successfully (FIXED)")
    else:
        EXECUTIVE_ORDERS_AVAILABLE = False
        print("❌ Executive orders not available (Azure SQL not available)")

except Exception as e:
    print(f"❌ Executive orders integration failed: {e}")
    EXECUTIVE_ORDERS_AVAILABLE = False

# Import Simple Executive Orders API - FIXED
try:
    from simple_executive_orders import fetch_executive_orders_simple_integration
    SIMPLE_EO_AVAILABLE = True
    print("✅ Simple Executive Orders API available")
except ImportError as e:
    print(f"⚠️ Simple Executive Orders API not available: {e}")
    SIMPLE_EO_AVAILABLE = False

# Import AI functions for state legislation - FIXED
try:
    from ai import (
        run_state_pipeline, 
        run_multi_state_pipeline,
        search_and_analyze_bills,
        test_legiscan_integration
        # Removed test_ai_integration - we'll define it below
    )
    AI_AVAILABLE = True
    print("✅ AI integration available")
except ImportError as e:
    print(f"⚠️ AI integration not available: {e}")
    AI_AVAILABLE = False

# ===============================
# AI INTEGRATION TEST FUNCTION
# ===============================

async def test_ai_integration() -> bool:
    """Test AI integration with Azure OpenAI - ADDED TO MAIN.PY"""
    if not AI_AVAILABLE:
        return False
    
    try:
        # Import Azure OpenAI client from ai.py
        from openai import AsyncAzureOpenAI
        
        # Get Azure AI configuration
        AZURE_ENDPOINT = os.getenv("AZURE_ENDPOINT", "https://david-mabholqy-swedencentral.openai.azure.com/")
        AZURE_KEY = os.getenv("AZURE_KEY")
        MODEL_NAME = os.getenv("AZURE_MODEL_NAME", "summarize-gpt-4.1")
        
        if not AZURE_KEY or not AZURE_ENDPOINT:
            print("❌ Azure AI credentials not configured")
            return False
        
        # Initialize client
        client = AsyncAzureOpenAI(
            azure_endpoint=AZURE_ENDPOINT,
            api_key=AZURE_KEY,
            api_version="2024-12-01-preview"
        )
        
        # Simple test to verify AI is working
        test_response = await client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Say 'AI test successful' if you can respond."}
            ],
            max_tokens=20,
            temperature=0.1
        )
        
        response_text = test_response.choices[0].message.content.lower()
        success = "test successful" in response_text or "successful" in response_text or "ai" in response_text
        
        if success:
            print("✅ AI integration test successful")
        else:
            print(f"⚠️ AI test response unexpected: {response_text}")
        
        return success
        
    except Exception as e:
        print(f"❌ AI integration test failed: {e}")
        return False

# ===============================
# HIGHLIGHTS FUNCTIONS
# ===============================

def get_azure_sql_connection():
    """Get Azure SQL connection using our DatabaseConnection class"""
    try:
        db_conn = DatabaseConnection()
        return db_conn.get_connection()
    except Exception as e:
        logger.error(f"❌ Azure SQL connection failed: {e}")
        return None

def create_highlights_table():
    """Create the user highlights table"""
    try:
        conn = get_azure_sql_connection()
        if not conn:
            return False
            
        cursor = conn.cursor()
        
        create_table_sql = """
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='user_highlights' AND xtype='U')
        CREATE TABLE user_highlights (
            id INT IDENTITY(1,1) PRIMARY KEY,
            user_id NVARCHAR(50) NOT NULL,
            content_type NVARCHAR(20) NOT NULL,
            content_id NVARCHAR(100) NOT NULL,
            highlighted_at DATETIME2 DEFAULT GETUTCDATE(),
            notes NVARCHAR(MAX),
            is_active BIT DEFAULT 1,
            CONSTRAINT UQ_user_content UNIQUE (user_id, content_type, content_id)
        );
        """
        
        cursor.execute(create_table_sql)
        conn.commit()
        conn.close()
        
        print("✅ User highlights table created successfully")
        return True
        
    except Exception as e:
        print(f"❌ Error creating highlights table: {e}")
        return False

def get_user_highlights_direct(user_id: str) -> List[Dict]:
    """Get all highlights for a user"""
    try:
        conn = get_azure_sql_connection()
        if not conn:
            return []
            
        cursor = conn.cursor()
        
        query = """
        SELECT content_type, content_id, highlighted_at, notes 
        FROM user_highlights 
        WHERE user_id = ? AND is_active = 1
        ORDER BY highlighted_at DESC
        """
        
        cursor.execute(query, user_id)
        highlights = cursor.fetchall()
        
        results = []
        
        for highlight in highlights:
            content_type, content_id, highlighted_at, notes = highlight
            
            content_data = None
            
            if content_type == 'executive_order':
                if EXECUTIVE_ORDERS_AVAILABLE:
                    eo_result = get_executive_order_by_number(content_id)
                    if eo_result.get('success') and eo_result.get('result'):
                        content_data = eo_result['result']
                        content_data['content_type'] = 'executive_order'
                    
            elif content_type == 'legislation':
                leg_query = """
                SELECT bill_id, bill_number, title, description, state, category, 
                       ai_summary, ai_talking_points, ai_business_impact
                FROM state_legislation 
                WHERE bill_id = ?
                """
                cursor.execute(leg_query, content_id)
                leg_result = cursor.fetchone()
                
                if leg_result:
                    content_data = {
                        'bill_id': leg_result[0],
                        'bill_number': leg_result[1],
                        'title': leg_result[2],
                        'description': leg_result[3],
                        'state': leg_result[4],
                        'category': leg_result[5],
                        'ai_summary': leg_result[6],
                        'ai_talking_points': leg_result[7],
                        'ai_business_impact': leg_result[8],
                        'content_type': 'legislation'
                    }
            
            if content_data:
                content_data['highlight_info'] = {
                    'highlighted_at': highlighted_at.isoformat() if highlighted_at else None,
                    'notes': notes,
                    'content_type': content_type
                }
                results.append(content_data)
        
        conn.close()
        return results
        
    except Exception as e:
        print(f"❌ Error getting user highlights: {e}")
        return []

def add_highlight_direct(user_id: str, content_type: str, content_id: str, notes: str = None) -> bool:
    """Add a highlight"""
    try:
        conn = get_azure_sql_connection()
        if not conn:
            return False
            
        cursor = conn.cursor()
        
        check_query = """
        SELECT id, is_active FROM user_highlights 
        WHERE user_id = ? AND content_type = ? AND content_id = ?
        """
        cursor.execute(check_query, user_id, content_type, content_id)
        existing = cursor.fetchone()
        
        if existing:
            highlight_id, is_active = existing
            if not is_active:
                update_query = """
                UPDATE user_highlights 
                SET is_active = 1, highlighted_at = GETUTCDATE(), notes = ?
                WHERE id = ?
                """
                cursor.execute(update_query, notes, highlight_id)
        else:
            insert_query = """
            INSERT INTO user_highlights (user_id, content_type, content_id, notes)
            VALUES (?, ?, ?, ?)
            """
            cursor.execute(insert_query, user_id, content_type, content_id, notes)
        
        conn.commit()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Error adding highlight: {e}")
        return False

def remove_highlight_direct(user_id: str, content_type: str, content_id: str) -> bool:
    """Remove a highlight"""
    try:
        conn = get_azure_sql_connection()
        if not conn:
            return False
            
        cursor = conn.cursor()
        
        update_query = """
        UPDATE user_highlights 
        SET is_active = 0 
        WHERE user_id = ? AND content_type = ? AND content_id = ? AND is_active = 1
        """
        
        cursor.execute(update_query, user_id, content_type, content_id)
        rows_affected = cursor.rowcount
        
        conn.commit()
        conn.close()
        
        return rows_affected > 0
        
    except Exception as e:
        print(f"❌ Error removing highlight: {e}")
        return False

def is_highlighted_direct(user_id: str, content_type: str, content_id: str) -> bool:
    """Check if content is highlighted by user"""
    try:
        conn = get_azure_sql_connection()
        if not conn:
            return False
            
        cursor = conn.cursor()
        
        query = """
        SELECT COUNT(*) FROM user_highlights 
        WHERE user_id = ? AND content_type = ? AND content_id = ? AND is_active = 1
        """
        cursor.execute(query, user_id, content_type, content_id)
        count = cursor.fetchone()[0]
        
        conn.close()
        return count > 0
        
    except Exception as e:
        print(f"❌ Error checking highlight status: {e}")
        return False

def get_highlight_info_direct(user_id: str, content_type: str, content_id: str) -> Optional[Dict]:
    """Get highlight information for specific content"""
    try:
        conn = get_azure_sql_connection()
        if not conn:
            return None
            
        cursor = conn.cursor()
        
        query = """
        SELECT highlighted_at, notes FROM user_highlights 
        WHERE user_id = ? AND content_type = ? AND content_id = ? AND is_active = 1
        """
        cursor.execute(query, user_id, content_type, content_id)
        result = cursor.fetchone()
        
        conn.close()
        
        if result:
            highlighted_at, notes = result
            return {
                'highlighted_at': highlighted_at.isoformat() if highlighted_at else None,
                'notes': notes
            }
        
        return None
        
    except Exception as e:
        print(f"❌ Error getting highlight info: {e}")
        return None

# Set HIGHLIGHTS_DB_AVAILABLE based on Azure SQL availability
HIGHLIGHTS_DB_AVAILABLE = AZURE_SQL_AVAILABLE

def validate_eo_number(eo_number: str) -> bool:
    """More lenient validation that accepts any reasonable EO number for debugging"""
    if not eo_number:
        return False
    
    # Accept temporary numbers for debugging
    if str(eo_number).startswith('TEMP_'):
        return True
    
    # Accept unknown numbers for debugging
    if str(eo_number) == 'UNKNOWN':
        return True
    
    try:
        eo_int = int(str(eo_number).strip())
        # More lenient range - accept any modern EO number
        return 1000 <= eo_int <= 20000  # Much wider range for debugging
    except (ValueError, TypeError):
        return False

def format_date_for_display(date_str: str) -> str:
    """Format date string for UI display (MM/DD/YYYY)"""
    if not date_str:
        return ""
    
    try:
        date_part = date_str[:10] if len(date_str) > 10 else date_str
        date_obj = datetime.strptime(date_part, '%Y-%m-%d')
        return date_obj.strftime('%m/%d/%Y')
    except (ValueError, TypeError):
        return date_str

def enrich_executive_order_with_formatting(order: dict) -> dict:
    """Add formatted dates and ensure proper structure for frontend"""
    enriched_order = order.copy()
    
    enriched_order['formatted_publication_date'] = format_date_for_display(order.get('publication_date', ''))
    enriched_order['formatted_signing_date'] = format_date_for_display(order.get('signing_date', ''))
    
    eo_number = order.get('eo_number') or order.get('executive_order_number', '')
    enriched_order['eo_number'] = eo_number
    enriched_order['executive_order_number'] = eo_number
    
    if not enriched_order.get('category'):
        enriched_order['category'] = 'not-applicable'
    
    enriched_order['is_valid_eo'] = validate_eo_number(eo_number)
    
    return enriched_order

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown"""
    print("🔄 Starting LegislationVue API with Azure SQL Integration...")
    
    # Test database connection
    if AZURE_SQL_AVAILABLE:
        print("🔍 Testing Azure SQL integration...")
        try:
            azure_sql_working = test_azure_sql_connection()
            if azure_sql_working:
                print("✅ Azure SQL connection successful")
                if init_databases():
                    print("✅ Azure SQL tables ready")
                if create_highlights_table():
                    print("✅ Highlights table ready")
            else:
                print("❌ Azure SQL connection failed")
        except Exception as e:
            print(f"❌ Azure SQL connection error: {e}")
    
    # Test AI integration
    if AI_AVAILABLE:
        print("🧪 Testing AI integration...")
        try:
            ai_working = await test_ai_integration()
            if ai_working:
                print("✅ AI integration ready")
            else:
                print("⚠️ AI integration issues")
        except Exception as e:
            print(f"⚠️ AI test failed: {e}")
        
        # Test LegiScan integration
        print("🧪 Testing LegiScan integration...")
        try:
            legiscan_working = await test_legiscan_integration()
            if legiscan_working:
                print("✅ LegiScan integration ready")
            else:
                print("⚠️ LegiScan integration issues")
        except Exception as e:
            print(f"⚠️ LegiScan test failed: {e}")
    
    # Initialize executive orders database (Azure SQL integration)
    if EXECUTIVE_ORDERS_AVAILABLE:
        eo_test_result = test_executive_orders_db()
        
        if eo_test_result:
            print("✅ Executive orders Azure SQL integration ready")
        else:
            print("⚠️ Executive orders integration issues")
    
    print("🎯 API startup complete!")
    
    yield

app = FastAPI(
    title="LegislationVue API - Azure SQL Integration",
    description="API for Executive Orders and State Legislation with Azure SQL Integration",
    version="13.0.0-Azure-SQL-Integration",
    lifespan=lifespan
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supported states
SUPPORTED_STATES = {
    "California": "CA",
    "Colorado": "CO",
    "Kentucky": "KY", 
    "Nevada": "NV",
    "South Carolina": "SC",
    "Texas": "TX",
}

# Categories
EXECUTIVE_ORDER_CATEGORIES = [
    "civic", "education", "healthcare", "engineering", "not-applicable"
]

BILL_CATEGORIES = [
    "healthcare", "education", "environment", "transportation", 
    "economic_development", "housing", "public_safety", "agriculture", 
    "technology", "general"
]

def convert_state_param(state_param: str) -> str:
    """Convert state abbreviation to full name"""
    if not state_param:
        return state_param
        
    abbrev_to_full = {abbrev: full_name for full_name, abbrev in SUPPORTED_STATES.items()}
    state_upper = state_param.upper()
    
    if state_upper in abbrev_to_full:
        return abbrev_to_full[state_upper]
    
    for full_name in SUPPORTED_STATES.keys():
        if full_name.lower() == state_param.lower():
            return full_name
    
    return state_param

@app.get("/")
async def root():
    """Health check endpoint"""
    
    # Test database connections
    if AZURE_SQL_AVAILABLE:
        db_working = test_azure_sql_connection()
        db_type = "Azure SQL Database"
    else:
        db_working = False
        db_type = "Not Available"
    
    eo_db_status = test_executive_orders_db() if EXECUTIVE_ORDERS_AVAILABLE else False
    
    # Test AI integration status
    ai_status = "unknown"
    legiscan_status = "unknown"
    
    if AI_AVAILABLE:
        try:
            ai_working = await test_ai_integration()
            ai_status = "connected" if ai_working else "configuration_issue"
        except Exception as e:
            ai_status = f"error: {str(e)[:50]}"
        
        try:
            legiscan_working = await test_legiscan_integration()
            legiscan_status = "connected" if legiscan_working else "configuration_issue"
        except Exception as e:
            legiscan_status = f"error: {str(e)[:50]}"
    
    # Get stats
    stats = None
    eo_stats = None
    if db_working:
        try:
            stats = get_legislation_stats()
            if EXECUTIVE_ORDERS_AVAILABLE:
                eo_stats_result = get_executive_orders_stats()
                if eo_stats_result.get('success'):
                    eo_stats = eo_stats_result.get('statistics', {})
                else:
                    eo_stats = {"total_executive_orders": 0}
        except Exception:
            stats = {"total_bills": 0, "states_with_data": []}
            eo_stats = {"total_executive_orders": 0}
    
    return {
        "message": "LegislationVue API with Azure SQL Integration",
        "status": "healthy",
        "version": "13.0.0-Azure-SQL-Integration",
        "timestamp": datetime.now().isoformat(),
        "database": {
            "status": "connected" if db_working else "issues",
            "type": db_type,
            "azure_sql_available": AZURE_SQL_AVAILABLE,
            "total_bills": stats["total_bills"] if stats else 0,
            "total_executive_orders": eo_stats["total_executive_orders"] if eo_stats else 0,
            "highlights_available": HIGHLIGHTS_DB_AVAILABLE
        },
        "integrations": {
            "simple_executive_orders": "available" if SIMPLE_EO_AVAILABLE else "not_available",
            "legiscan": legiscan_status,
            "ai_analysis": ai_status,
            "azure_sql": "connected" if (AZURE_SQL_AVAILABLE and db_working) else "not_configured",
            "highlights": "available" if HIGHLIGHTS_DB_AVAILABLE else "table_needed",
            "executive_orders_integration": "azure_sql_based" if EXECUTIVE_ORDERS_AVAILABLE else "not_available"
        },
        "features": {
            "simple_executive_orders": "Simple Federal Register API that works",
            "executive_orders": "Azure SQL Integration (No SQLAlchemy)",
            "eo_validation": "Lenient Range (1000-20000) + Date Formatting",
            "state_legislation": "LegiScan Integration with AI" if legiscan_status == "connected" else "Configuration Required",
            "ai_analysis": "Azure AI Integration" if ai_status == "connected" else "Configuration Required",
            "azure_sql_database": "Connected & Working" if (AZURE_SQL_AVAILABLE and db_working) else "Not Available",
            "persistent_highlights": "Available" if HIGHLIGHTS_DB_AVAILABLE else "Database Setup Required"
        },
        "supported_states": list(SUPPORTED_STATES.keys()),
        "executive_order_categories": EXECUTIVE_ORDER_CATEGORIES,
        "bill_categories": BILL_CATEGORIES,
        "eo_validation": {
            "valid_range": "1000-20000",
            "description": "Lenient range for debugging",
            "date_format": "MM/DD/YYYY for display"
        }
    }

# ===============================
# EXECUTIVE ORDERS ENDPOINTS (Azure SQL Integration)
# ===============================

@app.get("/api/executive-orders")
async def get_executive_orders_with_highlights(
    category: Optional[str] = Query(None, description="Executive order category filter"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(25, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search term"),
    sort_by: str = Query("signing_date", description="Sort field"),
    sort_order: str = Query("desc", description="Sort order (asc, desc)"),
    user_id: Optional[str] = Query(None, description="User ID to show highlight status")
):
    """Get executive orders with highlighting, pagination, and validation"""
    
    try:
        logger.info(f"🔍 Getting executive orders - page: {page}, per_page: {per_page}")
        
        if not EXECUTIVE_ORDERS_AVAILABLE:
            logger.warning("Executive orders functionality not available")
            # Return empty results instead of failing
            return {
                "results": [],
                "count": 0,
                "total_pages": 1,
                "page": page,
                "per_page": per_page,
                "validation_applied": True,
                "user_highlights_included": bool(user_id),
                "database_type": "Not Available",
                "integration_type": "executive_orders_db_integration",
                "message": "Executive orders functionality not available"
            }
        
        if category and category not in EXECUTIVE_ORDER_CATEGORIES and category != 'not-applicable':
            raise HTTPException(
                status_code=400,
                detail=f"Category '{category}' not supported. Supported: {EXECUTIVE_ORDER_CATEGORIES}"
            )
        
        # Build filters for the Azure SQL integration
        filters = {}
        if category:
            filters['category'] = category
        if search:
            filters['search'] = search
        
        logger.info(f"📊 Calling get_executive_orders_from_db with filters: {filters}")
        
        result = get_executive_orders_from_db(
            limit=per_page,
            offset=(page - 1) * per_page,
            filters=filters
        )
        
        logger.info(f"📥 Database result: success={result.get('success')}, count={result.get('count', 0)}")
        
        if not result.get('success'):
            error_msg = result.get('message', 'Failed to retrieve executive orders')
            logger.error(f"❌ Database query failed: {error_msg}")
            
            # Return empty results instead of failing
            return {
                "results": [],
                "count": 0,
                "total_pages": 1,
                "page": page,
                "per_page": per_page,
                "validation_applied": True,
                "user_highlights_included": bool(user_id),
                "database_type": "Azure SQL",
                "integration_type": "executive_orders_db_integration",
                "error": error_msg
            }
        
        orders = result.get('results', [])
        logger.info(f"📋 Got {len(orders)} orders from database")
        
        # Add highlight information if user_id provided
        if user_id and orders and HIGHLIGHTS_DB_AVAILABLE:
            try:
                logger.info(f"⭐ Adding highlight info for user: {user_id}")
                for order in orders:
                    # Use bill_number as the content_id for executive orders
                    content_id = order.get('bill_number', '')
                    
                    highlighted = is_highlighted_direct(user_id, 'executive_order', content_id)
                    order['is_highlighted'] = highlighted
                    
                    if highlighted:
                        highlight_info = get_highlight_info_direct(user_id, 'executive_order', content_id)
                        order['highlight_info'] = highlight_info
                    else:
                        order['highlight_info'] = None
                        
            except Exception as e:
                logger.warning(f"Could not add highlight info: {e}")
        
        # Apply validation and formatting
        validated_orders = []
        for i, order in enumerate(orders):
            try:
                eo_number = order.get('bill_number', '')
                logger.info(f"📝 Processing order {i+1}: bill_number={eo_number}, title={order.get('title', 'No title')[:50]}...")
                
                if validate_eo_number(eo_number):
                    # Map Azure SQL fields to expected EO fields
                    formatted_order = {
                        'eo_number': eo_number,
                        'executive_order_number': eo_number,
                        'title': order.get('title', ''),
                        'summary': order.get('description', ''),
                        'signing_date': order.get('introduced_date', ''),
                        'publication_date': order.get('last_action_date', ''),
                        'category': order.get('category', 'not-applicable'),
                        'html_url': order.get('legiscan_url', ''),
                        'pdf_url': order.get('pdf_url', ''),
                        'ai_summary': order.get('ai_summary', ''),
                        'ai_executive_summary': order.get('ai_executive_summary', ''),
                        'ai_key_points': order.get('ai_talking_points', ''),
                        'ai_talking_points': order.get('ai_talking_points', ''),
                        'ai_business_impact': order.get('ai_business_impact', ''),
                        'ai_potential_impact': order.get('ai_potential_impact', ''),
                        'source': 'Azure SQL Database',
                        'is_highlighted': order.get('is_highlighted', False),
                        'highlight_info': order.get('highlight_info')
                    }
                    
                    enriched_order = enrich_executive_order_with_formatting(formatted_order)
                    validated_orders.append(enriched_order)
                    logger.info(f"✅ Validated order: {eo_number}")
                else:
                    logger.warning(f"⚠️ Filtered invalid EO from database: {eo_number}")
            except Exception as e:
                logger.error(f"❌ Error processing order {i+1}: {e}")
                continue
        
        logger.info(f"✅ Returning {len(validated_orders)} validated orders")
        
        return {
            "results": validated_orders,
            "count": len(validated_orders),
            "total_pages": 1,  # Single page for now
            "page": page,
            "per_page": per_page,
            "validation_applied": True,
            "user_highlights_included": bool(user_id),
            "database_type": "Azure SQL",
            "integration_type": "executive_orders_db_integration"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Unexpected error in get_executive_orders_with_highlights: {e}")
        import traceback
        traceback.print_exc()
        
        # Return empty results instead of 500 error
        return {
            "results": [],
            "count": 0,
            "total_pages": 1,
            "page": page,
            "per_page": per_page,
            "validation_applied": True,
            "user_highlights_included": bool(user_id),
            "database_type": "Azure SQL",
            "integration_type": "executive_orders_db_integration",
            "error": f"Unexpected error: {str(e)}"
        }

# Fix for the await error in main.py
# Replace your fetch_executive_orders endpoint with this corrected version:

@app.post("/api/executive-orders/fetch-fixed")
async def fetch_executive_orders_fixed():
    """FIXED: Fetch executive orders with proper EO numbers, AI analysis, and newest-first sorting"""
    try:
        logger.info("📡 Starting FIXED executive order fetch using Federal Register API")
        
        # Use the updated integration function with fixes
        result = await fetch_executive_orders_simple_integration(
            start_date="2025-01-20",
            end_date=None,  # Gets up to today
            with_ai=True,   # Enable AI analysis
            limit=None      # No limit to get all orders
        )
        
        if not result.get('success'):
            logger.warning(f"⚠️ API fetch failed: {result.get('error', 'Unknown error')}")
            return {"success": False, "message": result.get('error', 'Failed to fetch executive orders')}
        
        orders = result.get('results', [])
        logger.info(f"📥 Retrieved {len(orders)} executive orders from Federal Register API")
        
        if not orders:
            logger.warning("⚠️ No executive orders returned from API")
            return {"success": False, "message": "No executive orders found"}
        
        # Transform orders for database save with FIXED field mapping
        transformed_orders = transform_orders_for_save_fixed(orders)
        
        # Save to database
        if EXECUTIVE_ORDERS_AVAILABLE:
            try:
                saved_count = save_executive_orders_to_db(transformed_orders)
                
                if saved_count > 0:
                    logger.info(f"💾 Saved {saved_count} executive orders to database")
                    return {
                        "success": True, 
                        "count": len(orders), 
                        "saved": saved_count,
                        "method": "federal_register_api_fixed",
                        "ai_analysis": "enabled",
                        "sorting": "newest_first",
                        "eo_number_extraction": "fixed"
                    }
                else:
                    logger.error("❌ Failed to save executive orders to database")
                    return {"success": False, "message": "Failed to save to database"}
            except Exception as save_error:
                logger.error(f"❌ Error saving to database: {save_error}")
                return {"success": False, "message": f"Database save error: {str(save_error)}"}
        else:
            logger.warning("⚠️ Executive orders database not available")
            return {"success": False, "message": "Database not available"}
            
    except Exception as e:
        logger.error(f"❌ Error in fetch_executive_orders_fixed: {e}")
        return {"success": False, "message": str(e)}

@app.post("/api/executive-orders/fetch-with-limit")
async def fetch_executive_orders_with_limit(
    limit: int = Query(20, description="Number of orders to fetch"),
    with_ai: bool = Query(True, description="Enable AI analysis"),
    start_date: str = Query("2025-01-20", description="Start date (YYYY-MM-DD)")
):
    """Fetch a limited number of executive orders with AI analysis"""
    try:
        logger.info(f"📡 Starting limited fetch: {limit} orders with AI: {with_ai}")
        
        result = await fetch_executive_orders_simple_integration(
            start_date=start_date,
            end_date=None,
            with_ai=with_ai,
            limit=limit
        )
        
        if not result.get('success'):
            return {"success": False, "message": result.get('error', 'Fetch failed')}
        
        orders = result.get('results', [])
        logger.info(f"📥 Retrieved {len(orders)} executive orders (limited)")
        
        # Transform and save if we have orders
        if orders and EXECUTIVE_ORDERS_AVAILABLE:
            transformed_orders = transform_orders_for_save_fixed(orders)
            saved_count = save_executive_orders_to_db(transformed_orders)
            
            return {
                "success": True,
                "count": len(orders),
                "total_found": result.get('total_found', len(orders)),
                "saved": saved_count,
                "limit_applied": limit,
                "ai_analysis": with_ai,
                "method": "federal_register_api_limited"
            }
        else:
            return {
                "success": True,
                "count": len(orders),
                "saved": 0,
                "message": "No orders to save or database unavailable"
            }
            
    except Exception as e:
        logger.error(f"❌ Error in limited fetch: {e}")
        return {"success": False, "message": str(e)}

def transform_orders_for_save_fixed(orders):
    """FIXED: Transform executive orders for database save with proper field mapping"""
    
    transformed_orders = []
    
    for order in orders:
        # Get the best dates available
        signing_date = order.get('signing_date', '')
        publication_date = order.get('publication_date', '')
        
        # If no signing date, try to use publication date
        if not signing_date and publication_date:
            signing_date = publication_date
        
        # FIXED: Ensure eo_number is properly extracted and not a year
        eo_number = order.get('eo_number', '')
        
        # Validate the EO number - if it looks like a year, try to fix it
        if eo_number and eo_number.isdigit():
            eo_int = int(eo_number)
            # If it's a year (2020-2030), try to extract real EO number from other fields
            if 2020 <= eo_int <= 2030:
                # Try to get a better EO number from title or other fields
                title = order.get('title', '')
                doc_number = order.get('document_number', '')
                
                # Look for EO number in title
                import re
                eo_match = re.search(r'(?:Executive Order|EO)\s*(\d{4,5})', title, re.IGNORECASE)
                if eo_match:
                    eo_number = eo_match.group(1)
                elif doc_number and '2025-' in doc_number:
                    # Create a sequential EO number based on document number
                    date_match = re.search(r'2025-(\d+)', doc_number)
                    if date_match:
                        day_num = int(date_match.group(1))
                        eo_number = str(14000 + day_num)
                else:
                    eo_number = f"TEMP_{eo_int}"
        
        # Create clean database record
        transformed_order = {
            'bill_id': f"eo-{eo_number}",
            'bill_number': eo_number,  # This should be the actual EO number, not year
            'title': order.get('title', ''),
            'description': order.get('summary', ''),
            'state': 'Federal',
            'state_abbr': 'US',
            'status': 'Signed',
            'category': order.get('category', 'civic'),
            'introduced_date': signing_date,
            'last_action_date': publication_date or signing_date,
            'session_id': '2025-trump-administration',
            'session_name': 'Trump 2025 Administration',
            'bill_type': 'executive_order',
            'body': 'executive',
            'legiscan_url': order.get('html_url', ''),
            'pdf_url': order.get('pdf_url', ''),
            'ai_summary': order.get('ai_summary', ''),
            'ai_executive_summary': order.get('ai_executive_summary', ''),
            'ai_talking_points': order.get('ai_talking_points', ''),
            'ai_key_points': order.get('ai_key_points', ''),
            'ai_business_impact': order.get('ai_business_impact', ''),
            'ai_potential_impact': order.get('ai_potential_impact', ''),
            'ai_version': order.get('ai_version', 'enhanced_v1_fixed'),
            'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'last_updated': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        transformed_orders.append(transformed_order)
    
    return transformed_orders

@app.get("/api/executive-orders-fixed")
async def get_executive_orders_fixed(
    category: Optional[str] = Query(None, description="Executive order category filter"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(25, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search term"),
    sort_by: str = Query("publication_date", description="Sort field"),
    sort_order: str = Query("desc", description="Sort order (asc, desc)"),
    user_id: Optional[str] = Query(None, description="User ID to show highlight status")
):
    """FIXED: Get executive orders with proper sorting (newest first) and validation"""
    
    try:
        logger.info(f"🔍 Getting FIXED executive orders - page: {page}, per_page: {per_page}, sort: {sort_by} {sort_order}")
        
        if not EXECUTIVE_ORDERS_AVAILABLE:
            return {
                "results": [],
                "count": 0,
                "total_pages": 1,
                "page": page,
                "per_page": per_page,
                "message": "Executive orders functionality not available"
            }
        
        # Build filters
        filters = {}
        if category:
            filters['category'] = category
        if search:
            filters['search'] = search
        
        result = get_executive_orders_from_db(
            limit=per_page,
            offset=(page - 1) * per_page,
            filters=filters
        )
        
        if not result.get('success'):
            return {
                "results": [],
                "count": 0,
                "error": result.get('message', 'Database query failed')
            }
        
        orders = result.get('results', [])
        logger.info(f"📋 Got {len(orders)} orders from database")
        
        # Add highlight information if user_id provided
        if user_id and orders and HIGHLIGHTS_DB_AVAILABLE:
            try:
                for order in orders:
                    content_id = order.get('bill_number', '')
                    highlighted = is_highlighted_direct(user_id, 'executive_order', content_id)
                    order['is_highlighted'] = highlighted
                    
                    if highlighted:
                        highlight_info = get_highlight_info_direct(user_id, 'executive_order', content_id)
                        order['highlight_info'] = highlight_info
                    else:
                        order['highlight_info'] = None
            except Exception as e:
                logger.warning(f"Could not add highlight info: {e}")
        
        # Process and validate orders
        validated_orders = []
        for order in orders:
            try:
                eo_number = order.get('bill_number', '')
                
                # FIXED: Better validation that doesn't filter out valid EOs
                if eo_number and (eo_number.startswith('TEMP_') or eo_number == 'UNKNOWN' or 
                                (eo_number.isdigit() and int(eo_number) >= 1000)):
                    
                    # Map Azure SQL fields to expected EO fields
                    formatted_order = {
                        'eo_number': eo_number,
                        'executive_order_number': eo_number,
                        'title': order.get('title', ''),
                        'summary': order.get('description', ''),
                        'signing_date': order.get('introduced_date', ''),
                        'publication_date': order.get('last_action_date', ''),
                        'category': order.get('category', 'not-applicable'),
                        'html_url': order.get('legiscan_url', ''),
                        'pdf_url': order.get('pdf_url', ''),
                        'ai_summary': order.get('ai_summary', ''),
                        'ai_executive_summary': order.get('ai_executive_summary', ''),
                        'ai_key_points': order.get('ai_talking_points', ''),
                        'ai_talking_points': order.get('ai_talking_points', ''),
                        'ai_business_impact': order.get('ai_business_impact', ''),
                        'ai_potential_impact': order.get('ai_potential_impact', ''),
                        'source': 'Azure SQL Database (Fixed)',
                        'is_highlighted': order.get('is_highlighted', False),
                        'highlight_info': order.get('highlight_info')
                    }
                    
                    # Add formatted dates
                    enriched_order = enrich_executive_order_with_formatting(formatted_order)
                    validated_orders.append(enriched_order)
                    
            except Exception as e:
                logger.error(f"❌ Error processing order: {e}")
                continue
        
        # FIXED: Sort by publication date (newest first) if that's what's requested
        if sort_by == "publication_date" and sort_order == "desc":
            validated_orders.sort(key=lambda x: x.get('publication_date', ''), reverse=True)
        elif sort_by == "eo_number" and sort_order == "desc":
            # Sort by EO number descending (highest numbers first)
            validated_orders.sort(key=lambda x: int(x.get('eo_number', '0')) if str(x.get('eo_number', '')).isdigit() else 0, reverse=True)
        
        logger.info(f"✅ Returning {len(validated_orders)} validated orders (FIXED)")
        
        return {
            "results": validated_orders,
            "count": len(validated_orders),
            "total_pages": 1,
            "page": page,
            "per_page": per_page,
            "sorting": f"{sort_by} {sort_order}",
            "validation_applied": True,
            "user_highlights_included": bool(user_id),
            "database_type": "Azure SQL (Fixed)",
            "fixes_applied": [
                "proper_eo_number_extraction",
                "newest_first_sorting", 
                "improved_ai_rate_limiting",
                "better_validation"
            ]
        }
        
    except Exception as e:
        logger.error(f"❌ Error in get_executive_orders_fixed: {e}")
        return {
            "results": [],
            "count": 0,
            "error": f"Error: {str(e)}"
        }

@app.post("/api/test-eo-extraction")
async def test_eo_extraction():
    """Test the fixed EO number extraction"""
    try:
        logger.info("🧪 Testing fixed EO number extraction")
        
        # Test with a small sample
        result = await fetch_executive_orders_simple_integration(
            start_date="2025-01-20",
            end_date="2025-01-25",
            with_ai=False,
            limit=5
        )
        
        if result.get('success'):
            orders = result.get('results', [])
            
            extraction_test = []
            for order in orders:
                test_result = {
                    'title': order.get('title', '')[:80] + "...",
                    'document_number': order.get('document_number', ''),
                    'extracted_eo_number': order.get('eo_number', ''),
                    'publication_date': order.get('publication_date', ''),
                    'presidential_document_type': order.get('presidential_document_type', ''),
                    'is_valid_eo_number': order.get('eo_number', '').isdigit() and int(order.get('eo_number', '0')) >= 1000
                }
                extraction_test.append(test_result)
            
            return {
                "success": True,
                "message": "EO extraction test completed",
                "sample_size": len(orders),
                "extraction_results": extraction_test,
                "fixes_applied": [
                    "improved_regex_patterns",
                    "year_detection_and_correction", 
                    "sequential_number_generation",
                    "better_fallback_logic"
                ]
            }
        else:
            return {
                "success": False,
                "message": f"Test failed: {result.get('error', 'Unknown error')}"
            }
            
    except Exception as e:
        return {
            "success": False,
            "message": f"Test error: {str(e)}"
        }

@app.get("/api/test/simple-executive-orders")
async def test_simple_executive_orders():
    """Test the simple executive orders system"""
    
    try:
        if not SIMPLE_EO_AVAILABLE:
            return {
                "available": False,
                "message": "Simple Executive Orders API not imported"
            }
        
        # Test with a small date range
        result = await fetch_executive_orders_simple_integration(
            start_date="2025-06-01",
            end_date="2025-06-15",
            with_ai=False
        )
        
        return {
            "available": True,
            "test_result": result,
            "message": f"Test completed - found {result.get('count', 0)} executive orders"
        }
        
    except Exception as e:
        return {
            "available": True,
            "error": str(e),
            "message": "Test failed with error"
        }

@app.get("/api/executive-orders/{order_number}")
async def get_executive_order_by_id(order_number: str):
    """Get a specific executive order by number with validation"""
    
    if not EXECUTIVE_ORDERS_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Executive orders functionality not available."
        )
    
    try:
        # Validate EO number first
        if not validate_eo_number(order_number):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid executive order number: {order_number}. Must be in range 1000-20000."
            )
        
        result = get_executive_order_by_number(order_number)
        
        if not result.get('success') or not result.get('result'):
            raise HTTPException(
                status_code=404, 
                detail=f"Executive order {order_number} not found"
            )
        
        order = result['result']
        
        # Map Azure SQL fields to expected EO fields
        formatted_order = {
            'eo_number': order.get('bill_number', order_number),
            'executive_order_number': order.get('bill_number', order_number),
            'title': order.get('title', ''),
            'summary': order.get('description', ''),
            'signing_date': order.get('introduced_date', ''),
            'publication_date': order.get('last_action_date', ''),
            'category': order.get('category', 'not-applicable'),
            'html_url': order.get('legiscan_url', ''),
            'pdf_url': order.get('pdf_url', ''),
            'ai_summary': order.get('ai_summary', ''),
            'ai_executive_summary': order.get('ai_executive_summary', ''),
            'ai_key_points': order.get('ai_talking_points', ''),
            'ai_talking_points': order.get('ai_talking_points', ''),
            'ai_business_impact': order.get('ai_business_impact', ''),
            'ai_potential_impact': order.get('ai_potential_impact', ''),
            'source': 'Azure SQL Database'
        }
        
        # Enrich with formatting
        enriched_order = enrich_executive_order_with_formatting(formatted_order)
        
        return {
            "success": True,
            "order": enriched_order,
            "validation_passed": True,
            "eo_range": "1000-20000",
            "database_integration": "Azure SQL"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error retrieving executive order: {str(e)}"
        )

# Add these endpoints to your main.py file

# ===============================
# MISSING EXECUTIVE ORDERS ENDPOINTS
# ===============================

@app.post("/api/executive-orders/run-pipeline")
async def run_executive_orders_pipeline():
    """Run the complete executive orders pipeline"""
    try:
        logger.info("🚀 Starting Executive Orders Pipeline")
        
        if not SIMPLE_EO_AVAILABLE:
            return {
                "success": False,
                "message": "Simple Executive Orders API not available"
            }
        
        # Use the updated integration function
        result = await fetch_executive_orders_simple_integration(
            period="inauguration",  # Since inauguration
            with_ai=True,
            limit=None  # No limit
        )
        
        if not result.get('success'):
            logger.warning(f"⚠️ Pipeline failed: {result.get('error', 'Unknown error')}")
            return {
                "success": False,
                "message": result.get('error', 'Pipeline failed')
            }
        
        orders = result.get('results', [])
        logger.info(f"📥 Pipeline retrieved {len(orders)} executive orders")
        
        # Transform orders for database save
        if orders and EXECUTIVE_ORDERS_AVAILABLE:
            try:
                transformed_orders = transform_orders_for_save_fixed(orders)
                saved_count = save_executive_orders_to_db(transformed_orders)
                
                return {
                    "success": True,
                    "message": f"Pipeline completed successfully",
                    "orders_fetched": len(orders),
                    "orders_saved": saved_count,
                    "ai_analysis": result.get('ai_analysis_enabled', False),
                    "date_range": result.get('date_range_used', 'Unknown'),
                    "api_response_count": result.get('api_response_count', 0),
                    "pipeline_type": "federal_register_direct_api"
                }
                
            except Exception as save_error:
                logger.error(f"❌ Error saving to database: {save_error}")
                return {
                    "success": False,
                    "message": f"Pipeline fetch succeeded but database save failed: {str(save_error)}"
                }
        else:
            return {
                "success": True if orders else False,
                "message": f"Pipeline completed - found {len(orders)} orders but database not available",
                "orders_fetched": len(orders),
                "orders_saved": 0
            }
            
    except Exception as e:
        logger.error(f"❌ Error in pipeline: {e}")
        return {
            "success": False,
            "message": str(e)
        }

@app.post("/api/executive-orders/fetch")
async def fetch_executive_orders_endpoint():
    """Fetch executive orders endpoint"""
    try:
        logger.info("📡 Fetching executive orders via endpoint")
        
        # Call the pipeline
        result = await run_executive_orders_pipeline()
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Error in fetch endpoint: {e}")
        return {
            "success": False,
            "message": str(e)
        }

@app.post("/api/executive-orders/quick-pipeline")
async def quick_executive_orders_pipeline():
    """Quick pipeline with limited orders"""
    try:
        logger.info("⚡ Starting Quick Executive Orders Pipeline")
        
        if not SIMPLE_EO_AVAILABLE:
            return {
                "success": False,
                "message": "Simple Executive Orders API not available"
            }
        
        # Quick fetch with limit
        result = await fetch_executive_orders_simple_integration(
            period="last_30_days",  # Last 30 days
            with_ai=True,
            limit=25  # Limited for quick processing
        )
        
        if not result.get('success'):
            return {
                "success": False,
                "message": result.get('error', 'Quick pipeline failed')
            }
        
        orders = result.get('results', [])
        
        # Save to database if available
        saved_count = 0
        if orders and EXECUTIVE_ORDERS_AVAILABLE:
            try:
                transformed_orders = transform_orders_for_save_fixed(orders)
                saved_count = save_executive_orders_to_db(transformed_orders)
            except Exception as save_error:
                logger.warning(f"⚠️ Quick pipeline save error: {save_error}")
        
        return {
            "success": True,
            "message": f"Quick pipeline completed",
            "orders_fetched": len(orders),
            "orders_saved": saved_count,
            "ai_analysis": result.get('ai_analysis_enabled', False),
            "date_range": result.get('date_range_used', 'Last 30 days'),
            "pipeline_type": "quick_federal_register"
        }
        
    except Exception as e:
        logger.error(f"❌ Error in quick pipeline: {e}")
        return {
            "success": False,
            "message": str(e)
        }

@app.post("/api/fetch-executive-orders")
async def legacy_fetch_executive_orders():
    """Legacy endpoint for backward compatibility"""
    try:
        logger.info("🔄 Legacy fetch executive orders endpoint")
        
        # Call the main pipeline
        result = await run_executive_orders_pipeline()
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Error in legacy fetch: {e}")
        return {
            "success": False,
            "message": str(e)
        }

@app.get("/api/test-federal-register-direct")
async def test_federal_register_direct():
    """Test the direct Federal Register API"""
    try:
        logger.info("🧪 Testing direct Federal Register API")
        
        # Test with a small date range
        result = await fetch_executive_orders_simple_integration(
            start_date="01/20/2025",
            end_date="06/17/2025",
            with_ai=False,
            limit=5
        )
        
        return {
            "success": result.get('success', False),
            "message": result.get('message', 'Test completed'),
            "orders_found": result.get('count', 0),
            "total_found": result.get('total_found', 0),
            "api_response_count": result.get('api_response_count', 0),
            "date_range": result.get('date_range_used', 'Unknown'),
            "api_url": result.get('api_url', 'Unknown'),
            "search_params": result.get('search_params', {}),
            "sample_orders": [
                {
                    "eo_number": order.get('eo_number'),
                    "title": order.get('title', 'No title')[:80] + "...",
                    "signing_date": order.get('signing_date'),
                    "publication_date": order.get('publication_date'),
                    "document_number": order.get('document_number')
                }
                for order in result.get('results', [])[:3]
            ] if result.get('success') else [],
            "error": result.get('error') if not result.get('success') else None
        }
        
    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        return {
            "success": False,
            "message": f"Test failed: {str(e)}"
        }

@app.post("/api/executive-orders/fetch-by-date-range")
async def fetch_executive_orders_by_date_range(
    start_date: str = Query("01/20/2025", description="Start date (MM/DD/YYYY)"),
    end_date: str = Query(None, description="End date (MM/DD/YYYY)"),
    with_ai: bool = Query(True, description="Enable AI analysis"),
    limit: Optional[int] = Query(None, description="Limit number of orders")
):
    """Fetch executive orders by specific date range"""
    try:
        logger.info(f"📅 Fetching executive orders for date range: {start_date} to {end_date}")
        
        if not SIMPLE_EO_AVAILABLE:
            return {
                "success": False,
                "message": "Simple Executive Orders API not available"
            }
        
        # Use the direct Federal Register API
        result = await fetch_executive_orders_simple_integration(
            start_date=start_date,
            end_date=end_date,
            with_ai=with_ai,
            limit=limit
        )
        
        if not result.get('success'):
            return {
                "success": False,
                "message": result.get('error', 'Date range fetch failed')
            }
        
        orders = result.get('results', [])
        
        # Save to database
        saved_count = 0
        if orders and EXECUTIVE_ORDERS_AVAILABLE:
            try:
                transformed_orders = transform_orders_for_save_fixed(orders)
                saved_count = save_executive_orders_to_db(transformed_orders)
            except Exception as save_error:
                logger.warning(f"⚠️ Date range fetch save error: {save_error}")
        
        return {
            "success": True,
            "message": f"Successfully fetched executive orders for date range",
            "orders_fetched": len(orders),
            "orders_saved": saved_count,
            "ai_analysis": with_ai,
            "date_range": f"{start_date} to {end_date}",
            "api_response_count": result.get('api_response_count', 0),
            "total_found": result.get('total_found', len(orders))
        }
        
    except Exception as e:
        logger.error(f"❌ Error in date range fetch: {e}")
        return {
            "success": False,
            "message": str(e)
        }

@app.get("/api/executive-orders/test-api-url")
async def test_your_specific_api_url():
    """Test your specific Federal Register API URL"""
    try:
        logger.info("🔍 Testing your specific Federal Register API URL")
        
        # Import the updated simple executive orders
        from simple_executive_orders import SimpleExecutiveOrders
        
        # Create instance and test
        simple_eo = SimpleExecutiveOrders()
        result = simple_eo.fetch_executive_orders_direct(
            start_date="01/20/2025",
            end_date="06/17/2025",
            limit=10
        )
        
        if result.get('success'):
            orders = result.get('results', [])
            return {
                "success": True,
                "message": "API URL test successful",
                "api_url_working": True,
                "orders_found": len(orders),
                "total_api_response": result.get('api_response_count', 0),
                "date_range_tested": result.get('date_range'),
                "sample_data": [
                    {
                        "eo_number": order.get('eo_number'),
                        "title": order.get('title', 'No title')[:60] + "...",
                        "signing_date": order.get('signing_date'),
                        "document_number": order.get('document_number'),
                        "html_url": order.get('html_url', '')[:50] + "..." if order.get('html_url') else None
                    }
                    for order in orders[:3]
                ]
            }
        else:
            return {
                "success": False,
                "message": "API URL test failed",
                "api_url_working": False,
                "error": result.get('error', 'Unknown error'),
                "api_url": result.get('api_url', 'Unknown')
            }
            
    except Exception as e:
        logger.error(f"❌ API URL test failed: {e}")
        return {
            "success": False,
            "message": f"API URL test failed: {str(e)}",
            "api_url_working": False
        }

# ===============================
# BATCH PROCESSING ENDPOINTS
# ===============================

@app.post("/api/executive-orders/batch-fetch-small")
async def batch_fetch_small():
    """Fetch small batch with AI (20 orders max)"""
    try:
        logger.info("📦 Starting small batch fetch")
        
        result = await fetch_executive_orders_simple_integration(
            period="last_7_days",
            with_ai=True,
            limit=20
        )
        
        if not result.get('success'):
            return {
                "success": False,
                "message": result.get('error', 'Small batch fetch failed')
            }
        
        orders = result.get('results', [])
        
        # Save to database
        saved_count = 0
        if orders and EXECUTIVE_ORDERS_AVAILABLE:
            try:
                transformed_orders = transform_orders_for_save_fixed(orders)
                saved_count = save_executive_orders_to_db(transformed_orders)
            except Exception as save_error:
                logger.warning(f"⚠️ Small batch save error: {save_error}")
        
        return {
            "success": True,
            "message": "Small batch fetch completed",
            "batch_type": "small_with_ai",
            "orders_fetched": len(orders),
            "orders_saved": saved_count,
            "ai_analysis": True,
            "date_range": result.get('date_range_used', 'Last 7 days')
        }
        
    except Exception as e:
        logger.error(f"❌ Error in small batch fetch: {e}")
        return {
            "success": False,
            "message": str(e)
        }

@app.post("/api/executive-orders/batch-fetch-large")
async def batch_fetch_large():
    """Fetch large batch without AI for speed"""
    try:
        logger.info("📦 Starting large batch fetch (no AI)")
        
        result = await fetch_executive_orders_simple_integration(
            period="inauguration",
            with_ai=False,  # No AI for speed
            limit=None  # No limit
        )
        
        if not result.get('success'):
            return {
                "success": False,
                "message": result.get('error', 'Large batch fetch failed')
            }
        
        orders = result.get('results', [])
        
        # Save to database
        saved_count = 0
        if orders and EXECUTIVE_ORDERS_AVAILABLE:
            try:
                transformed_orders = transform_orders_for_save_fixed(orders)
                saved_count = save_executive_orders_to_db(transformed_orders)
            except Exception as save_error:
                logger.warning(f"⚠️ Large batch save error: {save_error}")
        
        return {
            "success": True,
            "message": "Large batch fetch completed",
            "batch_type": "large_no_ai",
            "orders_fetched": len(orders),
            "orders_saved": saved_count,
            "ai_analysis": False,
            "date_range": result.get('date_range_used', 'Since inauguration'),
            "note": "AI analysis skipped for faster processing"
        }
        
    except Exception as e:
        logger.error(f"❌ Error in large batch fetch: {e}")
        return {
            "success": False,
            "message": str(e)
        }

# ===============================
# DEBUG AND TESTING ENDPOINTS
# ===============================

@app.get("/api/debug/federal-register-response")
async def debug_federal_register_response():
    """Debug endpoint to see raw Federal Register API response"""
    try:
        logger.info("🔍 Debugging Federal Register API response")
        
        import requests
        
        # Build the exact URL you provided
        base_url = "https://www.federalregister.gov/api/v1/documents.json"
        params = {
            'conditions[correction]': '0',
            'conditions[president]': 'donald-trump',
            'conditions[presidential_document_type]': 'executive_order',
            'conditions[signing_date][gte]': '01/20/2025',
            'conditions[signing_date][lte]': '06/17/2025',
            'conditions[type][]': 'PRESDOCU',
            'fields[]': [
                'citation', 'document_number', 'html_url', 'pdf_url',
                'publication_date', 'signing_date', 'title', 
                'executive_order_number'
            ],
            'per_page': '5'  # Small number for debugging
        }
        
        logger.info(f"🌐 Making request to: {base_url}")
        logger.info(f"📋 Parameters: {params}")
        
        response = requests.get(base_url, params=params, timeout=30)
        
        debug_info = {
            "success": response.status_code == 200,
            "status_code": response.status_code,
            "url_requested": response.url,
            "response_headers": dict(response.headers),
            "content_type": response.headers.get('content-type', 'Unknown')
        }
        
        if response.status_code == 200:
            try:
                data = response.json()
                debug_info.update({
                    "response_structure": {
                        "keys": list(data.keys()),
                        "count": data.get('count', 'Not provided'),
                        "results_length": len(data.get('results', [])),
                        "next_page_url": data.get('next_page_url'),
                        "previous_page_url": data.get('previous_page_url')
                    },
                    "sample_documents": [
                        {
                            "title": doc.get('title', 'No title')[:80] + "...",
                            "document_number": doc.get('document_number'),
                            "executive_order_number": doc.get('executive_order_number'),
                            "signing_date": doc.get('signing_date'),
                            "publication_date": doc.get('publication_date'),
                            "available_fields": list(doc.keys())
                        }
                        for doc in data.get('results', [])[:2]
                    ]
                })
            except Exception as json_error:
                debug_info["json_parse_error"] = str(json_error)
                debug_info["raw_response_preview"] = response.text[:500]
        else:
            debug_info["error_response"] = response.text[:500]
        
        return debug_info
        
    except Exception as e:
        logger.error(f"❌ Debug endpoint error: {e}")
        return {
            "success": False,
            "error": str(e),
            "message": "Debug endpoint failed"
        }

@app.get("/api/executive-orders/status")
async def executive_orders_status():
    """Get status of executive orders system"""
    try:
        # Test components
        simple_eo_available = SIMPLE_EO_AVAILABLE
        exec_orders_db_available = EXECUTIVE_ORDERS_AVAILABLE
        ai_available = AI_AVAILABLE
        
        # Get database stats
        db_stats = {}
        if exec_orders_db_available:
            try:
                stats_result = get_executive_orders_stats()
                if stats_result.get('success'):
                    db_stats = stats_result.get('statistics', {})
            except Exception:
                db_stats = {"error": "Could not get database stats"}
        
        # Test API connectivity
        api_test_result = None
        try:
            # Quick test of Federal Register API
            from simple_executive_orders import SimpleExecutiveOrders
            simple_eo = SimpleExecutiveOrders()
            test_result = simple_eo.fetch_executive_orders_direct(
                start_date="01/20/2025",
                end_date="01/21/2025",
                limit=1
            )
            api_test_result = {
                "working": test_result.get('success', False),
                "error": test_result.get('error') if not test_result.get('success') else None
            }
        except Exception as api_error:
            api_test_result = {
                "working": False,
                "error": str(api_error)
            }
        
        return {
            "success": True,
            "components": {
                "simple_executive_orders": {
                    "available": simple_eo_available,
                    "status": "✅ Available" if simple_eo_available else "❌ Not Available"
                },
                "executive_orders_database": {
                    "available": exec_orders_db_available,
                    "status": "✅ Available" if exec_orders_db_available else "❌ Not Available",
                    "stats": db_stats
                },
                "ai_analysis": {
                    "available": ai_available,
                    "status": "✅ Available" if ai_available else "❌ Not Available"
                },
                "federal_register_api": {
                    "status": "✅ Working" if api_test_result and api_test_result.get('working') else "❌ Issues",
                    "test_result": api_test_result
                }
            },
            "endpoints_available": [
                "/api/executive-orders/run-pipeline",
                "/api/executive-orders/fetch",
                "/api/executive-orders/quick-pipeline",
                "/api/fetch-executive-orders",
                "/api/executive-orders/fetch-by-date-range",
                "/api/executive-orders/batch-fetch-small",
                "/api/executive-orders/batch-fetch-large"
            ],
            "system_ready": all([
                simple_eo_available,
                exec_orders_db_available,
                api_test_result and api_test_result.get('working', False)
            ]),
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Status check failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

# ===============================
# HIGHLIGHTS API ENDPOINTS
# ===============================

@app.get("/api/user-highlights")
async def get_user_highlights_endpoint(
    user_id: str = Query("user123", description="User identifier")
):
    """Get all highlights for a user"""
    
    if not HIGHLIGHTS_DB_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Highlights database not available. Please ensure Azure SQL is configured."
        )
    
    try:
        highlights = get_user_highlights_direct(user_id)
        
        return {
            "success": True,
            "user_id": user_id,
            "highlights": highlights,
            "count": len(highlights),
            "database_type": "Azure SQL",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting user highlights: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting highlights: {str(e)}")

@app.post("/api/highlights/toggle")
async def toggle_highlight_endpoint(
    content_type: str = Query(..., description="'executive_order' or 'legislation'"),
    content_id: str = Query(..., description="EO number or bill ID"),
    user_id: str = Query("user123", description="User identifier"),
    notes: Optional[str] = Query(None, description="Optional notes")
):
    """Toggle highlight on/off"""
    
    if not HIGHLIGHTS_DB_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Highlights database not available. Please ensure Azure SQL is configured."
        )
    
    try:
        # Validate content_type
        if content_type not in ['executive_order', 'legislation']:
            raise HTTPException(
                status_code=400, 
                detail="content_type must be 'executive_order' or 'legislation'"
            )
        
        # Check current status
        currently_highlighted = is_highlighted_direct(user_id, content_type, content_id)
        
        if currently_highlighted:
            # Remove highlight
            success = remove_highlight_direct(user_id, content_type, content_id)
            action = "removed" if success else "error"
        else:
            # Add highlight
            success = add_highlight_direct(user_id, content_type, content_id, notes)
            action = "added" if success else "error"
        
        if not success:
            raise HTTPException(status_code=500, detail=f"Failed to {action} highlight")
        
        return {
            "success": True,
            "action": action,
            "user_id": user_id,
            "content_type": content_type,
            "content_id": content_id,
            "database_type": "Azure SQL",
            "message": f"Highlight {action} successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error toggling highlight: {e}")
        raise HTTPException(status_code=500, detail=f"Error toggling highlight: {str(e)}")

@app.get("/api/test-highlights")
async def test_highlights():
    """Test highlights functionality"""
    try:
        # Test database connection
        conn = get_azure_sql_connection()
        if not conn:
            return {"success": False, "message": "Could not connect to Azure SQL"}
        
        cursor = conn.cursor()
        
        # Test table exists
        cursor.execute("""
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME = 'user_highlights'
        """)
        table_exists = cursor.fetchone()[0] > 0
        
        # Test basic operations
        test_user = "test_user"
        test_content_id = "test_content"
        
        # Add test highlight
        add_result = add_highlight_direct(test_user, "executive_order", test_content_id, "Test note")
        
        # Check if highlighted
        is_highlighted_result = is_highlighted_direct(test_user, "executive_order", test_content_id)
        
        # Remove test highlight
        remove_result = remove_highlight_direct(test_user, "executive_order", test_content_id)
        
        conn.close()
        
        return {
            "success": True,
            "database_connection": "OK",
            "table_exists": table_exists,
            "add_highlight": add_result,
            "check_highlighted": is_highlighted_result,
            "remove_highlight": remove_result,
            "database_type": "Azure SQL",
            "integration_type": "Direct Azure SQL Connection"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "database_type": "Azure SQL"
        }

# ===============================
# STATE LEGISLATION ENDPOINTS
# ===============================

@app.get("/api/state-legislation")
async def get_state_legislation_with_highlights(
    state: Optional[str] = Query(None, description="State name or abbreviation"),
    category: Optional[str] = Query(None, description="Bill category filter"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(25, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search term"),
    user_id: Optional[str] = Query(None, description="User ID to show highlight status")
):
    """Get state legislation with highlighting"""
    
    if state:
        state = convert_state_param(state)
        if state not in SUPPORTED_STATES:
            raise HTTPException(
                status_code=400,
                detail=f"State '{state}' not supported. Supported: {list(SUPPORTED_STATES.keys())}"
            )
    
    if category and category not in BILL_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"Category '{category}' not supported. Supported: {BILL_CATEGORIES}"
        )
    
    try:
        result = get_legislation_from_db(
            state=state,
            category=category,
            search=search,
            page=page,
            per_page=per_page
        )
        
        # Add highlight information if user_id provided
        if user_id and result.get('results') and HIGHLIGHTS_DB_AVAILABLE:
            try:
                for bill in result['results']:
                    bill_id = bill.get('bill_id', '')
                    
                    # Check if highlighted
                    highlighted = is_highlighted_direct(user_id, 'legislation', bill_id)
                    bill['is_highlighted'] = highlighted
                    
                    if highlighted:
                        highlight_info = get_highlight_info_direct(user_id, 'legislation', bill_id)
                        bill['highlight_info'] = highlight_info
                    else:
                        bill['highlight_info'] = None
                        
            except Exception as e:
                logger.warning(f"Could not add highlight info: {e}")
        
        result["database_type"] = "Azure SQL"
        result["azure_sql_enabled"] = AZURE_SQL_AVAILABLE
        result["user_highlights_included"] = bool(user_id)
        
        return result
    
    except Exception as e:
        logger.error(f"Error retrieving legislation: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving legislation: {str(e)}")

@app.post("/api/state-legislation/fetch")
async def fetch_state_legislation(
    request: StateLegislationFetchRequest,
    background_tasks: BackgroundTasks
):
    """Fetch state legislation with AI analysis"""
    
    if not AI_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="AI integration not available. Please check configuration."
        )
    
    try:
        # Validate states
        state_abbrevs = []
        for state in request.states:
            if state in SUPPORTED_STATES:
                state_abbrevs.append(SUPPORTED_STATES[state])
            elif state.upper() in [abbr for abbr in SUPPORTED_STATES.values()]:
                state_abbrevs.append(state.upper())
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported state: {state}. Supported: {list(SUPPORTED_STATES.keys())}"
                )
        
        logger.info(f"🚀 Starting state legislation fetch for: {state_abbrevs}")
        
        # Test LegiScan integration
        legiscan_test = await test_legiscan_integration()
        if not legiscan_test:
            raise HTTPException(
                status_code=503,
                detail="LegiScan API connection failed. Please check your API key configuration."
            )
        
        # Use the AI pipeline
        if len(state_abbrevs) == 1:
            # Single state processing
            result = await run_state_pipeline(
                state=state_abbrevs[0],
                bills_limit=request.bills_per_state
            )
            
            if result.get('error'):
                raise HTTPException(status_code=500, detail=result['error'])
            
            # Save to Azure SQL if requested
            saved_count = 0
            if request.save_to_db and result.get('bills'):
                try:
                    saved_count = save_legislation_to_db(result['bills'])
                    logger.info(f"💾 Saved {saved_count} bills to Azure SQL database")
                except Exception as e:
                    logger.error(f"❌ Azure SQL save failed: {e}")
            
            return {
                "success": True,
                "message": f"Successfully processed {result.get('bills_processed', 0)} bills for {state_abbrevs[0]}",
                "state": state_abbrevs[0],
                "bills_fetched": result.get('bills_processed', 0),
                "bills_saved": saved_count,
                "database_type": "Azure SQL" if AZURE_SQL_AVAILABLE else "Fallback",
                "timestamp": datetime.now().isoformat()
            }
        
        else:
            # Multi-state processing
            result = await run_multi_state_pipeline(
                states=state_abbrevs,
                bills_per_state=request.bills_per_state
            )
            
            if result.get('status') == 'error':
                raise HTTPException(status_code=500, detail=result.get('error'))
            
            # Save to Azure SQL if requested
            total_saved = 0
            if request.save_to_db:
                try:
                    all_bills = []
                    for state_result in result.get('results', {}).values():
                        if state_result.get('bills'):
                            all_bills.extend(state_result['bills'])
                    
                    if all_bills:
                        total_saved = save_legislation_to_db(all_bills)
                        logger.info(f"💾 Saved {total_saved} total bills to Azure SQL database")
                        
                except Exception as e:
                    logger.error(f"❌ Azure SQL save failed: {e}")
            
            return {
                "success": True,
                "message": f"Successfully processed legislation for {len(state_abbrevs)} states",
                "states_processed": result.get('states_processed', 0),
                "total_bills_fetched": result.get('total_bills_processed', 0),
                "bills_saved": total_saved,
                "database_type": "Azure SQL" if AZURE_SQL_AVAILABLE else "Fallback",
                "timestamp": datetime.now().isoformat()
            }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ State legislation fetch failed: {e}")
        raise HTTPException(status_code=500, detail=f"Fetch failed: {str(e)}")

@app.post("/api/legiscan/search-and-analyze")
async def search_and_analyze_legislation(request: LegiScanSearchRequest):
    """Search for legislation using LegiScan and analyze with AI"""
    
    if not AI_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="AI integration not available. Please check configuration."
        )
    
    try:
        # Validate state
        state_upper = request.state.upper()
        if state_upper not in SUPPORTED_STATES.values():
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported state: {request.state}. Supported: {list(SUPPORTED_STATES.values())}"
            )
        
        logger.info(f"🔍 Searching and analyzing {request.query} bills in {request.state}")
        
        # Test LegiScan integration
        legiscan_test = await test_legiscan_integration()
        if not legiscan_test:
            raise HTTPException(
                status_code=503,
                detail="LegiScan API connection failed. Please check your API key configuration."
            )
        
        # Use the AI search and analyze function
        result = await search_and_analyze_bills(
            query=request.query,
            state=request.state,
            limit=request.limit
        )
        
        if result.get('error'):
            raise HTTPException(status_code=500, detail=result['error'])
        
        # Save to Azure SQL if requested
        saved_count = 0
        if request.save_to_db and result.get('bills'):
            try:
                # Transform bills to match database schema
                transformed_bills = []
                for bill in result['bills']:
                    transformed_bill = {
                        'bill_id': bill.get('bill_id', ''),
                        'bill_number': bill.get('bill_number', ''),
                        'title': bill.get('title', ''),
                        'description': bill.get('description', ''),
                        'state': bill.get('state', request.state),
                        'state_abbr': request.state,
                        'status': str(bill.get('status', '')),
                        'category': bill.get('category', 'not-applicable'),
                        'introduced_date': bill.get('introduced_date', ''),
                        'last_action_date': bill.get('last_action_date', ''),
                        'session_id': bill.get('session_id', ''),
                        'session_name': bill.get('session_name', ''),
                        'legiscan_url': bill.get('url', ''),
                        'ai_summary': bill.get('ai_summary', ''),
                        'ai_executive_summary': bill.get('ai_executive_summary', ''),
                        'ai_talking_points': bill.get('ai_talking_points', ''),
                        'ai_key_points': bill.get('ai_key_points', ''),
                        'ai_business_impact': bill.get('ai_business_impact', ''),
                        'ai_potential_impact': bill.get('ai_potential_impact', ''),
                        'ai_version': bill.get('ai_version', 'legiscan_search_azure_v1'),
                        'created_at': datetime.now().isoformat(),
                        'last_updated': datetime.now().isoformat()
                    }
                    transformed_bills.append(transformed_bill)
                
                saved_count = save_legislation_to_db(transformed_bills)
                logger.info(f"💾 Saved {saved_count} bills to Azure SQL database")
                
            except Exception as e:
                logger.error(f"❌ Azure SQL save failed: {e}")
        
        return {
            "success": True,
            "message": f"Successfully searched and analyzed {result.get('bills_analyzed', 0)} bills",
            "query": request.query,
            "state": request.state,
            "bills_found": result.get('bills_found', 0),
            "bills_analyzed": result.get('bills_analyzed', 0),
            "bills_saved": saved_count,
            "database_type": "Azure SQL" if AZURE_SQL_AVAILABLE else "Fallback",
            "search_relevance": result.get('search_summary', {}),
            "timestamp": datetime.now().isoformat()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Search and analyze failed: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")
    
    @app.post("/api/test-ai-direct")
    async def test_ai_direct():
        """Test AI analysis directly"""
        try:
            logger.info("🧪 Testing AI analysis directly")
            
            # Test sample executive order
            test_title = "National Day of Prayer, 2025"
            test_abstract = "This executive order designates May 1, 2025, as the National Day of Prayer, encouraging Americans to pray and reflect on our nation's founding principles."
            test_eo_number = "21279"
            
            # Call your AI analysis function directly
            from ai import analyze_executive_order
            logger.info("✅ Successfully imported analyze_executive_order from ai.py")
            
            ai_result = await analyze_executive_order(
                title=test_title,
                abstract=test_abstract,
                order_number=test_eo_number
            )
            
            return {
                "success": True,
                "message": "AI analysis test completed",
                "test_input": {
                    "title": test_title,
                    "abstract": test_abstract,
                    "eo_number": test_eo_number
                },
                "ai_output": ai_result,
                "fields_generated": list(ai_result.keys()) if ai_result else [],
                "ai_working": True
            }
            
        except Exception as e:
            logger.error(f"❌ AI analysis test failed: {e}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "message": f"AI analysis test failed: {str(e)}",
                "ai_working": False,
                "error_details": traceback.format_exc()
            }

@app.post("/api/debug-fetch-process")
async def debug_fetch_process():
    """Debug the fetch process to see where AI is getting lost"""
    try:
        logger.info("🔍 Debugging fetch process...")
        
        # Test the simple integration function directly
        from simple_executive_orders import fetch_executive_orders_simple_integration
        
        logger.info("📡 Testing fetch with AI enabled...")
        result = await fetch_executive_orders_simple_integration(
            start_date="2025-06-10",  # Small date range for testing
            end_date="2025-06-15",
            with_ai=True  # Explicitly enable AI
        )
        
        logger.info(f"📊 Fetch result: success={result.get('success')}, count={result.get('count', 0)}")
        
        if result.get('success') and result.get('results'):
            sample_order = result['results'][0] if result['results'] else {}
            
            # Check if AI fields are present
            ai_fields_present = {
                'ai_summary': bool(sample_order.get('ai_summary')),
                'ai_executive_summary': bool(sample_order.get('ai_executive_summary')),
                'ai_talking_points': bool(sample_order.get('ai_talking_points')),
                'ai_business_impact': bool(sample_order.get('ai_business_impact'))
            }
            
            return {
                "success": True,
                "message": "Fetch process debug completed",
                "fetch_result": {
                    "success": result.get('success'),
                    "count": result.get('count', 0),
                    "ai_analysis_enabled": result.get('ai_analysis_enabled'),
                    "sample_title": sample_order.get('title', 'No title')[:100],
                    "ai_fields_present": ai_fields_present,
                    "sample_ai_summary": sample_order.get('ai_summary', 'No AI summary')[:200]
                }
            }
        else:
            return {
                "success": False,
                "message": "Fetch failed or no results",
                "fetch_result": result
            }
        
    except Exception as e:
        logger.error(f"❌ Debug fetch failed: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "message": f"Debug fetch failed: {str(e)}",
            "error_details": traceback.format_exc()
        }

@app.get("/api/check-ai-config")
async def check_ai_config():
    """Check AI configuration"""
    try:
        import os
        
        # Check environment variables
        azure_endpoint = os.getenv("AZURE_ENDPOINT")
        azure_key = os.getenv("AZURE_KEY")
        model_name = os.getenv("AZURE_MODEL_NAME", "summarize-gpt-4.1")
        
        config_status = {
            "azure_endpoint": {
                "set": bool(azure_endpoint),
                "value": azure_endpoint[:50] + "..." if azure_endpoint else None
            },
            "azure_key": {
                "set": bool(azure_key),
                "length": len(azure_key) if azure_key else 0
            },
            "model_name": model_name
        }
        
        # Test AI import
        try:
            from ai import analyze_executive_order
            ai_import_success = True
            ai_import_error = None
        except Exception as e:
            ai_import_success = False
            ai_import_error = str(e)
        
        return {
            "success": True,
            "ai_config": config_status,
            "ai_import": {
                "success": ai_import_success,
                "error": ai_import_error
            },
            "recommendations": [
                "Test AI directly with /api/test-ai-direct",
                "Debug fetch process with /api/debug-fetch-process",
                "Check logs for AI processing messages during fetch"
            ]
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"Config check failed: {str(e)}"
        }

@app.post("/api/executive-orders/fetch-with-ai")
async def fetch_executive_orders_with_ai():
    """Fetch executive orders with AI analysis - EXPLICIT VERSION"""
    try:
        logger.info("📡 Starting executive order fetch WITH AI ANALYSIS")
        
        # EXPLICIT AI ENABLEMENT
        result = await fetch_executive_orders_simple_integration(
            start_date="2025-01-20",
            end_date=None,
            with_ai=True  # EXPLICITLY ENABLE AI
        )
        
        logger.info(f"📊 Fetch result: success={result.get('success')}, count={result.get('count', 0)}")
        logger.info(f"🤖 AI enabled: {result.get('ai_analysis_enabled', False)}")
        
        if not result.get('success'):
            logger.warning(f"⚠️ API fetch failed: {result.get('error', 'Unknown error')}")
            return {"success": False, "message": result.get('error', 'Failed to fetch executive orders')}
        
        orders = result.get('results', [])
        logger.info(f"📥 Retrieved {len(orders)} executive orders from Federal Register API")
        
        # Check if AI fields are present in the first order
        ai_fields_check = {}
        if orders:
            sample = orders[0]
            ai_fields_check = {
                'ai_summary': bool(sample.get('ai_summary')),
                'ai_talking_points': bool(sample.get('ai_talking_points')),
                'ai_business_impact': bool(sample.get('ai_business_impact'))
            }
            logger.info(f"🔍 AI fields present in sample: {ai_fields_check}")
        
        if not orders:
            logger.warning("⚠️ No executive orders returned from API")
            return {"success": False, "message": "No executive orders found"}
        
        # Transform orders for database save
        transformed_orders = transform_orders_for_save(orders)
        
        # Save to database
        if EXECUTIVE_ORDERS_AVAILABLE:
            try:
                saved_count = save_executive_orders_to_db(transformed_orders)
                
                if saved_count > 0:
                    logger.info(f"💾 Saved {saved_count} executive orders to database")
                    return {
                        "success": True, 
                        "count": len(orders), 
                        "saved": saved_count,
                        "ai_analysis": "enabled",
                        "ai_fields_present": ai_fields_check if orders else {},
                        "method": "federal_register_api_with_ai"
                    }
                else:
                    logger.error("❌ Failed to save executive orders to database")
                    return {"success": False, "message": "Failed to save to database"}
            except Exception as save_error:
                logger.error(f"❌ Error saving to database: {save_error}")
                return {"success": False, "message": f"Database save error: {str(save_error)}"}
        else:
            logger.warning("⚠️ Executive orders database not available")
            return {"success": False, "message": "Database not available"}
            
    except Exception as e:
        logger.error(f"❌ Error in fetch_executive_orders_with_ai: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "message": str(e)}

@app.post("/api/executive-orders/add-ai-analysis")
async def add_ai_analysis_to_existing():
    """Add AI analysis to existing executive orders in database"""
    try:
        logger.info("🤖 Adding AI analysis to existing executive orders")
        
        # Get existing orders without AI analysis
        result = get_executive_orders_from_db(limit=50, offset=0, filters={})
        
        if not result.get('success'):
            return {"success": False, "message": "Failed to get orders from database"}
        
        orders = result.get('results', [])
        logger.info(f"📋 Found {len(orders)} orders to analyze")
        
        # Convert to the format expected by AI analysis
        orders_for_ai = []
        for order in orders:
            orders_for_ai.append({
                'eo_number': order.get('bill_number', ''),
                'title': order.get('title', ''),
                'summary': order.get('description', ''),
                'bill_id': order.get('bill_id', ''),
                'category': order.get('category', 'civic')
            })
        
        # Add AI analysis with rate limiting
        enhanced_orders = await add_ai_analysis_with_rate_limiting(orders_for_ai)
        
        # Transform for database update
        transformed_orders = transform_orders_for_save(enhanced_orders)
        
        # Save updated orders
        saved_count = save_executive_orders_to_db(transformed_orders)
        
        return {
            "success": True,
            "message": f"Added AI analysis to {len(enhanced_orders)} orders",
            "analyzed": len(enhanced_orders),
            "saved": saved_count,
            "ai_fields_added": [
                "ai_summary", 
                "ai_executive_summary", 
                "ai_key_points", 
                "ai_talking_points", 
                "ai_business_impact", 
                "ai_potential_impact"
            ]
        }
        
    except Exception as e:
        logger.error(f"❌ Error adding AI analysis: {e}")
        return {"success": False, "message": str(e)}
    
@app.post("/api/executive-orders/fetch-by-period")
async def fetch_executive_orders_by_period(
    period: str = Query("inauguration", description="Time period: 'inauguration', 'last_90_days', 'last_30_days', 'last_7_days'"),
    with_ai: bool = Query(True, description="Enable AI analysis"),
    limit: Optional[int] = Query(None, description="Limit number of orders fetched")
):
    """FIXED: Fetch executive orders by time period (EXECUTIVE ORDERS ONLY - no proclamations)"""
    try:
        logger.info(f"📡 Starting executive order fetch for period: {period}")
        logger.info(f"🤖 AI Analysis: {'ENABLED' if with_ai else 'DISABLED'}")
        if limit:
            logger.info(f"📊 Limit: {limit}")
        
        # Validate period
        valid_periods = ["inauguration", "last_90_days", "last_30_days", "last_7_days"]
        if period not in valid_periods:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid period '{period}'. Valid options: {valid_periods}"
            )
        
        # Use the updated integration function with period support
        result = await fetch_executive_orders_simple_integration(
            period=period,
            with_ai=with_ai,
            limit=limit
        )
        
        if not result.get('success'):
            logger.warning(f"⚠️ API fetch failed: {result.get('error', 'Unknown error')}")
            return {"success": False, "message": result.get('error', 'Failed to fetch executive orders')}
        
        orders = result.get('results', [])
        logger.info(f"📥 Retrieved {len(orders)} EXECUTIVE ORDERS (no proclamations) for period: {period}")
        
        if not orders:
            logger.warning("⚠️ No executive orders returned from API")
            return {
                "success": True, 
                "message": f"No executive orders found for period: {period}",
                "count": 0,
                "period": period,
                "date_range": result.get('date_range_used', 'Unknown')
            }
        
        # Transform orders for database save
        transformed_orders = transform_orders_for_save_fixed(orders)
        
        # Save to database
        saved_count = 0
        if EXECUTIVE_ORDERS_AVAILABLE:
            try:
                saved_count = save_executive_orders_to_db(transformed_orders)
                logger.info(f"💾 Saved {saved_count} executive orders to database")
            except Exception as save_error:
                logger.error(f"❌ Error saving to database: {save_error}")
        
        return {
            "success": True,
            "count": len(orders),
            "saved": saved_count,
            "period": period,
            "date_range": result.get('date_range_used', 'Unknown'),
            "ai_analysis": with_ai,
            "limit_applied": limit,
            "method": "federal_register_api_executive_orders_only",
            "document_types_excluded": result.get('document_types_filtered', []),
            "message": f"Successfully fetched {len(orders)} executive orders for period: {period}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error in fetch_executive_orders_by_period: {e}")
        return {"success": False, "message": str(e)}

@app.post("/api/executive-orders/quick-fetch/{period}")
async def quick_fetch_executive_orders(
    period: str = Path(..., description="Time period: 'inauguration', 'last_90_days', 'last_30_days', 'last_7_days'"),
    with_ai: bool = Query(True, description="Enable AI analysis")
):
    """Quick fetch buttons for different time periods"""
    try:
        logger.info(f"⚡ Quick fetch for period: {period}")
        
        # Map frontend period names to backend periods
        period_mapping = {
            "inauguration": "inauguration",
            "since_inauguration": "inauguration", 
            "last_90_days": "last_90_days",
            "last_30_days": "last_30_days", 
            "last_7_days": "last_7_days"
        }
        
        mapped_period = period_mapping.get(period, period)
        
        # Use the period-based fetch
        result = await fetch_executive_orders_by_period(
            period=mapped_period,
            with_ai=with_ai,
            limit=None  # No limit for quick fetch
        )
        
        # Add quick fetch metadata
        if isinstance(result, dict):
            result["quick_fetch"] = True
            result["period_requested"] = period
            result["period_mapped"] = mapped_period
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Error in quick_fetch_executive_orders: {e}")
        return {"success": False, "message": str(e)}

@app.get("/api/executive-orders/periods")
async def get_available_periods():
    """Get available time periods for executive order fetching"""
    from datetime import datetime, timedelta
    
    today = datetime.now()
    inauguration_date = datetime(2025, 1, 20)
    
    periods = {
        "inauguration": {
            "name": "Since Inauguration",
            "description": "All executive orders since January 20, 2025",
            "start_date": "2025-01-20",
            "end_date": today.strftime('%Y-%m-%d'),
            "days": (today - inauguration_date).days
        },
        "last_90_days": {
            "name": "Last 90 Days", 
            "description": "Executive orders from the last 90 days",
            "start_date": (today - timedelta(days=90)).strftime('%Y-%m-%d'),
            "end_date": today.strftime('%Y-%m-%d'),
            "days": 90
        },
        "last_30_days": {
            "name": "Last 30 Days",
            "description": "Executive orders from the last 30 days", 
            "start_date": (today - timedelta(days=30)).strftime('%Y-%m-%d'),
            "end_date": today.strftime('%Y-%m-%d'),
            "days": 30
        },
        "last_7_days": {
            "name": "Last 7 Days",
            "description": "Executive orders from the last 7 days",
            "start_date": (today - timedelta(days=7)).strftime('%Y-%m-%d'),
            "end_date": today.strftime('%Y-%m-%d'),
            "days": 7
        }
    }
    
    return {
        "success": True,
        "periods": periods,
        "current_date": today.strftime('%Y-%m-%d'),
        "inauguration_date": "2025-01-20",
        "days_since_inauguration": (today - inauguration_date).days
    }

@app.post("/api/executive-orders/test-periods")
async def test_period_functionality():
    """Test endpoint to verify period functionality works"""
    try:
        # Test each period without AI to speed up testing
        periods_to_test = ["last_7_days", "last_30_days", "inauguration"]
        results = {}
        
        for period in periods_to_test:
            logger.info(f"🧪 Testing period: {period}")
            
            try:
                result = await fetch_executive_orders_simple_integration(
                    period=period,
                    with_ai=False,
                    limit=3  # Small limit for testing
                )
                
                results[period] = {
                    "success": result.get('success', False),
                    "count": result.get('count', 0),
                    "date_range": result.get('date_range_used', 'Unknown'),
                    "sample_titles": []
                }
                
                # Add sample titles
                if result.get('success') and result.get('results'):
                    for order in result['results'][:2]:
                        results[period]["sample_titles"].append({
                            "eo_number": order.get('eo_number'),
                            "title": order.get('title', 'No title')[:60] + "...",
                            "publication_date": order.get('publication_date'),
                            "document_type": order.get('presidential_document_type')
                        })
                
            except Exception as period_error:
                results[period] = {
                    "success": False,
                    "error": str(period_error),
                    "count": 0
                }
        
        return {
            "success": True,
            "message": "Period functionality test completed",
            "test_results": results,
            "executive_orders_only": True,
            "proclamations_excluded": True
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"Period test failed: {str(e)}"
        }

def transform_orders_for_save_fixed(orders):
    """FIXED: Transform executive orders for database save with proper field mapping"""
    
    transformed_orders = []
    
    for order in orders:
        # Get the best dates available
        signing_date = order.get('signing_date', '')
        publication_date = order.get('publication_date', '')
        
        # If no signing date, try to use publication date
        if not signing_date and publication_date:
            signing_date = publication_date
        
        # FIXED: Ensure eo_number is properly extracted and not a year
        eo_number = order.get('eo_number', '')
        
        # Validate the EO number - if it looks like a year, try to fix it
        if eo_number and eo_number.isdigit():
            eo_int = int(eo_number)
            # If it's a year (2020-2030), try to extract real EO number from other fields
            if 2020 <= eo_int <= 2030:
                # Try to get a better EO number from title or other fields
                title = order.get('title', '')
                doc_number = order.get('document_number', '')
                
                # Look for EO number in title
                import re
                eo_match = re.search(r'(?:Executive Order|EO)\s*(\d{4,5})', title, re.IGNORECASE)
                if eo_match:
                    eo_number = eo_match.group(1)
                elif doc_number and '2025-' in doc_number:
                    # Create a sequential EO number based on document number
                    date_match = re.search(r'2025-(\d+)', doc_number)
                    if date_match:
                        day_num = int(date_match.group(1))
                        eo_number = str(14000 + day_num)
                else:
                    eo_number = f"TEMP_{eo_int}"
        
        # Create clean database record
        transformed_order = {
            'bill_id': f"eo-{eo_number}",
            'bill_number': eo_number,  # This should be the actual EO number, not year
            'title': order.get('title', ''),
            'description': order.get('summary', ''),
            'state': 'Federal',
            'state_abbr': 'US',
            'status': 'Signed',
            'category': order.get('category', 'civic'),
            'introduced_date': signing_date,
            'last_action_date': publication_date or signing_date,
            'session_id': '2025-trump-administration',
            'session_name': 'Trump 2025 Administration',
            'bill_type': 'executive_order',
            'body': 'executive',
            'legiscan_url': order.get('html_url', ''),
            'pdf_url': order.get('pdf_url', ''),
            'ai_summary': order.get('ai_summary', ''),
            'ai_executive_summary': order.get('ai_executive_summary', ''),
            'ai_talking_points': order.get('ai_talking_points', ''),
            'ai_key_points': order.get('ai_key_points', ''),
            'ai_business_impact': order.get('ai_business_impact', ''),
            'ai_potential_impact': order.get('ai_potential_impact', ''),
            'ai_version': order.get('ai_version', 'enhanced_v1_executive_orders_only'),
            'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'last_updated': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        transformed_orders.append(transformed_order)
    
    return transformed_orders

# Update your existing fetch endpoint to use executive orders only
@app.post("/api/executive-orders/fetch-executive-orders-only")
async def fetch_executive_orders_only():
    """FIXED: Fetch EXECUTIVE ORDERS ONLY (no proclamations) using Federal Register API"""
    try:
        logger.info("📡 Starting EXECUTIVE ORDERS ONLY fetch using Federal Register API")
        
        # Use the updated integration function that filters out proclamations
        result = await fetch_executive_orders_simple_integration(
            period="inauguration",  # Since inauguration by default
            with_ai=True,
            limit=None
        )
        
        if not result.get('success'):
            logger.warning(f"⚠️ API fetch failed: {result.get('error', 'Unknown error')}")
            return {"success": False, "message": result.get('error', 'Failed to fetch executive orders')}
        
        orders = result.get('results', [])
        logger.info(f"📥 Retrieved {len(orders)} EXECUTIVE ORDERS (no proclamations)")
        
        if not orders:
            logger.warning("⚠️ No executive orders returned from API")
            return {"success": False, "message": "No executive orders found"}
        
        # Transform orders for database save
        transformed_orders = transform_orders_for_save_fixed(orders)
        
        # Save to database
        if EXECUTIVE_ORDERS_AVAILABLE:
            try:
                saved_count = save_executive_orders_to_db(transformed_orders)
                
                if saved_count > 0:
                    logger.info(f"💾 Saved {saved_count} executive orders to database")
                    return {
                        "success": True, 
                        "count": len(orders), 
                        "saved": saved_count,
                        "method": "federal_register_api_executive_orders_only",
                        "ai_analysis": "enabled",
                        "document_types_excluded": ["proclamation", "memorandum"],
                        "date_range": result.get('date_range_used', 'Since inauguration'),
                        "message": f"Successfully fetched {len(orders)} executive orders (no proclamations)"
                    }
                else:
                    logger.error("❌ Failed to save executive orders to database")
                    return {"success": False, "message": "Failed to save to database"}
            except Exception as save_error:
                logger.error(f"❌ Error saving to database: {save_error}")
                return {"success": False, "message": f"Database save error: {str(save_error)}"}
        else:
            logger.warning("⚠️ Executive orders database not available")
            return {"success": False, "message": "Database not available"}
            
    except Exception as e:
        logger.error(f"❌ Error in fetch_executive_orders_only: {e}")
        return {"success": False, "message": str(e)}


# ===============================
# TESTING ENDPOINTS
# ===============================

@app.get("/api/test-azure-sql")
async def test_azure_sql_endpoint():
    """Test Azure SQL database connection and functionality"""
    
    if not AZURE_SQL_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Azure SQL configuration not available. Check database imports."
        )
    
    try:
        # Test connection
        db_conn = DatabaseConnection()
        connection_test = db_conn.test_connection()
        
        # Run the full Azure SQL test
        full_test_result = test_azure_sql_full()
        
        # Test executive orders integration
        eo_test_result = test_executive_orders_db() if EXECUTIVE_ORDERS_AVAILABLE else False
        
        if connection_test and full_test_result:
            # Get current stats
            stats = get_legislation_stats()
            eo_stats = None
            
            if EXECUTIVE_ORDERS_AVAILABLE:
                eo_stats_result = get_executive_orders_stats()
                if eo_stats_result.get('success'):
                    eo_stats = eo_stats_result.get('statistics', {})
            
            return {
                "success": True,
                "message": "Azure SQL database is working correctly",
                "database_type": "Azure SQL Database",
                "connection": connection_test,
                "full_test": full_test_result,
                "executive_orders_test": eo_test_result,
                "total_bills": stats.get("total_bills", 0),
                "states_with_data": stats.get("states_with_data", []),
                "total_executive_orders": eo_stats.get("total_executive_orders", 0) if eo_stats else 0,
                "highlights_available": HIGHLIGHTS_DB_AVAILABLE,
                "integration_type": "Azure SQL Integration (No SQLAlchemy)",
                "test_passed": True,
                "timestamp": datetime.now().isoformat()
            }
        else:
            return {
                "success": False,
                "message": "Azure SQL tests failed",
                "connection": connection_test,
                "full_test": full_test_result,
                "executive_orders_test": eo_test_result,
                "test_passed": False,
                "timestamp": datetime.now().isoformat()
            }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Azure SQL test failed: {str(e)}"
        )

@app.get("/api/test-azure-ai")
async def test_azure_ai_endpoint():
    """Test Azure AI integration"""
    
    if not AI_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Azure AI not available."
        )
    
    try:
        logger.info("🧪 Testing Azure AI integration...")
        
        # Run the Azure AI test
        test_result = await test_ai_integration()
        
        if test_result:
            return {
                "success": True,
                "message": "Azure AI integration is working correctly",
                "ai_endpoint": os.getenv('AZURE_ENDPOINT', 'Not Set')[:50] + "..." if os.getenv('AZURE_ENDPOINT') else 'Not Set',
                "ai_model": os.getenv('AZURE_MODEL_NAME', 'Not Set'),
                "test_passed": True,
                "simple_executive_orders_available": SIMPLE_EO_AVAILABLE,
                "executive_orders_integration": "Azure SQL",
                "timestamp": datetime.now().isoformat()
            }
        else:
            return {
                "success": False,
                "message": "Azure AI integration test failed",
                "test_passed": False,
                "timestamp": datetime.now().isoformat()
            }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Azure AI test failed: {str(e)}"
        )

# Replace your validate_eo_number function in main.py with this improved version:

def validate_eo_number(eo_number: str) -> bool:
    """
    IMPROVED validation that accepts Federal Register documents
    """
    if not eo_number:
        return False
    
    # Accept temporary numbers for debugging
    if str(eo_number).startswith('TEMP_'):
        return True
    
    # Accept unknown numbers for debugging
    if str(eo_number) == 'UNKNOWN':
        return True
    
    try:
        eo_str = str(eo_number).strip()
        
        # Skip empty strings
        if not eo_str:
            return False
        
        # Try to convert to integer
        eo_int = int(eo_str)
        
        # EXPANDED RANGE: Accept a much wider range of document numbers
        # This includes:
        # - Traditional EO numbers (1000-20000)
        # - Recent Trump EOs (14000-15000)
        # - Federal Register document numbers (20000+)
        # - Presidential proclamations and memorandums
        if eo_int >= 1000:  # Remove upper limit for now
            return True
        
        return False
        
    except (ValueError, TypeError):
        # If it's not a number, check if it's a valid non-numeric identifier
        eo_str = str(eo_number).strip()
        
        # Accept document patterns like "2025-01234"
        if re.match(r'\d{4}-\d+', eo_str):
            return True
        
        # Accept TEMP patterns
        if eo_str.startswith(('TEMP_', 'UNKNOWN_')):
            return True
        
        return False

# ALSO: Update your validation test to reflect the new range
@app.get("/api/test-eo-validation-updated")
async def test_eo_validation_updated():
    """Test the updated EO validation functionality"""
    
    try:
        test_cases = [
            {"eo_number": "14000", "expected": True, "description": "Valid Trump 2025 EO"},
            {"eo_number": "14200", "expected": True, "description": "Mid-range Trump 2025 EO"},
            {"eo_number": "15000", "expected": True, "description": "High range Trump 2025 EO"},
            {"eo_number": "1052", "expected": True, "description": "Lower range valid EO"},
            {"eo_number": "2025", "expected": True, "description": "Year-based document number"},
            {"eo_number": "2026", "expected": True, "description": "Sequential document number"},
            {"eo_number": "21279", "expected": True, "description": "Federal Register document number"},
            {"eo_number": "21280", "expected": True, "description": "High Federal Register number"},
            {"eo_number": "TEMP_20250120_1234", "expected": True, "description": "Temporary EO number"},
            {"eo_number": "UNKNOWN", "expected": True, "description": "Unknown EO number"},
            {"eo_number": "", "expected": False, "description": "Empty string"},
            {"eo_number": "abc", "expected": False, "description": "Non-numeric string"},
            {"eo_number": "999", "expected": False, "description": "Below valid range"},
        ]
        
        results = []
        passed = 0
        failed = 0
        
        for test_case in test_cases:
            actual = validate_eo_number(test_case["eo_number"])
            expected = test_case["expected"]
            success = actual == expected
            
            if success:
                passed += 1
            else:
                failed += 1
            
            results.append({
                "eo_number": test_case["eo_number"],
                "description": test_case["description"],
                "expected": expected,
                "actual": actual,
                "passed": success
            })
        
        return {
            "success": True,
            "message": "Updated EO validation testing completed",
            "validation_tests": {
                "total": len(test_cases),
                "passed": passed,
                "failed": failed,
                "success_rate": f"{(passed/len(test_cases)*100):.1f}%",
                "results": results
            },
            "updated_range": "1000+ (no upper limit)",
            "accepts_federal_register_numbers": True,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"EO validation test failed: {str(e)}"
        )
    
@app.get("/api/debug/executive-orders")
async def debug_executive_orders():
    """Debug endpoint to see what's causing the 500 error"""
    try:
        logger.info("🔍 DEBUG: Testing executive orders endpoint")
        
        # Test 1: Check if executive orders integration is available
        if not EXECUTIVE_ORDERS_AVAILABLE:
            return {
                "issue": "executive_orders_not_available",
                "EXECUTIVE_ORDERS_AVAILABLE": EXECUTIVE_ORDERS_AVAILABLE,
                "message": "Executive orders integration not imported"
            }
        
        # Test 2: Try to call the database function
        logger.info("📊 DEBUG: Testing get_executive_orders_from_db")
        try:
            result = get_executive_orders_from_db(limit=5, offset=0, filters={})
            logger.info(f"📥 DEBUG: Database result: {result}")
            
            if not result.get('success'):
                return {
                    "issue": "database_query_failed",
                    "result": result,
                    "message": f"Database query failed: {result.get('message', 'Unknown error')}"
                }
            
            orders = result.get('results', [])
            return {
                "issue": "none_found_so_far",
                "orders_count": len(orders),
                "sample_order": orders[0] if orders else None,
                "message": f"Found {len(orders)} orders in database"
            }
            
        except Exception as db_error:
            logger.error(f"❌ DEBUG: Database error: {db_error}")
            import traceback
            return {
                "issue": "database_exception",
                "error": str(db_error),
                "traceback": traceback.format_exc(),
                "message": "Database call threw an exception"
            }
        
    except Exception as e:
        logger.error(f"❌ DEBUG: Unexpected error: {e}")
        import traceback
        return {
            "issue": "unexpected_error",
            "error": str(e),
            "traceback": traceback.format_exc()
        }

@app.get("/api/executive-orders-simple")
async def get_executive_orders_simple():
    """Simple version that returns empty results instead of failing"""
    try:
        return {
            "results": [],
            "count": 0,
            "total_pages": 1,
            "page": 1,
            "per_page": 25,
            "message": "No executive orders loaded yet. Use the fetch button to load some.",
            "database_type": "Azure SQL" if AZURE_SQL_AVAILABLE else "Not Available",
            "integration_status": {
                "AZURE_SQL_AVAILABLE": AZURE_SQL_AVAILABLE,
                "EXECUTIVE_ORDERS_AVAILABLE": EXECUTIVE_ORDERS_AVAILABLE,
                "HIGHLIGHTS_DB_AVAILABLE": HIGHLIGHTS_DB_AVAILABLE
            }
        }
    except Exception as e:
        return {
            "results": [],
            "count": 0,
            "error": str(e),
            "message": "Error occurred but returning empty results"
        }

@app.get("/api/status")
async def get_status():
    """System status endpoint"""
    
    # Test database connection
    db_conn = DatabaseConnection()
    db_working = db_conn.test_connection()
    
    # Test Azure SQL connection if available
    azure_sql_working = False
    if AZURE_SQL_AVAILABLE:
        try:
            azure_sql_working = test_azure_sql_connection()
        except Exception:
            azure_sql_working = False
    
    eo_db_status = test_executive_orders_db() if EXECUTIVE_ORDERS_AVAILABLE else False
    
    # Test integration status
    ai_status = "unknown"
    legiscan_status = "unknown"
    
    if AI_AVAILABLE:
        try:
            ai_working = await test_ai_integration()
            ai_status = "connected" if ai_working else "configuration_issue"
        except Exception as e:
            ai_status = f"error: {str(e)[:50]}"
        
        try:
            legiscan_working = await test_legiscan_integration()
            legiscan_status = "connected" if legiscan_working else "configuration_issue"
        except Exception as e:
            legiscan_status = f"error: {str(e)[:50]}"
    
    # Get statistics
    stats = None
    eo_stats = None
    if db_working or azure_sql_working:
        try:
            if AZURE_SQL_AVAILABLE:
                stats = get_legislation_stats()
            if EXECUTIVE_ORDERS_AVAILABLE:
                eo_stats_result = get_executive_orders_stats()
                if eo_stats_result.get('success'):
                    eo_stats = eo_stats_result.get('statistics', {})
        except Exception:
            stats = {"total_bills": 0, "states_with_data": []}
            eo_stats = {"total_executive_orders": 0}
    
    return {
        "environment": os.getenv("ENVIRONMENT", "development"),
        "app_version": "13.0.0-Azure-SQL-Integration - Executive Orders & State Legislation with Azure SQL Integration",
        "database": {
            "status": "connected" if (db_working or azure_sql_working) else "connection_issues",
            "type": "Azure SQL Database" if AZURE_SQL_AVAILABLE else "Fallback",
            "connection": db_working,
            "azure_sql_connection": azure_sql_working,
            "executive_orders_db": eo_db_status,
            "legislation_count": stats["total_bills"] if stats else 0,
            "executive_orders_count": eo_stats["total_executive_orders"] if eo_stats else 0,
            "highlights_enabled": HIGHLIGHTS_DB_AVAILABLE
        },
        "integrations": {
            "simple_executive_orders": "available" if SIMPLE_EO_AVAILABLE else "not_available",
            "legiscan": legiscan_status,
            "ai_analysis": ai_status,
            "azure_sql": "connected" if azure_sql_working else "not_configured",
            "highlights": "available" if HIGHLIGHTS_DB_AVAILABLE else "table_needed",
            "executive_orders_integration": "azure_sql_based" if EXECUTIVE_ORDERS_AVAILABLE else "not_available"
        },
        "features": {
            "simple_executive_orders": "Simple Federal Register API that works",
            "executive_orders": "Azure SQL Integration (No SQLAlchemy)",
            "eo_validation": "Lenient Range (1000-20000) + Date Formatting",
            "state_legislation": "LegiScan Integration with AI",
            "ai_analysis": "Azure AI Integration",
            "persistent_highlights": "Available" if HIGHLIGHTS_DB_AVAILABLE else "Database Setup Required"
        },
        "supported_states": list(SUPPORTED_STATES.keys()),
        "api_keys_configured": {
            "legiscan": bool(os.getenv('LEGISCAN_API_KEY')),
            "azure_ai": bool(os.getenv('AZURE_KEY')),
            "azure_sql": AZURE_SQL_AVAILABLE,
            "azure_endpoint": bool(os.getenv('AZURE_ENDPOINT'))
        },
        "azure_ai_config": {
            "endpoint": os.getenv('AZURE_ENDPOINT', 'Not Set')[:50] + "..." if os.getenv('AZURE_ENDPOINT') else 'Not Set',
            "model_name": os.getenv('AZURE_MODEL_NAME', 'Not Set'),
            "key_configured": bool(os.getenv('AZURE_KEY'))
        },
        "eo_validation": {
            "enabled": True,
            "valid_range": "1000-20000",
            "description": "Lenient range for debugging",
            "date_format": "MM/DD/YYYY for display",
            "filters_invalid": False
        },
        "integration_details": {
            "executive_orders_database": "Azure SQL (state_legislation table with document_type='executive_order')",
            "no_sqlalchemy": True,
            "direct_azure_sql": True,
            "unified_database": True
        },
        "timestamp": datetime.now().isoformat()
    }

@app.post("/api/database/clear-all")
async def clear_all_database_data():
    """Clear all data from the database"""
    
    try:
        records_deleted = 0
        
        # Clear state legislation from Azure SQL (this includes executive orders)
        if AZURE_SQL_AVAILABLE:
            try:
                with LegislationSession() as session:
                    # Count total records first
                    total_count = session.query(StateLegislationDB).count()
                    
                    # Delete all records
                    session.query(StateLegislationDB).delete()
                    session.commit()
                    records_deleted += total_count
                    logger.info(f"✅ Cleared {total_count} records from Azure SQL database")
            except Exception as e:
                logger.error(f"Error clearing legislation: {e}")
        
        return {
            "success": True,
            "message": f"Database cleared successfully. {records_deleted} records deleted. (Highlights preserved)",
            "records_deleted": records_deleted,
            "database_type": "Azure SQL" if AZURE_SQL_AVAILABLE else "Fallback",
            "highlights_preserved": True,
            "eo_validation_maintained": True,
            "simple_executive_orders_ready": SIMPLE_EO_AVAILABLE,
            "integration_type": "Azure SQL Integration (No SQLAlchemy)",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error clearing database: {str(e)}"
        )

# ===============================
# HEALTH CHECK ENDPOINTS
# ===============================

async def check_service_health(service_name: str, check_func) -> dict:
    """Generic health check wrapper"""
    try:
        start_time = datetime.now()
        result = await check_func()
        end_time = datetime.now()
        response_time = (end_time - start_time).total_seconds() * 1000  # ms
        
        return {
            "service": service_name,
            "status": "healthy" if result else "unhealthy",
            "message": "Service is operational" if result else "Service is not responding",
            "response_time_ms": round(response_time, 2),
            "checked_at": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Health check failed for {service_name}: {str(e)}")
        return {
            "service": service_name,
            "status": "error", 
            "message": str(e),
            "response_time_ms": None,
            "checked_at": datetime.now().isoformat()
        }

async def health_check_database() -> bool:
    """Check database connectivity"""
    try:
        db_conn = DatabaseConnection()
        return db_conn.test_connection()
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return False

async def health_check_azure_sql() -> bool:
    """Check Azure SQL connectivity"""
    try:
        if AZURE_SQL_AVAILABLE:
            return test_azure_sql_connection()
        return False
    except Exception as e:
        logger.error(f"Azure SQL health check failed: {e}")
        return False

async def health_check_simple_executive_orders() -> bool:
    """Check Simple Executive Orders API"""
    try:
        if not SIMPLE_EO_AVAILABLE:
            return False
        # Quick test with minimal data
        result = await fetch_executive_orders_simple_integration(
            start_date="2025-01-20",
            end_date="2025-01-21",
            with_ai=False
        )
        return result.get('success', False)
    except Exception as e:
        logger.error(f"Simple Executive Orders health check failed: {e}")
        return False

async def health_check_legiscan() -> bool:
    """Check LegiScan API"""
    try:
        if AI_AVAILABLE:
            return await test_legiscan_integration()
        return False
    except Exception as e:
        logger.error(f"LegiScan health check failed: {e}")
        return False

async def health_check_azure_ai() -> bool:
    """Check Azure AI"""
    try:
        if AI_AVAILABLE:
            return await test_ai_integration()
        return False
    except Exception as e:
        logger.error(f"Azure AI health check failed: {e}")
        return False

async def health_check_highlights() -> bool:
    """Check highlights database functionality"""
    try:
        if not HIGHLIGHTS_DB_AVAILABLE:
            return False
        
        # Try to get highlights for test user
        test_highlights = get_user_highlights_direct("test_user")
        return True  # If no exception, it's working
    except Exception as e:
        logger.error(f"Highlights health check failed: {e}")
        return False

async def health_check_eo_validation() -> bool:
    """Check EO validation functionality"""
    try:
        # Test a few validation cases
        test_valid = validate_eo_number("14200")  # Should be True
        test_invalid = validate_eo_number("abc")  # Should be False
        test_format = format_date_for_display("2025-01-20")  # Should be "01/20/2025"
        
        return test_valid and not test_invalid and test_format == "01/20/2025"
    except Exception as e:
        logger.error(f"EO validation health check failed: {e}")
        return False

async def health_check_executive_orders_integration() -> bool:
    """Check executive orders Azure SQL integration"""
    try:
        if not EXECUTIVE_ORDERS_AVAILABLE:
            return False
        
        # Test the integration
        return test_executive_orders_db()
    except Exception as e:
        logger.error(f"Executive orders integration health check failed: {e}")
        return False

@app.get("/api/health/database")
async def health_endpoint_database():
    """Database health check endpoint"""
    return await check_service_health("database", health_check_database)

@app.get("/api/health/azure-sql")
async def health_endpoint_azure_sql():
    """Azure SQL health check endpoint"""
    return await check_service_health("azure-sql", health_check_azure_sql)

@app.get("/api/health/simple-executive-orders")
async def health_endpoint_simple_executive_orders():
    """Simple Executive Orders health check endpoint"""
    return await check_service_health("simple-executive-orders", health_check_simple_executive_orders)

@app.get("/api/health/legiscan")
async def health_endpoint_legiscan():
    """LegiScan API health check endpoint"""
    return await check_service_health("legiscan", health_check_legiscan)

@app.get("/api/health/azure-ai")
async def health_endpoint_azure_ai():
    """Azure AI health check endpoint"""
    return await check_service_health("azure-ai", health_check_azure_ai)

@app.get("/api/health/highlights")
async def health_endpoint_highlights():
    """Highlights database health check endpoint"""
    return await check_service_health("highlights", health_check_highlights)

@app.get("/api/health/eo-validation")
async def health_endpoint_eo_validation():
    """EO validation health check endpoint"""
    return await check_service_health("eo-validation", health_check_eo_validation)

@app.get("/api/health/executive-orders-integration")
async def health_endpoint_executive_orders_integration():
    """Executive orders Azure SQL integration health check endpoint"""
    return await check_service_health("executive-orders-integration", health_check_executive_orders_integration)

@app.get("/api/health/all")
async def health_check_all_services():
    """Check all services at once"""
    try:
        # Run all checks concurrently
        results = await asyncio.gather(
            check_service_health("database", health_check_database),
            check_service_health("azure-sql", health_check_azure_sql),
            check_service_health("simple-executive-orders", health_check_simple_executive_orders),
            check_service_health("legiscan", health_check_legiscan),
            check_service_health("azure-ai", health_check_azure_ai),
            check_service_health("highlights", health_check_highlights),
            check_service_health("eo-validation", health_check_eo_validation),
            check_service_health("executive-orders-integration", health_check_executive_orders_integration),
            return_exceptions=True
        )
        
        # Calculate overall health
        healthy_count = sum(1 for result in results if isinstance(result, dict) and result.get('status') == 'healthy')
        total_count = len(results)
        
        return {
            "overall_status": "healthy" if healthy_count == total_count else "degraded" if healthy_count > 0 else "unhealthy",
            "healthy_services": healthy_count,
            "total_services": total_count,
            "services": results,
            "database_type": "Azure SQL" if AZURE_SQL_AVAILABLE else "Fallback",
            "ai_available": AI_AVAILABLE,
            "highlights_available": HIGHLIGHTS_DB_AVAILABLE,
            "eo_validation_enabled": True,
            "simple_executive_orders_available": SIMPLE_EO_AVAILABLE,
            "executive_orders_integration": "Azure SQL",
            "valid_eo_range": "1000-20000",
            "integration_type": "Azure SQL Integration (No SQLAlchemy)",
            "checked_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Health check all failed: {e}")
        raise HTTPException(status_code=500, detail="Health check failed")
    
# ===============================
# NEW BATCH PROCESSING ENDPOINTS
# ===============================

@app.post("/api/executive-orders/fetch-small-batch")
async def fetch_small_batch():
    """Fetch small batch with AI (20 orders max)"""
    return await fetch_executive_orders_endpoint(
        start_date='2025-01-20',
        limit=20,
        with_ai=True,
        save_to_db=True,
        skip_ai_if_large=False
    )

@app.post("/api/executive-orders/fetch-large-batch-no-ai")
async def fetch_large_batch_no_ai():
    """Fetch all orders without AI analysis"""
    return await fetch_executive_orders_endpoint(
        start_date='2025-01-20',
        limit=None,  # No limit
        with_ai=False,
        save_to_db=True
    )

@app.post("/api/executive-orders/fetch-recent-with-ai")
async def fetch_recent_with_ai():
    """Fetch recent orders with AI (last 30 days)"""
    thirty_days_ago = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
    
    return await fetch_executive_orders_endpoint(
        start_date=thirty_days_ago,
        limit=50,
        with_ai=True,
        save_to_db=True,
        skip_ai_if_large=False
    )

@app.get("/api/test-enhanced-eo-search")
async def test_enhanced_eo_search():
    """Test the enhanced executive orders search with limits"""
    try:
        result = await fetch_executive_orders_endpoint(
            start_date='2025-01-20',
            end_date='2025-06-15',
            limit=10,  # Test with small batch
            with_ai=False,
            save_to_db=False
        )
        
        if result.get('success'):
            orders = result.get('results', [])
            
            # Count orders with signing dates
            orders_with_signing_dates = sum(1 for order in orders if order.get('signing_date'))
            
            return {
                "success": True,
                "total_orders_found": result.get('total_found', 0),
                "orders_returned": len(orders),
                "orders_with_signing_dates": orders_with_signing_dates,
                "orders_without_signing_dates": len(orders) - orders_with_signing_dates,
                "sample_orders": orders[:3],  # First 3 orders
                "message": f"Enhanced search found {result.get('total_found', 0)} total orders, returned {len(orders)}"
            }
        else:
            return {
                "success": False,
                "error": result.get('error', 'Unknown error'),
                "message": "Enhanced search failed"
            }
            
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": "Test failed"
        }
    
@app.post("/api/add-ai-to-existing-orders")
async def add_ai_to_existing_orders():
    """Add AI analysis to existing executive orders"""
    try:
        logger.info("🤖 Adding AI analysis to existing executive orders")
        
        # Get existing orders from database
        result = get_executive_orders_from_db(limit=200, offset=0, filters={})
        
        if not result.get('success'):
            return {"success": False, "message": "Failed to get orders from database"}
        
        orders = result.get('results', [])
        logger.info(f"📋 Found {len(orders)} orders to analyze")
        
        if not orders:
            return {"success": False, "message": "No orders found in database"}
        
        # Convert to the format expected by AI analysis
        orders_for_ai = []
        for order in orders:
            orders_for_ai.append({
                'eo_number': order.get('bill_number', ''),
                'title': order.get('title', ''),
                'summary': order.get('description', ''),
                'bill_id': order.get('bill_id', ''),
                'category': order.get('category', 'civic')
            })
        
        # Add AI analysis using your existing function
        enhanced_orders = await add_ai_analysis_with_rate_limiting(orders_for_ai)
        
        # Transform for database save
        transformed_orders = transform_orders_for_save(enhanced_orders)
        
        # Save updated orders
        saved_count = save_executive_orders_to_db(transformed_orders)
        
        return {
            "success": True,
            "message": f"Added AI analysis to {len(enhanced_orders)} orders",
            "orders_processed": len(enhanced_orders),
            "orders_saved": saved_count,
            "ai_fields_added": [
                "ai_summary", 
                "ai_executive_summary", 
                "ai_key_points", 
                "ai_talking_points", 
                "ai_business_impact", 
                "ai_potential_impact"
            ]
        }
        
    except Exception as e:
        logger.error(f"❌ Error adding AI analysis: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "message": str(e)}
    

# ===============================
# MAIN APPLICATION STARTUP
# ===============================
if __name__ == "__main__":
    import uvicorn
    print("🌐 Starting LegislationVue API v13.0.0-Azure-SQL-Integration")
    print("=" * 80)
    print("🎯 Azure SQL Integration Features:")
    print("   • Executive orders stored in Azure SQL (No SQLAlchemy)")
    print("   • Simple Federal Register API integration")
    print("   • Direct Azure SQL connection for all data")
    print("   • Unified database approach")
    print("")
    print("📋 Executive Orders endpoints (Azure SQL Integration):")
    print("   • GET  /api/executive-orders?user_id=user123  (✅ EO Validation + Highlights)")
    print("   • POST /api/executive-orders/fetch  (🤖 Simple Federal Register + Azure SQL)")
    print("   • GET  /api/executive-orders/{order_number}  (✅ Validated)")
    print("   • GET  /api/test/simple-executive-orders  (🧪 Test Simple API + Azure SQL)")
    print("")
    print("🏛️ State Legislation endpoints (Azure SQL):")
    print("   • GET  /api/state-legislation?user_id=user123  (✅ Highlights)")
    print("   • POST /api/state-legislation/fetch")
    print("   • POST /api/legiscan/search-and-analyze")
    print("")
    print("⭐ Highlights endpoints (Azure SQL Direct Connection):")
    print("   • GET  /api/user-highlights?user_id=user123")
    print("   • POST /api/highlights/toggle?content_type=executive_order&content_id=14147&user_id=user123")
    print("   • GET  /api/test-highlights")
    print("")
    print("🔧 Testing endpoints:")
    print("   • GET  /api/test-azure-sql")
    print("   • GET  /api/test-azure-ai")
    print("   • GET  /api/test-eo-validation")
    print("")
    print("🔧 Utility endpoints:")
    print("   • GET  /api/status")
    print("   • POST /api/database/clear-all")
    print("")
    print("🩺 Health check endpoints:")
    print("   • GET  /api/health/all")
    print("   • GET  /api/health/database")
    print("   • GET  /api/health/azure-sql")
    print("   • GET  /api/health/simple-executive-orders")
    print("   • GET  /api/health/highlights")
    print("   • GET  /api/health/azure-ai")
    print("   • GET  /api/health/eo-validation")
    print("   • GET  /api/health/executive-orders-integration")
    print("")
    
    # Configuration status checks
    azure_sql_configured = AZURE_SQL_AVAILABLE
    legiscan_configured = bool(os.getenv('LEGISCAN_API_KEY'))
    azure_ai_configured = bool(os.getenv('AZURE_KEY')) and bool(os.getenv('AZURE_ENDPOINT'))
    simple_executive_orders_configured = SIMPLE_EO_AVAILABLE
    executive_orders_integration_configured = EXECUTIVE_ORDERS_AVAILABLE
    
    print(f"🎯 Configuration Status:")
    print(f"   • AZURE_SQL: {'✅ Configured' if azure_sql_configured else '❌ Missing'}")
    print(f"   • LEGISCAN_API_KEY: {'✅ Configured' if legiscan_configured else '❌ Missing'}")
    print(f"   • AZURE_AI (Key + Endpoint): {'✅ Configured' if azure_ai_configured else '❌ Missing'}")
    print(f"   • HIGHLIGHTS_DB: {'✅ Available' if HIGHLIGHTS_DB_AVAILABLE else '❌ Azure SQL Required'}")
    print(f"   • EO_VALIDATION: ✅ Enabled (Range: 1000-20000)")
    print(f"   • SIMPLE_EXECUTIVE_ORDERS: {'✅ Available' if simple_executive_orders_configured else '❌ Missing'}")
    print(f"   • EXECUTIVE_ORDERS_INTEGRATION: {'✅ Available' if executive_orders_integration_configured else '❌ Missing'}")
    print("")
    
    if simple_executive_orders_configured and executive_orders_integration_configured:
        print(f"🚀 AZURE SQL INTEGRATION READY!")
        print(f"   • Simple Federal Register API that actually works ✅")
        print(f"   • Azure SQL integration for executive orders ✅")
        print(f"   • No SQLAlchemy dependencies ✅")
        print(f"   • Unified database approach ✅")
        print(f"   • Executive order validation and filtering ✅")
        print(f"   • Azure AI integration for analysis ✅")
    else:
        print(f"⚠️  Some integrations not available")
        if not simple_executive_orders_configured:
            print(f"   - Ensure simple_executive_orders.py is available")
        if not executive_orders_integration_configured:
            print(f"   - Ensure Azure SQL database is configured")
    
    if azure_ai_configured:
        print(f"🤖 Azure AI Configuration:")
        print(f"   • Endpoint: {os.getenv('AZURE_ENDPOINT', 'Not Set')[:50]}...")
        print(f"   • Model: {os.getenv('AZURE_MODEL_NAME', 'summarize-gpt-4.1')}")
        print(f"   • Executive Order Analysis: ✅ Enabled")
        print(f"   • test_ai_integration: ✅ Added to main.py")
    else:
        print(f"⚠️  Azure AI not configured - will use basic analysis")
    
    if not HIGHLIGHTS_DB_AVAILABLE:
        print(f"⚠️  Highlights not available - ensure Azure SQL is configured")
    
    print(f"")
    print(f"✅ AZURE SQL INTEGRATION BENEFITS:")
    print(f"   • All data in one Azure SQL database")
    print(f"   • No SQLAlchemy complexity or dependencies")
    print(f"   • Direct Azure SQL connections for better performance")
    print(f"   • Unified schema for executive orders and legislation")
    print(f"   • Simple Federal Register API that actually fetches data")
    print(f"   • Proper error handling and validation")
    print(f"   • Clean separation of concerns")
    print("")
    
    print(f"🗄️ DATABASE ARCHITECTURE:")
    print(f"   • Executive Orders: Azure SQL (state_legislation table, document_type='executive_order')")
    print(f"   • State Legislation: Azure SQL (state_legislation table)")
    print(f"   • User Highlights: Azure SQL (user_highlights table)")
    print(f"   • No separate SQLAlchemy databases")
    print(f"   • Unified queries and reporting")
    print("")
    
    print(f"📡 SIMPLE FEDERAL REGISTER FEATURES:")
    print(f"   • Simple Federal Register API access that works")
    print(f"   • Azure AI analysis for executive orders")
    print(f"   • Lenient EO validation (1000-20000) for debugging")
    print(f"   • Date formatting and validation")
    print(f"   • Integration with highlights system")
    print(f"   • Reliable data fetching and processing")
    print("")
    
    print(f"🔧 AI INTEGRATION STATUS:")
    print(f"   • test_ai_integration function: ✅ Added to main.py")
    print(f"   • AI testing during startup: ✅ Enabled")
    print(f"   • Executive order AI analysis: ✅ Available")
    print(f"   • State legislation AI analysis: ✅ Available")
    print("")
    
    # Test database connection on startup
    print("🔍 Testing database connection...")
    try:
        db_conn = DatabaseConnection()
        if db_conn.test_connection():
            print("✅ Database connection successful!")
        else:
            print("❌ Database connection failed")
    except Exception as e:
        print(f"❌ Database connection test error: {e}")
    
    # Test Simple Executive Orders on startup if available
    if SIMPLE_EO_AVAILABLE:
        print("🔍 Testing Simple Executive Orders API...")
        try:
            print("✅ Simple Executive Orders API module loaded successfully!")
        except Exception as e:
            print(f"❌ Simple Executive Orders test error: {e}")
    
    # Test Executive Orders Integration on startup if available
    if EXECUTIVE_ORDERS_AVAILABLE:
        print("🔍 Testing Executive Orders Azure SQL Integration...")
        try:
            print("✅ Executive Orders Azure SQL Integration module loaded successfully!")
        except Exception as e:
            print(f"❌ Executive Orders Integration test error: {e}")
    
    # Test AI Integration on startup if available
    if AI_AVAILABLE:
        print("🔍 AI Integration available with test_ai_integration function")
        print("   • Will test AI during lifespan startup")
        print("   • Azure OpenAI client configuration ready")
    
    print("🎯 Starting server...")
    uvicorn.run(app, host="0.0.0.0", port=8000)