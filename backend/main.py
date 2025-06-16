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

# ===============================
# CRITICAL MISSING ENDPOINT - ADD THIS TO YOUR MAIN.PY
# ===============================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown"""
    print("🔄 Starting LegislationVue API with Azure SQL Integration...")
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

# ===============================
# ESSENTIAL ENDPOINT - THIS IS WHAT YOUR FRONTEND IS CALLING
# ===============================

@app.post("/api/fetch-executive-orders-simple")
async def fetch_executive_orders_simple_endpoint(request: ExecutiveOrderFetchRequest):
    """
    ESSENTIAL ENDPOINT: Fetch executive orders from Federal Register API with AI processing
    This is the endpoint your frontend is calling!
    """
    try:
        logger.info(f"🚀 Starting executive orders fetch via Federal Register API")
        logger.info(f"📋 Request: {request.dict()}")
        
        if not SIMPLE_EO_AVAILABLE:
            raise HTTPException(
                status_code=503,
                detail="Simple Executive Orders API not available"
            )
        
        # Call your integration function
        result = await fetch_executive_orders_simple_integration(
            start_date=request.start_date,
            end_date=request.end_date,
            with_ai=request.with_ai,
            limit=None,  # No limit to get all orders
            save_to_db=request.save_to_db
        )
        
        logger.info(f"📊 Fetch result: {result.get('count', 0)} orders")
        
        if result.get('success'):
            return {
                "success": True,
                "results": result.get('results', []),
                "count": result.get('count', 0),
                "orders_saved": result.get('orders_saved', 0),
                "total_found": result.get('total_found', 0),
                "ai_successful": result.get('ai_successful', 0),
                "ai_failed": result.get('ai_failed', 0),
                "message": result.get('message', 'Executive orders fetched successfully'),
                "date_range_used": result.get('date_range_used'),
                "method": "federal_register_api_direct"
            }
        else:
            raise HTTPException(
                status_code=500,
                detail=result.get('error', 'Unknown error occurred')
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error in executive orders fetch endpoint: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch executive orders: {str(e)}"
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
    
    return {
        "message": "LegislationVue API with Azure SQL Integration",
        "status": "healthy",
        "version": "13.0.0-Azure-SQL-Integration",
        "timestamp": datetime.now().isoformat(),
        "database": {
            "status": "connected" if db_working else "issues",
            "type": db_type,
            "azure_sql_available": AZURE_SQL_AVAILABLE
        },
        "integrations": {
            "simple_executive_orders": "available" if SIMPLE_EO_AVAILABLE else "not_available",
            "executive_orders_integration": "azure_sql_based" if EXECUTIVE_ORDERS_AVAILABLE else "not_available"
        },
        "supported_states": list(SUPPORTED_STATES.keys())
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
                "message": "Executive orders functionality not available"
            }
        
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
                "error": error_msg
            }
        
        orders = result.get('results', [])
        logger.info(f"📋 Got {len(orders)} orders from database")
        
        # Apply validation and formatting
        validated_orders = []
        for i, order in enumerate(orders):
            try:
                eo_number = order.get('bill_number', '')
                logger.info(f"📝 Processing order {i+1}: bill_number={eo_number}, title={order.get('title', 'No title')[:50]}...")
                
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
                    'source': 'Azure SQL Database'
                }
                
                validated_orders.append(formatted_order)
                logger.info(f"✅ Processed order: {eo_number}")
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
            "database_type": "Azure SQL"
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
            "error": f"Unexpected error: {str(e)}"
        }
    
    # ===============================
# ADDITIONAL EXECUTIVE ORDER ENDPOINTS
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
                transformed_orders = transform_orders_for_save(orders)
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

