# direct_db.py
import pyodbc
import logging
from contextlib import contextmanager

logger = logging.getLogger(__name__)

def get_connection_string(server, database):
    """Get pyodbc connection string with MSI authentication"""
    conn_str = (
        "Driver={ODBC Driver 18 for SQL Server};"
        f"Server=tcp:{server},1433;"
        f"Database={database};"
        "Authentication=ActiveDirectoryMSI;"
        "Encrypt=yes;"
        "TrustServerCertificate=no;"
        "Connection Timeout=30;"
    )
    return conn_str

def get_sql_auth_connection_string(server, database, username, password):
    """Get pyodbc connection string with SQL authentication"""
    conn_str = (
        "Driver={ODBC Driver 18 for SQL Server};"
        f"Server=tcp:{server},1433;"
        f"Database={database};"
        f"UID={username};"
        f"PWD={password};"
        "Encrypt=yes;"
        "TrustServerCertificate=no;"
        "Connection Timeout=30;"
    )
    return conn_str

@contextmanager
def get_db_connection(server, database, use_msi=True, username=None, password=None):
    """Context manager for database connections"""
    conn = None
    try:
        if use_msi:
            conn_str = get_connection_string(server, database)
            logger.info("Using MSI authentication for database connection")
        else:
            conn_str = get_sql_auth_connection_string(server, database, username, password)
            logger.info("Using SQL authentication for database connection")
        
        conn = pyodbc.connect(conn_str, timeout=30)
        yield conn
        
    except Exception as e:
        logger.error(f"Database connection error: {e}")
        if conn:
            conn.close()
        raise
    finally:
        if conn:
            conn.close()

@contextmanager
def get_db_cursor(server, database, use_msi=True, username=None, password=None):
    """Context manager for database cursors"""
    with get_db_connection(server, database, use_msi, username, password) as conn:
        cursor = conn.cursor()
        try:
            yield cursor
            conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f"Database query error: {e}")
            raise
        finally:
            cursor.close()

def test_connection(server, database):
    """Test database connection"""
    try:
        with get_db_cursor(server, database) as cursor:
            cursor.execute("SELECT 1 AS test_value")
            result = cursor.fetchone()
            return result and result[0] == 1
    except Exception as e:
        logger.error(f"Connection test failed: {e}")
        return False
