# database_config.py - Simple multi-database support using direct connections
import os
import logging
import psycopg2
import pyodbc
from contextlib import contextmanager

logger = logging.getLogger(__name__)

def get_database_config():
    """Get database configuration based on environment"""
    environment = os.getenv('ENVIRONMENT', 'development').lower()
    is_container = bool(os.getenv("CONTAINER_APP_NAME") or os.getenv("MSI_ENDPOINT"))
    
    if environment == 'development' and not is_container:
        # Development - Also use Azure SQL
        server = os.getenv('AZURE_SQL_SERVER', 'sql-legislation-tracker.database.windows.net')
        database = os.getenv('AZURE_SQL_DATABASE', 'db-executiveorders')
        username = os.getenv('AZURE_SQL_USERNAME')
        password = os.getenv('AZURE_SQL_PASSWORD')
        
        if not username or not password:
            raise ValueError("❌ SQL credentials required for Azure SQL. Set AZURE_SQL_USERNAME and AZURE_SQL_PASSWORD")
        
        return {
            'type': 'azure_sql',
            'server': server,
            'database': database,
            'username': username,
            'password': password,
            'description': 'Azure SQL Server (Development)'
        }
    else:
        # Production - Use Azure SQL with MSI authentication
        server = os.getenv('AZURE_SQL_SERVER', 'sql-legislation-tracker.database.windows.net')
        database = os.getenv('AZURE_SQL_DATABASE', 'db-executiveorders')
        
        return {
            'type': 'azure_sql',
            'server': server,
            'database': database,
            'username': None,  # Not needed for MSI authentication
            'password': None,  # Not needed for MSI authentication
            'description': 'Azure SQL Server (Production with MSI)'
        }

@contextmanager
def get_db_connection():
    """Get database connection context manager"""
    config = get_database_config()
    print(f"🗄️ Using database: {config['description']}")

    conn = None
    try:
        if config['type'] == 'postgresql':
            # PostgreSQL connection
            conn = psycopg2.connect(
                host=config['host'],
                port=config['port'],
                database=config['database'],
                user=config['user'],
                password=config['password']
            )
            conn.autocommit = False
            print("✅ PostgreSQL connection established")
        else:
            # Azure SQL connection using pyodbc
            # Check if SQL credentials are explicitly provided (even in container)
            username = os.getenv('AZURE_SQL_USERNAME')
            password = os.getenv('AZURE_SQL_PASSWORD')
            is_container = bool(os.getenv("CONTAINER_APP_NAME") or os.getenv("MSI_ENDPOINT"))

            if username and password:
                # Use SQL authentication when credentials are provided
                connection_string = (
                    "Driver={ODBC Driver 18 for SQL Server};"
                    f"Server=tcp:{config['server']},1433;"
                    f"Database={config['database']};"
                    f"UID={username};"
                    f"PWD={password};"
                    "Encrypt=yes;"
                    "TrustServerCertificate=no;"
                    "Connection Timeout=30;"
                )
                print("🔑 Using SQL authentication")
            elif is_container:
                # Use MSI authentication in production when no credentials provided
                connection_string = (
                    "Driver={ODBC Driver 18 for SQL Server};"
                    f"Server=tcp:{config['server']},1433;"
                    f"Database={config['database']};"
                    "Authentication=ActiveDirectoryMSI;"
                    "Encrypt=yes;"
                    "TrustServerCertificate=no;"
                    "Connection Timeout=30;"
                )
                print("🔐 Using MSI authentication")
            else:
                raise ValueError("❌ No database credentials found. Set AZURE_SQL_USERNAME and AZURE_SQL_PASSWORD or configure MSI")

            conn = pyodbc.connect(connection_string, timeout=30)
            conn.autocommit = False
        
        yield conn
        
        # Commit the transaction - this is critical for PostgreSQL
        if conn:
            conn.commit()
            print("✅ Transaction committed successfully")
        
    except Exception as e:
        logger.error(f"❌ Database connection error: {e}")
        if conn:
            print("🔄 Rolling back transaction due to error")
            conn.rollback()
        raise
    finally:
        if conn:
            print("🔒 Closing database connection")
            conn.close()

def test_database_connection():
    """Test database connection and return info"""
    try:
        config = get_database_config()
        print(f"🔍 Testing connection to: {config['description']}")
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            if config['type'] == 'postgresql':
                cursor.execute("SELECT version()")
                result = cursor.fetchone()
                print(f"✅ PostgreSQL connected: {result[0][:50]}...")
            else:
                cursor.execute("SELECT @@version")
                result = cursor.fetchone()
                print(f"✅ Azure SQL connected: {result[0][:50]}...")
            
            cursor.close()
        
        return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False

if __name__ == "__main__":
    test_database_connection()