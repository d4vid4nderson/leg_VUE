# executive_orders_db.py - Fixed version using direct pyodbc
import os
import logging
from datetime import datetime
from typing import Dict, List, Optional
import json

# Import our direct database connection
from database_connection import get_db_connection, get_db_cursor, execute_query, execute_many

logger = logging.getLogger(__name__)

def check_executive_orders_table():
    """Check if the executive_orders table exists and create it if needed"""
    try:
        # Check if table exists
        with get_db_cursor() as cursor:
            cursor.execute("""
                SELECT COUNT(*) 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_NAME = 'executive_orders' AND TABLE_SCHEMA = 'dbo'
            """)
            
            table_exists = cursor.fetchone()[0] > 0
            
            if not table_exists:
                logger.warning("⚠️ executive_orders table doesn't exist, creating...")
                # Create the table
                cursor.execute("""
                    CREATE TABLE dbo.executive_orders (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        document_number NVARCHAR(100) NOT NULL,
                        eo_number NVARCHAR(50),
                        title NVARCHAR(MAX) NOT NULL,
                        summary NVARCHAR(MAX),
                        signing_date DATE,
                        publication_date DATE,
                        citation NVARCHAR(255),
                        presidential_document_type NVARCHAR(100),
                        category NVARCHAR(100),
                        html_url NVARCHAR(MAX),
                        pdf_url NVARCHAR(MAX),
                        trump_2025_url NVARCHAR(MAX),
                        ai_summary NVARCHAR(MAX),
                        ai_executive_summary NVARCHAR(MAX),
                        ai_key_points NVARCHAR(MAX),
                        ai_talking_points NVARCHAR(MAX),
                        ai_business_impact NVARCHAR(MAX),
                        ai_potential_impact NVARCHAR(MAX),
                        ai_version NVARCHAR(50),
                        source NVARCHAR(255),
                        raw_data_available BIT DEFAULT 1,
                        processing_status NVARCHAR(50) DEFAULT 'completed',
                        error_message NVARCHAR(MAX),
                        content NVARCHAR(MAX),
                        tags NVARCHAR(MAX),
                        ai_analysis NVARCHAR(MAX),
                        created_at DATETIME DEFAULT GETUTCDATE(),
                        last_updated DATETIME DEFAULT GETUTCDATE(),
                        last_scraped_at DATETIME DEFAULT GETUTCDATE(),
                        CONSTRAINT UQ_document_number UNIQUE (document_number)
                    )
                """)
                logger.info("✅ executive_orders table created successfully")
                
                # Create indexes for better performance
                cursor.execute("CREATE INDEX idx_eo_number ON dbo.executive_orders (eo_number)")
                cursor.execute("CREATE INDEX idx_category ON dbo.executive_orders (category)")
                cursor.execute("CREATE INDEX idx_signing_date ON dbo.executive_orders (signing_date)")
                logger.info("✅ Indexes created for executive_orders table")
                
                return True, []
                
            # Get column information
            cursor.execute("""
                SELECT COLUMN_NAME
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = 'executive_orders' AND TABLE_SCHEMA = 'dbo'
                ORDER BY ORDINAL_POSITION
            """)
            
            columns = [row[0] for row in cursor.fetchall()]
            logger.info(f"✅ executive_orders table exists with {len(columns)} columns")
            return True, columns
            
    except Exception as e:
        logger.error(f"❌ Error checking executive_orders table: {e}")
        return False, []

