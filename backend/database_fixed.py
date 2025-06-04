# database_fixed.py - UPDATED WITH PROPER DATE HANDLING
from sqlalchemy import create_engine, Column, String, Text, DateTime, Integer, Boolean, Index, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.sql import func
from contextlib import contextmanager
from datetime import datetime, date
from typing import List, Dict, Optional
import os
import urllib.parse
from dotenv import load_dotenv

load_dotenv()

# Database configuration
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    # Try to build from individual components
    server = os.getenv('AZURE_SQL_SERVER')
    database = os.getenv('AZURE_SQL_DATABASE')
    username = os.getenv('AZURE_SQL_USERNAME')
    password = os.getenv('AZURE_SQL_PASSWORD')
    
    if all([server, database, username, password]):
        password_encoded = urllib.parse.quote_plus(password)
        username_encoded = urllib.parse.quote_plus(username)
        DATABASE_URL = (
            f"mssql+pyodbc://{username_encoded}:{password_encoded}@{server}:1433/{database}"
            f"?driver=ODBC+Driver+18+for+SQL+Server&Encrypt=yes&TrustServerCertificate=no&Connection+Timeout=30"
        )
        print(f"✅ Built Azure SQL connection string")
    else:
        # Default to SQLite for development
        DATABASE_URL = "sqlite:///./legislation_vue.db"
        print(f"📁 Using SQLite database: {DATABASE_URL}")

# Create engine
try:
    if any(term in DATABASE_URL.lower() for term in ["azure", "database.windows.net", "mssql"]):
        engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,
            echo=False,
            execution_options={"isolation_level": "AUTOCOMMIT"}
        )
        print(f"✅ Azure SQL Database engine created")
    else:
        engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,
            echo=False,
            connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
        )
        print(f"✅ Database engine created: {DATABASE_URL}")
except Exception as e:
    print(f"❌ Error creating database engine: {e}")
    # Fallback to SQLite
    DATABASE_URL = "sqlite:///./legislation_vue_fallback.db"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# Create declarative base
Base = declarative_base()

# HELPER FUNCTIONS FOR DATE HANDLING
def safe_date_convert(date_string):
    """
    Safely convert date string to date string in YYYY-MM-DD format, handling empty strings and None
    """
    if not date_string or date_string == '' or date_string is None:
        return None
    
    try:
        # Try different date formats
        date_formats = [
            '%Y-%m-%d',           # 2025-06-01
            '%m/%d/%Y',           # 06/01/2025
            '%Y-%m-%d %H:%M:%S',  # 2025-06-01 12:34:56
            '%Y-%m-%dT%H:%M:%S',  # 2025-06-01T12:34:56
            '%Y-%m-%dT%H:%M:%S.%f',  # 2025-06-01T12:34:56.123456
        ]
        
        for fmt in date_formats:
            try:
                parsed_date = datetime.strptime(str(date_string), fmt)
                return parsed_date.strftime('%Y-%m-%d')  # Return as YYYY-MM-DD string
            except ValueError:
                continue
        
        # If none of the formats work, return None
        print(f"⚠️ Could not parse date: '{date_string}'")
        return None
        
    except Exception as e:
        print(f"⚠️ Error parsing date '{date_string}': {e}")
        return None


