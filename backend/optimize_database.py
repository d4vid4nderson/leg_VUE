#!/usr/bin/env python3
"""
Database Performance Optimization Script
Run this to create indexes and optimize database performance
"""

import os
import sys
from database_config import get_db_connection
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_indexes():
    """Create performance optimization indexes"""
    
    indexes = [
        # Executive Orders Table Indexes
        {
            "name": "idx_executive_orders_date",
            "table": "dbo.executive_orders",
            "columns": "publication_date DESC, signing_date DESC",
            "description": "Index for date-based queries"
        },
        {
            "name": "idx_executive_orders_president_date",
            "table": "dbo.executive_orders",
            "columns": "president, publication_date DESC",
            "description": "Index for president + date queries"
        },
        {
            "name": "idx_executive_orders_category",
            "table": "dbo.executive_orders",
            "columns": "category",
            "description": "Index for category filtering"
        },
        {
            "name": "idx_executive_orders_eo_number",
            "table": "dbo.executive_orders",
            "columns": "eo_number",
            "description": "Index for EO number lookups"
        },
        {
            "name": "idx_executive_orders_lookup",
            "table": "dbo.executive_orders",
            "columns": "id, publication_date, president, category",
            "description": "Composite index for common query pattern"
        },
        
        # Highlights Table Indexes
        {
            "name": "idx_highlights_user_order",
            "table": "dbo.highlights",
            "columns": "user_id, order_id",
            "description": "Index for user + order lookups"
        },
        {
            "name": "idx_highlights_user_type",
            "table": "dbo.highlights",
            "columns": "user_id, item_type",
            "description": "Index for user + type lookups"
        },
        {
            "name": "idx_highlights_user",
            "table": "dbo.highlights",
            "columns": "user_id, created_at DESC",
            "description": "Index for finding all highlights for a user"
        },
        {
            "name": "idx_highlights_existence",
            "table": "dbo.highlights",
            "columns": "user_id, order_id, item_type",
            "description": "Composite index for highlight existence checks"
        }
    ]
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        created_count = 0
        skipped_count = 0
        
        for index in indexes:
            try:
                # Check if index already exists
                cursor.execute("""
                    SELECT COUNT(*) 
                    FROM sys.indexes 
                    WHERE name = ? AND object_id = OBJECT_ID(?)
                """, (index['name'], index['table']))
                
                exists = cursor.fetchone()[0] > 0
                
                if not exists:
                    # Create the index
                    sql = f"CREATE INDEX {index['name']} ON {index['table']}({index['columns']})"
                    logger.info(f"Creating index: {index['name']} - {index['description']}")
                    cursor.execute(sql)
                    conn.commit()
                    created_count += 1
                    logger.info(f"✅ Created index: {index['name']}")
                else:
                    skipped_count += 1
                    logger.info(f"⏭️  Index already exists: {index['name']}")
                    
            except Exception as e:
                logger.error(f"❌ Error creating index {index['name']}: {e}")
                continue
        
        # Create full-text catalog and index if not exists
        try:
            # Check if full-text catalog exists
            cursor.execute("SELECT COUNT(*) FROM sys.fulltext_catalogs WHERE name = 'ft_executive_orders'")
            if cursor.fetchone()[0] == 0:
                logger.info("Creating full-text catalog...")
                cursor.execute("CREATE FULLTEXT CATALOG ft_executive_orders AS DEFAULT")
                conn.commit()
                logger.info("✅ Created full-text catalog")
            
            # Check if full-text index exists
            cursor.execute("""
                SELECT COUNT(*) 
                FROM sys.fulltext_indexes 
                WHERE object_id = OBJECT_ID('dbo.executive_orders')
            """)
            if cursor.fetchone()[0] == 0:
                logger.info("Creating full-text index...")
                cursor.execute("""
                    CREATE FULLTEXT INDEX ON dbo.executive_orders(title, summary) 
                    KEY INDEX PK_executive_orders
                """)
                conn.commit()
                logger.info("✅ Created full-text index")
                
        except Exception as e:
            logger.warning(f"⚠️  Could not create full-text index: {e}")
        
        # Update statistics
        logger.info("Updating table statistics...")
        cursor.execute("UPDATE STATISTICS dbo.executive_orders")
        cursor.execute("UPDATE STATISTICS dbo.highlights")
        conn.commit()
        logger.info("✅ Updated statistics")
        
        # Display summary
        logger.info(f"\n🎯 Optimization Summary:")
        logger.info(f"   - Indexes created: {created_count}")
        logger.info(f"   - Indexes skipped (already exist): {skipped_count}")
        logger.info(f"   - Statistics updated")
        
        # Show current indexes
        cursor.execute("""
            SELECT 
                t.name AS TableName,
                i.name AS IndexName,
                i.type_desc AS IndexType
            FROM sys.indexes i
            JOIN sys.tables t ON i.object_id = t.object_id
            WHERE t.name IN ('executive_orders', 'highlights')
            AND i.type > 0
            ORDER BY t.name, i.name
        """)
        
        logger.info("\n📊 Current Indexes:")
        for row in cursor.fetchall():
            logger.info(f"   - {row.TableName}.{row.IndexName} ({row.IndexType})")
        
        cursor.close()
        conn.close()
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Database optimization failed: {e}")
        return False

def check_query_performance():
    """Test query performance with and without indexes"""
    
    test_queries = [
        {
            "name": "Executive Orders by Date",
            "query": """
                SELECT TOP 20 eo_number, title, publication_date 
                FROM dbo.executive_orders 
                ORDER BY publication_date DESC
            """
        },
        {
            "name": "Executive Orders with Category Filter",
            "query": """
                SELECT COUNT(*) 
                FROM dbo.executive_orders 
                WHERE category = 'policy'
            """
        },
        {
            "name": "User Highlights Check",
            "query": """
                SELECT order_id 
                FROM dbo.highlights 
                WHERE user_id = 1
            """
        }
    ]
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        logger.info("\n🔍 Testing Query Performance:")
        
        for test in test_queries:
            # Enable statistics
            cursor.execute("SET STATISTICS TIME ON")
            cursor.execute("SET STATISTICS IO ON")
            
            # Run query
            cursor.execute(test['query'])
            results = cursor.fetchall()
            
            logger.info(f"\n   {test['name']}:")
            logger.info(f"   - Returned {len(results)} rows")
            
        cursor.close()
        conn.close()
        
    except Exception as e:
        logger.error(f"❌ Performance test failed: {e}")

if __name__ == "__main__":
    logger.info("🚀 Starting Database Performance Optimization")
    logger.info("=" * 50)
    
    # Run optimization
    if create_indexes():
        logger.info("\n✅ Database optimization completed successfully!")
        
        # Test performance
        check_query_performance()
    else:
        logger.error("\n❌ Database optimization failed!")
        sys.exit(1)