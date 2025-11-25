#!/usr/bin/env python3
"""
Export Azure SQL data to CSV files for Supabase migration.
Run this from the backend directory: python scripts/export_azure_data.py
"""

import os
import csv
import json
from datetime import datetime, date
from database_config import get_db_connection

# Output directory for CSV exports
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'exports')

def ensure_output_dir():
    """Create exports directory if it doesn't exist."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"📁 Export directory: {os.path.abspath(OUTPUT_DIR)}")

def serialize_value(val):
    """Convert values to JSON-serializable format."""
    if val is None:
        return None
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    if isinstance(val, bytes):
        return val.decode('utf-8', errors='replace')
    return val

def export_table(table_name, query=None):
    """Export a table to CSV file."""
    if query is None:
        query = f"SELECT * FROM dbo.{table_name}"

    output_file = os.path.join(OUTPUT_DIR, f"{table_name}.csv")

    print(f"\n📊 Exporting {table_name}...")

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query)

            # Get column names
            columns = [column[0] for column in cursor.description]

            # Fetch all rows
            rows = cursor.fetchall()

            print(f"   Found {len(rows)} rows, {len(columns)} columns")

            # Write to CSV
            with open(output_file, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow(columns)

                for row in rows:
                    serialized_row = [serialize_value(val) for val in row]
                    writer.writerow(serialized_row)

            print(f"   ✅ Exported to {output_file}")
            return len(rows)

    except Exception as e:
        print(f"   ❌ Error exporting {table_name}: {e}")
        return 0

def export_table_schema(table_name):
    """Export table schema information."""
    query = f"""
    SELECT
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE,
        COLUMN_DEFAULT
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = '{table_name}' AND TABLE_SCHEMA = 'dbo'
    ORDER BY ORDINAL_POSITION
    """

    output_file = os.path.join(OUTPUT_DIR, f"{table_name}_schema.csv")

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query)

            columns = [column[0] for column in cursor.description]
            rows = cursor.fetchall()

            with open(output_file, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow(columns)
                for row in rows:
                    writer.writerow([serialize_value(val) for val in row])

            print(f"   📋 Schema exported to {output_file}")

    except Exception as e:
        print(f"   ❌ Error exporting schema for {table_name}: {e}")

def generate_supabase_schema():
    """Generate PostgreSQL CREATE TABLE statements for Supabase."""

    # Type mapping from SQL Server to PostgreSQL
    type_map = {
        'int': 'INTEGER',
        'bigint': 'BIGINT',
        'smallint': 'SMALLINT',
        'tinyint': 'SMALLINT',
        'bit': 'BOOLEAN',
        'decimal': 'DECIMAL',
        'numeric': 'NUMERIC',
        'float': 'DOUBLE PRECISION',
        'real': 'REAL',
        'money': 'DECIMAL(19,4)',
        'date': 'DATE',
        'datetime': 'TIMESTAMP',
        'datetime2': 'TIMESTAMP',
        'time': 'TIME',
        'char': 'CHAR',
        'varchar': 'VARCHAR',
        'nchar': 'CHAR',
        'nvarchar': 'VARCHAR',
        'text': 'TEXT',
        'ntext': 'TEXT',
        'uniqueidentifier': 'UUID',
    }

    tables = ['executive_orders', 'state_legislation', 'user_highlights',
              'legislative_sessions', 'page_views', 'user_profiles', 'user_activity_events']

    output_file = os.path.join(OUTPUT_DIR, 'supabase_schema.sql')

    print(f"\n🔧 Generating Supabase schema...")

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("-- Supabase PostgreSQL Schema\n")
        f.write("-- Generated from Azure SQL Server\n")
        f.write(f"-- Date: {datetime.now().isoformat()}\n\n")

        for table_name in tables:
            try:
                with get_db_connection() as conn:
                    cursor = conn.cursor()

                    # Get column info
                    cursor.execute(f"""
                        SELECT
                            c.COLUMN_NAME,
                            c.DATA_TYPE,
                            c.CHARACTER_MAXIMUM_LENGTH,
                            c.IS_NULLABLE,
                            c.COLUMN_DEFAULT,
                            CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as IS_PRIMARY_KEY,
                            COLUMNPROPERTY(OBJECT_ID('dbo.{table_name}'), c.COLUMN_NAME, 'IsIdentity') as IS_IDENTITY
                        FROM INFORMATION_SCHEMA.COLUMNS c
                        LEFT JOIN (
                            SELECT ku.COLUMN_NAME
                            FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                            JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
                                ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
                            WHERE tc.TABLE_NAME = '{table_name}'
                            AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
                        ) pk ON c.COLUMN_NAME = pk.COLUMN_NAME
                        WHERE c.TABLE_NAME = '{table_name}' AND c.TABLE_SCHEMA = 'dbo'
                        ORDER BY c.ORDINAL_POSITION
                    """)

                    columns = cursor.fetchall()

                    if not columns:
                        print(f"   ⚠️ Table {table_name} not found or empty")
                        continue

                    f.write(f"-- Table: {table_name}\n")
                    f.write(f"CREATE TABLE IF NOT EXISTS {table_name} (\n")

                    col_defs = []
                    for col in columns:
                        col_name, data_type, max_len, nullable, default, is_pk, is_identity = col

                        # Map data type
                        pg_type = type_map.get(data_type.lower(), 'TEXT')

                        # Handle varchar length
                        if data_type.lower() in ('varchar', 'nvarchar', 'char', 'nchar'):
                            if max_len == -1 or max_len is None or max_len > 10485760:
                                pg_type = 'TEXT'
                            else:
                                pg_type = f'VARCHAR({max_len})'

                        # Build column definition
                        col_def = f"    {col_name} "

                        if is_identity:
                            col_def += "SERIAL"
                        else:
                            col_def += pg_type

                        if is_pk:
                            col_def += " PRIMARY KEY"
                        elif nullable == 'NO':
                            col_def += " NOT NULL"

                        # Handle defaults
                        if default and not is_identity:
                            if 'getdate()' in str(default).lower():
                                col_def += " DEFAULT CURRENT_TIMESTAMP"
                            elif default == '((0))':
                                col_def += " DEFAULT 0"
                            elif default == '((1))':
                                col_def += " DEFAULT 1"

                        col_defs.append(col_def)

                    f.write(',\n'.join(col_defs))
                    f.write("\n);\n\n")

                    print(f"   ✅ Generated schema for {table_name}")

            except Exception as e:
                print(f"   ❌ Error generating schema for {table_name}: {e}")
                f.write(f"-- Error generating {table_name}: {e}\n\n")

    print(f"\n📄 Schema file: {output_file}")

def main():
    print("=" * 60)
    print("🚀 Azure SQL to Supabase Export Tool")
    print("=" * 60)

    ensure_output_dir()

    # Tables to export
    tables = [
        'executive_orders',
        'state_legislation',
        'user_highlights',
        'legislative_sessions',
        'page_views',
        'user_profiles',
        'user_activity_events'
    ]

    total_rows = 0

    # Export each table
    for table in tables:
        rows = export_table(table)
        total_rows += rows
        export_table_schema(table)

    # Generate Supabase-compatible schema
    generate_supabase_schema()

    print("\n" + "=" * 60)
    print(f"✅ Export complete! Total rows: {total_rows}")
    print(f"📁 Files saved to: {os.path.abspath(OUTPUT_DIR)}")
    print("=" * 60)

    print("\n📋 Next steps:")
    print("1. Review the generated supabase_schema.sql")
    print("2. Create tables in Supabase using the SQL Editor")
    print("3. Import CSV files using Supabase Table Editor or CLI")
    print("4. Update your backend to use Supabase connection")

if __name__ == "__main__":
    main()
