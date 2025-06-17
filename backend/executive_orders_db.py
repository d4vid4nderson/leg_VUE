# executive_orders_db.py - Enhanced with Azure SQL and User Highlights
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Boolean, Index, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from contextlib import contextmanager
import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import urllib.parse

# Import database configuration (keep your existing import)
try:
    from database_fixed import get_database_info
except ImportError:
    def get_database_info():
        return {"using_azure_sql": True}

Base = declarative_base()

class ExecutiveOrder(Base):
    """Executive Order model with enhanced schema for Azure SQL"""
    __tablename__ = 'executive_orders'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    document_number = Column(String(100), unique=True, index=True, nullable=False)  # Increased size
    eo_number = Column(String(50), index=True)
    title = Column(Text, nullable=False)
    summary = Column(Text)
    signing_date = Column(String(20))  # Keep as string for compatibility
    publication_date = Column(String(20))
    citation = Column(String(255))  # Increased size
    presidential_document_type = Column(String(100))
    category = Column(String(100))  # Increased size
    html_url = Column(Text)
    pdf_url = Column(Text)
    trump_2025_url = Column(Text)  # New field from your API
    
    # AI Analysis fields (enhanced)
    ai_summary = Column(Text)
    ai_executive_summary = Column(Text)  # Additional field for compatibility
    ai_key_points = Column(Text)
    ai_talking_points = Column(Text)  # Additional field for compatibility
    ai_business_impact = Column(Text)
    ai_potential_impact = Column(Text)  # Additional field for compatibility
    ai_version = Column(String(50), default='azure_openai_v2')
    
    # Enhanced metadata
    source = Column(String(255), default='Federal Register API v1')
    raw_data_available = Column(Boolean, default=True)
    processing_status = Column(String(50), default='completed')
    error_message = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_scraped_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship to user highlights
    highlights = relationship("UserHighlight", back_populates="order")
    
    # Enhanced indexes
    __table_args__ = (
        Index('idx_eo_number', 'eo_number'),
        Index('idx_document_number', 'document_number'),
        Index('idx_signing_date', 'signing_date'),
        Index('idx_category', 'category'),
        Index('idx_created_at', 'created_at'),
    )

class UserHighlight(Base):
    """User highlights/bookmarks for executive orders"""
    __tablename__ = 'user_highlights'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(255), nullable=False, index=True)
    order_id = Column(String(255), ForeignKey('executive_orders.document_number'), nullable=False)
    order_type = Column(String(50), default='executive_order')
    highlighted_at = Column(DateTime, default=datetime.utcnow)
    
    # Additional user interaction fields
    notes = Column(Text)
    priority_level = Column(Integer, default=1)
    tags = Column(String(500))
    is_archived = Column(Boolean, default=False)
    
    # Relationship to executive order
    order = relationship("ExecutiveOrder", back_populates="highlights")
    
    # Indexes
    __table_args__ = (
        Index('idx_user_id', 'user_id'),
        Index('idx_order_id', 'order_id'),
        Index('idx_highlighted_at', 'highlighted_at'),
        Index('idx_user_order_unique', 'user_id', 'order_id', 'order_type', unique=True),
    )

class ProcessingLog(Base):
    """Processing log for tracking scraping activities"""
    __tablename__ = 'processing_log'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    process_type = Column(String(100), nullable=False)
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime)
    status = Column(String(50), nullable=False)
    records_processed = Column(Integer, default=0)
    records_new = Column(Integer, default=0)
    records_updated = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    details = Column(Text)
    date_range_start = Column(String(20))
    date_range_end = Column(String(20))
    
    __table_args__ = (
        Index('idx_process_type', 'process_type'),
        Index('idx_start_time', 'start_time'),
    )


