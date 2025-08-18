#!/usr/bin/env python3
"""
Update session tracking to capture MSI email addresses from Azure AD tokens
This script modifies the start_session endpoint to properly capture and store user emails
"""

import sys

# The updated start_session function that should replace the existing one in main.py
UPDATED_START_SESSION = '''@app.post("/api/analytics/start-session")
async def start_session(
    request: SessionStartRequest,
    http_request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Start or update a user session with MSI email capture"""
    try:
        create_user_sessions_table()
        migrate_user_sessions_add_display_name()
        
        # Get user info from Azure AD token if available
        msi_email = None
        display_name = request.display_name
        
        if current_user and current_user.get("email"):
            # We have an authenticated user from Azure AD
            msi_email = current_user.get("email")
            # Use the name from Azure AD if display_name not provided
            if not display_name:
                display_name = current_user.get("name") or current_user.get("given_name")
            print(f"🔑 Azure AD user detected: {display_name} ({msi_email})")
        
        # Normalize user ID to handle both email and numeric IDs
        normalized_user_id = normalize_user_id(request.user_id)
        
        # Get client IP and user agent
        client_ip = http_request.headers.get("x-forwarded-for")
        if client_ip:
            client_ip = client_ip.split(",")[0].strip()
        else:
            client_ip = http_request.client.host if http_request.client else "unknown"
        
        user_agent = http_request.headers.get("user-agent", "unknown")[:500]
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Get display_name from user_profiles if not provided
            if not display_name:
                cursor.execute("SELECT display_name FROM dbo.user_profiles WHERE user_id = ?", (normalized_user_id,))
                result = cursor.fetchone()
                if result:
                    display_name = result[0]
            
            # Use MERGE to handle race conditions atomically (SQL Server UPSERT)
            cursor.execute("""
                MERGE dbo.user_sessions AS target
                USING (SELECT ? AS session_id, ? AS user_id, ? AS display_name, ? AS msi_email, ? AS ip_address, ? AS user_agent) AS source
                ON target.session_id = source.session_id
                WHEN MATCHED THEN
                    UPDATE SET 
                        last_activity = GETDATE(), 
                        user_id = source.user_id, 
                        display_name = source.display_name,
                        msi_email = COALESCE(source.msi_email, target.msi_email),
                        ip_address = source.ip_address,
                        user_agent = source.user_agent
                WHEN NOT MATCHED THEN
                    INSERT (session_id, user_id, display_name, msi_email, ip_address, user_agent, started_at, last_activity, is_active)
                    VALUES (source.session_id, source.user_id, source.display_name, source.msi_email, source.ip_address, source.user_agent, GETDATE(), GETDATE(), 1);
            """, (request.session_id, normalized_user_id, display_name, msi_email, client_ip, user_agent))
            
            conn.commit()
            
            return {
                "success": True, 
                "message": "Session updated",
                "user_info": {
                    "user_id": normalized_user_id,
                    "display_name": display_name,
                    "msi_email": msi_email
                }
            }
            
    except Exception as e:
        print(f"❌ Failed to start session: {e}")
        return {"success": False, "error": str(e)}'''

# SQL script to update existing sessions with MSI emails from Azure AD logs
UPDATE_EXISTING_SESSIONS_SQL = """
-- Update existing sessions with MSI emails where possible
-- This query looks for page views with authenticated users and updates their sessions

WITH AuthenticatedUsers AS (
    SELECT DISTINCT 
        pv.user_id,
        pv.session_id,
        up.display_name,
        up.email
    FROM dbo.page_views pv
    INNER JOIN dbo.user_profiles up ON pv.user_id = up.user_id
    WHERE up.email IS NOT NULL 
    AND up.email NOT LIKE 'anonymous-%'
    AND up.email NOT LIKE '%desktop-user%'
)
UPDATE us
SET 
    us.msi_email = au.email,
    us.display_name = COALESCE(us.display_name, au.display_name)
FROM dbo.user_sessions us
INNER JOIN AuthenticatedUsers au ON us.session_id = au.session_id
WHERE us.msi_email IS NULL OR us.msi_email = '';

-- Return count of updated records
SELECT @@ROWCOUNT as updated_count;
"""

# Function to create a report of user sessions with emails
USER_SESSION_REPORT_SQL = """
SELECT 
    us.user_id,
    us.display_name,
    us.msi_email,
    COUNT(*) as session_count,
    MAX(us.started_at) as last_session,
    SUM(CASE WHEN us.is_active = 1 THEN 1 ELSE 0 END) as active_sessions
FROM dbo.user_sessions us
WHERE us.started_at >= DATEADD(day, -30, GETDATE())
GROUP BY us.user_id, us.display_name, us.msi_email
ORDER BY 
    CASE 
        WHEN us.msi_email IS NOT NULL AND us.msi_email != '' THEN 0 
        ELSE 1 
    END,
    session_count DESC;
"""

def main():
    print("=" * 60)
    print("MSI Email Capture Update Script")
    print("=" * 60)
    print("\nThis script will help you:")
    print("1. Update the session tracking to capture MSI emails")
    print("2. Update existing sessions with available email data")
    print("3. Generate a report of user sessions with emails")
    print("\n" + "=" * 60)
    
    print("\n📝 STEP 1: Update main.py")
    print("-" * 40)
    print("Replace the existing start_session function in main.py with:")
    print("\n" + UPDATED_START_SESSION)
    
    print("\n📊 STEP 2: Update Existing Sessions")
    print("-" * 40)
    print("Run this SQL to update existing sessions with MSI emails:")
    print("\n" + UPDATE_EXISTING_SESSIONS_SQL)
    
    print("\n📈 STEP 3: Generate User Report")
    print("-" * 40)
    print("Run this SQL to see user sessions with emails:")
    print("\n" + USER_SESSION_REPORT_SQL)
    
    print("\n✅ Additional Notes:")
    print("-" * 40)
    print("• The updated function captures emails from Azure AD tokens")
    print("• It also captures IP addresses and user agents for analytics")
    print("• Existing sessions will be updated with emails where available")
    print("• The display_name will be pulled from Azure AD if available")
    print("• Anonymous users will not have MSI emails")

if __name__ == "__main__":
    main()