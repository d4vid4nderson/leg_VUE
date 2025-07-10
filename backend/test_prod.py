# test_prod.py - Simple connection test for Azure Container App environment
import os
import sys
import requests
import logging
from datetime import datetime
import urllib.parse
import socket
import pyodbc

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)

def print_section_header(title):
    """Print a nicely formatted section header"""
    print("\n" + "=" * 80)
    print(f" {title} ".center(80, "="))
    print("=" * 80)

def check_environment():
    """Check which environment the app is running in"""
    print_section_header("ENVIRONMENT CHECK")
    
    env = os.getenv("ENVIRONMENT", "development")
    container_app = bool(os.getenv("CONTAINER_APP_NAME"))
    
    print(f"• Environment variable: ENVIRONMENT = {env}")
    print(f"• Running in container app: {container_app}")
    print(f"• Container app name: {os.getenv('CONTAINER_APP_NAME', 'Not set')}")
    print(f"• Container app revision: {os.getenv('CONTAINER_APP_REVISION', 'Not set')}")
    print(f"• Hostname: {os.getenv('HOSTNAME', 'Not set')}")
    
    is_production = env.lower() == "production" or container_app
    
    if is_production:
        print("\n✅ Running in PRODUCTION environment")
    else:
        print("\n⚠️ Running in DEVELOPMENT environment")
        
    return is_production

def check_ai_foundry_api():
    """Check if AI Foundry API credentials are available and working"""
    print_section_header("AI FOUNDRY API CHECK")
    
    # Check environment variables
    azure_endpoint = os.getenv("AZURE_ENDPOINT")
    azure_key = os.getenv("AZURE_KEY")
    azure_model = os.getenv("AZURE_MODEL_NAME")
    
    # Print status for each variable
    print(f"• AZURE_ENDPOINT: {'✅ Set' if azure_endpoint else '❌ Not set'}")
    if azure_endpoint:
        print(f"  Value: {azure_endpoint}")
    
    print(f"• AZURE_KEY: {'✅ Set' if azure_key else '❌ Not set'}")
    if azure_key:
        masked_key = azure_key[:10] + "..." if len(azure_key) > 10 else azure_key
        print(f"  Value: {masked_key}")
    
    print(f"• AZURE_MODEL_NAME: {'✅ Set' if azure_model else '❌ Not set'}")
    if azure_model:
        print(f"  Value: {azure_model}")
    
    # Test connection if variables are set
    if azure_endpoint and azure_key and azure_model:
        print("\nTesting AI Foundry API connection...")
        try:
            # Create simple request to Azure OpenAI API
            headers = {
                "Content-Type": "application/json",
                "api-key": azure_key
            }
            
            # Create API URL - this is for Azure OpenAI
            api_url = f"{azure_endpoint}/openai/deployments/{azure_model}/chat/completions?api-version=2024-02-15-preview"
            
            # Simple test payload
            payload = {
                "messages": [
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": "Say hello world"}
                ],
                "max_tokens": 10
            }
            
            # Make the request
            response = requests.post(api_url, headers=headers, json=payload, timeout=10)
            
            # Check the response
            if response.status_code == 200:
                print(f"\n✅ AI Foundry API connection successful!")
                print(f"  Response: {response.json().get('choices', [{}])[0].get('message', {}).get('content', 'No content')}")
            else:
                print(f"\n❌ AI Foundry API connection failed with status code: {response.status_code}")
                print(f"  Error: {response.text}")
        except Exception as e:
            print(f"\n❌ AI Foundry API connection error: {str(e)}")
    else:
        print("\n❌ Cannot test AI Foundry API - missing credentials")