def get_database_url():
   """Get database URL with enhanced Azure SQL support"""
   environment = os.getenv("ENVIRONMENT", "development")
   server = os.getenv('AZURE_SQL_SERVER', 'sql-legislation-tracker.database.windows.net')
   database = os.getenv('AZURE_SQL_DATABASE', 'db-executiveorders')
   
   if environment == "production":
       # For production, use system-assigned MSI
       print("🔐 Using system-assigned managed identity for executive orders")
       connection_string = (
           f"mssql+pyodbc://{server}:1433/{database}"
           f"?driver=ODBC+Driver+18+for+SQL+Server"
           f"&authentication=ActiveDirectoryMSI"
           f"&Encrypt=yes"
           f"&TrustServerCertificate=no"
           f"&Connection+Timeout=30"
       )
       return connection_string
   else:
       # Development - use SQL auth
       username = os.getenv('AZURE_SQL_USERNAME')
       password = os.getenv('AZURE_SQL_PASSWORD')
       
       if all([server, database, username, password]):
           # URL encode password for special characters
           password_encoded = urllib.parse.quote_plus(password)
           username_encoded = urllib.parse.quote_plus(username)
           
           # Standard SQL authentication for development
           connection_string = (
               f"mssql+pyodbc://{username_encoded}:{password_encoded}@{server}:1433/{database}"
               f"?driver=ODBC+Driver+18+for+SQL+Server"
               f"&Encrypt=yes"
               f"&TrustServerCertificate=no"
               f"&Connection+Timeout=30"
           )
           print(f"🔑 Using SQL authentication for development")
           return connection_string
       else:
           # Fallback to SQLite
           print("ℹ️ Using SQLite fallback database")
           return "sqlite:///./executive_orders.db"

DATABASE_URL = get_database_url()
engine = create_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_executive_orders_db():
    """Initialize the executive orders database with all tables"""
    try:
        # Create all tables
        Base.metadata.create_all(bind=engine)
        print("✅ Executive orders database initialized with all tables")
        return True
    except Exception as e:
        print(f"❌ Error initializing executive orders database: {e}")
        return False

@contextmanager
def get_db_session():
    """Get database session with enhanced error handling"""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception as e:
        session.rollback()
        print(f"Database error: {e}")
        raise
    finally:
        session.close()

def save_executive_orders_to_db(orders: List[Dict]) -> Dict:
    """Enhanced save with comprehensive result tracking"""
    
    if not orders:
        return {"total_processed": 0, "inserted": 0, "updated": 0, "errors": 0, "error_details": []}
    
    results = {
        "total_processed": 0,
        "inserted": 0,
        "updated": 0,
        "errors": 0,
        "error_details": []
    }
    
    try:
        with get_db_session() as session:
            for order_data in orders:
                try:
                    # Use document_number as primary identifier
                    document_number = order_data.get('document_number', '')
                    if not document_number:
                        # Generate a document number if not provided
                        document_number = f"EO-{order_data.get('eo_number', '')}-{int(datetime.now().timestamp())}"
                        print(f"⚠️ Generated document number: {document_number}")
                    
                    # Check if order already exists
                    existing_order = session.query(ExecutiveOrder).filter_by(document_number=document_number).first()
                    
                    if existing_order:
                        # Update existing order with all new fields
                        for key, value in order_data.items():
                            if hasattr(existing_order, key) and value is not None:
                                setattr(existing_order, key, value)
                        existing_order.last_updated = datetime.utcnow()
                        existing_order.last_scraped_at = datetime.utcnow()
                        results["updated"] += 1
                        print(f"🔄 Updated EO {order_data.get('eo_number', 'Unknown')}")
                    else:
                        # Create new order with comprehensive field mapping
                        new_order = ExecutiveOrder(
                            document_number=document_number,
                            eo_number=order_data.get('eo_number', ''),
                            title=order_data.get('title', ''),
                            summary=order_data.get('summary', ''),
                            signing_date=order_data.get('signing_date', ''),
                            publication_date=order_data.get('publication_date', ''),
                            citation=order_data.get('citation', ''),
                            presidential_document_type=order_data.get('presidential_document_type', ''),
                            category=order_data.get('category', 'not-applicable'),
                            html_url=order_data.get('html_url', ''),
                            pdf_url=order_data.get('pdf_url', ''),
                            trump_2025_url=order_data.get('trump_2025_url', ''),
                            
                            # AI Analysis fields (with fallbacks)
                            ai_summary=order_data.get('ai_summary', ''),
                            ai_executive_summary=order_data.get('ai_executive_summary', order_data.get('ai_summary', '')),
                            ai_key_points=order_data.get('ai_key_points', ''),
                            ai_talking_points=order_data.get('ai_talking_points', order_data.get('ai_key_points', '')),
                            ai_business_impact=order_data.get('ai_business_impact', ''),
                            ai_potential_impact=order_data.get('ai_potential_impact', order_data.get('ai_business_impact', '')),
                            ai_version=order_data.get('ai_version', 'azure_openai_v2'),
                            
                            # Metadata
                            source=order_data.get('source', 'Federal Register API v1'),
                            raw_data_available=order_data.get('raw_data_available', True),
                            processing_status='completed',
                            last_scraped_at=datetime.utcnow()
                        )
                        session.add(new_order)
                        results["inserted"] += 1
                        print(f"✅ Added EO {order_data.get('eo_number', 'Unknown')}: {order_data.get('title', 'No title')[:50]}...")
                    
                    results["total_processed"] += 1
                    
                except Exception as e:
                    results["errors"] += 1
                    error_msg = f"Error saving order {order_data.get('eo_number', 'unknown')}: {str(e)}"
                    results["error_details"].append(error_msg)
                    print(f"⚠️ {error_msg}")
                    continue
        
        print(f"💾 Saved {results['total_processed']} orders: {results['inserted']} new, {results['updated']} updated, {results['errors']} errors")
        return results
        
    except Exception as e:
        print(f"❌ Critical error saving executive orders: {e}")
        results["errors"] = len(orders)
        results["error_details"].append(f"Critical database error: {str(e)}")
        return results

