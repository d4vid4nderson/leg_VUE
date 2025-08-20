# executive_orders_db.py - Fixed version using direct pyodbc
import os
import logging
from datetime import datetime
from typing import Dict, List, Optional
import json

# Import our direct database connection - NOT USED, keeping for reference
# from database_connection import execute_query, execute_many
# from database_connection import get_db_connection as get_old_db_connection

# Import new multi-database support
from database_config import get_db_connection, get_database_config
from contextlib import contextmanager

@contextmanager
def get_db_cursor():
    """Context manager for database cursors using new multi-database connection"""
    with get_db_connection() as conn:
        cursor = None
        try:
            cursor = conn.cursor()
            yield cursor
            conn.commit()
        except Exception as e:
            logger.error(f"❌ Database error: {e}")
            conn.rollback()
            raise
        finally:
            if cursor:
                cursor.close()

logger = logging.getLogger(__name__)

def get_parameter_placeholder():
    """Get the correct parameter placeholder for the database"""
    config = get_database_config()
    if config['type'] == 'postgresql':
        return '%s'
    else:
        return '?'

def get_database_specific_queries():
    """Get database-specific SQL queries based on current configuration"""
    config = get_database_config()
    db_type = config['type']
    
    if db_type == 'postgresql':
        return {
            'check_table': """
                SELECT COUNT(*) 
                FROM information_schema.tables 
                WHERE table_name = 'executive_orders' AND table_schema = 'public'
            """,
            'create_table': """
                CREATE TABLE IF NOT EXISTS executive_orders (
                    id SERIAL PRIMARY KEY,
                    document_number VARCHAR(100) NOT NULL,
                    eo_number VARCHAR(50),
                    title TEXT NOT NULL,
                    summary TEXT,
                    signing_date DATE,
                    publication_date DATE,
                    citation VARCHAR(255),
                    presidential_document_type VARCHAR(100),
                    category VARCHAR(100),
                    html_url TEXT,
                    pdf_url TEXT,
                    trump_2025_url TEXT,
                    ai_summary TEXT,
                    ai_executive_summary TEXT,
                    ai_key_points TEXT,
                    ai_talking_points TEXT,
                    ai_business_impact TEXT,
                    ai_potential_impact TEXT,
                    ai_version VARCHAR(50),
                    source VARCHAR(255),
                    raw_data_available BOOLEAN DEFAULT true,
                    processing_status VARCHAR(50) DEFAULT 'completed',
                    error_message TEXT,
                    content TEXT,
                    tags TEXT,
                    ai_analysis TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT uq_document_number UNIQUE (document_number)
                )
            """,
            'get_columns': """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'executive_orders' AND table_schema = 'public'
                ORDER BY ordinal_position
            """,
            'create_indexes': [
                "CREATE INDEX IF NOT EXISTS idx_eo_number ON executive_orders (eo_number)",
                "CREATE INDEX IF NOT EXISTS idx_category ON executive_orders (category)",
                "CREATE INDEX IF NOT EXISTS idx_signing_date ON executive_orders (signing_date)"
            ]
        }
    else:  # azure_sql
        return {
            'check_table': """
                SELECT COUNT(*) 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_NAME = 'executive_orders' AND TABLE_SCHEMA = 'dbo'
            """,
            'create_table': """
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
            """,
            'get_columns': """
                SELECT COLUMN_NAME
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = 'executive_orders' AND TABLE_SCHEMA = 'dbo'
                ORDER BY ORDINAL_POSITION
            """,
            'create_indexes': [
                "CREATE INDEX idx_eo_number ON dbo.executive_orders (eo_number)",
                "CREATE INDEX idx_category ON dbo.executive_orders (category)",
                "CREATE INDEX idx_signing_date ON dbo.executive_orders (signing_date)"
            ]
        }