def clean_bill_data_for_azure_sql(bill_data: dict) -> dict:
    """Clean and validate bill data for Azure SQL"""
    print(f"\n🔍 CLEANING bill data for Azure SQL:")
    print(f"   - Bill ID: {bill_data.get('bill_id', 'unknown')}")
    print(f"   - Title: {bill_data.get('title', 'No title')[:50]}...")
    
    cleaned = bill_data.copy()
    
    # Print all date fields in the incoming data
    print(f"🔍 INCOMING date values:")
    date_fields = ['introduced_date', 'last_action_date', 'created_at', 'last_updated']
    for field in date_fields:
        if field in cleaned:
            print(f"   - {field}: '{cleaned.get(field)}'")
    
    # Handle ALL date fields, including timestamps
    for field in date_fields:
        if field in cleaned:
            original_value = cleaned[field]
            print(f"   Processing {field}: '{original_value}' (type: {type(original_value).__name__})")
            
            if original_value is None or original_value == '':
                cleaned[field] = None  # Ensure it's actually None, not string 'None'
                print(f"     -> Set to None (empty/null)")
            else:
                # For ISO format strings
                if isinstance(original_value, str) and 'T' in original_value:
                    try:
                        # Extract just the date part YYYY-MM-DD for date fields
                        if field in ['introduced_date', 'last_action_date']:
                            cleaned[field] = original_value.split('T')[0]
                            print(f"     -> Extracted date part: '{cleaned[field]}'")
                        else:
                            # For created_at and last_updated, use SQL Server compatible format
                            # Convert to datetime and then to SQL Server format
                            from datetime import datetime
                            dt = datetime.fromisoformat(original_value.replace('Z', '+00:00'))
                            cleaned[field] = dt.strftime('%Y-%m-%d %H:%M:%S')
                            print(f"     -> Converted to SQL Server timestamp format: '{cleaned[field]}'")
                    except Exception as e:
                        print(f"     -> Error processing timestamp: {e}")
                        # Fallback to safe conversion
                        cleaned[field] = safe_date_convert(original_value)
                        print(f"     -> Fallback conversion: '{cleaned[field]}'")
                else:
                    # Try to convert to SQL Server compatible date
                    converted = safe_date_convert(original_value)
                    if converted:
                        cleaned[field] = converted
                        print(f"     -> Converted using safe_date_convert: '{cleaned[field]}'")
                    else:
                        cleaned[field] = None  # If conversion fails, use NULL
                        print(f"     -> Conversion failed, set to NULL")
    
    # Ensure required string fields
    string_fields = ['bill_id', 'bill_number', 'title', 'description', 'state', 'status', 'category']
    for field in string_fields:
        if field not in cleaned or cleaned[field] is None:
            if field in ['bill_id', 'bill_number', 'title']:
                # Required fields get defaults
                if field == 'bill_id':
                    cleaned[field] = f"unknown_{int(datetime.now().timestamp())}"
                elif field == 'bill_number':
                    cleaned[field] = 'UNKNOWN'
                elif field == 'title':
                    cleaned[field] = 'Untitled Bill'
                print(f"   Set default for required field {field}: '{cleaned[field]}'")
            else:
                cleaned[field] = ''
                print(f"   Set empty string for optional field {field}")
    
    # Ensure text fields don't exceed limits
    text_limits = {
        'bill_id': 100,
        'bill_number': 50,
        'state': 50,
        'state_abbr': 5,
        'status': 100,
        'category': 50,
        'session_id': 50,
        'session_name': 100,
        'bill_type': 50,
        'body': 20,
        'ai_version': 50
    }
    
    for field, max_length in text_limits.items():
        if field in cleaned and cleaned[field]:
            original_length = len(str(cleaned[field]))
            cleaned[field] = str(cleaned[field])[:max_length]
            if original_length > max_length:
                print(f"   Truncated {field} from {original_length} to {max_length} characters")
    
    # Print final date values
    print(f"🔍 FINAL cleaned date values:")
    for field in date_fields:
        if field in cleaned:
            print(f"   - {field}: '{cleaned.get(field)}'")
            # Critical fix: Make sure None appears as None, not as string 'None'
            if isinstance(cleaned.get(field), str) and cleaned.get(field) == 'None':
                cleaned[field] = None
                print(f"   - FIXED: {field} was string 'None', now actual None")
    
    return cleaned

