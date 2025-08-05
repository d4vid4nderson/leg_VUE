#!/usr/bin/env python3
"""
Simple script to clean up test users from the database
Run this from the backend directory
"""

import pyodbc
import os

# Database connection settings (adjust as needed)
SERVER = 'sql-legislation-tracker.database.windows.net'
DATABASE = 'db-executiveorders'

def cleanup_test_users():
    """Remove test users Jane Doe and John Smith"""
    
    # Connection string for local development (adjust as needed)
    connection_string = f"""
    Driver={{ODBC Driver 18 for SQL Server}};
    Server=tcp:{SERVER},1433;
    Database={DATABASE};
    Authentication=ActiveDirectoryMSI;
    Encrypt=yes;
    TrustServerCertificate=no;
    Connection Timeout=30;
    """
    
    test_user_ids = ["739446089", "445124510"]  # Jane Doe, John Smith
    
    try:
        with pyodbc.connect(connection_string) as conn:
            cursor = conn.cursor()
            
            for user_id in test_user_ids:
                print(f"Removing test user {user_id}...")
                
                # Remove from all tables
                cursor.execute("DELETE FROM dbo.user_profiles WHERE user_id = ?", (user_id,))
                profiles_removed = cursor.rowcount
                
                cursor.execute("DELETE FROM dbo.user_sessions WHERE user_id = ?", (user_id,))
                sessions_removed = cursor.rowcount
                
                cursor.execute("DELETE FROM dbo.user_highlights WHERE user_id = ?", (user_id,))
                highlights_removed = cursor.rowcount
                
                cursor.execute("DELETE FROM dbo.page_views WHERE user_id = ?", (user_id,))
                pageviews_removed = cursor.rowcount
                
                print(f"  Profiles: {profiles_removed}, Sessions: {sessions_removed}, Highlights: {highlights_removed}, Page views: {pageviews_removed}")
            
            conn.commit()
            print("✅ Test users cleanup completed!")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    cleanup_test_users()