def add_user_highlight(user_id: str, order_id: str, notes: str = None, 
                      priority: int = 1, tags: str = None) -> bool:
    """Add or update user highlight"""
    try:
        with get_db_session() as session:
            # Check if highlight already exists
            existing = session.query(UserHighlight).filter_by(
                user_id=user_id, 
                order_id=order_id, 
                order_type='executive_order'
            ).first()
            
            if existing:
                # Update existing highlight
                existing.notes = notes or existing.notes
                existing.priority_level = priority
                existing.tags = tags or existing.tags
                existing.highlighted_at = datetime.utcnow()
                existing.is_archived = False
                print(f"🔄 Updated highlight for user {user_id}")
            else:
                # Create new highlight
                new_highlight = UserHighlight(
                    user_id=user_id,
                    order_id=order_id,
                    order_type='executive_order',
                    notes=notes,
                    priority_level=priority,
                    tags=tags
                )
                session.add(new_highlight)
                print(f"✅ Added highlight for user {user_id}")
            
            return True
            
    except Exception as e:
        print(f"❌ Error adding user highlight: {e}")
        return False

def get_user_highlights(user_id: str, limit: int = 50) -> List[Dict]:
    """Get user's highlighted executive orders with full order details"""
    try:
        with get_db_session() as session:
            # Join with ExecutiveOrder to get full details
            highlights = session.query(UserHighlight, ExecutiveOrder).join(
                ExecutiveOrder, UserHighlight.order_id == ExecutiveOrder.document_number
            ).filter(
                UserHighlight.user_id == user_id,
                UserHighlight.is_archived == False
            ).order_by(UserHighlight.highlighted_at.desc()).limit(limit).all()
            
            results = []
            for highlight, order in highlights:
                result = {
                    # Order details
                    "id": order.id,
                    "document_number": order.document_number,
                    "eo_number": order.eo_number,
                    "title": order.title,
                    "summary": order.summary,
                    "signing_date": order.signing_date,
                    "category": order.category,
                    "html_url": order.html_url,
                    "pdf_url": order.pdf_url,
                    
                    # AI Analysis
                    "ai_summary": order.ai_summary,
                    "ai_key_points": order.ai_key_points,
                    "ai_business_impact": order.ai_business_impact,
                    
                    # Highlight details
                    "highlighted_at": highlight.highlighted_at.isoformat() if highlight.highlighted_at else None,
                    "user_notes": highlight.notes,
                    "priority_level": highlight.priority_level,
                    "user_tags": highlight.tags
                }
                results.append(result)
            
            return results
            
    except Exception as e:
        print(f"❌ Error getting user highlights: {e}")
        return []