class StateLegislationDB(Base):
    """State Legislation model optimized for Azure SQL"""
    
    __tablename__ = 'state_legislation'
    
    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Unique identifier
    bill_id = Column(String(100), unique=True, nullable=False, index=True)
    bill_number = Column(String(50), nullable=False, index=True)
    
    # Basic information
    title = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    state = Column(String(50), nullable=False, index=True)
    state_abbr = Column(String(5), nullable=True, index=True)
    status = Column(String(100), nullable=True, index=True)
    category = Column(String(50), nullable=True, index=True)
    
    # CORRECTED: Dates as strings to avoid Azure SQL conversion issues
    introduced_date = Column(String(20), nullable=True, index=True)  # YYYY-MM-DD format
    last_action_date = Column(String(20), nullable=True, index=True)  # YYYY-MM-DD format
    
    # Session information
    session_id = Column(String(50), nullable=True)
    session_name = Column(String(100), nullable=True)
    bill_type = Column(String(50), nullable=True)
    body = Column(String(20), nullable=True)
    
    # URLs
    legiscan_url = Column(Text, nullable=True)
    pdf_url = Column(Text, nullable=True)
    
    # AI-generated content
    ai_summary = Column(Text, nullable=True)
    ai_executive_summary = Column(Text, nullable=True)
    ai_talking_points = Column(Text, nullable=True)
    ai_key_points = Column(Text, nullable=True)
    ai_business_impact = Column(Text, nullable=True)
    ai_potential_impact = Column(Text, nullable=True)
    ai_version = Column(String(50), nullable=True)
    
    # Timestamps - Changed to String for consistency with date fields
    created_at = Column(String(30), default=datetime.now().strftime('%Y-%m-%dT%H:%M:%S'), nullable=False)
    last_updated = Column(String(30), default=datetime.now().strftime('%Y-%m-%dT%H:%M:%S'), nullable=False)
    
    # Indexes for better performance
    __table_args__ = (
        Index('idx_state_category', 'state', 'category'),
        Index('idx_state_date', 'state', 'introduced_date'),
        Index('idx_status_date', 'status', 'last_action_date'),
    )

# Session management
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@contextmanager
def LegislationSession():
    """Database session context manager"""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()

def test_connections():
    """Test database connections with proper text() usage"""
    try:
        # Test the main database connection
        with LegislationSession() as session:
            # Use proper SQLAlchemy text() function
            result = session.execute(text("SELECT 1 as test_column")).fetchone()
            if result and result[0] == 1:
                print("✅ Database connection test successful")
                return {
                    "executive_orders": True,
                    "legislation": True,
                    "errors": []
                }
        
        print("❌ Database connection test failed: No result")
        return {
            "executive_orders": False,
            "legislation": False,
            "errors": ["No result from test query"]
        }
    except Exception as e:
        print(f"❌ Database connection test failed: {e}")
        return {
            "executive_orders": False,
            "legislation": False,
            "errors": [str(e)]
        }

def init_databases():
    """Initialize database tables"""
    try:
        print("🔄 Initializing database tables...")
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created/verified")
        return True
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        return False

