# database_azure_fixed.py - CORRECTED Azure SQL Configuration
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

load_dotenv()

# CORRECTED Azure SQL Connection String
def build_azure_sql_connection():
    """Build proper Azure SQL connection string"""
    server = os.getenv('AZURE_SQL_SERVER', 'sql-legislation-tracker.database.windows.net')
    database = os.getenv('AZURE_SQL_DATABASE', 'db-executiveorders')
    username = os.getenv('AZURE_SQL_USERNAME', 'david.anderson')
    password = os.getenv('AZURE_SQL_PASSWORD', '_MOREgroup')
    
    if not all([server, database, username, password]):
        print("❌ Missing Azure SQL configuration")
        return None
    
    # URL encode the password properly
    password_encoded = urllib.parse.quote_plus(password)
    username_encoded = urllib.parse.quote_plus(username)
    
    # CORRECTED: Proper Azure SQL connection string format
    connection_string = (
        f"mssql+pyodbc://{username_encoded}:{password_encoded}@{server}:1433/{database}"
        f"?driver=ODBC+Driver+18+for+SQL+Server"
        f"&Encrypt=yes"
        f"&TrustServerCertificate=no"
        f"&Connection+Timeout=30"
        f"&CommandTimeout=60"
    )
    
    print(f"✅ Built Azure SQL connection string for server: {server}")
    print(f"   Database: {database}")
    print(f"   Username: {username}")
    return connection_string

# Get database URL
DATABASE_URL = os.getenv('DATABASE_URL') or build_azure_sql_connection()

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
    cleaned = bill_data.copy()
    
    # Handle date fields
    date_fields = ['introduced_date', 'last_action_date']
    for field in date_fields:
        if field in cleaned:
            cleaned[field] = safe_date_convert(cleaned[field])
    
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
            else:
                cleaned[field] = ''
    
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
            cleaned[field] = str(cleaned[field])[:max_length]
    
    return cleaned

# CORRECTED: State Legislation Model for Azure SQL
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
    
    # Timestamps
    created_at = Column(DateTime, default=func.now(), nullable=False)
    last_updated = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    
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
    """Initialize database tables"""
    try:
        print("🔄 Initializing database tables for Azure SQL...")
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created/verified")
        return True
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        traceback.print_exc()
        return False

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
        with LegislationSession() as session:
            query = session.query(StateLegislationDB)
            
            # Apply filters
            if state:
                # Try both full state name and abbreviation
                query = query.filter(
                    (StateLegislationDB.state == state) | 
                    (StateLegislationDB.state_abbr == state)
                )
            
            if category:
                query = query.filter(StateLegislationDB.category == category)
            
            if search:
                search_term = f"%{search}%"
                query = query.filter(
                    StateLegislationDB.title.ilike(search_term) |
                    StateLegislationDB.description.ilike(search_term)
                )
            
            # Get total count
            total_count = query.count()

            # REQUIRED for Azure SQL pagination
            query = query.order_by(StateLegislationDB.id.desc())

            # Apply pagination
            offset = (page - 1) * per_page
            bills = query.offset(offset).limit(per_page).all()
            
            # Convert to dictionaries
            results = []
            for bill in bills:
                bill_dict = {
                    "bill_id": bill.bill_id,
                    "bill_number": bill.bill_number,
                    "title": bill.title,
                    "description": bill.description,
                    "state": bill.state,
                    "state_abbr": bill.state_abbr,
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
                    "created_at": bill.created_at.isoformat() if bill.created_at else None,
                    "last_updated": bill.last_updated.isoformat() if bill.last_updated else None
                }
                results.append(bill_dict)
            
            total_pages = (total_count + per_page - 1) // per_page
            
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
    
    print("\n✅ All Azure SQL tests passed!")
    print(f"   Total bills in database: {stats['total_bills']}")
    print(f"   States with data: {len(stats['states_with_data'])}")
    
    return True

if __name__ == "__main__":
    print("🧪 Testing Azure SQL Database Configuration")
    test_azure_sql_full()