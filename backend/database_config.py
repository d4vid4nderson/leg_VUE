# database_config.py - Supabase PostgreSQL database configuration
import os
import logging
import psycopg2
from contextlib import contextmanager
from dotenv import load_dotenv

# Load environment variables
load_dotenv(override=True)

logger = logging.getLogger(__name__)

def get_database_config():
    """Get Supabase database configuration from environment variables"""
    host = os.getenv('SUPABASE_DB_HOST')
    password = os.getenv('SUPABASE_DB_PASSWORD')

    if not host or not password:
        raise ValueError(
            "❌ Supabase credentials required. Set SUPABASE_DB_HOST and SUPABASE_DB_PASSWORD in .env"
        )

    return {
        'type': 'postgresql',
        'host': host,
        'port': os.getenv('SUPABASE_DB_PORT', '5432'),
        'database': os.getenv('SUPABASE_DB_NAME', 'postgres'),
        'user': os.getenv('SUPABASE_DB_USER', 'postgres'),
        'password': password,
        'description': f'Supabase PostgreSQL ({host})'
    }

@contextmanager
def get_db_connection():
    """Get database connection context manager for Supabase PostgreSQL"""
    config = get_database_config()

    conn = None
    try:
        conn = psycopg2.connect(
            host=config['host'],
            port=config['port'],
            database=config['database'],
            user=config['user'],
            password=config['password'],
            sslmode='require'
        )
        conn.autocommit = False

        yield conn

        # Commit the transaction
        if conn:
            conn.commit()

    except Exception as e:
        logger.error(f"❌ Database connection error: {e}")
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()

def test_database_connection():
    """Test database connection and return info"""
    try:
        config = get_database_config()
        print(f"🔍 Testing connection to: {config['description']}")

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT version()")
            result = cursor.fetchone()
            print(f"✅ Connected to Supabase PostgreSQL")
            print(f"   Version: {result[0][:60]}...")

            # Check table counts
            cursor.execute("""
                SELECT 'executive_orders' as tbl, COUNT(*) FROM executive_orders
                UNION ALL SELECT 'state_legislation', COUNT(*) FROM state_legislation
                UNION ALL SELECT 'user_highlights', COUNT(*) FROM user_highlights
            """)
            print("\n📊 Table row counts:")
            for row in cursor.fetchall():
                print(f"   {row[0]}: {row[1]} rows")

            cursor.close()

        return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False

if __name__ == "__main__":
    test_database_connection()