def get_legislation_from_azure_sql(
    state: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    per_page: int = 25
) -> Dict:
    """Get legislation from Azure SQL with filtering"""
    
    try:
        print(f"\n🔍 DEBUG get_legislation_from_azure_sql:")
        print(f"   - State: '{state}'")
        print(f"   - Category: '{category}'")
        print(f"   - Search: '{search}'")
        print(f"   - Page: {page}, Per page: {per_page}")
        
        with LegislationSession() as session:
            # Get total count first to verify data exists
            total_in_db = session.query(StateLegislationDB).count()
            print(f"   - Total records in database: {total_in_db}")
            
            # Base query
            query = session.query(StateLegislationDB)
            
            # Apply filters
            if state:
                print(f"   - Filtering by state: '{state}'")
                # Try both full state name and abbreviation, and be case-insensitive
                # Also try numeric state values (like "40" for South Carolina)
                
                # Get all data to inspect 
                if total_in_db > 0:
                    print(f"   - Examining state values in database:")
                    states_in_db = session.query(
                        StateLegislationDB.id,
                        StateLegislationDB.state, 
                        StateLegislationDB.state_abbr
                    ).limit(5).all()
                    for db_id, db_state, db_abbr in states_in_db:
                        print(f"   - ID: {db_id}, DB State: '{db_state}', Abbr: '{db_abbr}'")
                
                # More flexible filtering for state field
                query = query.filter(
                    (func.lower(StateLegislationDB.state).like(f"%{state.lower()}%")) | 
                    (func.lower(StateLegislationDB.state_abbr).like(f"%{state.lower()}%"))
                )
                
                # Debug: count with just state filter
                state_count = query.count()
                print(f"   - Count after state filter: {state_count}")
                
                # If no results, try with an even more permissive approach
                if state_count == 0:
                    print(f"   - No matches for state '{state}', trying different approach")
                    
                    # For SC/South Carolina, look for "40"
                    if state.upper() == "SC" or "SOUTH CAROLINA" in state.upper():
                        query = session.query(StateLegislationDB).filter(
                            (StateLegislationDB.state == "40") |
                            (StateLegislationDB.state_abbr == "SC")
                        )
                    # For other states, add similar mappings as needed
                    
                    alt_state_count = query.count()
                    print(f"   - Count after alternative state filter: {alt_state_count}")
            
            if category:
                print(f"   - Filtering by category: '{category}'")
                query = query.filter(StateLegislationDB.category == category)
            
            if search:
                search_term = f"%{search}%"
                print(f"   - Filtering by search term: '{search}'")
                query = query.filter(
                    (StateLegislationDB.title.ilike(search_term)) |
                    (StateLegislationDB.description.ilike(search_term))
                )
            
            # Get total count
            total_count = query.count()
            print(f"   - Total matching count: {total_count}")

            # REQUIRED for Azure SQL pagination
            query = query.order_by(StateLegislationDB.id.desc())

            # Apply pagination
            offset = (page - 1) * per_page
            print(f"   - Applying pagination: offset={offset}, limit={per_page}")
            bills = query.offset(offset).limit(per_page).all()
            print(f"   - Retrieved {len(bills)} bills after pagination")
            
            # Convert to dictionaries
            results = []
            for bill in bills:
                # Fix state values during retrieval
                state_value = bill.state
                state_abbr_value = bill.state_abbr
                
                # Map numeric state codes to proper names if needed
                if state_value == "40":
                    state_value = "South Carolina"
                    if not state_abbr_value:
                        state_abbr_value = "SC"
                # Add more mappings as needed
                
                bill_dict = {
                    "id": bill.id,
                    "bill_id": bill.bill_id,
                    "bill_number": bill.bill_number,
                    "title": bill.title,
                    "description": bill.description,
                    "state": state_value,
                    "state_abbr": state_abbr_value,
                    "status": bill.status,
                    "category": bill.category,
                    "introduced_date": bill.introduced_date,
                    "last_action_date": bill.last_action_date,
                    "session_id": bill.session_id,
                    "session_name": bill.session_name,
                    "bill_type": bill.bill_type,
                    "body": bill.body,
                    "legiscan_url": bill.legiscan_url,
                    "pdf_url": bill.pdf_url,
                    "ai_summary": bill.ai_summary,
                    "ai_executive_summary": bill.ai_executive_summary,
                    "ai_talking_points": bill.ai_talking_points,
                    "ai_key_points": bill.ai_key_points,
                    "ai_business_impact": bill.ai_business_impact,
                    "ai_potential_impact": bill.ai_potential_impact,
                    "ai_version": bill.ai_version,
                    "created_at": bill.created_at,
                    "last_updated": bill.last_updated
                }
                results.append(bill_dict)
            
            total_pages = (total_count + per_page - 1) // per_page if total_count > 0 else 1
            
            print(f"✅ Retrieved {len(results)} bills from Azure SQL (page {page}/{total_pages})")
            
            return {
                "results": results,
                "count": total_count,
                "total_pages": total_pages,
                "page": page,
                "per_page": per_page
            }
    
    except Exception as e:
        print(f"❌ Error getting legislation from Azure SQL: {e}")
        import traceback
        traceback.print_exc()
        return {
            "results": [],
            "count": 0,
            "total_pages": 1,
            "page": page,
            "per_page": per_page,
            "error": str(e)
        }