def log_processing_activity(process_type: str, status: str, **kwargs) -> bool:
    """Log processing activity"""
    try:
        with get_db_session() as session:
            log_entry = ProcessingLog(
                process_type=process_type,
                status=status,
                records_processed=kwargs.get('records_processed', 0),
                records_new=kwargs.get('records_new', 0),
                records_updated=kwargs.get('records_updated', 0),
                error_count=kwargs.get('error_count', 0),
                details=kwargs.get('details', ''),
                date_range_start=kwargs.get('date_range_start'),
                date_range_end=kwargs.get('date_range_end'),
                end_time=datetime.utcnow()
            )
            session.add(log_entry)
            return True
            
    except Exception as e:
        print(f"❌ Error logging processing activity: {e}")
        return False

def get_executive_orders_from_db(category: Optional[str] = None,
                                search: Optional[str] = None,
                                user_id: Optional[str] = None,
                                highlights_only: bool = False,
                                page: int = 1,
                                per_page: int = 25,
                                sort_by: str = "signing_date",
                                sort_order: str = "desc") -> Dict:
    """Enhanced get method with user highlights support"""
    
    try:
        with get_db_session() as session:
            # Base query with optional highlight join
            if highlights_only and user_id:
                # Only get highlighted orders for this user
                query = session.query(ExecutiveOrder).join(
                    UserHighlight, ExecutiveOrder.document_number == UserHighlight.order_id
                ).filter(
                    UserHighlight.user_id == user_id,
                    UserHighlight.is_archived == False
                )
            else:
                # Get all orders with optional highlight information
                query = session.query(ExecutiveOrder)
            
            # Apply filters
            if category:
                query = query.filter(ExecutiveOrder.category == category)
            
            if search:
                search_filter = f"%{search}%"
                query = query.filter(
                    (ExecutiveOrder.title.ilike(search_filter)) |
                    (ExecutiveOrder.summary.ilike(search_filter)) |
                    (ExecutiveOrder.eo_number.ilike(search_filter)) |
                    (ExecutiveOrder.document_number.ilike(search_filter))
                )
            
            # Apply sorting
            sort_field = getattr(ExecutiveOrder, sort_by, ExecutiveOrder.signing_date)
            if sort_order == "asc":
                query = query.order_by(sort_field.asc())
            else:
                query = query.order_by(sort_field.desc())
            
            # Get total count
            total_count = query.count()
            
            # Apply pagination
            offset = (page - 1) * per_page
            orders = query.offset(offset).limit(per_page).all()
            
            # Convert to dictionaries with highlight information
            results = []
            for order in orders:
                # Check if this order is highlighted by the user
                is_highlighted = False
                highlight_info = {}
                
                if user_id:
                    highlight = session.query(UserHighlight).filter_by(
                        user_id=user_id,
                        order_id=order.document_number,
                        order_type='executive_order',
                        is_archived=False
                    ).first()
                    
                    if highlight:
                        is_highlighted = True
                        highlight_info = {
                            "highlighted_at": highlight.highlighted_at.isoformat() if highlight.highlighted_at else None,
                            "user_notes": highlight.notes,
                            "priority_level": highlight.priority_level,
                            "user_tags": highlight.tags
                        }
                
                order_dict = {
                    "id": order.id,
                    "document_number": order.document_number,
                    "eo_number": order.eo_number,
                    "title": order.title,
                    "summary": order.summary,
                    "signing_date": order.signing_date,
                    "publication_date": order.publication_date,
                    "citation": order.citation,
                    "presidential_document_type": order.presidential_document_type,
                    "category": order.category,
                    "html_url": order.html_url,
                    "pdf_url": order.pdf_url,
                    "trump_2025_url": order.trump_2025_url,
                    
                    # AI Analysis
                    "ai_summary": order.ai_summary,
                    "ai_executive_summary": order.ai_executive_summary,
                    "ai_key_points": order.ai_key_points,
                    "ai_talking_points": order.ai_talking_points,
                    "ai_business_impact": order.ai_business_impact,
                    "ai_potential_impact": order.ai_potential_impact,
                    "ai_version": order.ai_version,
                    
                    # Metadata
                    "source": order.source,
                    "raw_data_available": order.raw_data_available,
                    "processing_status": order.processing_status,
                    "created_at": order.created_at.isoformat() if order.created_at else None,
                    "last_updated": order.last_updated.isoformat() if order.last_updated else None,
                    "last_scraped_at": order.last_scraped_at.isoformat() if order.last_scraped_at else None,
                    
                    # User highlight information
                    "is_highlighted": is_highlighted,
                    **highlight_info
                }
                results.append(order_dict)
            
            total_pages = (total_count + per_page - 1) // per_page
            
            return {
                "results": results,
                "count": total_count,
                "total_pages": total_pages,
                "page": page,
                "per_page": per_page,
                "filters": {
                    "category": category,
                    "search": search,
                    "user_id": user_id,
                    "highlights_only": highlights_only,
                    "sort_by": sort_by,
                    "sort_order": sort_order
                }
            }
    
    except Exception as e:
        print(f"Error retrieving executive orders: {e}")
        return {
            "results": [],
            "count": 0,
            "total_pages": 0,
            "page": page,
            "per_page": per_page,
            "error": str(e)
        }
    
