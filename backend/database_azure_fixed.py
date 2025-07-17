# database_azure_fixed.py - CORRECTED Azure SQL Configuration with Highlights
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
import traceback
import logging

load_dotenv()

logger = logging.getLogger(__name__)


def build_azure_sql_connection():
    """Build proper Azure SQL connection string"""
    server = os.getenv('AZURE_SQL_SERVER', 'sql-legislation-tracker.database.windows.net')
    database = os.getenv('AZURE_SQL_DATABASE', 'db-executiveorders')
    username = os.getenv('AZURE_SQL_USERNAME', 'failed to pull SQL user')
    password = os.getenv('AZURE_SQL_PASSWORD', 'failed to pull SQL password')
    
    if not all([server, database, username, password]):
        print("❌ Missing Azure SQL configuration")
        return None
    
    # Direct pyodbc connection string
    connection_string = (
        "Driver={ODBC Driver 18 for SQL Server};"
        f"Server=tcp:{server},1433;"
        f"Database={database};"
        f"UID={username};"
        f"PWD={password};"
        "Encrypt=yes;"
        "TrustServerCertificate=no;"
        "Connection Timeout=30;"
    )
    
    print(f"✅ Built Azure SQL connection string for server: {server}")
    print(f"   Database: {database}")
    print(f"   Username: {username}")
    return connection_string


def build_connection_string_with_managed_identity():
    """Build Azure SQL connection string using system-assigned identity"""
    raw_env = os.getenv("ENVIRONMENT", "development")
    environment = "production" if raw_env == "production" or bool(os.getenv("CONTAINER_APP_NAME") or os.getenv("MSI_ENDPOINT")) else "development"
    server = os.getenv('AZURE_SQL_SERVER', 'sql-legislation-tracker.database.windows.net')
    database = os.getenv('AZURE_SQL_DATABASE', 'db-executiveorders')
    
    if environment == "production":
        # Production environment - use system-assigned identity
        print("🔐 Using system-assigned managed identity authentication")
        
        # Direct pyodbc connection string with MSI
        connection_string = (
            "Driver={ODBC Driver 18 for SQL Server};"
            f"Server=tcp:{server},1433;"
            f"Database={database};"
            "Authentication=ActiveDirectoryMSI;"
            "Encrypt=yes;"
            "TrustServerCertificate=no;"
            "Connection Timeout=30;"
        )
        return connection_string
    else:
        # Use regular connection for development
        return build_azure_sql_connection()


#def build_azure_sql_connection():
#    """Build proper Azure SQL connection string"""
#    server = os.getenv('AZURE_SQL_SERVER', 'sql-legislation-tracker.database.windows.net')
#    database = os.getenv('AZURE_SQL_DATABASE', 'db-executiveorders')
#    username = os.getenv('AZURE_SQL_USERNAME', 'david.anderson')
#    password = os.getenv('AZURE_SQL_PASSWORD', 'failed to pull SQL password')
#    
#    if not all([server, database, username, password]):
#        print("❌ Missing Azure SQL configuration")
#        return None
#    
#    # URL encode the password properly
#    password_encoded = urllib.parse.quote_plus(password)
#    username_encoded = urllib.parse.quote_plus(username)
#    
#    # CORRECTED: Proper Azure SQL connection string format
#    connection_string = (
#        f"mssql+pyodbc://{username_encoded}:{password_encoded}@{server}:1433/{database}"
#        f"?driver=ODBC+Driver+18+for+SQL+Server"
#        f"&Encrypt=yes"
#        f"&TrustServerCertificate=no"
#        f"&Connection+Timeout=30"
#        f"&CommandTimeout=60"
#    )
#    
#    print(f"✅ Built Azure SQL connection string for server: {server}")
#    print(f"   Database: {database}")
#    print(f"   Username: {username}")
#    return connection_string
#
#
#def build_connection_string_with_managed_identity():
#    """Build Azure SQL connection string using system-assigned identity"""
#    environment = os.getenv("ENVIRONMENT", "development")
#    server = os.getenv('AZURE_SQL_SERVER', 'sql-legislation-tracker.database.windows.net')
#    database = os.getenv('AZURE_SQL_DATABASE', 'db-executiveorders')
#    
#    if environment == "production":
#        # Production environment - use system-assigned identity (simplest approach)
#        print("🔐 Using system-assigned managed identity authentication")
#        
#        # For system-assigned identity, no client_id needed
#        connection_string = (
#            f"mssql+pyodbc://{server}:1433/{database}"
#            f"?driver=ODBC+Driver+18+for+SQL+Server"
#            f"&authentication=ActiveDirectoryMSI"
#            f"&Encrypt=yes"
#            f"&TrustServerCertificate=no"
#            f"&Connection+Timeout=30"
#        )
#        return connection_string
#    else:
#        # Use regular connection for development
#        return build_azure_sql_connection()


