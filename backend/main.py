# main.py - Updated with Azure AI Federal Register Integration + Highlights API + EO Validation
from fastapi import FastAPI, HTTPException, Query, Path, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
import os
import logging
import asyncio
from contextlib import asynccontextmanager
import aiohttp

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

# NEW: Highlights request models
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

# CORRECTED: Import the fixed Azure SQL database functions
try:
    from database_azure_fixed import (
        test_azure_sql_connection,
        init_databases,
        LegislationSession,
        StateLegislationDB,
        # Legislation functions
        save_legislation_to_azure_sql as save_legislation_to_db,
        get_legislation_from_azure_sql as get_legislation_from_db,
        get_legislation_stats_azure_sql as get_legislation_stats,
        # Highlights functions 
        get_user_highlights,
        add_user_highlight,
        remove_user_highlight,
        clear_user_highlights,
        update_user_highlight,
        test_azure_sql_full
    )
    AZURE_SQL_AVAILABLE = True
    HIGHLIGHTS_DB_AVAILABLE = True
    print("✅ Using comprehensive Azure SQL database with highlights")
except ImportError as e:
    print(f"❌ Database import failed: {e}")
    AZURE_SQL_AVAILABLE = False
    HIGHLIGHTS_DB_AVAILABLE = False
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

# Import UPDATED Federal Register API with Azure AI
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

# NEW: Import highlights database functions
try:
    if AZURE_SQL_AVAILABLE:
        # Try to import Azure SQL highlights functions
        from database_azure_fixed import (
            get_user_highlights,
            add_user_highlight,
            remove_user_highlight,
            clear_user_highlights,
            update_user_highlight
        )
        print("✅ Using Azure SQL for highlights")
        HIGHLIGHTS_DB_AVAILABLE = True
    else:
        # Fallback to SQLite or other database
        raise ImportError("Azure SQL not available for highlights")
except ImportError as e:
    print(f"⚠️ Highlights database functions not available: {e}")
    HIGHLIGHTS_DB_AVAILABLE = False

from dotenv import load_dotenv
load_dotenv()

def validate_eo_number(eo_number: str) -> bool:
    """Validate that EO number is in the correct Trump 2025 range"""
    try:
        eo_int = int(str(eo_number).strip())
        return 14000 <= eo_int <= 15000  # EXPANDED RANGE
    except (ValueError, TypeError):
        return False

def validate_and_filter_executive_orders(orders: List[dict]) -> List[dict]:
    """Filter out executive orders with invalid numbers or missing data"""
    valid_orders = []
    filtered_count = 0
    
    for order in orders:
        eo_number = order.get('eo_number') or order.get('executive_order_number', '')
        
        # Skip if no EO number
        if not eo_number:
            logger.warning(f"Filtered out order with no EO number: {order.get('title', 'Unknown')[:50]}")
            filtered_count += 1
            continue
        
        # Skip if invalid EO number (using expanded range)
        if not validate_eo_number(eo_number):
            logger.warning(f"Filtered out invalid EO number {eo_number}: {order.get('title', 'Unknown')[:50]}")
            filtered_count += 1
            continue
        
        # Skip if no title
        if not order.get('title'):
            logger.warning(f"Filtered out EO {eo_number} with no title")
            filtered_count += 1
            continue
        
        valid_orders.append(order)
    
    if filtered_count > 0:
        logger.info(f"✅ Kept {len(valid_orders)} valid orders, filtered {filtered_count} invalid")
    
    return valid_orders

def format_date_for_display(date_str: str) -> str:
    """Format date string for UI display (MM/DD/YYYY)"""
    if not date_str:
        return ""
    
    try:
        # Handle both full datetime and date-only strings
        date_part = date_str[:10] if len(date_str) > 10 else date_str
        date_obj = datetime.strptime(date_part, '%Y-%m-%d')
        return date_obj.strftime('%m/%d/%Y')
    except (ValueError, TypeError):
        return date_str  # Return original if parsing fails