def check_legiscan_api():
    """Check if LegiScan API credentials are available and working"""
    print_section_header("LEGISCAN API CHECK")
    
    # Check environment variable
    api_key = os.getenv("LEGISCAN_API_KEY")
    
    print(f"• LEGISCAN_API_KEY: {'✅ Set' if api_key else '❌ Not set'}")
    if api_key:
        masked_key = api_key[:10] + "..." if len(api_key) > 10 else api_key
        print(f"  Value: {masked_key}")
    
    # Test connection if API key is set
    if api_key:
        print("\nTesting LegiScan API connection...")
        try:
            # Create simple request to LegiScan API
            url = f"https://api.legiscan.com/?key={api_key}&op=getSessionList&state=CA"
            
            response = requests.get(url, timeout=10)
            
            # Check the response
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'OK':
                    print(f"\n✅ LegiScan API connection successful!")
                    print(f"  Session count: {len(data.get('sessions', []))}")
                    if data.get('sessions'):
                        print(f"  First session: {data['sessions'][0].get('session_name')}")
                else:
                    print(f"\n❌ LegiScan API returned error: {data.get('alert', {}).get('message', 'Unknown error')}")
            else:
                print(f"\n❌ LegiScan API connection failed with status code: {response.status_code}")
                print(f"  Error: {response.text}")
        except Exception as e:
            print(f"\n❌ LegiScan API connection error: {str(e)}")
    else:
        print("\n❌ Cannot test LegiScan API - missing API key")

def check_azure_sql_connection():
    """Check connection to Azure SQL Server database using MSI authentication"""
    print_section_header("AZURE SQL DATABASE CHECK")
    
    # Check environment variables
    server = os.getenv("AZURE_SQL_SERVER")
    database = os.getenv("AZURE_SQL_DATABASE")
    client_id = os.getenv("MANAGED_IDENTITY_CLIENT_ID")
    
    # Print status for each variable
    print(f"• AZURE_SQL_SERVER: {'✅ Set' if server else '❌ Not set'}")
    if server:
        print(f"  Value: {server}")
    
    print(f"• AZURE_SQL_DATABASE: {'✅ Set' if database else '❌ Not set'}")
    if database:
        print(f"  Value: {database}")
    
    print(f"• MANAGED_IDENTITY_CLIENT_ID: {'✅ Set' if client_id else '❌ Not set (using system-assigned identity)'}")
    if client_id:
        masked_id = client_id[:10] + "..." if len(client_id) > 10 else client_id
        print(f"  Value: {masked_id}")
    
    # MSI endpoint indicators
    msi_endpoint = os.getenv("MSI_ENDPOINT")
    msi_secret = os.getenv("MSI_SECRET")
    print(f"• MSI_ENDPOINT: {'✅ Set' if msi_endpoint else '❌ Not set'}")
    print(f"• MSI_SECRET: {'✅ Set' if msi_secret else '❌ Not set'}")
    
    # Test connection if server and database are set
    if server and database:
        print("\nTesting Azure SQL Database connection with MSI authentication...")
        try:
            # Build MSI connection string
            connection_string = (
                "Driver={ODBC Driver 18 for SQL Server};"
                f"Server=tcp:{server},1433;"
                f"Database={database};"
                "Authentication=ActiveDirectoryMSI;"
                "Encrypt=yes;"
                "TrustServerCertificate=no;"
                "Connection Timeout=30;"
            )
            
            # Add client ID if using user-assigned identity
            if client_id:
                connection_string += f"UID={client_id};"
                
            print(f"• Connection string: {connection_string}")
            
            # Try to connect
            conn = pyodbc.connect(connection_string)
            
            # Test basic query
            cursor = conn.cursor()
            cursor.execute("SELECT 1 AS test_value")
            result = cursor.fetchone()
            
            if result and result[0] == 1:
                print("\n✅ Azure SQL Database connection successful!")
                
                # Try to get current user for debugging
                try:
                    cursor.execute("SELECT CURRENT_USER, USER_NAME()")
                    user_info = cursor.fetchone()
                    print(f"  Connected as: CURRENT_USER={user_info[0]}, USER_NAME={user_info[1]}")
                except Exception as user_error:
                    print(f"  Could not determine user: {user_error}")
                
                # Try to get database version
                try:
                    cursor.execute("SELECT @@VERSION")
                    version = cursor.fetchone()
                    print(f"  SQL Server version: {version[0].split('\n')[0]}")
                except Exception as version_error:
                    print(f"  Could not get version: {version_error}")
                
                # Test executive_orders table access
                try:
                    cursor.execute("SELECT COUNT(*) FROM dbo.executive_orders")
                    count = cursor.fetchone()[0]
                    print(f"  Executive orders count: {count}")
                except Exception as table_error:
                    print(f"  Could not access executive_orders table: {table_error}")
                
                cursor.close()
                conn.close()
            else:
                print("\n❌ Query didn't return expected result")
        except Exception as e:
            print(f"\n❌ Azure SQL Database connection error: {str(e)}")
            
            # Additional debugging for MSI errors
            if "ActiveDirectoryMSI" in str(e):
                print("\nMSI Troubleshooting:")
                print("  1. Verify the container app has system-assigned identity enabled")
                print("  2. Ensure the identity has 'Reader' role on the SQL Server")
                print("  3. Verify the identity has been added as a user in the SQL database")
                print("  4. Check network security group rules allow the connection")
    else:
        print("\n❌ Cannot test Azure SQL Database - missing server or database")