def get_legislation_from_azure_sql(
    state: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    per_page: int = 25
) -> Dict:
    """Get legislation from Azure SQL with filtering"""
    
    try:
        print(f"\n🔍 DEBUG get_legislation_from_azure_sql:")
        print(f"   - State: '{state}'")
        print(f"   - Category: '{category}'")
        print(f"   - Search: '{search}'")
        print(f"   - Page: {page}, Per page: {per_page}")
        
        # State code mappings based on the database values
        state_code_map = {
            "South Carolina": "40",
            "SC": "40",
            "California": "5",
            "CA": "5",
            "Colorado": "6",
            "CO": "6",
            "Kentucky": "17",
            "KY": "17",
            "Nevada": "28",
            "NV": "28",
            "Texas": "43",
            "TX": "43"
        }
        
        # Reverse mapping from numeric codes to state names
        code_to_state = {
            "40": "South Carolina",
            "5": "California",
            "6": "Colorado",
            "17": "Kentucky",
            "28": "Nevada",
            "43": "Texas"
        }
        
        # Abbreviation mappings
        state_abbr_map = {
            "South Carolina": "SC",
            "California": "CA",
            "Colorado": "CO",
            "Kentucky": "KY",
            "Nevada": "NV",
            "Texas": "TX"
        }
        
        with LegislationSession() as session:
            # Get total count first to verify data exists
            total_in_db = session.query(StateLegislationDB).count()
            print(f"   - Total records in database: {total_in_db}")
            
            # Base query
            query = session.query(StateLegislationDB)
            
            # Apply filters
            if state:
                print(f"   - Filtering by state: '{state}'")
                
                # Get all data to inspect 
                if total_in_db > 0:
                    print(f"   - Examining state values in database:")
                    states_in_db = session.query(
                        StateLegislationDB.id,
                        StateLegislationDB.state, 
                        StateLegislationDB.state_abbr
                    ).limit(5).all()
                    for db_id, db_state, db_abbr in states_in_db:
                        print(f"   - ID: {db_id}, DB State: '{db_state}', Abbr: '{db_abbr}'")
                
                # Standard state filter first
                query_standard = session.query(StateLegislationDB).filter(
                    (func.lower(StateLegislationDB.state).like(f"%{state.lower()}%")) | 
                    (func.lower(StateLegislationDB.state_abbr).like(f"%{state.lower()}%"))
                )
                
                # Debug: count with standard state filter
                state_count = query_standard.count()
                print(f"   - Count after standard state filter: {state_count}")
                
                # If standard filter found results, use it
                if state_count > 0:
                    query = query_standard
                # Otherwise, try numeric state code if we have a mapping
                else:
                    print(f"   - No standard matches for state '{state}', trying code lookup")
                    
                    # Get numeric state code if it exists in our mapping
                    state_code = None
                    if state in state_code_map:
                        state_code = state_code_map[state]
                    
                    if state_code:
                        print(f"   - Found state code '{state_code}' for '{state}'")
                        query = session.query(StateLegislationDB).filter(
                            (StateLegislationDB.state == state_code) |
                            (StateLegislationDB.state_abbr == state_abbr_map.get(state, state))
                        )
                        code_state_count = query.count()
                        print(f"   - Count after state code filter: {code_state_count}")
                    else:
                        print(f"   - No state code mapping found for '{state}'")
            
            if category:
                print(f"   - Filtering by category: '{category}'")
                query = query.filter(StateLegislationDB.category == category)
            
            if search:
                search_term = f"%{search}%"
                print(f"   - Filtering by search term: '{search}'")
                query = query.filter(
                    (StateLegislationDB.title.ilike(search_term)) |
                    (StateLegislationDB.description.ilike(search_term))
                )
            
            # Get total count
            total_count = query.count()
            print(f"   - Total matching count: {total_count}")

            # REQUIRED for Azure SQL pagination
            query = query.order_by(StateLegislationDB.id.desc())

            # Apply pagination
            offset = (page - 1) * per_page
            print(f"   - Applying pagination: offset={offset}, limit={per_page}")
            bills = query.offset(offset).limit(per_page).all()
            print(f"   - Retrieved {len(bills)} bills after pagination")
            
            # Convert to dictionaries
            results = []
            for bill in bills:
                # Fix state values during retrieval
                state_value = bill.state
                state_abbr_value = bill.state_abbr
                
                # Map numeric state codes to proper names
                if state_value in code_to_state:
                    state_value = code_to_state[state_value]
                    if not state_abbr_value:
                        state_abbr_value = state_abbr_map.get(state_value, "")
                
                bill_dict = {
                    "id": bill.id,
                    "bill_id": bill.bill_id,
                    "bill_number": bill.bill_number,
                    "title": bill.title,
                    "description": bill.description,
                    "state": state_value,
                    "state_abbr": state_abbr_value,
                    "status": bill.status,
                    "category": bill.category,
                    "introduced_date": bill.introduced_date,
                    "last_action_date": bill.last_action_date,
                    "session_id": bill.session_id,
                    "session_name": bill.session_name,
                    "bill_type": bill.bill_type,
                    "body": bill.body,
                    "legiscan_url": bill.legiscan_url,
                    "pdf_url": bill.pdf_url,
                    "ai_summary": bill.ai_summary,
                    "ai_executive_summary": bill.ai_executive_summary,
                    "ai_talking_points": bill.ai_talking_points,
                    "ai_key_points": bill.ai_key_points,
                    "ai_business_impact": bill.ai_business_impact,
                    "ai_potential_impact": bill.ai_potential_impact,
                    "ai_version": bill.ai_version,
                    "created_at": bill.created_at,
                    "last_updated": bill.last_updated
                }
                results.append(bill_dict)
            
            total_pages = (total_count + per_page - 1) // per_page if total_count > 0 else 1
            
            print(f"✅ Retrieved {len(results)} bills from Azure SQL (page {page}/{total_pages})")
            
            return {
                "results": results,
                "count": total_count,
                "total_pages": total_pages,
                "page": page,
                "per_page": per_page
            }
    
    except Exception as e:
        print(f"❌ Error getting legislation from Azure SQL: {e}")
        import traceback
        traceback.print_exc()
        return {
            "results": [],
            "count": 0,
            "total_pages": 1,
            "page": page,
            "per_page": per_page,
            "error": str(e)
        }

