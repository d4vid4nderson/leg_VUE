# main.py - Updated with Fixed Azure SQL Integration
from fastapi import FastAPI, HTTPException, Query, Path, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
import os
import logging
from contextlib import asynccontextmanager

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

# CORRECTED: Import the fixed Azure SQL database functions
try:
    from database_azure_fixed import (
        test_azure_sql_connection,
        init_databases, 
        get_legislation_from_azure_sql as get_legislation_from_db,
        save_legislation_to_azure_sql as save_legislation_to_db,
        get_legislation_stats_azure_sql as get_legislation_stats,
        LegislationSession,
        StateLegislationDB,
        test_azure_sql_full
    )
    AZURE_SQL_AVAILABLE = True
    print("✅ Using Azure SQL database configuration")
except ImportError as e:
    print(f"❌ Azure SQL import failed: {e}")
    # Fallback to original database
    from database_fixed import (
        test_connections,
        init_databases, 
        get_legislation_from_db,
        save_legislation_to_db,
        get_legislation_stats,
        LegislationSession,
        StateLegislationDB
    )
    AZURE_SQL_AVAILABLE = False
    print("⚠️ Using fallback database configuration")

# Import executive orders functionality
from executive_orders_db import (
    init_executive_orders_db,
    save_executive_orders_to_db,
    get_executive_orders_from_db,
    get_executive_order_by_number,
    get_executive_orders_stats,
    test_executive_orders_db
)

# Import Federal Register API
from federal_register_api import FederalRegisterAPI

# Import AI functions for state legislation
try:
    from ai import (
        run_state_pipeline, 
        run_multi_state_pipeline,
        search_and_analyze_bills,
        test_legiscan_integration,
        test_ai_integration
    )
    AI_AVAILABLE = True
    print("✅ AI integration available")
except ImportError as e:
    print(f"⚠️ AI integration not available: {e}")
    AI_AVAILABLE = False

