# status_endpoints.py - Enhanced API status endpoints

import os
import logging
from fastapi import APIRouter, HTTPException
from datetime import datetime
import httpx
from typing import Dict, Any

# Import our improved modules
from database_config import test_database_connection, get_db_connection
from ai_status import get_ai_status_for_api

logger = logging.getLogger(__name__)

# Create router
router = APIRouter()

async def check_legiscan_connection() -> Dict[str, Any]:
    """Check LegiScan API connection"""
    try:
        # Check API key first
        api_key = os.getenv('LEGISCAN_API_KEY')
        if not api_key:
            return {
                "status": "not_configured",
                "message": "LegiScan API key not configured"
            }
            
        # Try a simple API call
        url = f"https://api.legiscan.com/?key={api_key}&op=getSessionList&state=CA"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=10.0)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'OK':
                    return {
                        "status": "connected",
                        "message": "LegiScan API connected"
                    }
                else:
                    return {
                        "status": "error",
                        "message": f"LegiScan API error: {data.get('alert', {}).get('message', 'Unknown')}"
                    }
            else:
                return {
                    "status": "error",
                    "message": f"LegiScan API HTTP error: {response.status_code}"
                }
    except Exception as e:
        logger.error(f"❌ LegiScan connection check failed: {e}")
        return {
            "status": "error",
            "message": f"Connection error: {str(e)}"
        }

async def check_federal_register_availability() -> Dict[str, Any]:
    """Check Federal Register API availability"""
    try:
        # Federal Register doesn't need authentication
        url = "https://www.federalregister.gov/api/v1/documents.json?per_page=1"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=10.0)
            
            if response.status_code == 200:
                return {
                    "status": "connected",
                    "message": "Federal Register API connected"
                }
            else:
                return {
                    "status": "error",
                    "message": f"Federal Register API HTTP error: {response.status_code}"
                }
    except Exception as e:
        logger.error(f"❌ Federal Register connection check failed: {e}")
        return {
            "status": "error",
            "message": f"Connection error: {str(e)}"
        }

@router.get("/api/status")
async def get_status():
    """Enhanced system status endpoint"""
    
    # Check database connection
    db_status = {"status": "checking", "message": "Checking..."}
    try:
        if test_database_connection():
            db_status = {
                "status": "connected",
                "message": "Database connected",
                "type": "Azure SQL"
            }
        else:
            db_status = {
                "status": "error",
                "message": "Database connection failed",
                "type": "Azure SQL"
            }
    except Exception as e:
        logger.error(f"❌ Database status check failed: {e}")
        db_status = {
            "status": "error",
            "message": f"Database error: {str(e)}",
            "type": "Azure SQL"
        }
    
    # Check Azure AI status
    ai_status = get_ai_status_for_api()
    
    # Check LegiScan API connection
    legiscan_status = await check_legiscan_connection()
    
    # Check Federal Register API
    federal_register_status = await check_federal_register_availability()
    
    # Get environment
    raw_env = os.getenv("ENVIRONMENT", "development")
    environment = "production" if raw_env == "production" or bool(os.getenv("CONTAINER_APP_NAME") or os.getenv("MSI_ENDPOINT")) else "development"
    
    return {
        "timestamp": datetime.now().isoformat(),
        "environment": environment,
        "app_version": "Azure SQL Enhanced Edition v14.0",
        "database": db_status,
        "integrations": {
            "ai_analysis": ai_status["status"],
            "legiscan": legiscan_status["status"],
            "federal_register": federal_register_status["status"]
        },
        "integration_details": {
            "ai_analysis": ai_status,
            "legiscan": legiscan_status,
            "federal_register": federal_register_status
        },
        "features": {
            "msi_authentication": environment == "production",
            "azure_sql": True,
            "enhanced_ai": ai_status["status"] == "connected",
            "one_by_one_processing": True
        }
    }