# Get database URL
# DATABASE_URL = os.getenv('DATABASE_URL') or build_azure_sql_connection()


raw_env = os.getenv("ENVIRONMENT", "development")
environment = "production" if raw_env == "production" or bool(os.getenv("CONTAINER_APP_NAME") or os.getenv("MSI_ENDPOINT")) else "development"
if environment == "production":
    DATABASE_URL = build_connection_string_with_managed_identity()
    print(f"🚀 Using managed identity connection for production")
else:
    DATABASE_URL = os.getenv('DATABASE_URL') or build_azure_sql_connection()
    print(f"🔍 Using development connection: {DATABASE_URL[:30]}...")

if not DATABASE_URL:
    # Fallback to SQLite
    DATABASE_URL = "sqlite:///./legislation_vue_fallback.db"
    print(f"📁 Using SQLite fallback: {DATABASE_URL}")


# CORRECTED: Create engine with proper Azure SQL settings
try:
    if "mssql" in DATABASE_URL or "database.windows.net" in DATABASE_URL:
        # Azure SQL specific engine configuration
        engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,
            pool_recycle=300,  # Recycle connections every 5 minutes
            pool_timeout=20,
            pool_size=5,
            max_overflow=10,
            echo=False,  # Set to True for SQL debugging
            connect_args={
                "timeout": 60,
                "autocommit": False
            },
            execution_options={
                "isolation_level": "READ_COMMITTED"
            }
        )
        print(f"✅ Azure SQL Database engine created successfully")
    else:
        # SQLite fallback
        engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,
            echo=False,
            connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
        )
        print(f"✅ SQLite engine created: {DATABASE_URL}")
        
except Exception as e:
    print(f"❌ Error creating database engine: {e}")
    # Force SQLite fallback
    DATABASE_URL = "sqlite:///./legislation_vue_emergency.db"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    print(f"🆘 Emergency SQLite fallback: {DATABASE_URL}")

# Create declarative base
Base = declarative_base()

# CORRECTED: Helper function for safe date conversion
def safe_date_convert(date_string):
    """Safely convert date to string format for Azure SQL"""
    if not date_string or date_string == '' or date_string is None:
        return None
    
    try:
        # Handle different date formats
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
                return parsed_date.strftime('%Y-%m-%d')  # Always return YYYY-MM-DD
            except ValueError:
                continue
        
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
    summary = Column(Text, nullable=True)  # Simple AI overview
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


