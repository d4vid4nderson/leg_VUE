#!/usr/bin/env python3
"""
Import CSV data into Supabase PostgreSQL database.
Run this after creating tables with supabase_schema.sql

Usage:
    python import_to_supabase.py

Environment variables required:
    SUPABASE_DB_HOST - Database host (e.g., db.xxxx.supabase.co)
    SUPABASE_DB_PASSWORD - Database password
"""

import os
import csv
import sys
from datetime import datetime

# Try psycopg2 first
try:
    import psycopg2
    from psycopg2 import sql
    DRIVER = 'psycopg2'
except ImportError:
    print("Installing psycopg2-binary...")
    os.system('pip install psycopg2-binary')
    import psycopg2
    from psycopg2 import sql
    DRIVER = 'psycopg2'

from dotenv import load_dotenv
load_dotenv()

# Configuration
EXPORTS_DIR = os.path.join(os.path.dirname(__file__), '..', 'exports')

# Tables to import in order (respecting foreign key dependencies)
TABLES_TO_IMPORT = [
    'executive_orders',
    'state_legislation',
    'user_profiles',
    'user_highlights',
    'page_views',
    'user_activity_events',
]

def get_connection():
    """Get Supabase PostgreSQL connection."""
    host = os.getenv('SUPABASE_DB_HOST')
    password = os.getenv('SUPABASE_DB_PASSWORD')

    if not host or not password:
        print("\n❌ Missing Supabase credentials!")
        print("Please set these environment variables:")
        print("  export SUPABASE_DB_HOST='db.xxxxxxxxxxxx.supabase.co'")
        print("  export SUPABASE_DB_PASSWORD='your-database-password'")
        print("\nOr add them to your .env file")
        sys.exit(1)

    try:
        conn = psycopg2.connect(
            host=host,
            port=5432,
            database='postgres',
            user='postgres',
            password=password,
            sslmode='require'
        )
        return conn
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        sys.exit(1)

def clean_value(value, column_name=None):
    """Clean and convert values for PostgreSQL."""
    if value is None or value == '' or value == 'None':
        return None

    # Handle boolean columns
    bool_columns = ['raw_data_available', 'reviewed', 'is_new', 'is_archived', 'is_active']
    if column_name and column_name.lower() in bool_columns:
        if value in ('True', 'true', '1', 1, True):
            return True
        elif value in ('False', 'false', '0', 0, False):
            return False
        return None

    # Handle integer columns
    int_columns = ['id', 'user_id', 'priority_level', 'login_count', 'duration_seconds']
    if column_name and column_name.lower() in int_columns:
        try:
            return int(float(value))
        except (ValueError, TypeError):
            return None

    return value

def import_table(conn, table_name):
    """Import a single table from CSV."""
    csv_file = os.path.join(EXPORTS_DIR, f'{table_name}.csv')

    if not os.path.exists(csv_file):
        print(f"  ⚠️ CSV file not found: {csv_file}")
        return 0

    cursor = conn.cursor()
    imported = 0
    errors = 0

    try:
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            columns = reader.fieldnames

            if not columns:
                print(f"  ⚠️ No columns found in {csv_file}")
                return 0

            # Skip the 'id' column for tables with SERIAL primary key
            insert_columns = [c for c in columns if c.lower() != 'id' or table_name == 'user_profiles']

            # Build INSERT statement
            placeholders = ', '.join(['%s'] * len(insert_columns))
            column_list = ', '.join([f'"{c}"' for c in insert_columns])

            insert_sql = f'INSERT INTO {table_name} ({column_list}) VALUES ({placeholders})'

            # For tables with unique constraints, use ON CONFLICT
            if table_name == 'state_legislation':
                insert_sql += ' ON CONFLICT (bill_id) DO NOTHING'
            elif table_name == 'user_profiles':
                insert_sql += ' ON CONFLICT (user_id) DO NOTHING'
            elif table_name == 'user_highlights':
                insert_sql += ' ON CONFLICT (user_id, order_id, order_type) DO NOTHING'

            for row in reader:
                try:
                    values = [clean_value(row.get(col), col) for col in insert_columns]
                    cursor.execute(insert_sql, values)
                    imported += 1
                except Exception as e:
                    errors += 1
                    if errors <= 3:  # Only show first few errors
                        print(f"    Error: {str(e)[:100]}")

            conn.commit()

    except Exception as e:
        print(f"  ❌ Error reading {csv_file}: {e}")
        conn.rollback()
        return 0

    finally:
        cursor.close()

    if errors > 0:
        print(f"  ⚠️ {errors} rows had errors")

    return imported

def verify_import(conn, table_name):
    """Verify row count in imported table."""
    cursor = conn.cursor()
    try:
        cursor.execute(f'SELECT COUNT(*) FROM {table_name}')
        count = cursor.fetchone()[0]
        return count
    except Exception as e:
        print(f"  ❌ Error verifying {table_name}: {e}")
        return 0
    finally:
        cursor.close()

def main():
    print("=" * 60)
    print("🚀 Supabase Data Import Tool")
    print("=" * 60)

    # Check exports directory
    if not os.path.exists(EXPORTS_DIR):
        print(f"\n❌ Exports directory not found: {EXPORTS_DIR}")
        print("Run export_azure_data.py first to export your data.")
        sys.exit(1)

    print(f"\n📁 Exports directory: {os.path.abspath(EXPORTS_DIR)}")

    # Connect to Supabase
    print("\n🔌 Connecting to Supabase...")
    conn = get_connection()
    print("✅ Connected successfully!")

    # Import each table
    print("\n📥 Importing tables...")
    results = {}

    for table in TABLES_TO_IMPORT:
        print(f"\n📊 Importing {table}...")
        imported = import_table(conn, table)
        db_count = verify_import(conn, table)
        results[table] = {'imported': imported, 'total': db_count}
        print(f"  ✅ Imported {imported} rows, total in DB: {db_count}")

    # Summary
    print("\n" + "=" * 60)
    print("📋 IMPORT SUMMARY")
    print("=" * 60)
    print(f"{'Table':<25} {'Imported':>10} {'Total in DB':>12}")
    print("-" * 50)

    total_imported = 0
    total_in_db = 0
    for table, counts in results.items():
        print(f"{table:<25} {counts['imported']:>10} {counts['total']:>12}")
        total_imported += counts['imported']
        total_in_db += counts['total']

    print("-" * 50)
    print(f"{'TOTAL':<25} {total_imported:>10} {total_in_db:>12}")
    print("=" * 60)

    # Close connection
    conn.close()
    print("\n✅ Import complete!")

    print("\n📋 Next steps:")
    print("1. Verify data in Supabase Dashboard → Table Editor")
    print("2. Update your backend .env with Supabase credentials")
    print("3. Replace database_config.py with supabase_config.py")
    print("4. Test your application")

if __name__ == "__main__":
    main()