def get_executive_orders_from_db(limit=100, offset=0, filters=None):
    """Get executive orders from database with filters and pagination"""
    try:
        logger.info(f"🔍 Getting executive orders: limit={limit}, offset={offset}, filters={filters}")
        
        # Build query
        base_query = """
        SELECT 
            id, document_number, eo_number, title, summary, 
            signing_date, publication_date, citation, presidential_document_type, category,
            html_url, pdf_url, trump_2025_url, 
            ai_summary, ai_executive_summary, ai_key_points, ai_talking_points, 
            ai_business_impact, ai_potential_impact, ai_version,
            source, raw_data_available, processing_status, error_message,
            created_at, last_updated, last_scraped_at, tags
        FROM dbo.executive_orders
        """
        
        # Add WHERE clause for filters
        where_conditions = []
        params = []
        
        if filters:
            if filters.get('category'):
                where_conditions.append("category = ?")
                params.append(filters['category'])
                
            if filters.get('search'):
                search_term = f"%{filters['search']}%"
                where_conditions.append("(title LIKE ? OR summary LIKE ? OR ai_summary LIKE ?)")
                params.extend([search_term, search_term, search_term])
        
        if where_conditions:
            base_query += " WHERE " + " AND ".join(where_conditions)
        
        # Add ORDER BY
        base_query += " ORDER BY signing_date DESC, eo_number DESC"
        
        # Count total matching records
        count_query = f"SELECT COUNT(*) FROM dbo.executive_orders"
        if where_conditions:
            count_query += " WHERE " + " AND ".join(where_conditions)
            
        total_count = execute_query(count_query, params, fetch_one=True)[0]
        
        # Add pagination
        base_query += f" OFFSET {offset} ROWS FETCH NEXT {limit} ROWS ONLY"
        
        # Execute the query
        with get_db_cursor() as cursor:
            if params:
                cursor.execute(base_query, params)
            else:
                cursor.execute(base_query)
                
            # Get column names
            columns = [column[0] for column in cursor.description]
            
            # Fetch all results
            rows = cursor.fetchall()
            
            # Convert to dictionaries
            results = []
            for row in rows:
                # Convert row to dictionary
                result = dict(zip(columns, row))
                
                # Format dates
                for date_field in ['signing_date', 'publication_date', 'created_at', 'last_updated', 'last_scraped_at']:
                    if result.get(date_field) and hasattr(result[date_field], 'isoformat'):
                        result[date_field] = result[date_field].isoformat()
                
                # Add formatted dates
                if result.get('signing_date'):
                    result['formatted_signing_date'] = result['signing_date']
                if result.get('publication_date'):
                    result['formatted_publication_date'] = result['publication_date']
                
                results.append(result)
        
        logger.info(f"✅ Retrieved {len(results)} executive orders from database")
        
        return {
            'success': True,
            'results': results,
            'count': len(results),
            'total': total_count
        }
        
    except Exception as e:
        logger.error(f"❌ Error getting executive orders: {e}")
        return {
            'success': False,
            'message': str(e),
            'results': [],
            'count': 0
        }

def save_executive_orders_to_db(orders: List[Dict]) -> Dict:
    """Save executive orders to database with improved error handling"""
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
        # Ensure table exists
        table_exists, columns = check_executive_orders_table()
        if not table_exists:
            results["error_details"].append("Executive orders table could not be created")
            return results
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            for order in orders:
                try:
                    # Get key values
                    document_number = order.get('document_number', '')
                    eo_number = order.get('eo_number', '')
                    
                    # Generate document number if missing
                    if not document_number:
                        document_number = f"EO-{eo_number}-{int(datetime.now().timestamp())}"
                        logger.info(f"Generated document number: {document_number}")
                    
                    # Check if order exists
                    cursor.execute(
                        "SELECT id FROM dbo.executive_orders WHERE document_number = ? OR eo_number = ?", 
                        (document_number, eo_number)
                    )
                    existing = cursor.fetchone()
                    
                    if existing:
                        # UPDATE existing order
                        update_fields = []
                        params = []
                        
                        # Build dynamic update
                        for key, value in order.items():
                            # Skip these fields for update
                            if key in ['id', 'document_number', 'created_at']:
                                continue
                                
                            # Add to update if in our schema
                            if key in columns:
                                update_fields.append(f"{key} = ?")
                                params.append(value)
                        
                        # Add timestamp
                        update_fields.append("last_updated = ?")
                        params.append(datetime.now())
                        
                        # Add WHERE clause parameter
                        params.append(document_number)
                        
                        # Execute update
                        update_sql = f"UPDATE dbo.executive_orders SET {', '.join(update_fields)} WHERE document_number = ?"
                        cursor.execute(update_sql, params)
                        
                        results["updated"] += 1
                        logger.info(f"🔄 Updated EO {eo_number}")
                    else:
                        # INSERT new order
                        insert_fields = ['document_number']
                        params = [document_number]
                        
                        # Build dynamic insert
                        for key, value in order.items():
                            # Skip these fields
                            if key in ['id', 'document_number']:
                                continue
                                
                            # Add field if in our schema
                            if key in columns:
                                insert_fields.append(key)
                                params.append(value)
                        
                        # Add timestamps if not already present
                        if 'created_at' not in insert_fields:
                            insert_fields.append('created_at')
                            params.append(datetime.now())
                        if 'last_updated' not in insert_fields:
                            insert_fields.append('last_updated')
                            params.append(datetime.now())
                        
                        # Execute insert
                        placeholders = ', '.join(['?'] * len(insert_fields))
                        insert_sql = f"INSERT INTO dbo.executive_orders ({', '.join(insert_fields)}) VALUES ({placeholders})"
                        cursor.execute(insert_sql, params)
                        
                        results["inserted"] += 1
                        logger.info(f"✅ Inserted EO {eo_number}")
                    
                    results["total_processed"] += 1
                    
                except Exception as e:
                    results["errors"] += 1
                    error_msg = f"Error saving order {order.get('eo_number', 'unknown')}: {str(e)}"
                    results["error_details"].append(error_msg)
                    logger.error(f"❌ {error_msg}")
                    continue
        
        logger.info(f"💾 Saved {results['total_processed']} orders: {results['inserted']} new, {results['updated']} updated, {results['errors']} errors")
        return results
        
    except Exception as e:
        logger.error(f"❌ Critical error saving executive orders: {e}")
        results["errors"] = len(orders)
        results["error_details"].append(f"Critical database error: {str(e)}")
        return results