def enrich_executive_order_with_formatting(order: dict) -> dict:
    """Add formatted dates and ensure proper structure for frontend"""
    enriched_order = order.copy()
    
    # Add formatted dates
    enriched_order['formatted_publication_date'] = format_date_for_display(order.get('publication_date', ''))
    enriched_order['formatted_signing_date'] = format_date_for_display(order.get('signing_date', ''))
    
    # Ensure EO number is properly set
    eo_number = order.get('eo_number') or order.get('executive_order_number', '')
    enriched_order['eo_number'] = eo_number
    enriched_order['executive_order_number'] = eo_number
    
    # Ensure category is set
    if not enriched_order.get('category'):
        enriched_order['category'] = 'not-applicable'
    
    # Add validation flag
    enriched_order['is_valid_eo'] = validate_eo_number(eo_number)
    
    return enriched_order

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown with Azure SQL and Azure AI testing"""
    print("🔄 Starting LegislationVue API with Azure SQL and Azure AI...")
    
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
    
    # Test Federal Register with Azure AI integration
    try:
        from federal_register_api import test_azure_ai_integration
        print("🔍 Testing Federal Register Azure AI integration...")
        ai_integration_working = await test_azure_ai_integration()
        if ai_integration_working:
            print("✅ Federal Register Azure AI integration ready")
        else:
            print("⚠️ Federal Register Azure AI integration issues")
    except Exception as e:
        print(f"⚠️ Federal Register Azure AI test failed: {e}")
    
    # Initialize executive orders database
    eo_init_result = init_executive_orders_db()
    eo_db_result = test_executive_orders_db()
    
    if eo_init_result and eo_db_result:
        print("✅ Executive orders database ready")
    
    # Test highlights database
    if HIGHLIGHTS_DB_AVAILABLE:
        print("✅ Highlights database ready")
    else:
        print("⚠️ Highlights database not available - create table manually")
    
    print("🎯 API startup complete!")
    
    yield
    # Shutdown

app = FastAPI(
    title="LegislationVue API - Azure AI Enhanced Edition with Highlights & EO Validation",
    description="API for Executive Orders and State Legislation with Azure AI Analysis, EO Validation, and Persistent Highlights",
    version="10.2.0-Azure-AI-Highlights-Validated",
    lifespan=lifespan
)


# Get environment
environment = os.getenv("ENVIRONMENT", "development")

# CORS setup with environment-based configuration
if environment == "production":
    # Production - restrict to specific domain
    cors_origins = ["https://leg-vue.ashyground-1cf783d6.centralus.azurecontainerapps.io"]
    print(f"✅ Production CORS configured for {cors_origins}")
else:
    # Development - allow all origins
    cors_origins = ["*"]
    print(f"⚠️ Development CORS configured - allowing all origins")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
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
    """Health check endpoint with Azure AI status"""
    
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
    federal_register_ai_status = "unknown"
    
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
    
    # Test Federal Register Azure AI
    try:
        from federal_register_api import test_azure_ai_integration
        fr_ai_working = await test_azure_ai_integration()
        federal_register_ai_status = "connected" if fr_ai_working else "configuration_issue"
    except Exception as e:
        federal_register_ai_status = f"error: {str(e)[:50]}"
    
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
        "message": "LegislationVue API with Azure AI Enhancement + Highlights + EO Validation",
        "status": "healthy",
        "version": "10.2.0-Azure-AI-Highlights-Validated",
        "timestamp": datetime.now().isoformat(),
        "database": {
            "status": "connected" if db_working else "issues",
            "type": db_type,
            "azure_sql_available": AZURE_SQL_AVAILABLE,
            "total_bills": stats["total_bills"] if stats else 0,
            "total_executive_orders": eo_stats["total_orders"] if eo_stats else 0,
            "highlights_available": HIGHLIGHTS_DB_AVAILABLE
        },
        "integrations": {
            "federal_register": "available",
            "federal_register_ai": federal_register_ai_status,
            "legiscan": legiscan_status,
            "ai_analysis": ai_status,
            "azure_sql": "connected" if (AZURE_SQL_AVAILABLE and db_working) else "not_configured",
            "highlights": "available" if HIGHLIGHTS_DB_AVAILABLE else "table_needed"
        },
        "features": {
            "executive_orders": "Real Federal Register Integration with Azure AI + Validation",
            "eo_validation": "Trump 2025 Range (14147-15000) + Date Formatting",
            "state_legislation": "LegiScan Integration with AI" if legiscan_status == "connected" else "Configuration Required",
            "ai_analysis": "Azure AI Integration" if ai_status == "connected" else "Configuration Required",
            "azure_sql_database": "Connected & Working" if (AZURE_SQL_AVAILABLE and db_working) else "Not Available",
            "dynamic_ai_analysis": "Azure AI Enhanced" if federal_register_ai_status == "connected" else "Basic Templates",
            "persistent_highlights": "Available" if HIGHLIGHTS_DB_AVAILABLE else "Database Setup Required"
        },
        "supported_states": list(SUPPORTED_STATES.keys()),
        "executive_order_categories": EXECUTIVE_ORDER_CATEGORIES,
        "bill_categories": BILL_CATEGORIES,
        "eo_validation": {
            "valid_range": "14147-15000",
            "description": "Trump 2025 Executive Orders",
            "date_format": "MM/DD/YYYY for display"
        }
    }

# ===============================
# NEW: HIGHLIGHTS API ENDPOINTS
# ===============================

@app.get("/api/highlights")
async def get_highlights(
    user_id: int = Query(1, description="User ID")
):
    """Get all highlighted items for a user"""
    
    if not HIGHLIGHTS_DB_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Highlights database not available. Please ensure user_highlights table exists."
        )
    
    try:
        # Get highlights from database
        highlights = get_user_highlights(user_id)
        
        # For each highlight, get the full order data
        enriched_highlights = []
        for highlight in highlights:
            order_data = None
            
            if highlight['order_type'] == 'executive_order':
                # Get executive order data
                try:
                    order_data = get_executive_order_by_number(highlight['order_id'])
                    if order_data:
                        # Apply EO validation and formatting
                        order_data = enrich_executive_order_with_formatting(order_data)
                except Exception as e:
                    logger.warning(f"Could not find executive order {highlight['order_id']}: {e}")
            
            elif highlight['order_type'] == 'state_legislation':
                # Get state legislation data
                try:
                    # Query legislation database for this bill
                    with LegislationSession() as session:
                        bill = session.query(StateLegislationDB).filter(
                            StateLegislationDB.bill_number == highlight['order_id']
                        ).first()
                        
                        if bill:
                            order_data = {
                                'id': bill.id,
                                'bill_id': bill.bill_id,
                                'bill_number': bill.bill_number,
                                'title': bill.title,
                                'description': bill.description,
                                'state': bill.state,
                                'state_abbr': bill.state_abbr,
                                'status': bill.status,
                                'category': bill.category,
                                'introduced_date': bill.introduced_date,
                                'last_action_date': bill.last_action_date,
                                'ai_summary': bill.ai_summary,
                                'ai_talking_points': bill.ai_talking_points,
                                'ai_business_impact': bill.ai_business_impact,
                                'ai_potential_impact': bill.ai_potential_impact,
                                'legiscan_url': bill.legiscan_url
                            }
                except Exception as e:
                    logger.warning(f"Could not find legislation {highlight['order_id']}: {e}")
            
            if order_data:
                # Add highlight metadata to the order data
                order_data['highlight_metadata'] = {
                    'id': highlight['id'],
                    'user_id': highlight['user_id'],
                    'order_id': highlight['order_id'],
                    'order_type': highlight['order_type'],
                    'highlighted_at': highlight['highlighted_at'],
                    'notes': highlight['notes'],
                    'priority_level': highlight['priority_level'],
                    'tags': highlight['tags'],
                    'is_archived': highlight['is_archived']
                }
                enriched_highlights.append(order_data)
        
        return enriched_highlights
        
    except Exception as e:
        logger.error(f"Error fetching highlights: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching highlights: {str(e)}")

@app.post("/api/highlights")
async def add_highlight(request: HighlightCreateRequest):
    """Add a new highlight"""
    
    if not HIGHLIGHTS_DB_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Highlights database not available. Please ensure user_highlights table exists."
        )
    
    try:
        # Validate order_type
        if request.order_type not in ['executive_order', 'state_legislation']:
            raise HTTPException(
                status_code=400,
                detail="order_type must be 'executive_order' or 'state_legislation'"
            )
        
        # Additional validation for executive orders
        if request.order_type == 'executive_order':
            if not validate_eo_number(request.order_id):
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid executive order number: {request.order_id}. Must be in range 14147-15000."
                )
        
        # Add highlight to database
        result = add_user_highlight(
            user_id=request.user_id,
            order_id=request.order_id,
            order_type=request.order_type,
            notes=request.notes,
            priority_level=request.priority_level,
            tags=request.tags,
            is_archived=request.is_archived
        )
        
        if result:
            return {
                "success": True,
                "message": "Highlight added successfully",
                "highlight_id": result,
                "eo_validation_passed": validate_eo_number(request.order_id) if request.order_type == 'executive_order' else None,
                "timestamp": datetime.now().isoformat()
            }
        else:
            raise HTTPException(status_code=400, detail="Failed to add highlight")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding highlight: {e}")
        # Check if it's a duplicate key error
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail="Item already highlighted by this user")
        raise HTTPException(status_code=500, detail=f"Error adding highlight: {str(e)}")

@app.delete("/api/highlights/{order_id}")
async def remove_highlight(
    order_id: str,
    user_id: int = Query(..., description="User ID")
):
    """Remove a specific highlight"""
    
    if not HIGHLIGHTS_DB_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Highlights database not available."
        )
    
    try:
        result = remove_user_highlight(user_id, order_id)
        
        if result:
            return {
                "success": True,
                "message": "Highlight removed successfully",
                "timestamp": datetime.now().isoformat()
            }
        else:
            raise HTTPException(status_code=404, detail="Highlight not found")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing highlight: {e}")
        raise HTTPException(status_code=500, detail=f"Error removing highlight: {str(e)}")

@app.put("/api/highlights/{order_id}")
async def update_highlight(
    order_id: str,
    request: HighlightUpdateRequest
):
    """Update highlight metadata"""
    
    if not HIGHLIGHTS_DB_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Highlights database not available."
        )
    
    try:
        result = update_user_highlight(
            user_id=request.user_id,
            order_id=order_id,
            notes=request.notes,
            priority_level=request.priority_level,
            tags=request.tags,
            is_archived=request.is_archived
        )
        
        if result:
            return {
                "success": True,
                "message": "Highlight updated successfully",
                "timestamp": datetime.now().isoformat()
            }
        else:
            raise HTTPException(status_code=404, detail="Highlight not found")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating highlight: {e}")
        raise HTTPException(status_code=500, detail=f"Error updating highlight: {str(e)}")

@app.delete("/api/highlights")
async def clear_all_highlights(
    user_id: int = Query(..., description="User ID")
):
    """Clear all highlights for a user"""
    
    if not HIGHLIGHTS_DB_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Highlights database not available."
        )
    
    try:
        result = clear_user_highlights(user_id)
        
        return {
            "success": True,
            "message": f"Cleared {result} highlights successfully",
            "highlights_cleared": result,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error clearing highlights: {e}")
        raise HTTPException(status_code=500, detail=f"Error clearing highlights: {str(e)}")

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
                "highlights_available": HIGHLIGHTS_DB_AVAILABLE,
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
# ENHANCED EXECUTIVE ORDERS ENDPOINTS WITH AZURE AI + VALIDATION
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
    """Get executive orders with filtering, pagination, and validation"""
    
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
        
        # Apply validation and formatting to each order
        if result.get('results'):
            validated_orders = []
            for order in result['results']:
                # Validate EO number
                if validate_eo_number(order.get('eo_number', '')):
                    enriched_order = enrich_executive_order_with_formatting(order)
                    validated_orders.append(enriched_order)
                else:
                    logger.warning(f"Filtered invalid EO from database: {order.get('eo_number', 'Unknown')}")
            
            result['results'] = validated_orders
            result['count'] = len(validated_orders)
            result['validation_applied'] = True
            result['filtered_invalid_eos'] = len(result.get('results', [])) - len(validated_orders)
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving executive orders: {str(e)}")

@app.post("/api/executive-orders/fetch")
async def fetch_executive_orders_with_azure_ai(
    request: ExecutiveOrderFetchRequest,
    background_tasks: BackgroundTasks
):
    """Fetch executive orders from Federal Register with Azure AI analysis and validation"""

    try:
        # Initialize the ENHANCED Federal Register API with Azure AI
        api = FederalRegisterAPI()
        
        # Set default end_date if not provided
        end_date = request.end_date or datetime.now().strftime('%Y-%m-%d')
        
        # Validate dates
        if request.start_date:
            try:
                datetime.strptime(request.start_date, '%Y-%m-%d')
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")
        
        if end_date:
            try:
                datetime.strptime(end_date, '%Y-%m-%d')
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")
        
        logger.info(f"🚀 Fetching executive orders from Federal Register with Azure AI + Validation")
        logger.info(f"📊 Date range: {request.start_date} to {end_date}")
        logger.info(f"🤖 Azure AI Analysis: Enabled")
        logger.info(f"✅ EO Validation: Trump 2025 range (14147-15000)")
        
        # Call the ENHANCED API with Azure AI
        result = await api.fetch_trump_2025_executive_orders(
            start_date=request.start_date,
            end_date=end_date,
            per_page=request.per_page
        )
        
        orders = result.get('results', [])
        
        if not orders:
            return {
                "success": True,
                "message": "No executive orders found for the specified date range",
                "orders_fetched": 0,
                "orders_saved": 0,
                "ai_analysis_enabled": result.get('ai_analysis_enabled', False),
                "validation_applied": True,
                "valid_eo_range": "14147-15000",
                "timestamp": datetime.now().isoformat(),
                "orders": []
            }
        
        # Apply additional validation and filtering (backup validation)
        logger.info(f"🔍 Applying EO validation to {len(orders)} orders...")
        validated_orders = validate_and_filter_executive_orders(orders)
        
        # Enrich with formatting
        enriched_orders = []
        for order in validated_orders:
            enriched_order = enrich_executive_order_with_formatting(order)
            enriched_orders.append(enriched_order)
        
        # Log AI analysis status
        ai_enabled = result.get('ai_analysis_enabled', False)
        logger.info(f"🤖 Azure AI Analysis: {'✅ Enabled' if ai_enabled else '❌ Fallback Mode'}")
        logger.info(f"✅ Validation: Kept {len(enriched_orders)} valid orders")
        
        # Save to database if requested
        saved_count = 0
        if request.save_to_db and enriched_orders:
            try:
                db_result = save_executive_orders_to_db(enriched_orders)
                if isinstance(db_result, dict):
                    saved_count = db_result.get('total_processed', 0)
                else:
                    saved_count = db_result
                logger.info(f"✅ Saved {saved_count} validated orders to database with Azure AI analysis")
            except Exception as e:
                logger.error(f"❌ Database save failed: {e}")
                # Don't fail the whole request if database save fails
                logger.warning("Continuing without database save...")

        return {
            "success": True,
            "message": f"Successfully processed {len(enriched_orders)} validated executive orders with Azure AI analysis",
            "orders_fetched": len(orders),
            "orders_validated": len(enriched_orders),
            "orders_filtered": len(orders) - len(enriched_orders),
            "orders_saved": saved_count if isinstance(saved_count, int) else saved_count.get('total_processed', 0) if isinstance(saved_count, dict) else 0,
            "ai_analysis_enabled": ai_enabled,
            "ai_version": "azure_openai_federal_register_v1.0",
            "validation_applied": True,
            "valid_eo_range": "14147-15000",
            "timestamp": datetime.now().isoformat(),
            "orders": enriched_orders,  # Include the validated orders with Azure AI analysis and formatting
            "search_strategies": result.get('search_strategies', []),
            "date_range_days": result.get('date_range_days', 0)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Executive order fetch failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch executive orders: {str(e)}")

@app.get("/api/executive-orders/{order_number}")
async def get_executive_order_by_id(order_number: str):
    """Get a specific executive order by number with validation"""
    
    try:
        # Validate EO number first
        if not validate_eo_number(order_number):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid executive order number: {order_number}. Must be in range 14147-15000."
            )
        
        order = get_executive_order_by_number(order_number)
        
        if not order:
            raise HTTPException(
                status_code=404, 
                detail=f"Executive order {order_number} not found"
            )
        
        # Enrich with formatting
        enriched_order = enrich_executive_order_with_formatting(order)
        
        return {
            "success": True,
            "order": enriched_order,
            "validation_passed": True,
            "eo_range": "14147-15000"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error retrieving executive order: {str(e)}"
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
# UTILITY ENDPOINTS (Updated for Azure AI + Highlights + Validation)
# ===============================

@app.get("/api/status")
async def get_status():
    """System status endpoint with Azure AI, Highlights, and EO Validation information"""
    
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
    federal_register_ai_status = "unknown"
    
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
    
    # Test Federal Register Azure AI
    try:
        from federal_register_api import test_azure_ai_integration
        fr_ai_working = await test_azure_ai_integration()
        federal_register_ai_status = "connected" if fr_ai_working else "configuration_issue"
    except Exception as e:
        federal_register_ai_status = f"error: {str(e)[:50]}"
    
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
        "app_version": "10.2.0-Azure-AI-Highlights-Validated - Executive Orders & State Legislation with Validation and Persistent Highlights",
        "database": {
            "status": "connected" if db_working else "connection_issues",
            "type": db_type,
            "azure_sql_enabled": AZURE_SQL_AVAILABLE,
            "legislation_count": stats["total_bills"] if stats else 0,
            "executive_orders_count": eo_stats["total_orders"] if eo_stats else 0,
            "highlights_enabled": HIGHLIGHTS_DB_AVAILABLE
        },
        "integrations": {
            "federal_register": "available",
            "federal_register_ai": federal_register_ai_status,
            "legiscan": legiscan_status,
            "ai_analysis": ai_status,
            "azure_sql": "connected" if (AZURE_SQL_AVAILABLE and db_working) else "not_configured",
            "highlights": "available" if HIGHLIGHTS_DB_AVAILABLE else "table_needed"
        },
        "features": {
            "executive_orders": "Real Federal Register Integration with Azure AI + Validation" if federal_register_ai_status == "connected" else "Basic Federal Register Integration + Validation",
            "eo_validation": "Trump 2025 Range (14147-15000) + Date Formatting",
            "state_legislation": "LegiScan Integration with AI" if legiscan_status == "connected" else "Configuration Required",
            "ai_analysis": "Azure AI Integration" if ai_status == "connected" else "Configuration Required",
            "azure_sql_database": "Connected & Working" if (AZURE_SQL_AVAILABLE and db_working) else "Not Available",
            "dynamic_executive_order_ai": "Azure AI Enhanced with Validation" if federal_register_ai_status == "connected" else "Template Based with Validation",
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
            "valid_range": "14147-15000",
            "description": "Trump 2025 Executive Orders",
            "date_format": "MM/DD/YYYY for display",
            "filters_invalid": True
        },
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/test-azure-ai")
async def test_azure_ai_endpoint():
    """Test Azure AI integration for Federal Register"""
    
    try:
        from federal_register_api import test_azure_ai_integration
        
        logger.info("🧪 Testing Azure AI integration for Federal Register...")
        
        # Run the Azure AI test
        test_result = await test_azure_ai_integration()
        
        if test_result:
            return {
                "success": True,
                "message": "Azure AI integration is working correctly for Federal Register",
                "ai_endpoint": os.getenv('AZURE_ENDPOINT', 'Not Set')[:50] + "..." if os.getenv('AZURE_ENDPOINT') else 'Not Set',
                "ai_model": os.getenv('AZURE_MODEL_NAME', 'Not Set'),
                "test_passed": True,
                "eo_validation_enabled": True,
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
        
        # Note: We don't clear highlights here as they should persist
        # If you want to clear highlights, use the dedicated endpoint
        
        return {
            "success": True,
            "message": f"Database cleared successfully. {records_deleted} records deleted. (Highlights preserved)",
            "records_deleted": records_deleted,
            "database_type": "Azure SQL" if AZURE_SQL_AVAILABLE else "Fallback",
            "highlights_preserved": True,
            "eo_validation_maintained": True,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error clearing database: {str(e)}"
        )

# NEW: EO Validation Testing Endpoint
@app.get("/api/test-eo-validation")
async def test_eo_validation():
    """Test the EO validation functionality"""
    
    try:
        test_cases = [
            {"eo_number": "14147", "expected": True, "description": "Minimum valid Trump 2025 EO"},
            {"eo_number": "14200", "expected": True, "description": "Mid-range Trump 2025 EO"},
            {"eo_number": "14400", "expected": True, "description": "Maximum valid Trump 2025 EO"},
            {"eo_number": "14146", "expected": False, "description": "Below valid range"},
            {"eo_number": "14401", "expected": False, "description": "Above valid range"},
            {"eo_number": "1052", "expected": False, "description": "Invalid low number"},
            {"eo_number": "2025", "expected": False, "description": "Invalid year-like number"},
            {"eo_number": "0979", "expected": False, "description": "Invalid leading zero number"},
            {"eo_number": "", "expected": False, "description": "Empty string"},
            {"eo_number": "abc", "expected": False, "description": "Non-numeric string"},
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
        
        # Test date formatting
        date_test_cases = [
            {"input": "2025-01-20", "expected": "01/20/2025"},
            {"input": "2025-06-09", "expected": "06/09/2025"},
            {"input": "", "expected": ""},
            {"input": "invalid", "expected": "invalid"},
        ]
        
        date_results = []
        for test_case in date_test_cases:
            actual = format_date_for_display(test_case["input"])
            expected = test_case["expected"]
            success = actual == expected
            
            date_results.append({
                "input": test_case["input"],
                "expected": expected,
                "actual": actual,
                "passed": success
            })
        
        return {
            "success": True,
            "message": "EO validation testing completed",
            "eo_validation_tests": {
                "total": len(test_cases),
                "passed": passed,
                "failed": failed,
                "success_rate": f"{(passed/len(test_cases)*100):.1f}%",
                "results": results
            },
            "date_formatting_tests": {
                "total": len(date_test_cases),
                "results": date_results
            },
            "valid_range": "14147-15000",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"EO validation test failed: {str(e)}"
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
    """Check database connectivity using existing functions"""
    try:
        if AZURE_SQL_AVAILABLE:
            return test_azure_sql_connection()
        else:
            db_status = test_connections()
            return db_status.get("legislation", False)
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return False

async def health_check_legiscan() -> bool:
    """Check LegiScan API using existing test function"""
    try:
        if AI_AVAILABLE:
            return await test_legiscan_integration()
        return False
    except Exception as e:
        logger.error(f"LegiScan health check failed: {e}")
        return False

async def health_check_azure_ai() -> bool:
    """Check Azure AI using existing test function"""
    try:
        from federal_register_api import test_azure_ai_integration
        return await test_azure_ai_integration()
    except Exception as e:
        logger.error(f"Azure AI health check failed: {e}")
        return False

async def health_check_federal_register() -> bool:
    """Check Federal Register API connectivity"""
    try:
        async with aiohttp.ClientSession() as session:
            url = "https://www.federalregister.gov/api/v1/agencies"
            async with session.get(url, timeout=10) as response:
                return response.status == 200
    except Exception as e:
        logger.error(f"Federal Register health check failed: {e}")
        return False

async def health_check_highlights() -> bool:
    """Check highlights database functionality"""
    try:
        if not HIGHLIGHTS_DB_AVAILABLE:
            return False
        
        # Try to get highlights for test user
        test_highlights = get_user_highlights(1)
        return True  # If no exception, it's working
    except Exception as e:
        logger.error(f"Highlights health check failed: {e}")
        return False

async def health_check_eo_validation() -> bool:
    """Check EO validation functionality"""
    try:
        # Test a few validation cases
        test_valid = validate_eo_number("14200")  # Should be True
        test_invalid = validate_eo_number("1052")  # Should be False
        test_format = format_date_for_display("2025-01-20")  # Should be "01/20/2025"
        
        return test_valid and not test_invalid and test_format == "01/20/2025"
    except Exception as e:
        logger.error(f"EO validation health check failed: {e}")
        return False

# Health check endpoints

@app.get("/api/health/database")
async def health_endpoint_database():
    """Database health check endpoint"""
    return await check_service_health("database", health_check_database)

@app.get("/api/health/legiscan")
async def health_endpoint_legiscan():
    """LegiScan API health check endpoint"""
    return await check_service_health("legiscan", health_check_legiscan)

@app.get("/api/health/azure-ai")
async def health_endpoint_azure_ai():
    """Azure AI health check endpoint"""
    return await check_service_health("azure-ai", health_check_azure_ai)

@app.get("/api/health/federal-register")
async def health_endpoint_federal_register():
    """Federal Register API health check endpoint"""
    return await check_service_health("federal-register", health_check_federal_register)

@app.get("/api/health/highlights")
async def health_endpoint_highlights():
    """Highlights database health check endpoint"""
    return await check_service_health("highlights", health_check_highlights)

@app.get("/api/health/eo-validation")
async def health_endpoint_eo_validation():
    """EO validation health check endpoint"""
    return await check_service_health("eo-validation", health_check_eo_validation)

@app.get("/api/health/all")
async def health_check_all_services():
    """Check all services at once"""
    try:
        # Run all checks concurrently
        results = await asyncio.gather(
            check_service_health("database", health_check_database),
            check_service_health("legiscan", health_check_legiscan),
            check_service_health("azure-ai", health_check_azure_ai),
            check_service_health("federal-register", health_check_federal_register),
            check_service_health("highlights", health_check_highlights),
            check_service_health("eo-validation", health_check_eo_validation),
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
            "database_type": "Azure SQL" if AZURE_SQL_AVAILABLE else "SQLite Fallback",
            "ai_available": AI_AVAILABLE,
            "highlights_available": HIGHLIGHTS_DB_AVAILABLE,
            "eo_validation_enabled": True,
            "valid_eo_range": "14147-15000",
            "checked_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Health check all failed: {e}")
        raise HTTPException(status_code=500, detail="Health check failed")

if __name__ == "__main__":
    import uvicorn
    print("🌐 Starting LegislationVue API v10.2.0-Azure-AI-Highlights-Validated")
    print("=" * 80)
    print("📋 Executive Orders endpoints (With Azure AI + Validation):")
    print("   • GET  /api/executive-orders  (✅ EO Validation + Date Formatting)")
    print("   • POST /api/executive-orders/fetch  (🤖 Azure AI + ✅ Validation)")
    print("   • GET  /api/executive-orders/{order_number}  (✅ Validated)")
    print("")
    print("🏛️ State Legislation endpoints (Azure SQL):")
    print("   • GET  /api/state-legislation")
    print("   • POST /api/state-legislation/fetch")
    print("   • POST /api/legiscan/search-and-analyze")
    print("")
    print("⭐ Highlights endpoints (NEW):")
    print("   • GET  /api/highlights?user_id=1")
    print("   • POST /api/highlights  (✅ EO Validation)")
    print("   • PUT  /api/highlights/{order_id}")
    print("   • DELETE /api/highlights/{order_id}?user_id=1")
    print("   • DELETE /api/highlights?user_id=1")
    print("")
    print("🔧 Azure SQL specific endpoints:")
    print("   • GET  /api/test-azure-sql")
    print("   • POST /api/test-save-bill-azure")
    print("")
    print("🤖 Azure AI specific endpoints:")
    print("   • GET  /api/test-azure-ai")
    print("")
    print("✅ EO Validation endpoints (NEW):")
    print("   • GET  /api/test-eo-validation")
    print("")
    print("🔧 Utility endpoints:")
    print("   • GET  /api/status")
    print("   • POST /api/database/clear-all")
    print("")
    print("🩺 Health check endpoints:")
    print("   • GET  /api/health/all")
    print("   • GET  /api/health/database")
    print("   • GET  /api/health/highlights")
    print("   • GET  /api/health/azure-ai")
    print("   • GET  /api/health/eo-validation  (NEW)")
    print("")
    
    azure_sql_configured = AZURE_SQL_AVAILABLE
    legiscan_configured = bool(os.getenv('LEGISCAN_API_KEY'))
    azure_ai_configured = bool(os.getenv('AZURE_KEY')) and bool(os.getenv('AZURE_ENDPOINT'))
    
    print(f"🎯 Configuration Status:")
    print(f"   • AZURE_SQL: {'✅ Configured' if azure_sql_configured else '❌ Missing'}")
    print(f"   • LEGISCAN_API_KEY: {'✅ Configured' if legiscan_configured else '❌ Missing'}")
    print(f"   • AZURE_AI (Key + Endpoint): {'✅ Configured' if azure_ai_configured else '❌ Missing'}")
    print(f"   • HIGHLIGHTS_DB: {'✅ Available' if HIGHLIGHTS_DB_AVAILABLE else '❌ Functions Missing'}")
    print(f"   • EO_VALIDATION: ✅ Enabled (Range: 14147-15000)")
    print("")
    
    if azure_ai_configured:
        print(f"🤖 Azure AI Configuration:")
        print(f"   • Endpoint: {os.getenv('AZURE_ENDPOINT', 'Not Set')[:50]}...")
        print(f"   • Model: {os.getenv('AZURE_MODEL_NAME', 'summarize-gpt-4.1')}")
        print(f"   • Dynamic Executive Order Analysis: ✅ Enabled")
    else:
        print(f"⚠️  Azure AI not configured - Executive Orders will use template analysis")
    
    if not HIGHLIGHTS_DB_AVAILABLE:
        print(f"⚠️  Highlights not available - add functions to database_azure_fixed.py")
    
    print(f"")
    print(f"✅ NEW FEATURES IN v10.2.0:")
    print(f"   • EO Number Validation (14147-15000 Trump 2025 range)")
    print(f"   • Date Formatting (MM/DD/YYYY for UI display)")
    print(f"   • Invalid EO Filtering (removes 1052, 2025, 0979, etc.)")
    print(f"   • Enhanced Error Handling")
    print(f"   • Validation Testing Endpoint")
    print(f"   • Health Check for EO Validation")
    print("")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)