def check_executive_orders_table():
    """Check if the executive_orders table exists and create it if needed - database agnostic"""
    try:
        config = get_database_config()
        queries = get_database_specific_queries()
        print(f"🗄️ Using database: {config['description']}")
        
        # Check if table exists using new database connection
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(queries['check_table'])
            table_exists = cursor.fetchone()[0] > 0
            
            if not table_exists:
                logger.warning("⚠️ executive_orders table doesn't exist, creating...")
                
                # Create the table
                cursor.execute(queries['create_table'])
                logger.info("✅ executive_orders table created successfully")
                
                # Create indexes for better performance
                for index_query in queries['create_indexes']:
                    cursor.execute(index_query)
                logger.info("✅ Indexes created for executive_orders table")
                
                conn.commit()
                return True, []
                
            # Get column information
            cursor.execute(queries['get_columns'])
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
        
        # Get database-specific table name
        config = get_database_config()
        if config['type'] == 'postgresql':
            table_name = "executive_orders"
        else:
            table_name = "dbo.executive_orders"
        
        # Build query
        base_query = f"""
        SELECT 
            id, document_number, eo_number, title, summary, 
            signing_date, publication_date, citation, presidential_document_type, category,
            html_url, pdf_url, trump_2025_url, 
            ai_summary, ai_executive_summary, ai_key_points, ai_talking_points, 
            ai_business_impact, ai_potential_impact, ai_version,
            source, raw_data_available, processing_status, error_message,
            created_at, last_updated, last_scraped_at, tags
        FROM {table_name}
        """
        
        # Add WHERE clause for filters
        where_conditions = []
        params = []
        placeholder = get_parameter_placeholder()
        
        if filters:
            if filters.get('category'):
                where_conditions.append(f"category = {placeholder}")
                params.append(filters['category'])
                
            if filters.get('search'):
                search_term = f"%{filters['search']}%"
                where_conditions.append(f"(title LIKE {placeholder} OR summary LIKE {placeholder} OR ai_summary LIKE {placeholder})")
                params.extend([search_term, search_term, search_term])
        
        if where_conditions:
            base_query += " WHERE " + " AND ".join(where_conditions)
        
        # Add ORDER BY
        base_query += " ORDER BY signing_date DESC, eo_number DESC"
        
        # Get database-specific queries
        queries = get_database_specific_queries()
        config = get_database_config()
        
        # Count total matching records
        if config['type'] == 'postgresql':
            table_name = "executive_orders"
            count_query = f"SELECT COUNT(*) FROM {table_name}"
        else:
            table_name = "dbo.executive_orders"
            count_query = f"SELECT COUNT(*) FROM {table_name}"
            
        if where_conditions:
            count_query += " WHERE " + " AND ".join(where_conditions)
            
        with get_db_cursor() as cursor:
            if params:
                cursor.execute(count_query, params)
            else:
                cursor.execute(count_query)
            total_count = cursor.fetchone()[0]
        
        # Add pagination - database specific
        if config['type'] == 'postgresql':
            base_query += f" LIMIT {limit} OFFSET {offset}"
        else:
            base_query += f" OFFSET {offset} ROWS FETCH NEXT {limit} ROWS ONLY"
        
        # Execute the query
        with get_db_connection() as conn:
            cursor = conn.cursor()
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
                    
                    # Check if order exists - database agnostic
                    config = get_database_config()
                    table_name = "executive_orders" if config['type'] == 'postgresql' else "dbo.executive_orders"
                    placeholder = get_parameter_placeholder()
                    
                    cursor.execute(
                        f"SELECT id FROM {table_name} WHERE document_number = {placeholder} OR eo_number = {placeholder}", 
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
                                update_fields.append(f"{key} = {placeholder}")
                                params.append(value)
                        
                        # Add timestamp
                        update_fields.append(f"last_updated = {placeholder}")
                        params.append(datetime.now())
                        
                        # Add WHERE clause parameter
                        params.append(document_number)
                        
                        # Execute update - database agnostic
                        update_sql = f"UPDATE {table_name} SET {', '.join(update_fields)} WHERE document_number = {placeholder}"
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
                        
                        # Mark new orders as "new" for frontend notifications
                        if 'is_new' not in insert_fields:
                            insert_fields.append('is_new')
                            params.append(True)
                        
                        # Execute insert - database agnostic
                        placeholders = ', '.join([placeholder] * len(insert_fields))
                        insert_sql = f"INSERT INTO {table_name} ({', '.join(insert_fields)}) VALUES ({placeholders})"
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
        config = get_database_config()
        table_name = "executive_orders" if config['type'] == 'postgresql' else "dbo.executive_orders"
        placeholder = get_parameter_placeholder()
        
        logger.info(f"🔍 Searching for executive order with ID: {eo_number}")
        logger.info(f"🔍 Using table: {table_name}, placeholder: {placeholder}")
        
        with get_db_cursor() as cursor:
            # Try exact matches first
            queries_to_try = [
                # Exact matches
                (f"SELECT * FROM {table_name} WHERE eo_number = {placeholder}", (eo_number,)),
                (f"SELECT * FROM {table_name} WHERE document_number = {placeholder}", (eo_number,)),
                (f"SELECT * FROM {table_name} WHERE CAST(id AS VARCHAR) = {placeholder}", (eo_number,)),
                # With EO prefix
                (f"SELECT * FROM {table_name} WHERE eo_number = {placeholder}", (f"EO-{eo_number}",)),
                (f"SELECT * FROM {table_name} WHERE document_number = {placeholder}", (f"EO-{eo_number}",)),
                # Wildcard searches
                (f"SELECT * FROM {table_name} WHERE eo_number LIKE {placeholder}", (f"%{eo_number}%",)),
                (f"SELECT * FROM {table_name} WHERE document_number LIKE {placeholder}", (f"%{eo_number}%",)),
                (f"SELECT * FROM {table_name} WHERE title LIKE {placeholder}", (f"%{eo_number}%",)),
            ]
            
            for i, (query, params) in enumerate(queries_to_try):
                try:
                    logger.info(f"🔎 Trying query {i+1}: {query} with params {params}")
                    cursor.execute(query, params)
                    row = cursor.fetchone()
                    if row:
                        logger.info(f"✅ Found order with query {i+1}")
                        break
                except Exception as query_error:
                    logger.warning(f"⚠️ Query {i+1} failed: {query_error}")
                    continue
            
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
    """Create the user highlights table if it doesn't exist - database agnostic"""
    try:
        config = get_database_config()
        
        with get_db_cursor() as cursor:
            # Check if table exists - database agnostic
            if config['type'] == 'postgresql':
                check_query = """
                    SELECT COUNT(*) 
                    FROM information_schema.tables 
                    WHERE table_name = 'user_highlights' AND table_schema = 'public'
                """
                table_name = "user_highlights"
            else:
                check_query = """
                    SELECT COUNT(*) 
                    FROM INFORMATION_SCHEMA.TABLES 
                    WHERE TABLE_NAME = 'user_highlights' AND TABLE_SCHEMA = 'dbo'
                """
                table_name = "dbo.user_highlights"
            
            cursor.execute(check_query)
            table_exists = cursor.fetchone()[0] > 0
            
            if not table_exists:
                logger.info("📊 Creating user_highlights table...")
                
                # Create the table - database specific
                if config['type'] == 'postgresql':
                    create_query = f"""
                        CREATE TABLE {table_name} (
                            id SERIAL PRIMARY KEY,
                            user_id VARCHAR(50) NOT NULL,
                            order_id VARCHAR(100) NOT NULL,
                            order_type VARCHAR(50) NOT NULL,
                            title TEXT,
                            description TEXT,
                            ai_summary TEXT,
                            category VARCHAR(50),
                            state VARCHAR(50),
                            signing_date VARCHAR(50),
                            html_url VARCHAR(500),
                            pdf_url VARCHAR(500),
                            legiscan_url VARCHAR(500),
                            highlighted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            notes TEXT,
                            priority_level INT DEFAULT 1,
                            tags TEXT,
                            is_archived BOOLEAN DEFAULT false,
                            CONSTRAINT uq_user_highlight UNIQUE (user_id, order_id, order_type)
                        )
                    """
                    index_queries = [
                        f"CREATE INDEX idx_user_highlights_user_id ON {table_name} (user_id)",
                        f"CREATE INDEX idx_user_highlights_order_id ON {table_name} (order_id)"
                    ]
                else:
                    create_query = f"""
                        CREATE TABLE {table_name} (
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
                    """
                    index_queries = [
                        f"CREATE INDEX idx_user_highlights_user_id ON {table_name} (user_id)",
                        f"CREATE INDEX idx_user_highlights_order_id ON {table_name} (order_id)"
                    ]
                
                cursor.execute(create_query)
                
                # Create indexes
                for index_query in index_queries:
                    cursor.execute(index_query)
                
                logger.info("✅ user_highlights table created successfully")
            else:
                logger.info("✅ user_highlights table already exists")
            
            return True
            
    except Exception as e:
        logger.error(f"❌ Error creating highlights table: {e}")
        return False

def add_highlight_direct(user_id: str, order_id: str, order_type: str, item_data: Dict = None) -> bool:
    """Add a highlight with full item data - database agnostic"""
    try:
        # Create table if needed
        create_highlights_table()
        
        config = get_database_config()
        table_name = "user_highlights" if config['type'] == 'postgresql' else "dbo.user_highlights"
        placeholder = get_parameter_placeholder()
        
        with get_db_cursor() as cursor:
            # Check if highlight already exists
            check_query = f"""
                SELECT id FROM {table_name} 
                WHERE user_id = {placeholder} AND order_id = {placeholder} AND order_type = {placeholder} AND is_archived = {placeholder}
            """
            is_archived_value = False if config['type'] == 'postgresql' else 0
            cursor.execute(check_query, (user_id, order_id, order_type, is_archived_value))
            
            existing = cursor.fetchone()
            
            if existing:
                logger.info(f"ℹ️ Highlight already exists for {order_id}")
                return True
            
            # Insert new highlight with item data
            placeholders = ', '.join([placeholder] * 16)
            insert_query = f"""
            INSERT INTO {table_name} (
                user_id, order_id, order_type, title, description, ai_summary, 
                category, state, signing_date, html_url, pdf_url, legiscan_url,
                notes, priority_level, tags, is_archived
            ) VALUES ({placeholders})
            """
            
            # Prepare values with proper defaults
            is_archived_value = False if config['type'] == 'postgresql' else 0
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
                is_archived_value
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
    """Remove a highlight - database agnostic"""
    try:
        config = get_database_config()
        table_name = "user_highlights" if config['type'] == 'postgresql' else "dbo.user_highlights"
        placeholder = get_parameter_placeholder()
        
        with get_db_cursor() as cursor:
            if order_type:
                delete_query = f"""
                DELETE FROM {table_name} 
                WHERE user_id = {placeholder} AND order_id = {placeholder} AND order_type = {placeholder}
                """
                cursor.execute(delete_query, (user_id, order_id, order_type))
            else:
                delete_query = f"""
                DELETE FROM {table_name} 
                WHERE user_id = {placeholder} AND order_id = {placeholder}
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
    """Get all highlights for a user - database agnostic"""
    try:
        # Create table if needed
        create_highlights_table()
        
        config = get_database_config()
        table_name = "user_highlights" if config['type'] == 'postgresql' else "dbo.user_highlights"
        placeholder = get_parameter_placeholder()
        
        with get_db_cursor() as cursor:
            query = f"""
            SELECT order_id, order_type, title, description, ai_summary, category, 
                   state, signing_date, html_url, pdf_url, legiscan_url, 
                   highlighted_at, notes, priority_level, tags
            FROM {table_name} 
            WHERE user_id = {placeholder} AND is_archived = {placeholder}
            ORDER BY highlighted_at DESC
            """
            
            cursor.execute(query, (user_id, False if config['type'] == 'postgresql' else 0))
            
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
                COALESCE(s.category, h.category, 'not-applicable') as category,
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
                COALESCE(e.category, h.category, 'not-applicable') as category,
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
