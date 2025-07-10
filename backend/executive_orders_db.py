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
                # Create the table WITH reviewed column
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
                        reviewed BIT DEFAULT 0,
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
                cursor.execute("CREATE INDEX idx_reviewed ON dbo.executive_orders (reviewed)")
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
            
            # Check if reviewed column exists, add it if missing
            if 'reviewed' not in columns:
                logger.info("🔧 Adding missing reviewed column...")
                cursor.execute("ALTER TABLE dbo.executive_orders ADD reviewed BIT DEFAULT 0")
                cursor.execute("CREATE INDEX idx_reviewed ON dbo.executive_orders (reviewed)")
                logger.info("✅ Added reviewed column")
            
            return True, columns
            
    except Exception as e:
        logger.error(f"❌ Error checking executive_orders table: {e}")
        return False, []



def get_executive_orders_from_db(limit=100, offset=0, filters=None):
    """Get executive orders from database with filters and pagination - FIXED for direct connection"""
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
            created_at, last_updated, last_scraped_at, tags, reviewed
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
                where_conditions.append("(title LIKE ? OR summary LIKE ? OR ai_summary LIKE ?)")
                search_term = f"%{filters['search']}%"
                params.extend([search_term, search_term, search_term])
        
        if where_conditions:
            base_query += " WHERE " + " AND ".join(where_conditions)
        
        # Add ORDER BY
        base_query += " ORDER BY signing_date DESC, eo_number DESC"
        
        # Count total matching records
        count_query = f"SELECT COUNT(*) FROM dbo.executive_orders"
        if where_conditions:
            count_query += " WHERE " + " AND ".join(where_conditions)
        
        # Get direct connection - NOT using context manager
        conn = get_db_connection()
        if not conn:
            logger.error("❌ Failed to establish database connection")
            return {'success': False, 'message': 'Database connection failed', 'results': [], 'count': 0}
            
        cursor = conn.cursor()
        
        # Execute count query
        if params:
            cursor.execute(count_query, params)
        else:
            cursor.execute(count_query)
        total_count = cursor.fetchone()[0]
        logger.info(f"📊 Total matching records: {total_count}")
        
        # FIXED: Only add pagination if limit is specified
        if limit is not None and limit > 0:
            logger.info(f"📄 Applying pagination: OFFSET {offset} ROWS FETCH NEXT {limit} ROWS ONLY")
            base_query += f" OFFSET {offset} ROWS FETCH NEXT {limit} ROWS ONLY"
        else:
            logger.info(f"🔓 No limit specified - fetching ALL {total_count} records")
        
        # Execute the main query
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
        
        # Close cursor and connection
        cursor.close()
        conn.close()
        
        logger.info(f"✅ Retrieved {len(results)} executive orders from database")
        
        # Calculate pagination info
        if limit is not None and limit > 0:
            total_pages = max(1, (total_count + limit - 1) // limit)  # Ceiling division
            current_page = (offset // limit) + 1 if limit > 0 else 1
            has_more = (offset + len(results) < total_count)
        else:
            total_pages = 1
            current_page = 1 
            has_more = False
        
        return {
            'success': True,
            'results': results,
            'count': len(results),
            'total': total_count,
            'total_count': total_count,  # Add this for consistency
            'total_pages': total_pages,
            'current_page': current_page,
            'has_more': has_more
        }
        
    except Exception as e:
        logger.error(f"❌ Error getting executive orders: {e}")
        import traceback
        traceback.print_exc()
        return {
            'success': False,
            'message': str(e),
            'results': [],
            'count': 0,
            'total': 0
        }


def save_executive_orders_to_db(orders: List[Dict]) -> Dict:
    """Save executive orders to database - FIXED direct connection handling with reviewed column"""
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
        
        # Get direct connection - NOT using context manager
        conn = get_db_connection()
        if not conn:
            logger.error("❌ Failed to establish database connection")
            results["error_details"].append("Database connection failed")
            return results
            
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
                    
                    # Only add last_updated if it wasn't already in the data
                    if 'last_updated' not in order:
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
                    
                    # Add default reviewed value if not provided
                    if 'reviewed' not in order and 'reviewed' not in insert_fields:
                        insert_fields.append('reviewed')
                        params.append(False)  # Default to not reviewed
                    
                    # Add timestamps if not provided
                    current_time = datetime.now()
                    
                    if 'created_at' not in order and 'created_at' not in insert_fields:
                        insert_fields.append('created_at')
                        params.append(current_time)
                        
                    if 'last_updated' not in order and 'last_updated' not in insert_fields:
                        insert_fields.append('last_updated')
                        params.append(current_time)
                    
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
        
        # Commit the transaction and close connection
        conn.commit()
        cursor.close()
        conn.close()
        
        logger.info(f"💾 Saved {results['total_processed']} orders: {results['inserted']} new, {results['updated']} updated, {results['errors']} errors")
        return results
        
    except Exception as e:
        logger.error(f"❌ Critical error saving executive orders: {e}")
        import traceback
        traceback.print_exc()
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
    
def update_executive_order_review_status(eo_id: str, reviewed: bool) -> Dict:
    """Update the review status for a specific executive order"""
    conn = None
    cursor = None
    try:
        # Use get_database_connection directly instead of the context manager
        from database_connection import get_database_connection
        
        conn = get_database_connection()
        cursor = conn.cursor()
        
        # Update the review status
        # Only compare with id column if the value is numeric
        update_query = """
            UPDATE dbo.executive_orders 
            SET reviewed = ?, last_updated = ? 
            WHERE eo_number = ? OR document_number = ?
        """
        
        cursor.execute(update_query, [
            reviewed, 
            datetime.now(), 
            eo_id, 
            eo_id
        ])
        
        rows_affected = cursor.rowcount
        conn.commit()
        
        if rows_affected > 0:
            logger.info(f"✅ Updated review status for EO {eo_id} to {reviewed}")
            return {
                "success": True,
                "message": f"Review status updated to {reviewed}",
                "rows_affected": rows_affected
            }
        else:
            logger.warning(f"⚠️ No rows updated for EO {eo_id}")
            return {
                "success": False,
                "message": f"Executive order {eo_id} not found",
                "rows_affected": 0
            }
                
    except Exception as e:
        logger.error(f"❌ Error updating review status for EO {eo_id}: {e}")
        if conn:
            conn.rollback()
        return {
            "success": False,
            "message": f"Database error: {str(e)}",
            "rows_affected": 0
        }
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

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

def update_executive_order_category_in_db(eo_number: str, category: str) -> bool:
    """Update the category for a specific executive order - FIXED direct connection handling"""
    try:
        # Get direct connection - NOT using context manager
        conn = get_db_connection()
        if not conn:
            logger.error("❌ Failed to establish database connection")
            return False
            
        cursor = conn.cursor()
        
        # Update the category
        update_query = """
            UPDATE dbo.executive_orders 
            SET category = ?, last_updated = ? 
            WHERE eo_number = ? OR document_number = ?
        """
        
        cursor.execute(update_query, [
            category, 
            datetime.now(), 
            eo_number, 
            eo_number
        ])
        
        rows_affected = cursor.rowcount
        conn.commit()
        
        # Close cursor and connection
        cursor.close()
        conn.close()
        
        if rows_affected > 0:
            logger.info(f"✅ Updated category for EO {eo_number} to {category}")
            return True
        else:
            logger.warning(f"⚠️ No rows updated for EO {eo_number}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Error updating category for EO {eo_number}: {e}")
        import traceback
        traceback.print_exc()
        return False

# Alternative fix if you're using a different connection pattern:
def get_database_count_alternative():
    """Alternative version if using direct connection"""
    try:
        conn = get_db_connection()  # Get connection directly
        if conn is None:
            return 0
            
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM dbo.executive_orders")
        count = cursor.fetchone()[0]
        conn.close()  # Don't forget to close
        return count
    except Exception as e:
        logger.error(f"❌ Error getting database count: {e}")
        return 0

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
