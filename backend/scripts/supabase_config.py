"""
Supabase Database Configuration
Replace database_config.py with this after migration
"""

import os
from contextlib import contextmanager
from dotenv import load_dotenv

# Try psycopg2 first (more common), fall back to psycopg
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    PSYCOPG_VERSION = 2
except ImportError:
    import psycopg
    from psycopg.rows import dict_row
    PSYCOPG_VERSION = 3

load_dotenv(override=True)

def get_database_config():
    """Get Supabase database configuration from environment variables."""
    return {
        'host': os.getenv('SUPABASE_DB_HOST', 'db.xxxxxxxxxxxx.supabase.co'),
        'port': os.getenv('SUPABASE_DB_PORT', '5432'),
        'database': os.getenv('SUPABASE_DB_NAME', 'postgres'),
        'user': os.getenv('SUPABASE_DB_USER', 'postgres'),
        'password': os.getenv('SUPABASE_DB_PASSWORD', ''),
    }

def get_connection_string():
    """Build PostgreSQL connection string for Supabase."""
    config = get_database_config()
    return f"postgresql://{config['user']}:{config['password']}@{config['host']}:{config['port']}/{config['database']}"

@contextmanager
def get_db_connection():
    """
    Context manager for database connections.
    Compatible with existing code that uses:
        with get_db_connection() as conn:
            cursor = conn.cursor()
    """
    config = get_database_config()
    conn = None

    try:
        if PSYCOPG_VERSION == 2:
            conn = psycopg2.connect(
                host=config['host'],
                port=config['port'],
                database=config['database'],
                user=config['user'],
                password=config['password'],
                sslmode='require'
            )
        else:
            conn = psycopg.connect(
                host=config['host'],
                port=config['port'],
                dbname=config['database'],
                user=config['user'],
                password=config['password'],
                sslmode='require'
            )

        yield conn
        conn.commit()

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"❌ Database error: {e}")
        raise

    finally:
        if conn:
            conn.close()

@contextmanager
def get_dict_cursor(conn):
    """Get a cursor that returns dictionaries instead of tuples."""
    if PSYCOPG_VERSION == 2:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
    else:
        cursor = conn.cursor(row_factory=dict_row)

    try:
        yield cursor
    finally:
        cursor.close()

def test_database_connection():
    """Test the Supabase connection."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT version()")
            version = cursor.fetchone()[0]
            print(f"✅ Connected to Supabase PostgreSQL")
            print(f"   Version: {version[:50]}...")
            return True
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

# SQL syntax differences helper
class SQLHelper:
    """
    Helper to handle SQL syntax differences between SQL Server and PostgreSQL.
    Use these methods when writing queries to ensure compatibility.
    """

    @staticmethod
    def get_date():
        """Current timestamp - SQL Server: GETDATE(), PostgreSQL: CURRENT_TIMESTAMP"""
        return "CURRENT_TIMESTAMP"

    @staticmethod
    def top_n(n):
        """
        Limit results - SQL Server: SELECT TOP N, PostgreSQL: LIMIT N
        In PostgreSQL, add LIMIT at the end of query
        """
        return f"LIMIT {n}"

    @staticmethod
    def identity_insert(table, enabled):
        """
        PostgreSQL doesn't need SET IDENTITY_INSERT.
        For serial columns, either omit the column or use DEFAULT.
        """
        return ""  # No-op for PostgreSQL

    @staticmethod
    def string_concat(*args):
        """
        String concatenation - SQL Server: +, PostgreSQL: ||
        """
        return " || ".join(args)

    @staticmethod
    def isnull(expr, default):
        """
        Null handling - SQL Server: ISNULL(), PostgreSQL: COALESCE()
        """
        return f"COALESCE({expr}, {default})"

    @staticmethod
    def convert_bit_to_bool(value):
        """Convert SQL Server BIT (0/1) to PostgreSQL BOOLEAN."""
        if value is None:
            return None
        return bool(value)


if __name__ == "__main__":
    print("Testing Supabase connection...")
    test_database_connection()