# ADD THE NEW FUNCTION HERE ⬇️
def get_executive_order_by_number(eo_number: str):
    """Get a specific executive order by its number"""
    try:
        with get_db_session() as session:
            # Try different possible formats for the EO number
            order = session.query(ExecutiveOrder).filter(
                ExecutiveOrder.eo_number == eo_number
            ).first()
            
            if not order:
                # Try without prefix if it exists
                clean_number = eo_number.replace('EO', '').replace('E.O.', '').strip()
                order = session.query(ExecutiveOrder).filter(
                    ExecutiveOrder.eo_number.like(f'%{clean_number}%')
                ).first()
            
            if order:
                return {
                    "eo_number": order.eo_number,
                    "title": order.title,
                    "summary": order.summary,
                    "signing_date": order.signing_date,
                    "publication_date": order.publication_date,
                    "category": order.category,
                    "html_url": order.html_url,
                    "pdf_url": order.pdf_url,
                    "ai_summary": order.ai_summary,
                    "ai_executive_summary": order.ai_executive_summary,
                    "ai_talking_points": order.ai_talking_points,
                    "ai_key_points": order.ai_key_points,
                    "ai_business_impact": order.ai_business_impact,
                    "ai_potential_impact": order.ai_potential_impact,
                    "ai_version": order.ai_version,
                    "created_at": order.created_at.isoformat() if order.created_at else None,
                    "last_updated": order.last_updated.isoformat() if order.last_updated else None
                }
            
            return None
            
    except Exception as e:
        print(f"Error getting executive order by number: {e}")
        return None

def get_executive_orders_stats():
    """Your existing stats function"""

def get_executive_orders_stats() -> Dict:
    """Enhanced statistics with user activity"""
    try:
        with get_db_session() as session:
            total_orders = session.query(ExecutiveOrder).count()
            
            # Recent orders (last 30 days)
            thirty_days_ago = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
            recent_orders = session.query(ExecutiveOrder).filter(
                ExecutiveOrder.signing_date >= thirty_days_ago
            ).count()
            
            # This week
            seven_days_ago = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
            weekly_orders = session.query(ExecutiveOrder).filter(
                ExecutiveOrder.signing_date >= seven_days_ago
            ).count()
            
            # Orders by category
            from sqlalchemy import func
            categories = session.query(
                ExecutiveOrder.category,
                func.count(ExecutiveOrder.id).label('count')
            ).group_by(ExecutiveOrder.category).all()
            
            category_stats = {}
            for category, count in categories:
                if category:
                    category_stats[f"{category}_orders"] = count
            
            # Latest order date
            latest_order = session.query(ExecutiveOrder).order_by(
                ExecutiveOrder.signing_date.desc()
            ).first()
            
            # User highlight stats
            total_highlights = session.query(UserHighlight).filter_by(is_archived=False).count()
            
            return {
                "total_orders": total_orders,
                "orders_last_month": recent_orders,
                "orders_last_week": weekly_orders,
                "total_highlights": total_highlights,
                "latest_order_date": latest_order.signing_date if latest_order else None,
                "last_scraped": latest_order.last_scraped_at.isoformat() if latest_order and latest_order.last_scraped_at else None,
                "has_data": total_orders > 0,
                **category_stats
            }
    
    except Exception as e:
        print(f"Error getting executive orders stats: {e}")
        return {
            "total_orders": 0,
            "orders_last_month": 0,
            "orders_last_week": 0,
            "total_highlights": 0,
            "has_data": False
        }

