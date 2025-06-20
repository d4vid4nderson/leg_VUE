# database_connection.py - Simplified connection handling with proper MSI/SQL Auth logic
import os
import pyodbc
import logging
from contextlib import contextmanager

logger = logging.getLogger(__name__)


def get_connection_string():
    """Get database connection string with environment-based authentication"""
    environment = os.getenv("ENVIRONMENT", "development")
    logger.info(f"🔍 Environment: {environment}")
    
    server = os.getenv('AZURE_SQL_SERVER', 'sql-legislation-tracker.database.windows.net')
    database = os.getenv('AZURE_SQL_DATABASE', 'db-executiveorders')
    
    # Use MSI in production, SQL Auth in development
    if environment == "production":
        logger.info("🔐 Using MSI authentication for database connection")
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
        # Development - use SQL auth
        username = os.getenv('AZURE_SQL_USERNAME')
        password = os.getenv('AZURE_SQL_PASSWORD')
        
        # Debug print to see actual values
        logger.info(f"🔑 DEBUG: AZURE_SQL_USERNAME = '{username}'")
        logger.info(f"🔑 DEBUG: AZURE_SQL_PASSWORD length = {len(password) if password else 0}")
        logger.info(f"DEBUG: ENVIRONMENT = '{environment}'")
        
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
            logger.error("❌ Missing SQL credentials for development mode")
            raise ValueError("SQL credentials required in development mode")
    
    logger.info(f"🔌 Connecting to database: {connection_string[:50]}...")
    return connection_string

def get_database_connection():
    """Get a direct pyodbc database connection"""
    try:
        connection_string = get_connection_string()
        return pyodbc.connect(connection_string, timeout=30)
    except Exception as e:
        logger.error(f"❌ Failed to get database connection: {e}")
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
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1 AS test_value")
            result = cursor.fetchone()
            cursor.close()
            
            if result and result[0] == 1:
                logger.info("✅ Database connection successful")
                return True
            else:
                logger.error("❌ Database test query failed")
                return False
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")
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