def check_frontend_connection():
    """Check frontend container connection"""
    print_section_header("FRONTEND CONNECTION CHECK")
    
    # Check environment variable
    frontend_url = os.getenv("FRONTEND_URL")
    
    print(f"• FRONTEND_URL: {'✅ Set' if frontend_url else '❌ Not set'}")
    if frontend_url:
        print(f"  Value: {frontend_url}")
    
    # Test connection if URL is set
    if frontend_url:
        print("\nTesting frontend connection...")
        try:
            # Clean the URL if needed
            if not frontend_url.startswith(('http://', 'https://')):
                frontend_url = 'https://' + frontend_url
            
            # Make a request to the frontend
            response = requests.get(frontend_url, timeout=10)
            
            # Check the response
            if response.status_code == 200:
                print(f"\n✅ Frontend connection successful!")
                print(f"  Status code: {response.status_code}")
                print(f"  Content type: {response.headers.get('Content-Type', 'Unknown')}")
                print(f"  Content length: {len(response.content)} bytes")
            else:
                print(f"\n⚠️ Frontend returned status code: {response.status_code}")
                print(f"  This may be normal depending on your frontend setup")
        except Exception as e:
            print(f"\n❌ Frontend connection error: {str(e)}")
            
            # Try to resolve the hostname
            try:
                parsed_url = urllib.parse.urlparse(frontend_url)
                hostname = parsed_url.netloc
                print(f"\nTrying to resolve hostname: {hostname}")
                ip_address = socket.gethostbyname(hostname)
                print(f"  Resolved to IP: {ip_address}")
            except Exception as dns_error:
                print(f"  Could not resolve hostname: {dns_error}")
    else:
        print("\n❌ Cannot test frontend connection - missing URL")

def main():
    """Main function to run all checks"""
    print("\n" + "*" * 80)
    print(" AZURE CONTAINER APP CONNECTIVITY TEST ".center(80, "*"))
    print(f" {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ".center(80, "*"))
    print("*" * 80 + "\n")
    
    # Check environment first
    is_production = check_environment()
    
    # Only run other checks if in production
    if is_production:
        check_ai_foundry_api()
        check_legiscan_api()
        check_azure_sql_connection()
        check_frontend_connection()
        
        print_section_header("SUMMARY")
        print("All tests completed. Check the output above for details on each connection.")
    else:
        print("\nSkipping API and database checks since we're not in production environment.")
        print("Set ENVIRONMENT=production to run all checks.")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logger.error(f"Unexpected error in test script: {e}", exc_info=True)
        print(f"\n❌ TEST FAILED: {str(e)}")
        sys.exit(1)
