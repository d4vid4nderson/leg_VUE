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

def clean_bill_data_for_database(bill_data: dict) -> dict:
    """
    Clean bill data to ensure it's compatible with the database
    """
    cleaned = bill_data.copy()
    
    # Handle date fields - convert to YYYY-MM-DD strings or None
    date_fields = ['introduced_date', 'last_action_date']
    
    for field in date_fields:
        if field in cleaned:
            date_value = cleaned[field]
            if date_value == '' or date_value is None:
                cleaned[field] = None
            else:
                # Convert to proper date format
                cleaned_date = safe_date_convert(date_value)
                cleaned[field] = cleaned_date
    
    # Ensure required string fields are not None
    string_fields = ['bill_id', 'bill_number', 'title', 'description', 'state', 'status', 'category']
    for field in string_fields:
        if field not in cleaned or cleaned[field] is None:
            if field in ['bill_id', 'bill_number', 'title']:
                # These are required, provide defaults
                if field == 'bill_id':
                    cleaned[field] = f"unknown_{int(datetime.now().timestamp())}"
                elif field == 'bill_number':
                    cleaned[field] = 'UNKNOWN'
                elif field == 'title':
                    cleaned[field] = 'Untitled Bill'
            else:
                cleaned[field] = ''
    
    # Ensure text fields don't exceed database limits
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

class StateLegislationDB(Base):
    """FIXED: State Legislation database model with proper date handling"""
    
    __tablename__ = 'state_legislation'
    
    # Primary fields
    id = Column(Integer, primary_key=True, autoincrement=True)
    bill_id = Column(String(100), unique=True, nullable=False, index=True)
    bill_number = Column(String(50), nullable=False, index=True)
    
    # Basic information
    title = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    state = Column(String(50), nullable=False, index=True)
    state_abbr = Column(String(5), nullable=True, index=True)
    status = Column(String(100), nullable=True, index=True)
    category = Column(String(50), nullable=True, index=True)
    
    # FIXED: Dates as strings to avoid SQL Server conversion issues
    introduced_date = Column(String(20), nullable=True, index=True)  # YYYY-MM-DD format
    last_action_date = Column(String(20), nullable=True, index=True)  # YYYY-MM-DD format
    
    # Session info
    session_id = Column(String(50), nullable=True)
    session_name = Column(String(100), nullable=True)
    bill_type = Column(String(50), nullable=True)
    body = Column(String(20), nullable=True)  # House, Senate, etc.
    
    # URLs and links
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
    
    # Metadata
    created_at = Column(DateTime, default=func.now(), nullable=False)
    last_updated = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    
    # Indexes for better query performance
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

def get_legislation_from_db(
    state: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    per_page: int = 25
) -> Dict:
    """Get legislation from database with filtering"""
    
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

            # Required for MSSQL pagination
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
            
            return {
                "results": results,
                "count": total_count,
                "total_pages": total_pages,
                "page": page,
                "per_page": per_page
            }
    
    except Exception as e:
        print(f"❌ Error getting legislation from database: {e}")
        return {
            "results": [],
            "count": 0,
            "total_pages": 1,
            "page": page,
            "per_page": per_page,
            "error": str(e)
        }

def save_legislation_to_db(bills: List[Dict]) -> int:
    """FIXED: Save legislation bills to database with proper date handling"""
    
    if not bills:
        return 0
    
    saved_count = 0
    
    try:
        with LegislationSession() as session:
            for i, bill_data in enumerate(bills):
                try:
                    print(f"🔍 Processing bill {i+1}: {bill_data.get('bill_id', 'unknown')}")
                    
                    # FIXED: Clean the bill data before saving
                    cleaned_data = clean_bill_data_for_database(bill_data)
                    
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
                    
                    saved_count += 1
                
                except Exception as e:
                    print(f"❌ Error saving bill {i+1}: {e}")
                    print(f"❌ Bill data: {bill_data}")
                    continue
            
            session.commit()
            print(f"✅ Saved {saved_count} bills to database")
        
    except Exception as e:
        print(f"❌ Error saving legislation: {e}")
        return 0
    
    return saved_count

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