#!/usr/bin/env python3
"""
Quick script to update civic categories to not-applicable
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get database URL from environment
DATABASE_URL = os.getenv('DATABASE_URL')

if not DATABASE_URL:
    print("❌ DATABASE_URL not found in environment variables")
    print("Please make sure your .env file contains DATABASE_URL")
    exit(1)

try:
    import psycopg2
    from urllib.parse import urlparse
    
    # Parse DATABASE_URL
    result = urlparse(DATABASE_URL)
    
    # Connect to database
    conn = psycopg2.connect(
        database=result.path[1:],
        user=result.username,
        password=result.password,
        host=result.hostname,
        port=result.port
    )
    
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
            SELECT category, COUNT(*) 
            FROM executive_orders 
            GROUP BY category 
            ORDER BY COUNT(*) DESC
        """)
        
        print("\n📊 New category distribution:")
        for category, count in cursor.fetchall():
            print(f"   {category}: {count}")
    else:
        print("ℹ️  No orders with 'civic' category found")
    
    cursor.close()
    conn.close()
    
except ImportError:
    print("❌ psycopg2 not installed. Please run: pip install psycopg2-binary")
except Exception as e:
    print(f"❌ Error: {e}")