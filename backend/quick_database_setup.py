# database_fixed.py - COMPLETELY FIXED VERSION
from sqlalchemy import create_engine, Column, String, Text, DateTime, Integer, Boolean, Index, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.sql import func
from contextlib import contextmanager
from datetime import datetime
from typing import List, Dict, Optional
import os
import urllib.parse
from dotenv import load_dotenv

load_dotenv()

def get_database_url():
    """FIXED: Get database URL with proper Azure SQL support"""
    
    # Get DATABASE_URL first
    database_url = os.getenv('DATABASE_URL')
    
    # Check for Azure SQL environment variables
    server = os.getenv('AZURE_SQL_SERVER')
    database = os.getenv('AZURE_SQL_DATABASE')
    username = os.getenv('AZURE_SQL_USERNAME')
    password = os.getenv('AZURE_SQL_PASSWORD')
    
    # FIXED: Handle incomplete DATABASE_URL
    if database_url:
        # Check if it's a complete SQLAlchemy URL or just a server name
        if database_url.startswith(('mssql+', 'postgresql://', 'mysql://', 'sqlite:///')):
            print(f"📁 Using complete DATABASE_URL: {database_url[:50]}...")
            return database_url
        elif '.database.windows.net' in database_url:
            # It's just an Azure server name, we need to build the full URL
            print(f"🔧 DATABASE_URL is incomplete Azure server name, building full URL...")
            server = database_url
            # Continue to build full URL below
        else:
            print(f"📁 Using DATABASE_URL as-is: {database_url[:50]}...")
            return database_url
    
    # Build Azure SQL connection string
    if all([server, database, username, password]):
        print("🔄 Building Azure SQL connection string...")
        
        try:
            # FIXED: Proper Azure SQL connection string format
            password_encoded = urllib.parse.quote_plus(password)
            username_encoded = urllib.parse.quote_plus(username)
            
            # Ensure server has proper format
            if not server.endswith('.database.windows.net'):
                server = f"{server}.database.windows.net"
            
            # Method 1: Direct SQLAlchemy URL (recommended)
            connection_string = (
                f"mssql+pyodbc://{username_encoded}:{password_encoded}@{server}:1433/{database}"
                f"?driver=ODBC+Driver+18+for+SQL+Server&Encrypt=yes&TrustServerCertificate=no&Connection+Timeout=30"
            )
            
            print(f"✅ Azure SQL connection string built successfully")
            return connection_string
            
        except Exception as e:
            print(f"❌ Error building Azure SQL connection: {e}")
            
            # Method 2: Fallback with ODBC connect string
            try:
                odbc_str = (
                    f"DRIVER={{ODBC Driver 18 for SQL Server}};"
                    f"SERVER=tcp:{server},1433;"
                    f"DATABASE={database};"
                    f"UID={username};"
                    f"PWD={password};"
                    f"Encrypt=yes;"
                    f"TrustServerCertificate=no;"
                    f"Connection Timeout=30;"
                )
                
                params = urllib.parse.quote_plus(odbc_str)
                connection_string = f'mssql+pyodbc:///?odbc_connect={params}'
                
                print(f"✅ Azure SQL ODBC connection string built as fallback")
                return connection_string
                
            except Exception as e2:
                print(f"❌ Fallback Azure SQL connection also failed: {e2}")
    
    # Final fallback to SQLite
    print("ℹ️ Using SQLite fallback database")
    return "sqlite:///./legislation_vue.db"

# Get the database URL
DATABASE_URL = get_database_url()

# FIXED: Create engine with proper parameters
try:
    if any(term in DATABASE_URL.lower() for term in ["azure", "database.windows.net", "mssql"]):
        # Azure SQL specific configuration
        engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,
            echo=False,
            pool_recycle=300,  # Recycle connections every 5 minutes
            pool_timeout=30,   # Timeout after 30 seconds
            max_overflow=10,   # Allow 10 additional connections beyond pool_size
            pool_size=5,       # Base connection pool size
            # IMPORTANT: Enable autocommit for Azure SQL compatibility
            execution_options={
                "isolation_level": "AUTOCOMMIT"
            }
        )
        print(f"✅ Azure SQL Database engine created with autocommit")
    else:
        # SQLite or other database configuration
        engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,
            echo=False,
            connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
        )
        print(f"✅ Database engine created: {DATABASE_URL}")
        
except Exception as e:
    print(f"❌ Error creating database engine: {e}")
    # Final fallback to SQLite
    DATABASE_URL = "sqlite:///./legislation_vue_fallback.db"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    print(f"🔄 Using SQLite fallback: {DATABASE_URL}")

# Create declarative base
Base = declarative_base()

class StateLegislationDB(Base):
    """State Legislation database model"""
    
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
    
    # Dates
    introduced_date = Column(String(20), nullable=True, index=True)  # YYYY-MM-DD format
    last_action_date = Column(String(20), nullable=True, index=True)
    
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
        print(f"❌ Database session error: {e}")
        raise e
    finally:
        session.close()