def get_executive_order_by_number(eo_number: str) -> Optional[Dict]:
    """Get a specific executive order by its number"""
    try:
        with get_db_cursor() as cursor:
            # Try different variations of the number
            cursor.execute(
                "SELECT * FROM dbo.executive_orders WHERE eo_number = ? OR document_number = ?",
                (eo_number, eo_number)
            )
            
            row = cursor.fetchone()
            if not row:
                # Try with wildcard
                cursor.execute(
                    "SELECT * FROM dbo.executive_orders WHERE eo_number LIKE ?",
                    (f"%{eo_number}%",)
                )
                row = cursor.fetchone()
            
            if row:
                # Convert to dictionary
                columns = [column[0] for column in cursor.description]
                result = dict(zip(columns, row))
                
                # Format dates
                for date_field in ['signing_date', 'publication_date', 'created_at', 'last_updated', 'last_scraped_at']:
                    if result.get(date_field) and hasattr(result[date_field], 'isoformat'):
                        result[date_field] = result[date_field].isoformat()
                
                return result
            
            return None
            
    except Exception as e:
        logger.error(f"❌ Error getting executive order by number {eo_number}: {e}")
        return None

def create_highlights_table():
    """Create the user highlights table if it doesn't exist"""
    try:
        with get_db_cursor() as cursor:
            # Check if table exists
            cursor.execute("""
                SELECT COUNT(*) 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_NAME = 'user_highlights' AND TABLE_SCHEMA = 'dbo'
            """)
            
            table_exists = cursor.fetchone()[0] > 0
            
            if not table_exists:
                logger.info("📊 Creating user_highlights table...")
                
                # Create the table
                cursor.execute("""
                    CREATE TABLE dbo.user_highlights (
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
                    )
                """)
                
                # Create indexes
                cursor.execute("CREATE INDEX idx_user_highlights_user_id ON dbo.user_highlights (user_id)")
                cursor.execute("CREATE INDEX idx_user_highlights_order_id ON dbo.user_highlights (order_id)")
                
                logger.info("✅ user_highlights table created successfully")
            else:
                logger.info("✅ user_highlights table already exists")
            
            return True
            
    except Exception as e:
        logger.error(f"❌ Error creating highlights table: {e}")
        return False

