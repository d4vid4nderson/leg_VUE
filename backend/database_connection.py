# database_connection.py - Simplified connection handling with proper MSI/SQL Auth logic
import os
import pyodbc
import logging
from contextlib import contextmanager

logger = logging.getLogger(__name__)


def get_connection_string():
    """Get database connection string with proper environment detection"""
    
    # Check environment - only use Azure SQL in production
    environment = os.getenv('ENVIRONMENT', 'development').lower()
    is_container = bool(os.getenv("CONTAINER_APP_NAME") or os.getenv("MSI_ENDPOINT"))
    
    # Force local development to NOT use Azure SQL
    if environment == 'development' and not is_container:
        print("🔧 Development mode detected - refusing Azure SQL connection")
        print("💡 Consider using SQLite or PostgreSQL for local development")
        raise ValueError("❌ Development should not connect to production Azure SQL database. Please configure a local database.")
    
    server = os.getenv('AZURE_SQL_SERVER', 'sql-legislation-tracker.database.windows.net')
    database = os.getenv('AZURE_SQL_DATABASE', 'db-executiveorders')
    
    # Use MSI ONLY if we're actually in a container/Azure environment
    if is_container:
        print("🔐 Using MSI authentication (container detected)")
        connection_string = (
            "Driver={ODBC Driver 18 for SQL Server};"
            f"Server=tcp:{server},1433;"
            f"Database={database};"
            "Authentication=ActiveDirectoryMSI;"
            "Encrypt=yes;"
            "TrustServerCertificate=no;"
            "Connection Timeout=30;"
        )
    else:
        # Local development - MUST use SQL auth
        username = os.getenv('AZURE_SQL_USERNAME')
        password = os.getenv('AZURE_SQL_PASSWORD')
        
        if not username or not password:
            raise ValueError("❌ SQL credentials required for local development. Set AZURE_SQL_USERNAME and AZURE_SQL_PASSWORD in your .env file")
        
        print("🔑 Using SQL authentication (local development)")
        connection_string = (
            "Driver={ODBC Driver 18 for SQL Server};"
            f"Server=tcp:{server},1433;"
            f"Database={database};"
            f"UID={username};"
            f"PWD={password};"
            "Encrypt=yes;"
            "TrustServerCertificate=no;"
            "Connection Timeout=30;"
        ) 
    
    return connection_string

def get_database_connection():
    """Get a direct pyodbc database connection"""
    try:
        connection_string = get_connection_string()
        print(f"🔍 Attempting to connect with connection string prefix: {connection_string[:50]}...")
        
        # Add connection attempt logging
        is_container = bool(os.getenv("CONTAINER_APP_NAME") or os.getenv("MSI_ENDPOINT"))
        print(f"🔐 Environment detection: Container environment: {is_container}")
        print(f"🔐 MSI_ENDPOINT: {os.getenv('MSI_ENDPOINT', 'Not set')}")
        print(f"🔐 Server: {os.getenv('AZURE_SQL_SERVER', 'Default server')}")
        print(f"🔐 Database: {os.getenv('AZURE_SQL_DATABASE', 'Default database')}")
        
        # Try to connect with timeout and retry
        conn = pyodbc.connect(connection_string, timeout=30)
        
        # Explicitly set autocommit to False to ensure transactions work properly
        conn.autocommit = False
        print("✅ Database connection successful!")
        print(f"🔍 Autocommit setting: {conn.autocommit}")
        return conn
    except Exception as e:
        print(f"❌ Failed to get database connection: {e}")
        print(f"❌ Error type: {type(e).__name__}")
        print(f"❌ Connection string prefix: {connection_string[:50]}...")
        raise

@contextmanager
def get_db_cursor():
    """Context manager for database cursors with proper error handling"""
    conn = None
    cursor = None
    try:
        conn = get_database_connection()
        cursor = conn.cursor()
        yield cursor
        conn.commit()
    except Exception as e:
        logger.error(f"❌ Database error: {e}")
        if conn:
            conn.rollback()
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@contextmanager
def get_db_connection():
    """Context manager for database connections with proper error handling"""
    conn = None
    try:
        conn = get_database_connection()
        yield conn
        conn.commit()
    except Exception as e:
        logger.error(f"❌ Database error: {e}")
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()


def test_database_connection():
    """Test database connection"""
    try:
        # Print connection environment info
        is_container = bool(os.getenv("CONTAINER_APP_NAME") or os.getenv("MSI_ENDPOINT"))
        server = os.getenv('AZURE_SQL_SERVER', 'sql-legislation-tracker.database.windows.net')
        database = os.getenv('AZURE_SQL_DATABASE', 'db-executiveorders')
        
        print(f"🔍 Testing database connection:")
        print(f"   • Environment: {'Container/MSI' if is_container else 'Local/SQL Auth'}")
        print(f"   • Server: {server}")
        print(f"   • Database: {database}")
        print(f"   • MSI_ENDPOINT: {'Set' if os.getenv('MSI_ENDPOINT') else 'Not set'}")
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1 AS test_value")
            result = cursor.fetchone()
            cursor.close()
            
            if result and result[0] == 1:
                print("✅ Database connection successful")
                
                # Try to get current user for debugging
                try:
                    user_cursor = conn.cursor()
                    user_cursor.execute("SELECT CURRENT_USER, USER_NAME()")
                    user_info = user_cursor.fetchone()
                    print(f"✅ Connected as: CURRENT_USER={user_info[0]}, USER_NAME={user_info[1]}")
                    user_cursor.close()
                except Exception as user_error:
                    print(f"⚠️ Could not determine user: {user_error}")
                
                return True
            else:
                print("❌ Database test query failed")
                return False
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        print(f"❌ Error type: {type(e).__name__}")
        if "ActiveDirectoryMSI" in str(e):
            print("🔍 MSI authentication error - check system identity configuration")
        return False


def execute_query(query, params=None, fetch_one=False, fetch_all=False):
    """Execute a query and optionally fetch results"""
    try:
        with get_db_cursor() as cursor:
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            
            if fetch_one:
                return cursor.fetchone()
            elif fetch_all:
                return cursor.fetchall()
            else:
                return cursor.rowcount
    except Exception as e:
        logger.error(f"❌ Query execution failed: {e}")
        logger.error(f"Query: {query}")
        if params:
            logger.error(f"Params: {params}")
        raise

def execute_many(query, params_list):
    """Execute a query with multiple parameter sets"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.executemany(query, params_list)
            return cursor.rowcount
    except Exception as e:
        logger.error(f"❌ Bulk query execution failed: {e}")
        raise
