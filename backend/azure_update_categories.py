#!/usr/bin/env python3
"""
Update civic categories to not-applicable in Azure SQL
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

try:
    import pyodbc
    
    # Get Azure SQL credentials
    server = os.getenv('AZURE_SQL_SERVER', 'sql-legislation-tracker.database.windows.net')
    database = os.getenv('AZURE_SQL_DATABASE', 'db-executiveorders')
    username = os.getenv('AZURE_SQL_USERNAME')
    password = os.getenv('AZURE_SQL_PASSWORD')
    
    if not username or not password:
        print("❌ Azure SQL credentials not found in .env file")
        print("Please make sure AZURE_SQL_USERNAME and AZURE_SQL_PASSWORD are set")
        sys.exit(1)
    
    # Create connection string
    connection_string = f'DRIVER={{ODBC Driver 18 for SQL Server}};SERVER={server};DATABASE={database};UID={username};PWD={password}'
    
    print(f"🔗 Connecting to Azure SQL Server: {server}/{database}")
    
    # Connect to database
    conn = pyodbc.connect(connection_string)
    cursor = conn.cursor()
    
    # Count current civic orders
    cursor.execute("SELECT COUNT(*) FROM executive_orders WHERE category = 'civic'")
    civic_count = cursor.fetchone()[0]
    
    print(f"🔍 Found {civic_count} executive orders with 'civic' category")
    
    if civic_count > 0:
        # Update civic to not-applicable
        cursor.execute("""
            UPDATE executive_orders 
            SET category = 'not-applicable' 
            WHERE category = 'civic'
        """)
        
        # Commit the changes
        conn.commit()
        
        print(f"✅ Successfully updated {civic_count} orders from 'civic' to 'not-applicable'")
        
        # Show new distribution
        cursor.execute("""
            SELECT category, COUNT(*) as count
            FROM executive_orders 
            GROUP BY category 
            ORDER BY count DESC
        """)
        
        print("\n📊 New category distribution:")
        for row in cursor.fetchall():
            print(f"   {row.category}: {row.count}")
    else:
        print("ℹ️  No orders with 'civic' category found")
    
    cursor.close()
    conn.close()
    
    print("\n✅ Update complete! Refresh your frontend to see the changes.")
    
except ImportError:
    print("❌ pyodbc not installed. Please run: pip install pyodbc")
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()