# NEW: User Highlights table for persistent highlights
class UserHighlights(Base):
    """User Highlights model for Azure SQL"""
    
    __tablename__ = "user_highlights"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    order_id = Column(String(255), nullable=False)  # Executive order number or bill number
    order_type = Column(String(50), nullable=False)  # 'executive_order' or 'state_legislation'
    highlighted_at = Column(DateTime, default=func.now())
    notes = Column(Text, nullable=True)
    priority_level = Column(Integer, default=1)  # 1-5 priority
    tags = Column(Text, nullable=True)  # Comma-separated tags
    is_archived = Column(Boolean, default=False)
    
    # Indexes for better query performance
    __table_args__ = (
        Index('idx_user_highlights_user_id', 'user_id'),
        Index('idx_user_highlights_order_id', 'order_id'),
        Index('idx_user_highlights_user_order', 'user_id', 'order_id'),
        Index('idx_user_highlights_type', 'order_type'),
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
        print(f"❌ Database session error: {e}")
        session.rollback()
        raise e
    finally:
        session.close()

def test_azure_sql_connection():
    """Test Azure SQL connection specifically"""
    try:
        print("🔍 Testing Azure SQL connection...")
        
        with LegislationSession() as session:
            # Test basic connection
            result = session.execute(text("SELECT 1 as test_column")).fetchone()
            if result and result[0] == 1:
                print("✅ Azure SQL connection successful")
                
                # Test table existence
                try:
                    count = session.query(StateLegislationDB).count()
                    print(f"✅ StateLegislation table accessible, {count} records")
                    return True
                except Exception as e:
                    print(f"⚠️ Table access issue: {e}")
                    return True  # Connection works, table might need creation
            
        print("❌ Azure SQL connection test failed")
        return False
        
    except Exception as e:
        print(f"❌ Azure SQL connection failed: {e}")
        print(f"   Connection string: {DATABASE_URL[:50]}...")
        return False

def init_databases():
    """Initialize database tables including highlights"""
    try:
        print("🔄 Initializing database tables for Azure SQL...")
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created/verified (including user_highlights)")
        return True
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        traceback.print_exc()
        return False

# NEW: Highlights Database Functions
def get_user_highlights(user_id: int):
    """Get all highlights for a specific user"""
    try:
        with LegislationSession() as session:
            highlights = session.query(UserHighlights).filter(
                UserHighlights.user_id == user_id,
                UserHighlights.is_archived == False
            ).order_by(UserHighlights.highlighted_at.desc()).all()
            
            result = []
            for highlight in highlights:
                result.append({
                    'id': highlight.id,
                    'user_id': highlight.user_id,
                    'order_id': highlight.order_id,
                    'order_type': highlight.order_type,
                    'highlighted_at': highlight.highlighted_at.isoformat() if highlight.highlighted_at else None,
                    'notes': highlight.notes,
                    'priority_level': highlight.priority_level,
                    'tags': highlight.tags,
                    'is_archived': highlight.is_archived
                })
            
            logger.info(f"Retrieved {len(result)} highlights for user {user_id}")
            return result
            
    except Exception as e:
        logger.error(f"Error getting highlights for user {user_id}: {e}")
        return []

def add_user_highlight(user_id: int, order_id: str, order_type: str, 
                      notes: str = None, priority_level: int = 1, 
                      tags: str = None, is_archived: bool = False):
    """Add a new highlight for a user"""
    try:
        with LegislationSession() as session:
            # Check if highlight already exists
            existing = session.query(UserHighlights).filter(
                UserHighlights.user_id == user_id,
                UserHighlights.order_id == order_id
            ).first()
            
            if existing:
                logger.warning(f"Highlight already exists for user {user_id}, order {order_id}")
                return existing.id
            
            # Create new highlight
            new_highlight = UserHighlights(
                user_id=user_id,
                order_id=order_id,
                order_type=order_type,
                notes=notes,
                priority_level=priority_level,
                tags=tags,
                is_archived=is_archived,
                highlighted_at=datetime.now()
            )
            
            session.add(new_highlight)
            session.commit()
            
            logger.info(f"Added highlight {new_highlight.id} for user {user_id}, order {order_id}")
            return new_highlight.id
            
    except Exception as e:
        logger.error(f"Error adding highlight for user {user_id}: {e}")
        return None

def remove_user_highlight(user_id: int, order_id: str):
    """Remove a specific highlight for a user"""
    try:
        with LegislationSession() as session:
            highlight = session.query(UserHighlights).filter(
                UserHighlights.user_id == user_id,
                UserHighlights.order_id == order_id
            ).first()
            
            if highlight:
                session.delete(highlight)
                session.commit()
                logger.info(f"Removed highlight for user {user_id}, order {order_id}")
                return True
            else:
                logger.warning(f"No highlight found for user {user_id}, order {order_id}")
                return False
                
    except Exception as e:
        logger.error(f"Error removing highlight for user {user_id}: {e}")
        return False

def clear_user_highlights(user_id: int):
    """Clear all highlights for a user"""
    try:
        with LegislationSession() as session:
            count = session.query(UserHighlights).filter(
                UserHighlights.user_id == user_id
            ).count()
            
            session.query(UserHighlights).filter(
                UserHighlights.user_id == user_id
            ).delete()
            
            session.commit()
            logger.info(f"Cleared {count} highlights for user {user_id}")
            return count
            
    except Exception as e:
        logger.error(f"Error clearing highlights for user {user_id}: {e}")
        return 0

def update_user_highlight(user_id: int, order_id: str, notes: str = None, 
                         priority_level: int = None, tags: str = None, 
                         is_archived: bool = None):
    """Update highlight metadata"""
    try:
        with LegislationSession() as session:
            highlight = session.query(UserHighlights).filter(
                UserHighlights.user_id == user_id,
                UserHighlights.order_id == order_id
            ).first()
            
            if not highlight:
                logger.warning(f"No highlight found for user {user_id}, order {order_id}")
                return False
            
            # Update fields that are provided
            if notes is not None:
                highlight.notes = notes
            if priority_level is not None:
                highlight.priority_level = priority_level
            if tags is not None:
                highlight.tags = tags
            if is_archived is not None:
                highlight.is_archived = is_archived
            
            session.commit()
            logger.info(f"Updated highlight for user {user_id}, order {order_id}")
            return True
            
    except Exception as e:
        logger.error(f"Error updating highlight for user {user_id}: {e}")
        return False

# Existing legislation functions (unchanged)
def save_legislation_to_azure_sql(bills: List[Dict]) -> int:
    """Save legislation bills to Azure SQL with error handling"""
    
    if not bills:
        print("⚠️ No bills to save")
        return 0
    
    saved_count = 0
    
    try:
        with LegislationSession() as session:
            for i, bill_data in enumerate(bills):
                try:
                    print(f"🔍 Processing bill {i+1}/{len(bills)}: {bill_data.get('bill_id', 'unknown')}")
                    
                    # Clean the bill data for Azure SQL
                    cleaned_data = clean_bill_data_for_azure_sql(bill_data)
                    
                    # Check if bill already exists
                    existing = session.query(StateLegislationDB).filter_by(
                        bill_id=cleaned_data.get('bill_id')
                    ).first()
                    
                    if existing:
                        # Update existing bill
                        for key, value in cleaned_data.items():
                            if hasattr(existing, key) and key not in ['id', 'created_at']:
                                setattr(existing, key, value)
                        existing.last_updated = datetime.now()
                        print(f"📝 Updated bill {cleaned_data.get('bill_id')}")
                    else:
                        # Create new bill
                        new_bill = StateLegislationDB(**cleaned_data)
                        session.add(new_bill)
                        print(f"➕ Added bill {cleaned_data.get('bill_id')}")
                    
                    # Flush to catch any SQL errors early
                    session.flush()
                    saved_count += 1
                
                except Exception as e:
                    print(f"❌ Error saving bill {i+1}: {e}")
                    print(f"   Bill data: {bill_data.get('bill_id', 'unknown')} - {bill_data.get('title', 'no title')[:50]}")
                    # Don't rollback the whole transaction, just skip this bill
                    continue
            
            # Commit all changes
            session.commit()
            print(f"✅ Successfully saved {saved_count} bills to Azure SQL")
        
    except Exception as e:
        print(f"❌ Error in save_legislation_to_azure_sql: {e}")
        traceback.print_exc()
        return 0
    
    return saved_count

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

def get_legislation_stats_azure_sql() -> Dict:
    """Get legislation statistics from Azure SQL"""
    
    try:
        with LegislationSession() as session:
            total_bills = session.query(StateLegislationDB).count()
            
            # Bills by state
            states_query = session.query(StateLegislationDB.state).distinct().all()
            states_list = [state[0] for state in states_query]
            
            # Bills by category
            categories_query = session.query(
                StateLegislationDB.category,
                func.count(StateLegislationDB.id).label('count')
            ).group_by(StateLegislationDB.category).all()
            
            categories = [
                {"category": cat, "count": count} 
                for cat, count in categories_query
            ]
            
            print(f"📊 Azure SQL stats: {total_bills} total bills across {len(states_list)} states")
            
            return {
                "total_bills": total_bills,
                "states_with_data": states_list,
                "categories": categories,
                "has_data": total_bills > 0
            }
    
    except Exception as e:
        print(f"❌ Error getting Azure SQL stats: {e}")
        return {
            "total_bills": 0,
            "states_with_data": [],
            "categories": [],
            "has_data": False,
            "error": str(e)
        }

# Test function
def test_azure_sql_full():
    """Complete test of Azure SQL functionality"""
    print("🧪 Testing Azure SQL Database Integration")
    print("=" * 50)
    
    # Test 1: Connection
    print("\n1. Testing connection...")
    if not test_azure_sql_connection():
        print("❌ Connection test failed")
        return False
    
    # Test 2: Table initialization
    print("\n2. Testing table initialization...")
    if not init_databases():
        print("❌ Table initialization failed")
        return False
    
    # Test 3: Data insertion
    print("\n3. Testing data insertion...")
    test_bill = {
        'bill_id': f'TEST_AZURE_{int(datetime.now().timestamp())}',
        'bill_number': 'TEST-001',
        'title': 'Test Bill for Azure SQL',
        'description': 'This is a test bill to verify Azure SQL integration',
        'state': 'California',
        'state_abbr': 'CA',
        'status': 'Active',
        'category': 'civic',
        'introduced_date': '2025-01-01',
        'ai_summary': 'Test AI summary',
        'ai_version': 'test_v1'
    }
    
    saved_count = save_legislation_to_azure_sql([test_bill])
    if saved_count != 1:
        print("❌ Data insertion test failed")
        return False
    
    # Test 4: Data retrieval
    print("\n4. Testing data retrieval...")
    result = get_legislation_from_azure_sql(state='California', page=1, per_page=5)
    if not result or result.get('count', 0) < 1:
        print("❌ Data retrieval test failed")
        return False
    
    # Test 5: Statistics
    print("\n5. Testing statistics...")
    stats = get_legislation_stats_azure_sql()
    if not stats or stats.get('total_bills', 0) < 1:
        print("❌ Statistics test failed")
        return False
    
    # Test 6: Highlights functionality
    print("\n6. Testing highlights functionality...")
    try:
        # Test adding a highlight
        highlight_id = add_user_highlight(
            user_id=1, 
            order_id="TEST-EO-001", 
            order_type="executive_order",
            notes="Test highlight"
        )
        if not highlight_id:
            print("❌ Add highlight test failed")
            return False
        
        # Test getting highlights
        highlights = get_user_highlights(1)
        if not highlights or len(highlights) == 0:
            print("❌ Get highlights test failed")
            return False
        
        # Test removing highlight
        if not remove_user_highlight(1, "TEST-EO-001"):
            print("❌ Remove highlight test failed")
            return False
        
        print("✅ Highlights functionality working")
        
    except Exception as e:
        print(f"❌ Highlights test failed: {e}")
        return False
    
    print("\n✅ All Azure SQL tests passed!")
    print(f"   Total bills in database: {stats['total_bills']}")
    print(f"   States with data: {len(stats['states_with_data'])}")
    print("   Highlights functionality: ✅ Working")
    
    return True

if __name__ == "__main__":
    print("🧪 Testing Azure SQL Database Configuration with Highlights")
    test_azure_sql_full()