from dotenv import load_dotenv
load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown with Azure SQL testing"""
    print("🔄 Starting LegislationVue API with Azure SQL...")
    
    # Test Azure SQL connection first
    if AZURE_SQL_AVAILABLE:
        print("🔍 Testing Azure SQL integration...")
        azure_sql_working = test_azure_sql_connection()
        if azure_sql_working:
            print("✅ Azure SQL connection successful")
            # Initialize tables
            if init_databases():
                print("✅ Azure SQL tables ready")
            else:
                print("⚠️ Azure SQL table initialization issues")
        else:
            print("❌ Azure SQL connection failed")
    
    # Test AI integration
    if AI_AVAILABLE:
        try:
            ai_working = await test_ai_integration()
            if ai_working:
                print("✅ AI integration ready")
            else:
                print("⚠️ AI integration issues")
        except Exception as e:
            print(f"⚠️ AI test failed: {e}")
        
        # Test LegiScan integration
        try:
            legiscan_working = await test_legiscan_integration()
            if legiscan_working:
                print("✅ LegiScan integration ready")
            else:
                print("⚠️ LegiScan integration issues")
        except Exception as e:
            print(f"⚠️ LegiScan test failed: {e}")
    
    # Initialize executive orders database
    eo_init_result = init_executive_orders_db()
    eo_db_result = test_executive_orders_db()
    
    if eo_init_result and eo_db_result:
        print("✅ Executive orders database ready")
    
    print("🎯 API startup complete!")
    
    yield
    # Shutdown

app = FastAPI(
    title="LegislationVue API - Azure SQL Edition",
    description="API for Executive Orders and State Legislation with Azure SQL Database",
    version="9.1.0-Azure",
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
    """Health check endpoint with Azure SQL status"""
    
    # Test database connections
    if AZURE_SQL_AVAILABLE:
        db_working = test_azure_sql_connection()
        db_type = "Azure SQL Database"
    else:
        try:
            db_status = test_connections()
            db_working = db_status["legislation"]
            db_type = "SQLite Fallback"
        except:
            db_working = False
            db_type = "Unknown"
    
    eo_db_status = test_executive_orders_db()
    
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
            eo_stats = get_executive_orders_stats()
        except Exception:
            stats = {"total_bills": 0, "states_with_data": []}
            eo_stats = {"total_orders": 0}
    
    return {
        "message": "LegislationVue API with Azure SQL Database",
        "status": "healthy",
        "version": "9.1.0-Azure",
        "timestamp": datetime.now().isoformat(),
        "database": {
            "status": "connected" if db_working else "issues",
            "type": db_type,
            "azure_sql_available": AZURE_SQL_AVAILABLE,
            "total_bills": stats["total_bills"] if stats else 0,
            "total_executive_orders": eo_stats["total_orders"] if eo_stats else 0
        },
        "integrations": {
            "federal_register": "available",
            "legiscan": legiscan_status,
            "ai_analysis": ai_status,
            "azure_sql": "connected" if (AZURE_SQL_AVAILABLE and db_working) else "not_configured"
        },
        "features": {
            "executive_orders": True,
            "state_legislation": legiscan_status == "connected",
            "ai_analysis": ai_status == "connected",
            "multi_state_processing": legiscan_status == "connected",
            "azure_sql_database": AZURE_SQL_AVAILABLE and db_working
        },
        "supported_states": list(SUPPORTED_STATES.keys()),
        "executive_order_categories": EXECUTIVE_ORDER_CATEGORIES,
        "bill_categories": BILL_CATEGORIES
    }

# ===============================
# AZURE SQL SPECIFIC ENDPOINTS
# ===============================

@app.get("/api/test-azure-sql")
async def test_azure_sql_endpoint():
    """Test Azure SQL database connection and functionality"""
    
    if not AZURE_SQL_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Azure SQL configuration not available. Check database_azure_fixed.py import."
        )
    
    try:
        # Run the full Azure SQL test
        test_result = test_azure_sql_full()
        
        if test_result:
            # Get current stats
            stats = get_legislation_stats()
            
            return {
                "success": True,
                "message": "Azure SQL database is working correctly",
                "database_type": "Azure SQL Database",
                "total_bills": stats.get("total_bills", 0),
                "states_with_data": stats.get("states_with_data", []),
                "test_passed": True,
                "timestamp": datetime.now().isoformat()
            }
        else:
            return {
                "success": False,
                "message": "Azure SQL tests failed",
                "test_passed": False,
                "timestamp": datetime.now().isoformat()
            }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Azure SQL test failed: {str(e)}"
        )

@app.post("/api/test-save-bill-azure")
async def test_save_bill_azure():
    """Test saving a bill to Azure SQL database"""
    
    if not AZURE_SQL_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Azure SQL not available"
        )
    
    try:
        # Create a test bill
        test_bill = {
            'bill_id': f'AZURE_TEST_{int(datetime.now().timestamp())}',
            'bill_number': 'TEST-AZURE-001',
            'title': 'Azure SQL Test Bill',
            'description': 'This is a test bill to verify Azure SQL database integration is working correctly.',
            'state': 'California',
            'state_abbr': 'CA',
            'status': 'Active',
            'category': 'civic',
            'introduced_date': '2025-06-02',
            'ai_summary': 'Test AI summary for Azure SQL integration verification',
            'ai_talking_points': 'Test talking points',
            'ai_business_impact': 'Test business impact analysis',
            'ai_version': 'azure_test_v1'
        }
        
        # Save to database
        saved_count = save_legislation_to_db([test_bill])
        
        if saved_count == 1:
            return {
                "success": True,
                "message": "Test bill saved successfully to Azure SQL",
                "bill_id": test_bill['bill_id'],
                "saved_count": saved_count,
                "timestamp": datetime.now().isoformat()
            }
        else:
            return {
                "success": False,
                "message": "Test bill save failed",
                "saved_count": saved_count,
                "timestamp": datetime.now().isoformat()
            }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Test save failed: {str(e)}"
        )

# ===============================
# STATE LEGISLATION ENDPOINTS (Updated for Azure SQL)
# ===============================

@app.get("/api/state-legislation")
async def get_state_legislation(
    state: Optional[str] = Query(None, description="State name or abbreviation"),
    category: Optional[str] = Query(None, description="Bill category filter"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(25, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search term")
):
    """Get state legislation with filtering (Azure SQL optimized)"""
    
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
        
        # Add Azure SQL specific metadata
        result["database_type"] = "Azure SQL" if AZURE_SQL_AVAILABLE else "Fallback"
        result["azure_sql_enabled"] = AZURE_SQL_AVAILABLE
        
        return result
    
    except Exception as e:
        logger.error(f"Error retrieving legislation: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving legislation: {str(e)}")

@app.post("/api/state-legislation/fetch")
async def fetch_state_legislation(
    request: StateLegislationFetchRequest,
    background_tasks: BackgroundTasks
):
    """Fetch state legislation with AI analysis (Azure SQL optimized)"""
    
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
    """Search for legislation using LegiScan and analyze with AI (Azure SQL optimized)"""
    
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

# ===============================
# EXECUTIVE ORDERS ENDPOINTS (Keep existing)
# ===============================

@app.get("/api/executive-orders")
async def get_executive_orders(
    category: Optional[str] = Query(None, description="Executive order category filter"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(25, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search term"),
    sort_by: str = Query("signing_date", description="Sort field"),
    sort_order: str = Query("desc", description="Sort order (asc, desc)")
):
    """Get executive orders with filtering and pagination"""
    
    if category and category not in EXECUTIVE_ORDER_CATEGORIES and category != 'not-applicable':
        raise HTTPException(
            status_code=400,
            detail=f"Category '{category}' not supported. Supported: {EXECUTIVE_ORDER_CATEGORIES}"
        )
    
    try:
        result = get_executive_orders_from_db(
            category=category,
            search=search,
            page=page,
            per_page=per_page,
            sort_by=sort_by,
            sort_order=sort_order
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving executive orders: {str(e)}")

@app.post("/api/executive-orders/fetch")
async def fetch_executive_orders_post(
    start_date: Optional[str] = Query("2025-01-20", description="Start date in YYYY-MM-DD format"),
    end_date: Optional[str] = Query(None, description="End date in YYYY-MM-DD format"),
    per_page: Optional[int] = Query(1000, description="Maximum number of orders to fetch"),
    save_to_db: Optional[bool] = Query(True, description="Whether to save results to database")
):
    """Fetch executive orders from Federal Register"""

    try:
        # Initialize the Federal Register API
        api = FederalRegisterAPI()
        
        # Set default end_date if not provided
        if not end_date:
            end_date = datetime.now().strftime('%Y-%m-%d')
        
        # Validate dates
        if start_date:
            try:
                datetime.strptime(start_date, '%Y-%m-%d')
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")
        
        if end_date:
            try:
                datetime.strptime(end_date, '%Y-%m-%d')
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")
        
        logger.info(f"🚀 Fetching executive orders from Federal Register")
        
        # Call the API
        result = api.fetch_trump_2025_executive_orders(
            start_date=start_date,
            end_date=end_date,
            per_page=per_page
        )
        
        orders = result.get('results', [])
        
        if not orders:
            return {
                "success": True,
                "message": "No executive orders found for the specified date range",
                "orders_fetched": 0,
                "orders_saved": 0,
                "timestamp": datetime.now().isoformat(),
                "orders": []
            }
        
        # Save to database if requested
        saved_count = 0
        if save_to_db:
            try:
                db_result = save_executive_orders_to_db(orders)
                if isinstance(db_result, dict):
                    saved_count = db_result.get('total_processed', 0)
                else:
                    saved_count = db_result
                logger.info(f"✅ Saved {saved_count} orders to database")
            except Exception as e:
                logger.error(f"❌ Database save failed: {e}")
                # Don't fail the whole request if database save fails
                logger.warning("Continuing without database save...")

        return {
            "success": True,
            "message": f"Successfully processed {len(orders)} executive orders",
            "orders_fetched": len(orders),
            "orders_saved": saved_count if isinstance(saved_count, int) else saved_count.get('total_processed', 0) if isinstance(saved_count, dict) else 0,
            "timestamp": datetime.now().isoformat(),
            "orders": orders  # Include the actual orders in the response
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Executive order fetch failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch executive orders: {str(e)}")

# ===============================
# UTILITY ENDPOINTS (Updated for Azure SQL)
# ===============================

@app.get("/api/status")
async def get_status():
    """System status endpoint with Azure SQL information"""
    
    # Test database connections
    if AZURE_SQL_AVAILABLE:
        db_working = test_azure_sql_connection()
        db_type = "Azure SQL Database"
    else:
        try:
            db_status = test_connections()
            db_working = db_status["legislation"]
            db_type = "SQLite Fallback"
        except:
            db_working = False
            db_type = "Unknown"
    
    eo_db_status = test_executive_orders_db()
    
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
    if db_working:
        try:
            stats = get_legislation_stats()
            eo_stats = get_executive_orders_stats()
        except Exception:
            stats = {"total_bills": 0, "states_with_data": []}
            eo_stats = {"total_orders": 0}
    
    return {
        "environment": os.getenv("ENVIRONMENT", "development"),
        "app_version": "9.1.0-Azure - Executive Orders & State Legislation",
        "database": {
            "status": "connected" if db_working else "connection_issues",
            "type": db_type,
            "azure_sql_enabled": AZURE_SQL_AVAILABLE,
            "legislation_count": stats["total_bills"] if stats else 0,
            "executive_orders_count": eo_stats["total_orders"] if eo_stats else 0
        },
        "integrations": {
            "federal_register": "available",
            "legiscan": legiscan_status,
            "ai_analysis": ai_status,
            "azure_sql": "connected" if (AZURE_SQL_AVAILABLE and db_working) else "not_configured"
        },
        "features": {
            "executive_orders": "Real Federal Register Integration",
            "state_legislation": "LegiScan Integration with AI" if legiscan_status == "connected" else "Configuration Required",
            "ai_analysis": "Azure AI Integration" if ai_status == "connected" else "Configuration Required",
            "azure_sql_database": "Connected & Working" if (AZURE_SQL_AVAILABLE and db_working) else "Not Available"
        },
        "supported_states": list(SUPPORTED_STATES.keys()),
        "api_keys_configured": {
            "legiscan": bool(os.getenv('LEGISCAN_API_KEY')),
            "azure_ai": bool(os.getenv('AZURE_KEY')),
            "azure_sql": AZURE_SQL_AVAILABLE
        },
        "timestamp": datetime.now().isoformat()
    }

@app.post("/api/database/clear-all")
async def clear_all_database_data():
    """Clear all data from the database (Azure SQL optimized)"""
    
    try:
        records_deleted = 0
        
        # Clear executive orders
        try:
            from executive_orders_db import get_db_session, ExecutiveOrder
            with get_db_session() as session:
                eo_count = session.query(ExecutiveOrder).count()
                session.query(ExecutiveOrder).delete()
                session.commit()
                records_deleted += eo_count
                logger.info(f"✅ Cleared {eo_count} executive orders")
        except Exception as e:
            logger.error(f"Error clearing executive orders: {e}")
        
        # Clear state legislation from Azure SQL
        try:
            with LegislationSession() as session:
                leg_count = session.query(StateLegislationDB).count()
                session.query(StateLegislationDB).delete()
                session.commit()
                records_deleted += leg_count
                logger.info(f"✅ Cleared {leg_count} state legislation records from Azure SQL")
        except Exception as e:
            logger.error(f"Error clearing legislation: {e}")
        
        return {
            "success": True,
            "message": f"Database cleared successfully. {records_deleted} records deleted.",
            "records_deleted": records_deleted,
            "database_type": "Azure SQL" if AZURE_SQL_AVAILABLE else "Fallback",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error clearing database: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    print("🌐 Starting LegislationVue API v9.1.0-Azure")
    print("=" * 60)
    print("📋 Executive Orders endpoints:")
    print("   • GET  /api/executive-orders")
    print("   • POST /api/executive-orders/fetch")
    print("")
    print("🏛️ State Legislation endpoints (Azure SQL):")
    print("   • GET  /api/state-legislation")
    print("   • POST /api/state-legislation/fetch")
    print("   • POST /api/legiscan/search-and-analyze")
    print("")
    print("🔧 Azure SQL specific endpoints:")
    print("   • GET  /api/test-azure-sql")
    print("   • POST /api/test-save-bill-azure")
    print("")
    print("🔧 Utility endpoints:")
    print("   • GET  /api/status")
    print("   • POST /api/database/clear-all")
    print("")
    
    azure_sql_configured = AZURE_SQL_AVAILABLE
    legiscan_configured = bool(os.getenv('LEGISCAN_API_KEY'))
    azure_ai_configured = bool(os.getenv('AZURE_KEY'))
    
    print(f"🎯 Configuration Status:")
    print(f"   • AZURE_SQL: {'✅ Configured' if azure_sql_configured else '❌ Missing'}")
    print(f"   • LEGISCAN_API_KEY: {'✅ Configured' if legiscan_configured else '❌ Missing'}")
    print(f"   • AZURE_AI_KEY: {'✅ Configured' if azure_ai_configured else '❌ Missing'}")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)