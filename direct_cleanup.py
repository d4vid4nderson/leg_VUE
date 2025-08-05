#!/usr/bin/env python3
"""
Direct cleanup script using the exact same database connection logic as the backend
"""
import pyodbc
import os

def get_db_connection():
    """Get database connection using the same logic as backend"""
    connection_string = f"""
    Driver={{ODBC Driver 18 for SQL Server}};
    Server=tcp:sql-legislation-tracker.database.windows.net,1433;
    Database=db-executiveorders;
    Authentication=ActiveDirectoryMSI;
    Encrypt=yes;
    TrustServerCertificate=no;
    Connection Timeout=30;
    """
    return pyodbc.connect(connection_string)

def cleanup_test_users():
    """Remove test users Jane Doe and John Smith"""
    test_user_ids = ["739446089", "445124510"]  # Jane Doe, John Smith
    
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            for user_id in test_user_ids:
                print(f"🗑️ Removing user {user_id}")
                
                # Remove from all tables
                cursor.execute("DELETE FROM dbo.user_profiles WHERE user_id = ?", (user_id,))
                profiles_removed = cursor.rowcount
                print(f"   user_profiles: {profiles_removed} rows removed")
                
                cursor.execute("DELETE FROM dbo.user_sessions WHERE user_id = ?", (user_id,))
                sessions_removed = cursor.rowcount
                print(f"   user_sessions: {sessions_removed} rows removed")
                
                cursor.execute("DELETE FROM dbo.user_highlights WHERE user_id = ?", (user_id,))
                highlights_removed = cursor.rowcount
                print(f"   user_highlights: {highlights_removed} rows removed")
                
                cursor.execute("DELETE FROM dbo.page_views WHERE user_id = ?", (user_id,))
                pageviews_removed = cursor.rowcount
                print(f"   page_views: {pageviews_removed} rows removed")
                
                print(f"✅ Removed test user {user_id}")
            
            conn.commit()
            print("🎉 Test users cleanup completed!")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    cleanup_test_users()