def get_legislation_stats() -> Dict:
    """Get legislation statistics"""
    
    try:
        with LegislationSession() as session:
            total_bills = session.query(StateLegislationDB).count()
            
            # Bills by state
            states_with_data = session.query(StateLegislationDB.state).distinct().all()
            states_list = [state[0] for state in states_with_data]
            
            # Bills by category
            categories = session.query(
                StateLegislationDB.category,
                func.count(StateLegislationDB.id).label('count')
            ).group_by(StateLegislationDB.category).all()
            
            return {
                "total_bills": total_bills,
                "states_with_data": states_list,
                "categories": [
                    {"category": cat, "count": count} 
                    for cat, count in categories
                ],
                "has_data": total_bills > 0
            }
    
    except Exception as e:
        print(f"❌ Error getting legislation stats: {e}")
        return {
            "total_bills": 0,
            "states_with_data": [],
            "categories": [],
            "has_data": False,
            "error": str(e)
        }

def get_database_info() -> Dict:
    """Get database information"""
    
    database_type = "SQLite"
    using_azure_sql = False
    
    if DATABASE_URL:
        if "sqlite" in DATABASE_URL:
            database_type = "SQLite"
        elif "postgresql" in DATABASE_URL:
            database_type = "PostgreSQL"
        elif "mysql" in DATABASE_URL:
            database_type = "MySQL"
        elif "sqlserver" in DATABASE_URL or "azure" in DATABASE_URL or "database.windows.net" in DATABASE_URL:
            database_type = "Azure SQL / SQL Server"
            using_azure_sql = True
    
    return {
        "database_type": database_type,
        "using_azure_sql": using_azure_sql,
        "database_url": DATABASE_URL[:50] + "..." if len(DATABASE_URL) > 50 else DATABASE_URL
    }

# ADDED: Test function for the date fix
def test_date_handling():
    """Test the date handling fix"""
    test_dates = [
        '',
        None,
        '2025-06-01',
        '06/01/2025',
        '2025-06-01 12:34:56',
        '2025-06-01T12:34:56',
        'invalid-date'
    ]
    
    print("🧪 Testing date handling...")
    for test_date in test_dates:
        result = safe_date_convert(test_date)
        print(f"  '{test_date}' -> '{result}'")

# ADDED: Test function for bill data cleaning
def test_bill_cleaning():
    """Test the bill data cleaning"""
    test_bill = {
        'bill_id': '12345',
        'bill_number': 'AB123',
        'title': 'Test Bill',
        'introduced_date': '',
        'last_action_date': '2025-06-01',
        'status': None,
        'category': 'healthcare'
    }
    
    print("🧪 Testing bill data cleaning...")
    cleaned = clean_bill_data_for_database(test_bill)
    print(f"Original: {test_bill}")
    print(f"Cleaned:  {cleaned}")

# Initialize on import
if __name__ == "__main__":
    print("🧪 Testing database_fixed module...")
    
    # Test date handling
    test_date_handling()
    print()
    
    # Test bill cleaning
    test_bill_cleaning()
    print()
    
    # Test connection
    test_result = test_connections()
    if test_result["legislation"]:
        print("✅ Database connection successful")
        
        # Initialize tables
        if init_databases():
            print("✅ Database tables ready")
        
        # Get stats
        stats = get_legislation_stats()
        print(f"📊 Total bills in database: {stats['total_bills']}")
        
    else:
        print("❌ Database connection failed")
        for error in test_result["errors"]:
            print(f"   - {error}")