def add_highlight_direct(user_id: str, order_id: str, order_type: str, item_data: Dict = None) -> bool:
    """Add a highlight with full item data"""
    try:
        # Create table if needed
        create_highlights_table()
        
        with get_db_cursor() as cursor:
            # Check if highlight already exists
            cursor.execute("""
                SELECT id FROM dbo.user_highlights 
                WHERE user_id = ? AND order_id = ? AND order_type = ? AND is_archived = 0
            """, (user_id, order_id, order_type))
            
            existing = cursor.fetchone()
            
            if existing:
                logger.info(f"ℹ️ Highlight already exists for {order_id}")
                return True
            
            # Insert new highlight with item data
            insert_query = """
            INSERT INTO dbo.user_highlights (
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
            
            success = rows_affected > 0
            logger.info(f"{'✅' if success else '❌'} Add highlight result: {success} (rows affected: {rows_affected})")
            return success
            
    except Exception as e:
        logger.error(f"❌ Error adding highlight: {e}")
        return False

def remove_highlight_direct(user_id: str, order_id: str, order_type: str = None) -> bool:
    """Remove a highlight"""
    try:
        with get_db_cursor() as cursor:
            if order_type:
                delete_query = """
                DELETE FROM dbo.user_highlights 
                WHERE user_id = ? AND order_id = ? AND order_type = ?
                """
                cursor.execute(delete_query, (user_id, order_id, order_type))
            else:
                delete_query = """
                DELETE FROM dbo.user_highlights 
                WHERE user_id = ? AND order_id = ?
                """
                cursor.execute(delete_query, (user_id, order_id))
            
            rows_affected = cursor.rowcount
            
            success = rows_affected > 0
            logger.info(f"{'✅' if success else 'ℹ️'} Remove highlight result: {success} (rows affected: {rows_affected})")
            return success
            
    except Exception as e:
        logger.error(f"❌ Error removing highlight: {e}")
        return False

def get_user_highlights_direct(user_id: str) -> List[Dict]:
    """Get all highlights for a user"""
    try:
        # Create table if needed
        create_highlights_table()
        
        with get_db_cursor() as cursor:
            query = """
            SELECT order_id, order_type, title, description, ai_summary, category, 
                   state, signing_date, html_url, pdf_url, legiscan_url, 
                   highlighted_at, notes, priority_level, tags
            FROM dbo.user_highlights 
            WHERE user_id = ? AND is_archived = 0
            ORDER BY highlighted_at DESC
            """
            
            cursor.execute(query, (user_id,))
            
            # Get column names
            columns = [column[0] for column in cursor.description]
            
            # Fetch all results
            rows = cursor.fetchall()
            
            # Convert to dictionaries
            results = []
            for row in rows:
                # Convert row to dictionary
                result = dict(zip(columns, row))
                
                # Format dates
                if result.get('highlighted_at') and hasattr(result['highlighted_at'], 'isoformat'):
                    result['highlighted_at'] = result['highlighted_at'].isoformat()
                
                results.append(result)
            
            logger.info(f"✅ Retrieved {len(results)} highlights for user {user_id}")
            return results
            
    except Exception as e:
        logger.error(f"❌ Error getting user highlights: {e}")
        return []

def get_user_highlights_with_content(user_id: str) -> List[Dict]:
    """Get all highlights for a user with full content from joined tables"""
    try:
        # Convert user_id to int for database compatibility
        user_id_int = int(user_id)
        logger.info(f"🚀 Getting highlights with content for user {user_id} (converted to {user_id_int})")
        
        # Create table if needed
        create_highlights_table()
        
        with get_db_cursor() as cursor:
            # Use a UNION query to get all highlights with proper content from both tables
            query = """
            -- State legislation highlights with content from joined table
            SELECT 
                h.order_id, 
                h.order_type,
                COALESCE(s.title, 'State Legislation Bill #' + h.order_id) as title,
                COALESCE(s.description, 'This is a highlighted state legislation item with ID ' + h.order_id) as description,
                COALESCE(s.ai_summary, 'AI-generated summary for state legislation item ' + h.order_id) as ai_summary,
                COALESCE(s.ai_executive_summary, '') as ai_executive_summary,
                COALESCE(s.ai_key_points, '') as ai_key_points,
                COALESCE(s.ai_talking_points, '') as ai_talking_points,
                COALESCE(s.ai_business_impact, '') as ai_business_impact,
                COALESCE(s.ai_potential_impact, '') as ai_potential_impact,
                COALESCE(s.category, h.category, 'civic') as category,
                COALESCE(s.state, h.state, 'Unknown State') as state,
                COALESCE(s.state_abbr, '') as state_abbr,
                COALESCE(s.status, 'Active') as status,
                COALESCE(s.bill_number, 'SB-' + h.order_id) as bill_number,
                COALESCE(s.bill_type, 'bill') as bill_type,
                s.introduced_date,
                s.last_action_date,
                COALESCE(s.legiscan_url, h.legiscan_url, '') as legiscan_url,
                COALESCE(s.pdf_url, h.pdf_url, '') as pdf_url,
                COALESCE(s.reviewed, 0) as reviewed,
                h.highlighted_at,
                h.notes,
                h.priority_level,
                h.tags,
                CAST('' AS NVARCHAR(MAX)) as eo_number,
                CAST('' AS NVARCHAR(MAX)) as document_number,
                NULL as signing_date_eo,
                NULL as publication_date,
                CAST('' AS NVARCHAR(MAX)) as html_url,
                CAST('State Legislation' AS NVARCHAR(MAX)) as presidential_document_type
            FROM dbo.user_highlights h
            LEFT JOIN dbo.state_legislation s ON h.order_id = s.bill_id
            WHERE h.user_id = ? AND h.order_type = 'state_legislation' AND h.is_archived = 0
            
            UNION ALL
            
            -- Executive order highlights with content  
            SELECT 
                h.order_id,
                h.order_type,
                COALESCE(e.title, h.title, 'Untitled Executive Order') as title,
                COALESCE(e.summary, h.description, '') as description,
                COALESCE(e.ai_summary, h.ai_summary, '') as ai_summary,
                COALESCE(e.ai_executive_summary, '') as ai_executive_summary,
                COALESCE(e.ai_key_points, '') as ai_key_points,
                COALESCE(e.ai_talking_points, '') as ai_talking_points,
                COALESCE(e.ai_business_impact, '') as ai_business_impact,
                COALESCE(e.ai_potential_impact, '') as ai_potential_impact,
                COALESCE(e.category, h.category, 'civic') as category,
                '' as state,
                '' as state_abbr,
                '' as status,
                '' as bill_number,
                '' as bill_type,
                NULL as introduced_date,
                NULL as last_action_date,
                '' as legiscan_url,
                COALESCE(e.pdf_url, h.pdf_url, '') as pdf_url,
                COALESCE(e.reviewed, 0) as reviewed,
                h.highlighted_at,
                h.notes,
                h.priority_level,
                h.tags,
                COALESCE(e.eo_number, REPLACE(h.order_id, 'eo-', '')) as eo_number,
                COALESCE(e.document_number, '') as document_number,
                e.signing_date as signing_date_eo,
                e.publication_date,
                COALESCE(e.html_url, h.html_url, '') as html_url,
                COALESCE(e.presidential_document_type, 'Executive Order') as presidential_document_type
            FROM dbo.user_highlights h
            LEFT JOIN dbo.executive_orders e ON CAST(REPLACE(h.order_id, 'eo-', '') AS VARCHAR) = CAST(e.eo_number AS VARCHAR)
            WHERE h.user_id = ? AND h.order_type = 'executive_order' AND h.is_archived = 0
            
            ORDER BY highlighted_at DESC
            """
            
            cursor.execute(query, (user_id_int, user_id_int))
            columns = [column[0] for column in cursor.description]
            rows = cursor.fetchall()
            
            logger.info(f"🔍 Retrieved {len(rows)} highlights with UNION query from joined tables")
            
            results = []
            for row in rows:
                result = dict(zip(columns, row))
                
                # Format the result based on order_type
                if result['order_type'] == 'state_legislation':
                    # Use actual database content from the JOIN
                    formatted_result = {
                        'order_id': result['order_id'],
                        'order_type': 'state_legislation',
                        'title': result.get('title', ''),
                        'description': result.get('description', ''),
                        'ai_summary': result.get('ai_summary', ''),
                        'ai_executive_summary': result.get('ai_executive_summary', ''),
                        'ai_key_points': result.get('ai_key_points', ''),
                        'ai_talking_points': result.get('ai_talking_points', ''),
                        'ai_business_impact': result.get('ai_business_impact', ''),
                        'ai_potential_impact': result.get('ai_potential_impact', ''),
                        'category': result.get('category', ''),
                        'state': result.get('state', ''),
                        'state_abbr': result.get('state_abbr', ''),
                        'status': result.get('status', ''),
                        'bill_number': result.get('bill_number', ''),
                        'bill_type': result.get('bill_type', ''),
                        'introduced_date': result.get('introduced_date') if isinstance(result.get('introduced_date'), str) else (result.get('introduced_date').isoformat() if result.get('introduced_date') else None),
                        'last_action_date': result.get('last_action_date') if isinstance(result.get('last_action_date'), str) else (result.get('last_action_date').isoformat() if result.get('last_action_date') else None),
                        'legiscan_url': result.get('legiscan_url', ''),
                        'pdf_url': result.get('pdf_url', ''),
                        'reviewed': bool(result.get('reviewed', False)),
                        'highlighted_at': result.get('highlighted_at') if isinstance(result.get('highlighted_at'), str) else (result.get('highlighted_at').isoformat() if result.get('highlighted_at') else None),
                        'notes': result.get('notes') or '',
                        'priority_level': result.get('priority_level') or 'medium',
                        'tags': result.get('tags') or '',
                        'ai_processed': bool(result.get('ai_summary') or result.get('ai_executive_summary')),
                        'bill_id': result['order_id']  # Add bill_id for frontend compatibility
                    }
                    
                    # Debug: Check formatted result
                    if result['order_id'] == '1892657':
                        logger.info(f"🔍 Formatted result for 1892657: title='{formatted_result.get('title')}', state='{formatted_result.get('state')}'")
                        
                else:  # executive_order
                    formatted_result = {
                        'order_id': result['order_id'],
                        'order_type': 'executive_order',
                        'title': result['title'],
                        'description': result['description'],
                        'ai_summary': result['ai_summary'],
                        'ai_executive_summary': result['ai_executive_summary'],
                        'ai_key_points': result['ai_key_points'],
                        'ai_talking_points': result['ai_talking_points'],
                        'ai_business_impact': result['ai_business_impact'],
                        'ai_potential_impact': result['ai_potential_impact'],
                        'category': result['category'],
                        'eo_number': result['eo_number'],
                        'document_number': result['document_number'],
                        'executive_order_number': result['eo_number'],
                        'signing_date': result['signing_date_eo'] if isinstance(result['signing_date_eo'], str) else (result['signing_date_eo'].isoformat() if result['signing_date_eo'] else None),
                        'publication_date': result['publication_date'] if isinstance(result['publication_date'], str) else (result['publication_date'].isoformat() if result['publication_date'] else None),
                        'html_url': result['html_url'],
                        'pdf_url': result['pdf_url'],
                        'reviewed': bool(result['reviewed']),
                        'highlighted_at': result['highlighted_at'] if isinstance(result['highlighted_at'], str) else (result['highlighted_at'].isoformat() if result['highlighted_at'] else None),
                        'notes': result['notes'] or '',
                        'priority_level': result['priority_level'] or 'medium',
                        'tags': result['tags'] or '',
                        'ai_processed': bool(result['ai_summary'] or result['ai_executive_summary']),
                        'presidential_document_type': result['presidential_document_type']
                    }
                
                results.append(formatted_result)
            
            logger.info(f"✅ Retrieved {len(results)} highlights with full content for user {user_id}")
            logger.info(f"📊 Breakdown: {len([r for r in results if r['order_type'] == 'state_legislation'])} state legislation, {len([r for r in results if r['order_type'] == 'executive_order'])} executive orders")
            
            return results
            
    except Exception as e:
        logger.error(f"❌ Error getting user highlights with content: {e}")
        import traceback
        traceback.print_exc()
        return []