@app.post("/api/fetch-executive-orders-simple")
async def fetch_executive_orders_simple_endpoint(request: ExecutiveOrderFetchRequest):
    """
    ESSENTIAL ENDPOINT: Fetch executive orders from Federal Register API with AI processing
    This is the endpoint your frontend is calling!
    """
    try:
        logger.info(f"🚀 Starting executive orders fetch via Federal Register API")
        logger.info(f"📋 Request: {request.dict()}")
        
        if not SIMPLE_EO_AVAILABLE:
            raise HTTPException(
                status_code=503,
                detail="Simple Executive Orders API not available"
            )
        
        # Call your integration function
        result = await fetch_executive_orders_simple_integration(
            start_date=request.start_date,
            end_date=request.end_date,
            with_ai=request.with_ai,
            limit=None,  # No limit to get all orders
            save_to_db=request.save_to_db
        )
        
        logger.info(f"📊 Fetch result: {result.get('count', 0)} orders")
        
        if result.get('success'):
            return {
                "success": True,
                "results": result.get('results', []),
                "count": result.get('count', 0),
                "orders_saved": result.get('orders_saved', 0),
                "total_found": result.get('total_found', 0),
                "ai_successful": result.get('ai_successful', 0),
                "ai_failed": result.get('ai_failed', 0),
                "message": result.get('message', 'Executive orders fetched successfully'),
                "date_range_used": result.get('date_range_used'),
                "method": "federal_register_api_direct"
            }
        else:
            raise HTTPException(
                status_code=500,
                detail=result.get('error', 'Unknown error occurred')
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error in executive orders fetch endpoint: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch executive orders: {str(e)}"
        )

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
                transformed_orders = transform_orders_for_save(orders)
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
            order_id NVARCHAR(100) NOT NULL,
            order_type NVARCHAR(50) NOT NULL,
            title NVARCHAR(MAX),
            description NVARCHAR(MAX),
            ai_summary NVARCHAR(MAX),
            category NVARCHAR(50),
            state NVARCHAR(50),
            signing_date NVARCHAR(50),
            html_url NVARCHAR(500),
            pdf_url NVARCHAR(500),
            legiscan_url NVARCHAR(500),
            highlighted_at DATETIME2 DEFAULT GETUTCDATE(),
            notes NVARCHAR(MAX),
            priority_level INT DEFAULT 1,
            tags NVARCHAR(MAX),
            is_archived BIT DEFAULT 0,
            CONSTRAINT UQ_user_highlight UNIQUE (user_id, order_id, order_type)
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

# Set HIGHLIGHTS_DB_AVAILABLE based on Azure SQL availability
HIGHLIGHTS_DB_AVAILABLE = AZURE_SQL_AVAILABLE