def test_executive_orders_db() -> bool:
    """Enhanced database test"""
    try:
        with get_db_session() as session:
            # Test executive orders table
            order_count = session.query(ExecutiveOrder).count()
            
            # Test user highlights table
            highlight_count = session.query(UserHighlight).count()
            
            # Test processing log table
            log_count = session.query(ProcessingLog).count()
            
            print(f"✅ Database test successful:")
            print(f"   • {order_count} executive orders")
            print(f"   • {highlight_count} user highlights")
            print(f"   • {log_count} processing log entries")
            
            return True
    except Exception as e:
        print(f"❌ Database test failed: {e}")
        return False

# Integration function for your Federal Register API
async def integrate_federal_register_with_db(federal_register_api, start_date=None, end_date=None):
    """Integration function to work with your existing Federal Register API"""
    try:
        from ai import analyze_executive_order
        
        print("🔄 Starting Federal Register integration with enhanced database...")
        
        # Fetch orders using your existing API
        api_result = federal_register_api.fetch_trump_2025_executive_orders(
            start_date=start_date,
            end_date=end_date
        )
        
        orders = api_result.get('results', [])
        print(f"📊 Federal Register API returned {len(orders)} orders")
        
        if not orders:
            return {'success': True, 'message': 'No orders to process'}
        
        # Enhanced AI analysis for each order
        enhanced_orders = []
        for order in orders:
            try:
                print(f"🤖 Enhancing EO {order.get('eo_number', 'unknown')} with AI analysis...")
                
                ai_analysis = await analyze_executive_order(
                    title=order.get('title', ''),
                    abstract=order.get('summary', ''),
                    order_number=order.get('eo_number', '')
                )
                
                # Merge AI analysis with order data
                enhanced_order = {**order, **ai_analysis}
                enhanced_orders.append(enhanced_order)
                
            except Exception as e:
                print(f"⚠️ AI analysis failed for EO {order.get('eo_number', 'unknown')}: {e}")
                enhanced_orders.append(order)
        
        # Save to database using enhanced function
        db_result = save_executive_orders_to_db(enhanced_orders)
        
        # Log the processing activity
        log_processing_activity(
            process_type='federal_register_scrape_with_ai',
            status='completed',
            records_processed=db_result['total_processed'],
            records_new=db_result['inserted'],
            records_updated=db_result['updated'],
            error_count=db_result['errors'],
            details=f"API returned {len(orders)} orders, processed {db_result['total_processed']}",
            date_range_start=start_date,
            date_range_end=end_date
        )
        
        return {
            'success': True,
            'api_result': api_result,
            'db_result': db_result,
            'enhanced_with_ai': True
        }
        
    except Exception as e:
        print(f"❌ Integration failed: {e}")
        
        # Log the error
        log_processing_activity(
            process_type='federal_register_scrape_with_ai',
            status='failed',
            error_count=1,
            details=f"Integration error: {str(e)}"
        )
        
        return {
            'success': False,
            'error': str(e)
        }

if __name__ == "__main__":
    # Initialize and test the enhanced database
    print("🔄 Initializing enhanced executive orders database...")
    if init_executive_orders_db():
        test_executive_orders_db()
        
        # Show current stats
        stats = get_executive_orders_stats()
        print(f"\n📊 Current database stats:")
        print(f"   • Total orders: {stats['total_orders']}")
        print(f"   • Recent orders: {stats['orders_last_month']}")
        print(f"   • User highlights: {stats['total_highlights']}")
    else:
        print("❌ Failed to initialize enhanced executive orders database")
