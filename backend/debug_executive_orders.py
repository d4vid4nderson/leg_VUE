# simple_db_test.py - Quick test of database connection
import pyodbc
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_connection():
    """Test basic database connection"""
    try:
        # Your credentials from .env
        server = os.getenv('AZURE_SQL_SERVER')  # sql-legislation-tracker.database.windows.net
        database = os.getenv('AZURE_SQL_DATABASE')  # db-executiveorders
        username = os.getenv('AZURE_SQL_USERNAME')  
        password = os.getenv('AZURE_SQL_PASSWORD')  
        
        print(f"🔍 Connecting to:")
        print(f"   Server: {server}")
        print(f"   Database: {database}")
        print(f"   Username: {username}")
        print(f"   Password: {'*' * len(password) if password else 'NOT SET'}")
        
        # Build connection string
        connection_string = (
            f"Driver={{ODBC Driver 18 for SQL Server}};"
            f"Server={server};"
            f"Database={database};"
            f"UID={username};"
            f"PWD={password};"
            f"Encrypt=yes;"
            f"TrustServerCertificate=yes;"
            f"Connection Timeout=30;"
        )
        
        print(f"\n🔗 Attempting connection...")
        conn = pyodbc.connect(connection_string)
        print("✅ Database connection successful!")
        
        # Test basic query
        cursor = conn.cursor()
        cursor.execute("SELECT @@VERSION")
        version = cursor.fetchone()[0]
        print(f"📊 SQL Server Version: {version[:100]}...")
        
        # Check if executive_orders table exists
        cursor.execute("""
            SELECT COUNT(*) 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'executive_orders' AND TABLE_SCHEMA = 'dbo'
        """)
        
        table_exists = cursor.fetchone()[0] > 0
        print(f"📊 dbo.executive_orders table exists: {'✅ YES' if table_exists else '❌ NO'}")
        
        if table_exists:
            # Get record count
            cursor.execute("SELECT COUNT(*) FROM dbo.executive_orders")
            count = cursor.fetchone()[0]
            print(f"📊 Records in executive_orders: {count}")
            
            # Show table structure
            cursor.execute("""
                SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = 'executive_orders' AND TABLE_SCHEMA = 'dbo'
                ORDER BY ORDINAL_POSITION
            """)
            
            columns = cursor.fetchall()
            print(f"\n📋 Table Structure ({len(columns)} columns):")
            for col in columns:
                length_info = f"({col[3]})" if col[3] else ""
                print(f"   {col[0]}: {col[1]}{length_info}")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Simple Database Connection Test")
    print("=" * 50)
    test_connection()