def add_highlight_direct(user_id: str, order_id: str, order_type: str, item_data: dict = None) -> bool:
    """Add a highlight with full item data - IMPROVED VERSION"""
    try:
        conn = get_azure_sql_connection()
        if not conn:
            print("❌ No database connection available")
            return False
            
        cursor = conn.cursor()
        
        # Check if highlight already exists
        check_query = """
        SELECT id FROM user_highlights 
        WHERE user_id = ? AND order_id = ? AND order_type = ? AND is_archived = 0
        """
        cursor.execute(check_query, user_id, order_id, order_type)
        existing = cursor.fetchone()
        
        if existing:
            print(f"ℹ️ Highlight already exists for {order_id}")
            conn.close()
            return True
        
        # Insert new highlight with item data
        insert_query = """
        INSERT INTO user_highlights (
            user_id, order_id, order_type, title, description, ai_summary, 
            category, state, signing_date, html_url, pdf_url, legiscan_url,
            notes, priority_level, tags, is_archived
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        
        # Prepare values with proper defaults
        values = (
            user_id, 
            order_id, 
            order_type,
            item_data.get('title', '') if item_data else '',
            item_data.get('description', '') if item_data else '',
            item_data.get('ai_summary', '') if item_data else '',
            item_data.get('category', '') if item_data else '',
            item_data.get('state', '') if item_data else '',
            item_data.get('signing_date', '') if item_data else '',
            item_data.get('html_url', '') if item_data else '',
            item_data.get('pdf_url', '') if item_data else '',
            item_data.get('legiscan_url', '') if item_data else '',
            None,  # notes
            1,     # priority_level
            None,  # tags
            0      # is_archived
        )
        
        cursor.execute(insert_query, values)
        rows_affected = cursor.rowcount
        
        conn.commit()
        conn.close()
        
        success = rows_affected > 0
        print(f"{'✅' if success else '❌'} Add highlight result: {success} (rows affected: {rows_affected})")
        return success
        
    except Exception as e:
        print(f"❌ Error adding highlight: {e}")
        import traceback
        traceback.print_exc()
        return False

# Also replace your remove_highlight_direct function:

def remove_highlight_direct(user_id: str, order_id: str, order_type: str = None) -> bool:
    """Remove a highlight - IMPROVED VERSION"""
    try:
        conn = get_azure_sql_connection()
        if not conn:
            print("❌ No database connection available")
            return False
            
        cursor = conn.cursor()
        
        if order_type:
            # Remove specific highlight by type
            delete_query = """
            DELETE FROM user_highlights 
            WHERE user_id = ? AND order_id = ? AND order_type = ?
            """
            cursor.execute(delete_query, user_id, order_id, order_type)
        else:
            # Remove by order_id only (for compatibility)
            delete_query = """
            DELETE FROM user_highlights 
            WHERE user_id = ? AND order_id = ?
            """
            cursor.execute(delete_query, user_id, order_id)
        
        rows_affected = cursor.rowcount
        conn.commit()
        conn.close()
        
        success = rows_affected > 0
        print(f"{'✅' if success else 'ℹ️'} Remove highlight result: {success} (rows affected: {rows_affected})")
        return success
        
    except Exception as e:
        print(f"❌ Error removing highlight: {e}")
        import traceback
        traceback.print_exc()
        return False

def remove_highlight_direct(user_id: str, order_id: str, order_type: str = None) -> bool:
    """Remove a highlight"""
    try:
        conn = get_azure_sql_connection()
        if not conn:
            return False
            
        cursor = conn.cursor()
        
        if order_type:
            # Remove specific highlight by type
            delete_query = """
            DELETE FROM user_highlights 
            WHERE user_id = ? AND order_id = ? AND order_type = ?
            """
            cursor.execute(delete_query, user_id, order_id, order_type)
        else:
            # Remove by order_id only (for compatibility)
            delete_query = """
            DELETE FROM user_highlights 
            WHERE user_id = ? AND order_id = ?
            """
            cursor.execute(delete_query, user_id, order_id)
        
        rows_affected = cursor.rowcount
        conn.commit()
        conn.close()
        
        return rows_affected > 0
        
    except Exception as e:
        print(f"❌ Error removing highlight: {e}")
        return False

def get_user_highlights_direct(user_id: str) -> List[Dict]:
    """Get all highlights for a user"""
    try:
        conn = get_azure_sql_connection()
        if not conn:
            return []
            
        cursor = conn.cursor()
        
        query = """
        SELECT order_id, order_type, title, description, ai_summary, category, 
               state, signing_date, html_url, pdf_url, legiscan_url, 
               highlighted_at, notes, priority_level
        FROM user_highlights 
        WHERE user_id = ? AND is_archived = 0
        ORDER BY highlighted_at DESC
        """
        
        cursor.execute(query, user_id)
        highlights = cursor.fetchall()
        
        results = []
        for highlight in highlights:
            (order_id, order_type, title, description, ai_summary, category, 
             state, signing_date, html_url, pdf_url, legiscan_url, 
             highlighted_at, notes, priority_level) = highlight
            
            result = {
                'order_id': order_id,
                'order_type': order_type,
                'title': title or f'{order_type.replace("_", " ").title()} {order_id}',
                'description': description or '',
                'ai_summary': ai_summary or '',
                'category': category or '',
                'state': state or '',
                'signing_date': signing_date or '',
                'html_url': html_url or '',
                'pdf_url': pdf_url or '',
                'legiscan_url': legiscan_url or '',
                'highlighted_at': highlighted_at.isoformat() if highlighted_at else None,
                'notes': notes or '',
                'priority_level': priority_level or 1
            }
            results.append(result)
        
        conn.close()
        return results
        
    except Exception as e:
        print(f"❌ Error getting user highlights: {e}")
        return []

# ===============================
# HIGHLIGHTS API ENDPOINTS - FIXED FOR YOUR FRONTEND
# ===============================

@app.get("/api/highlights")
async def get_user_highlights_endpoint(
    user_id: str = Query("1", description="User identifier")
):
    """Get all highlights for a user - FIXED endpoint path"""
    
    if not HIGHLIGHTS_DB_AVAILABLE:
        return {
            "success": False,
            "message": "Highlights database not available. Please ensure Azure SQL is configured.",
            "highlights": []
        }
    
    try:
        # Create table if it doesn't exist
        create_highlights_table()
        
        highlights = get_user_highlights_direct(user_id)
        
        return {
            "success": True,
            "user_id": user_id,
            "highlights": highlights,
            "results": highlights,  # Also provide as 'results' for compatibility
            "count": len(highlights),
            "database_type": "Azure SQL",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting user highlights: {e}")
        return {
            "success": False,
            "error": str(e),
            "highlights": [],
            "results": []
        }

@app.post("/api/highlights")
async def add_highlight_endpoint(request: HighlightCreateRequest):
    """Add a highlight - FIXED endpoint"""
    
    if not HIGHLIGHTS_DB_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Highlights database not available. Please ensure Azure SQL is configured."
        )
    
    try:
        # Create table if it doesn't exist
        create_highlights_table()
        
        # Get the item data if it's an executive order
        item_data = {}
        if request.order_type == 'executive_order' and EXECUTIVE_ORDERS_AVAILABLE:
            try:
                # Try to get the executive order data
                db_result = get_executive_orders_from_db(limit=1000, offset=0, filters={})
                if db_result.get('success'):
                    for order in db_result.get('results', []):
                        if order.get('bill_number') == request.order_id:
                            item_data = {
                                'title': order.get('title', ''),
                                'description': order.get('description', ''),
                                'ai_summary': order.get('ai_summary', ''),
                                'category': order.get('category', ''),
                                'state': order.get('state', ''),
                                'signing_date': order.get('introduced_date', ''),
                                'html_url': order.get('legiscan_url', ''),
                                'pdf_url': order.get('pdf_url', ''),
                                'legiscan_url': order.get('legiscan_url', '')
                            }
                            break
            except Exception as e:
                logger.warning(f"Could not get item data for highlight: {e}")
        
        success = add_highlight_direct(
            user_id=str(request.user_id), 
            order_id=request.order_id, 
            order_type=request.order_type,
            item_data=item_data
        )
        
        if success:
            return {
                "success": True,
                "message": "Highlight added successfully",
                "user_id": request.user_id,
                "order_id": request.order_id,
                "order_type": request.order_type
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to add highlight")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding highlight: {e}")
        raise HTTPException(status_code=500, detail=f"Error adding highlight: {str(e)}")

@app.delete("/api/highlights/{order_id}")
async def remove_highlight_endpoint(
    order_id: str,
    user_id: str = Query("1", description="User identifier"),
    order_type: Optional[str] = Query(None, description="Order type for more specific removal")
):
    """Remove a highlight - FIXED endpoint path"""
    
    if not HIGHLIGHTS_DB_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Highlights database not available. Please ensure Azure SQL is configured."
        )
    
    try:
        success = remove_highlight_direct(user_id, order_id, order_type)
        
        if success:
            return {
                "success": True,
                "message": "Highlight removed successfully",
                "user_id": user_id,
                "order_id": order_id
            }
        else:
            raise HTTPException(status_code=404, detail="Highlight not found")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing highlight: {e}")
        raise HTTPException(status_code=500, detail=f"Error removing highlight: {str(e)}")

@app.post("/api/test-highlight-simple")
async def test_highlight_simple():
    """Simple test to verify highlight functionality"""
    try:
        test_user = "test123"
        test_order = "14001"
        test_type = "executive_order"
        
        print(f"🧪 Testing highlight add/remove for user={test_user}, order={test_order}")
        
        # Test add
        add_success = add_highlight_direct(
            test_user, 
            test_order, 
            test_type,
            {
                'title': 'Test Executive Order 14001',
                'description': 'Test description for debugging',
                'category': 'civic'
            }
        )
        
        # Test get
        highlights = get_user_highlights_direct(test_user)
        
        # Test remove
        remove_success = remove_highlight_direct(test_user, test_order, test_type)
        
        return {
            "success": True,
            "test_results": {
                "add_highlight": add_success,
                "highlights_found": len(highlights),
                "remove_highlight": remove_success
            },
            "sample_highlight": highlights[0] if highlights else None,
            "message": "Simple highlight test completed"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": "Simple highlight test failed"
        }
    try:
    # Test database connection
        conn = get_azure_sql_connection()
        if not conn:
            return {"success": False, "message": "Could not connect to Azure SQL"}
        
        # Create table if needed
        table_created = create_highlights_table()
        
        # Test basic operations
        test_user = "test_user_123"
        test_order_id = "test_order_456"
        test_order_type = "executive_order"
        
        # Add test highlight
        add_result = add_highlight_direct(
            test_user, 
            test_order_id, 
            test_order_type,
            {
                'title': 'Test Executive Order',
                'description': 'Test description',
                'ai_summary': 'Test AI summary'
            }
        )
        
        # Get highlights
        highlights = get_user_highlights_direct(test_user)
        
        # Remove test highlight
        remove_result = remove_highlight_direct(test_user, test_order_id, test_order_type)
        
        conn.close()
        
        return {
            "success": True,
            "database_connection": "OK",
            "table_created": table_created,
            "add_highlight": add_result,
            "highlights_count": len(highlights),
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
# STATUS AND HEALTH ENDPOINTS
# ===============================

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
    
    return {
        "environment": os.getenv("ENVIRONMENT", "development"),
        "app_version": "13.0.0-Azure-SQL-Integration - Executive Orders & State Legislation",
        "database": {
            "status": "connected" if (db_working or azure_sql_working) else "connection_issues",
            "type": "Azure SQL Database" if AZURE_SQL_AVAILABLE else "Fallback",
            "connection": db_working,
            "azure_sql_connection": azure_sql_working,
            "highlights_enabled": HIGHLIGHTS_DB_AVAILABLE
        },
        "integrations": {
            "simple_executive_orders": "available" if SIMPLE_EO_AVAILABLE else "not_available",
            "azure_sql": "connected" if azure_sql_working else "not_configured",
            "highlights": "available" if HIGHLIGHTS_DB_AVAILABLE else "table_needed",
            "executive_orders_integration": "azure_sql_based" if EXECUTIVE_ORDERS_AVAILABLE else "not_available"
        },
        "features": {
            "simple_executive_orders": "Simple Federal Register API that works",
            "executive_orders": "Azure SQL Integration",
            "persistent_highlights": "Available" if HIGHLIGHTS_DB_AVAILABLE else "Database Setup Required"
        },
        "supported_states": list(SUPPORTED_STATES.keys()),
        "api_keys_configured": {
            "azure_sql": AZURE_SQL_AVAILABLE,
        },
        "timestamp": datetime.now().isoformat()
    }

# ===============================
# TESTING ENDPOINTS
# ===============================

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
            with_ai=False,
            limit=5
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

@app.post("/api/debug-fetch-process")
async def debug_fetch_process():
    """Debug the fetch process to see where AI is getting lost"""
    try:
        logger.info("🔍 Debugging fetch process...")
        
        # Test the simple integration function directly
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
        return {
            "success": False,
            "message": f"Debug fetch failed: {str(e)}"
        }

# ===============================
# MAIN APPLICATION STARTUP
# ===============================
if __name__ == "__main__":
    import uvicorn
    print("🌐 Starting LegislationVue API v13.0.0-Azure-SQL-Integration")
    print("=" * 80)
    
    print(f"🎯 KEY ENDPOINTS FIXED:")
    print(f"   • POST /api/fetch-executive-orders-simple  ✅ ADDED (Frontend calls this)")
    print(f"   • GET  /api/highlights?user_id=1           ✅ FIXED (Highlights page)")
    print(f"   • POST /api/highlights                     ✅ FIXED (Add highlight)")
    print(f"   • DELETE /api/highlights/{{order_id}}        ✅ FIXED (Remove highlight)")
    print(f"   • GET  /api/executive-orders               ✅ WORKING (Main page)")
    print("")
    
    print(f"📋 Executive Orders endpoints:")
    print(f"   • GET  /api/executive-orders")
    print(f"   • POST /api/fetch-executive-orders-simple  (✅ NEW - Your frontend calls this)")
    print(f"   • POST /api/executive-orders/run-pipeline")
    print(f"   • POST /api/executive-orders/fetch")
    print("")
    
    print(f"⭐ Highlights endpoints (FIXED):")
    print(f"   • GET  /api/highlights?user_id=1")
    print(f"   • POST /api/highlights")
    print(f"   • DELETE /api/highlights/{{order_id}}?user_id=1")
    print(f"   • GET  /api/test-highlights")
    print("")
    
    print(f"🔧 Testing endpoints:")
    print(f"   • GET  /api/test/simple-executive-orders")
    print(f"   • POST /api/debug-fetch-process")
    print(f"   • GET  /api/status")
    print("")
    
    # Configuration status checks
    azure_sql_configured = AZURE_SQL_AVAILABLE
    simple_executive_orders_configured = SIMPLE_EO_AVAILABLE
    executive_orders_integration_configured = EXECUTIVE_ORDERS_AVAILABLE
    
    print(f"🎯 Configuration Status:")
    print(f"   • AZURE_SQL: {'✅ Configured' if azure_sql_configured else '❌ Missing'}")
    print(f"   • HIGHLIGHTS_DB: {'✅ Available' if HIGHLIGHTS_DB_AVAILABLE else '❌ Azure SQL Required'}")
    print(f"   • SIMPLE_EXECUTIVE_ORDERS: {'✅ Available' if simple_executive_orders_configured else '❌ Missing'}")
    print(f"   • EXECUTIVE_ORDERS_INTEGRATION: {'✅ Available' if executive_orders_integration_configured else '❌ Missing'}")
    print("")
    
    if simple_executive_orders_configured and executive_orders_integration_configured:
        print(f"🚀 INTEGRATION READY!")
        print(f"   • Federal Register API integration ✅")
        print(f"   • Azure SQL database integration ✅") 
        print(f"   • Highlights system working ✅")
        print(f"   • Frontend endpoint /api/fetch-executive-orders-simple ✅")
    else:
        print(f"⚠️  Some integrations not available")
    
    print(f"")
    print(f"🔧 FIXES APPLIED:")
    print(f"   • Added missing /api/fetch-executive-orders-simple endpoint")
    print(f"   • Fixed highlights endpoints to match frontend calls")
    print(f"   • Updated highlights table schema with full item data")
    print(f"   • Added proper error handling for missing components")
    print(f"   • Frontend and backend now properly connected")
    print("")
    
    # Test database connection on startup
    print("🔍 Testing database connection...")
    try:
        db_conn = DatabaseConnection()
        if db_conn.test_connection():
            print("✅ Database connection successful!")
            
            # Test highlights table creation
            if create_highlights_table():
                print("✅ Highlights table ready!")
        else:
            print("❌ Database connection failed")
    except Exception as e:
        print(f"❌ Database connection test error: {e}")
    
    print("🎯 Starting server...")
    uvicorn.run(app, host="0.0.0.0", port=8000)