@router.get("/api/debug/database-msi")
async def debug_database_msi_connection():
    """Debug endpoint for testing MSI database connection"""
    try:
        raw_env = os.getenv("ENVIRONMENT", "development")
        environment = "production" if raw_env == "production" or bool(os.getenv("CONTAINER_APP_NAME") or os.getenv("MSI_ENDPOINT")) else "development"
        log_output = []
        
        log_output.append(f"🔍 Environment: {environment}")
        log_output.append(f"🔍 Container: {'Yes' if os.getenv('CONTAINER_APP_NAME') else 'No'}")
        log_output.append(f"🔍 Testing Azure SQL connection...")
        
        # Connection parameters
        server = os.getenv('AZURE_SQL_SERVER', 'sql-legislation-tracker.database.windows.net')
        database = os.getenv('AZURE_SQL_DATABASE', 'db-executiveorders')
        
        log_output.append(f"📊 Connection details:")
        log_output.append(f"   Server: {server}")
        log_output.append(f"   Database: {database}")
        
        # Force MSI in container environment
        use_msi = environment == "production" or bool(os.getenv("CONTAINER_APP_NAME"))
        
        if use_msi:
            log_output.append(f"   Authentication: MSI (System-assigned)")
            connection_string = (
                "Driver={ODBC Driver 18 for SQL Server};"
                f"Server=tcp:{server},1433;"
                f"Database={database};"
                "Authentication=ActiveDirectoryMSI;"
                "Encrypt=yes;"
                "TrustServerCertificate=no;"
                "Connection Timeout=30;"
            )
            
            # Add client ID if available
         #   client_id = os.getenv("MANAGED_IDENTITY_CLIENT_ID")
         #   if client_id:
         #       log_output.append(f"   Using Client ID: {client_id[:5]}...")
         #       connection_string += f"UID={client_id};"
        else:
            username = os.getenv('AZURE_SQL_USERNAME')
            password = os.getenv('AZURE_SQL_PASSWORD')
            log_output.append(f"   Authentication: SQL (Username/Password)")
            connection_string = (
                "Driver={ODBC Driver 18 for SQL Server};"
                f"Server=tcp:{server},1433;"
                f"Database={database};"
                f"UID={username};"
                f"PWD={'*' * (len(password) if password else 0)};"
                "Encrypt=yes;"
                "TrustServerCertificate=no;"
                "Connection Timeout=30;"
            )
        
        log_output.append(f"🔗 Connection string: {connection_string}")
        
        # Try to connect
        log_output.append("🔄 Attempting to connect...")
        
        import pyodbc
        conn = pyodbc.connect(connection_string)
        
        # Test basic query
        cursor = conn.cursor()
        log_output.append("🔍 Executing test query: SELECT 1 as test_column")
        cursor.execute("SELECT 1 as test_column")
        row = cursor.fetchone()
        
        if row and row[0] == 1:
            log_output.append("✅ Connection successful! Query returned: 1")
            
            # Test table access
            try:
                log_output.append("🔍 Testing table access...")
                cursor.execute("SELECT TOP 1 * FROM executive_orders")
                columns = [column[0] for column in cursor.description]
                log_output.append(f"✅ Table access successful! Found columns: {', '.join(columns)}")
                
                # Get count of executive orders
                cursor.execute("SELECT COUNT(*) FROM executive_orders")
                count = cursor.fetchone()[0]
                log_output.append(f"📊 Total executive orders in database: {count}")
                
            except Exception as table_error:
                log_output.append(f"⚠️ Table access test failed: {str(table_error)}")
                
            conn.close()
            success = True
        else:
            log_output.append("❌ Query didn't return expected result")
            success = False
            
    except Exception as e:
        log_output.append(f"❌ Connection failed: {str(e)}")
        log_output.append(f"Error type: {type(e).__name__}")
        
        # Additional debugging for connection errors
        if "ActiveDirectoryMSI" in str(e):
            log_output.append("🔍 MSI authentication error detected!")
            log_output.append("👉 Make sure system-assigned identity is enabled on your container app")
            log_output.append("👉 Make sure identity has access to SQL Database")
        
        success = False
    
    return {
        "success": success,
        "logs": log_output,
        "timestamp": datetime.now().isoformat()
    }
