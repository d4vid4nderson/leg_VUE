# database_connection.py - Simplified connection handling with proper MSI/SQL Auth logic
import os
import pyodbc
import logging
from contextlib import contextmanager

logger = logging.getLogger(__name__)


def get_connection_string():
    """Get database connection string with container-based detection for MSI"""
    
    # Check for container environment indicators
    is_container = bool(os.getenv("CONTAINER_APP_NAME") or os.getenv("MSI_ENDPOINT"))
    
    server = os.getenv('AZURE_SQL_SERVER', 'sql-legislation-tracker.database.windows.net')
    database = os.getenv('AZURE_SQL_DATABASE', 'db-executiveorders')
    
    # Use MSI if we're in a container (Azure), SQL Auth otherwise
    if is_container:
        logger.info("🔐 Using MSI authentication (container detected)")
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
        # Local development - use SQL auth
        username = os.getenv('AZURE_SQL_USERNAME')
        password = os.getenv('AZURE_SQL_PASSWORD')
        
        logger.info(f"🔑 Using SQL authentication (local development)")
        if all([username, password]):
            logger.info("🔑 Using SQL authentication for development")
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
        else:
            logger.error("❌ Missing SQL credentials for local development")
            raise ValueError("SQL credentials required in local development")
    
    logger.info(f"🔌 Connecting to database: {connection_string[:50]}...")
    return connection_string


def get_db_connection():
    """Get a database connection directly - NOT as a context manager"""
    try:
        # Determine environment
        is_container = bool(os.getenv("CONTAINER_APP_NAME") or os.getenv("MSI_ENDPOINT"))
        
        logger.info(f"🔍 Attempting to connect with connection string prefix: Driver={{ODBC Driver 18 for SQL Server}};Server=tcp:...")
        logger.info(f"🔍 Environment detection: Container environment: {is_container}")
        
        server = os.getenv('AZURE_SQL_SERVER', 'sql-legislation-tracker.database.windows.net')
        database = os.getenv('AZURE_SQL_DATABASE', 'db-executiveorders')
        
        if is_container:
            # For container environment, use MSI authentication
            logger.info(f"🔍 Using MSI authentication (container detected)")
            logger.info(f"🔍 MSI_ENDPOINT: {os.getenv('MSI_ENDPOINT')}")
            logger.info(f"🔍 Server: {server or 'Default server'}")
            logger.info(f"🔍 Database: {database or 'Default database'}")
            
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
            # For development, use SQL authentication
            username = os.getenv('AZURE_SQL_USERNAME')
            password = os.getenv('AZURE_SQL_PASSWORD')
            
            if not all([server, database, username, password]):
                logger.error("❌ Missing database credentials")
                return None
                
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
            logger.info("🔍 Using SQL authentication for development")
            
        conn = pyodbc.connect(connection_string)
        logger.info("✅ Database connection successful!")
        return conn
        
    except Exception as e:
        logger.error(f"❌ Database connection error: {e}")
        return None


# Use different name to avoid confusion with the non-context manager function
def get_database_connection():
    """Get a direct database connection - alias for get_db_connection"""
    return get_db_connection()


@contextmanager
def get_db_cursor():
    """Context manager for database cursors with proper error handling"""
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        if not conn:
            raise Exception("Failed to establish database connection")
        cursor = conn.cursor()
        yield cursor
        conn.commit()
    except Exception as e:
        logger.error(f"❌ Database error: {e}")
        if conn:
            try:
                conn.rollback()
            except:
                pass
        raise
    finally:
        if cursor:
            try:
                cursor.close()
            except:
                pass
        if conn:
            try:
                conn.close()
            except:
                pass

@contextmanager
def get_connection():
    """Context manager for database connections with proper error handling"""
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            raise Exception("Failed to establish database connection")
        yield conn
        conn.commit()
    except Exception as e:
        logger.error(f"❌ Database error: {e}")
        if conn:
            try:
                conn.rollback()
            except:
                pass
        raise
    finally:
        if conn:
            try:
                conn.close()
            except:
                pass


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
        
        # Get direct connection, not through context manager
        conn = get_db_connection()
        if not conn:
            print("❌ Could not establish database connection")
            return False
            
        cursor = conn.cursor()
        cursor.execute("SELECT 1 AS test_value")
        result = cursor.fetchone()
        
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
            
            cursor.close()
            conn.close()
            return True
        else:
            print("❌ Database test query failed")
            cursor.close()
            conn.close()
            return False
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        print(f"❌ Error type: {type(e).__name__}")
        if "ActiveDirectoryMSI" in str(e):
            print("🔍 MSI authentication error - check system identity configuration")
        return False


def execute_query(query, params=None, fetch_one=False, fetch_all=False):
    """Execute a query and optionally fetch results"""
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        if not conn:
            raise Exception("Failed to establish database connection")
        
        cursor = conn.cursor()
        
        if params:
            cursor.execute(query, params)
        else:
            cursor.execute(query)
        
        if fetch_one:
            result = cursor.fetchone()
        elif fetch_all:
            result = cursor.fetchall()
        else:
            result = cursor.rowcount
            
        conn.commit()
        return result
    except Exception as e:
        logger.error(f"❌ Query execution failed: {e}")
        logger.error(f"Query: {query}")
        if params:
            logger.error(f"Params: {params}")
        if conn:
            try:
                conn.rollback()
            except:
                pass
        raise
    finally:
        if cursor:
            try:
                cursor.close()
            except:
                pass
        if conn:
            try:
                conn.close()
            except:
                pass

def execute_many(query, params_list):
    """Execute a query with multiple parameter sets"""
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        if not conn:
            raise Exception("Failed to establish database connection")
            
        cursor = conn.cursor()
        cursor.executemany(query, params_list)
        result = cursor.rowcount
        conn.commit()
        return result
    except Exception as e:
        logger.error(f"❌ Bulk query execution failed: {e}")
        if conn:
            try:
                conn.rollback()
            except:
                pass
        raise
    finally:
        if cursor:
            try:
                cursor.close()
            except:
                pass
        if conn:
            try:
                conn.close()
            except:
                pass