def test_connections():
    """FIXED: Test database connections with proper SQLAlchemy syntax"""
    try:
        # Test the main database connection
        with LegislationSession() as session:
            # FIXED: Use proper SQLAlchemy text() function
            result = session.execute(text("SELECT 1 as test_column")).fetchone()
            if result and result[0] == 1:
                print("✅ Database connection test successful")
                return {
                    "executive_orders": True,
                    "legislation": True,
                    "errors": []
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
        print(f"Database URL: {DATABASE_URL[:50]}...")
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
                query = query.filter(StateLegislationDB.state == state)
            
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
            
            # ✅ FIXED: Add ORDER BY before pagination (required for MSSQL)
            query = query.order_by(StateLegislationDB.last_updated.desc())
            
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
    """Save legislation bills to database"""
    
    if not bills:
        print("⚠️ No bills provided to save")
        return 0
    
    saved_count = 0
    
    try:
        with LegislationSession() as session:
            print(f"🔄 Attempting to save {len(bills)} bills to database...")
            
            for i, bill_data in enumerate(bills):
                try:
                    # Validate required fields
                    bill_id = bill_data.get('bill_id')
                    if not bill_id:
                        print(f"⚠️ Skipping bill {i+1}: No bill_id")
                        continue
                    
                    # Check if bill already exists
                    existing = session.query(StateLegislationDB).filter_by(
                        bill_id=bill_id
                    ).first()
                    
                    if existing:
                        # Update existing bill
                        for key, value in bill_data.items():
                            if hasattr(existing, key):
                                setattr(existing, key, value)
                        existing.last_updated = datetime.now()
                        print(f"📝 Updated bill {bill_id}")
                    else:
                        # Create new bill - ensure required fields
                        bill_data_clean = {
                            'bill_id': bill_id,
                            'bill_number': bill_data.get('bill_number', 'Unknown'),
                            'title': bill_data.get('title', 'Untitled Bill'),
                            'description': bill_data.get('description', ''),
                            'state': bill_data.get('state', 'Unknown'),
                            'state_abbr': bill_data.get('state_abbr', ''),
                            'status': bill_data.get('status', ''),
                            'category': bill_data.get('category', 'not_applicable'),
                            'introduced_date': bill_data.get('introduced_date', ''),
                            'last_action_date': bill_data.get('last_action_date', ''),
                            'session_id': bill_data.get('session_id', ''),
                            'session_name': bill_data.get('session_name', ''),
                            'bill_type': bill_data.get('bill_type', ''),
                            'body': bill_data.get('body', ''),
                            'legiscan_url': bill_data.get('legiscan_url', ''),
                            'pdf_url': bill_data.get('pdf_url', ''),
                            'ai_summary': bill_data.get('ai_summary', ''),
                            'ai_executive_summary': bill_data.get('ai_executive_summary', ''),
                            'ai_talking_points': bill_data.get('ai_talking_points', ''),
                            'ai_key_points': bill_data.get('ai_key_points', ''),
                            'ai_business_impact': bill_data.get('ai_business_impact', ''),
                            'ai_potential_impact': bill_data.get('ai_potential_impact', ''),
                            'ai_version': bill_data.get('ai_version', 'v1'),
                            'created_at': datetime.now(),
                            'last_updated': datetime.now()
                        }
                        
                        new_bill = StateLegislationDB(**bill_data_clean)
                        session.add(new_bill)
                        print(f"➕ Added bill {bill_id}")
                    
                    saved_count += 1
                    
                    # Commit every 10 bills for performance
                    if saved_count % 10 == 0:
                        session.commit()
                        print(f"💾 Committed batch of 10 bills (total: {saved_count})")
                
                except Exception as bill_error:
                    print(f"❌ Error saving individual bill {i+1}: {bill_error}")
                    continue
            
            # Final commit
            session.commit()
            print(f"✅ Successfully saved {saved_count} bills to database")
        
    except Exception as e:
        print(f"❌ Error saving legislation: {e}")
        print(f"Database URL: {DATABASE_URL[:50]}...")
        return 0
    
    return saved_count

def get_legislation_stats() -> Dict:
    """Get legislation statistics"""
    
    try:
        with LegislationSession() as session:
            total_bills = session.query(StateLegislationDB).count()
            
            # Bills by state
            states_with_data = session.query(StateLegislationDB.state).distinct().all()
            states_list = [state[0] for state in states_with_data if state[0]]
            
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
                    for cat, count in categories if cat
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
    
    database_type = "Unknown"
    using_azure_sql = False
    
    if DATABASE_URL:
        if "sqlite" in DATABASE_URL.lower():
            database_type = "SQLite"
        elif "postgresql" in DATABASE_URL.lower():
            database_type = "PostgreSQL"
        elif "mysql" in DATABASE_URL.lower():
            database_type = "MySQL"
        elif any(term in DATABASE_URL.lower() for term in ["sqlserver", "azure", "database.windows.net", "mssql"]):
            database_type = "Azure SQL / SQL Server"
            using_azure_sql = True
    
    return {
        "database_type": database_type,
        "using_azure_sql": using_azure_sql,
        "database_url": DATABASE_URL[:50] + "..." if len(DATABASE_URL) > 50 else DATABASE_URL
    }

# Initialize on import
if __name__ == "__main__":
    print("🧪 Testing completely fixed database_fixed module...")
    
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