#!/usr/bin/env python3
"""
Database troubleshooting script for executive orders
Usage: python troubleshoot_db.py
"""

import os
import sys

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from database_connection import get_db_cursor, test_database_connection
except ImportError as e:
    print(f"❌ Cannot import database modules: {e}")
    sys.exit(1)

def test_connection():
    """Test basic database connectivity"""
    print("🔍 Testing database connection...")
    try:
        success = test_database_connection()
        print(f"✅ Connection: {'SUCCESS' if success else 'FAILED'}")
        return success
    except Exception as e:
        print(f"❌ Connection error: {e}")
        return False

def analyze_schema():
    """Analyze the executive_orders table"""
    print("\n🔍 Analyzing table schema...")
    
    try:
        with get_db_cursor() as cursor:
            # Check table exists
            cursor.execute("""
                SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_NAME = 'executive_orders' AND TABLE_SCHEMA = 'dbo'
            """)
            exists = cursor.fetchone()[0] > 0
            print(f"📊 Table exists: {'✅ YES' if exists else '❌ NO'}")
            
            if not exists:
                return False
            
            # Get columns
            cursor.execute("""
                SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = 'executive_orders' AND TABLE_SCHEMA = 'dbo'
                ORDER BY ORDINAL_POSITION
            """)
            
            columns = cursor.fetchall()
            print(f"\n📋 Columns ({len(columns)} total):")
            
            column_names = []
            for col in columns:
                name, dtype, nullable = col
                null_info = "NULL" if nullable == "YES" else "NOT NULL"
                print(f"   • {name:<25} {dtype:<15} {null_info}")
                column_names.append(name.lower())
            
            # Check problematic columns
            print(f"\n🔍 Column Analysis:")
            checks = [
                ('id', 'Primary key'),
                ('eo_number', 'EO identifier'),
                ('title', 'Order title'),
                ('president', 'President name (problematic)')
            ]
            
            for col, desc in checks:
                exists = col in column_names
                status = "✅ EXISTS" if exists else "❌ MISSING"
                note = " (GOOD - this was causing errors)" if col == 'president' and not exists else ""
                print(f"   {col:<15} {status:<10} {desc}{note}")
            
            # Get record count
            cursor.execute("SELECT COUNT(*) FROM dbo.executive_orders")
            count = cursor.fetchone()[0]
            print(f"\n📊 Total records: {count}")
            
            return True
            
    except Exception as e:
        print(f"❌ Schema analysis failed: {e}")
        return False

def test_queries():
    """Test various queries"""
    print("\n🧪 Testing queries...")
    
    queries = [
        ("Count all", "SELECT COUNT(*) FROM dbo.executive_orders"),
        ("Recent orders", "SELECT TOP 3 eo_number, title FROM dbo.executive_orders ORDER BY signing_date DESC"),
        ("By document type", "SELECT presidential_document_type, COUNT(*) FROM dbo.executive_orders GROUP BY presidential_document_type"),
    ]
    
    try:
        with get_db_cursor() as cursor:
            for name, query in queries:
                print(f"\n🔍 {name}:")
                try:
                    cursor.execute(query)
                    result = cursor.fetchall()
                    print(f"   ✅ Success: {len(result)} rows")
                    if len(result) <= 3:
                        for row in result:
                            print(f"      {row}")
                except Exception as e:
                    print(f"   ❌ Failed: {e}")
                    
    except Exception as e:
        print(f"❌ Query testing failed: {e}")

def main():
    print("🚀 Executive Orders Database Troubleshooter")
    print("=" * 50)
    
    if not test_connection():
        print("\n❌ Cannot proceed without database connection")
        return
    
    if not analyze_schema():
        print("\n❌ Schema analysis failed")
        return
    
    test_queries()
    
    print("\n" + "=" * 50)
    print("✅ Troubleshooting complete!")

if __name__ == "__main__":
    main()