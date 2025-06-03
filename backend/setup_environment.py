# setup_environment.py - Fix your .env file for proper Azure SQL connection
import os
from dotenv import load_dotenv

def setup_azure_sql_environment():
    """Setup proper Azure SQL environment variables"""
    
    print("🔧 Azure SQL Environment Setup")
    print("=" * 40)
    
    # Load existing .env
    load_dotenv()
    
    # Get current values
    current_database_url = os.getenv('DATABASE_URL', '')
    
    print(f"Current DATABASE_URL: {current_database_url}")
    
    if 'sql-legislation-tracker.database.windows.net' in current_database_url:
        print("🔍 Detected incomplete Azure SQL configuration")
        
        # Extract server name
        server = 'sql-legislation-tracker.database.windows.net'
        
        print("\nTo complete your Azure SQL setup, I need the following information:")
        print("1. Database name")
        print("2. Username")  
        print("3. Password")
        
        # You'll need to provide these - for security, don't hardcode them
        print("\nUpdate your .env file with:")
        print("# Replace these with your actual values")
        print("AZURE_SQL_SERVER=sql-legislation-tracker.database.windows.net")
        print("AZURE_SQL_DATABASE=your-database-name")
        print("AZURE_SQL_USERNAME=your-username")
        print("AZURE_SQL_PASSWORD=your-password")
        print("")
        print("# OR use a complete DATABASE_URL:")
        print("# DATABASE_URL=mssql+pyodbc://username:password@sql-legislation-tracker.database.windows.net:1433/database?driver=ODBC+Driver+18+for+SQL+Server&Encrypt=yes&TrustServerCertificate=no&Connection+Timeout=30")
        
        return False
    
    # Check if we have complete Azure SQL config
    server = os.getenv('AZURE_SQL_SERVER')
    database = os.getenv('AZURE_SQL_DATABASE') 
    username = os.getenv('AZURE_SQL_USERNAME')
    password = os.getenv('AZURE_SQL_PASSWORD')
    
    if all([server, database, username, password]):
        print("✅ Complete Azure SQL configuration found")
        return True
    elif any([server, database, username, password]):
        print("⚠️ Partial Azure SQL configuration found")
        print("Missing:")
        if not server: print("  - AZURE_SQL_SERVER")
        if not database: print("  - AZURE_SQL_DATABASE")  
        if not username: print("  - AZURE_SQL_USERNAME")
        if not password: print("  - AZURE_SQL_PASSWORD")
        return False
    else:
        print("ℹ️ No Azure SQL configuration found - will use SQLite")
        return True

def create_sample_env_file():
    """Create a sample .env file with proper Azure SQL format"""
    
    sample_env = """# LegislationVue Environment Configuration

# Azure SQL Database (Option 1: Individual components)
AZURE_SQL_SERVER=sql-legislation-tracker.database.windows.net
AZURE_SQL_DATABASE=db-legislation
AZURE_SQL_USERNAME=david.anderson
AZURE_SQL_PASSWORD=_MOREgroup

# OR Azure SQL Database (Option 2: Complete URL)
# DATABASE_URL=mssql+pyodbc://david.anderson:_MOREgroup@sql-legislation-tracker.database.windows.net:1433/database?driver=ODBC+Driver+18+for+SQL+Server&Encrypt=yes&TrustServerCertificate=no&Connection+Timeout=30

# LegiScan API
LEGISCAN_API_KEY=e3bd77ddffa618452dbe7e9bd3ea3a35

# Azure AI
AZURE_ENDPOINT=https://david-mabholqy-swedencentral.openai.azure.com/
AZURE_KEY=8bFP5NQ6KL7jSV74M3ZJ77vh9uYrtR7c3sOkAmM3Gs7tirc5mOWAJQQJ99BEACfhMk5XJ3w3AAAAACOGGlXN
AZURE_MODEL_NAME=summarize-gpt-4.1

# Optional: Environment
ENVIRONMENT=development
"""
    
    # Check if .env exists
    if os.path.exists('.env'):
        print("📁 .env file already exists")
        
        # Read current content
        with open('.env', 'r') as f:
            current_content = f.read()
        
        # Check if it needs Azure SQL config
        if 'AZURE_SQL_SERVER' not in current_content and 'DATABASE_URL' not in current_content:
            print("➕ Adding Azure SQL configuration template to .env")
            
            with open('.env', 'a') as f:
                f.write('\n\n# Azure SQL Database Configuration\n')
                f.write('AZURE_SQL_SERVER=your-server.database.windows.net\n')
                f.write('AZURE_SQL_DATABASE=your-database-name\n')
                f.write('AZURE_SQL_USERNAME=your-username\n')
                f.write('AZURE_SQL_PASSWORD=your-password\n')
            
            print("✅ Added Azure SQL template to .env file")
        else:
            print("✅ .env file already has database configuration")
    
    else:
        print("📝 Creating sample .env file...")
        with open('.env.sample', 'w') as f:
            f.write(sample_env)
        print("✅ Created .env.sample file")
        print("💡 Copy .env.sample to .env and fill in your actual values")

def test_fixed_database():
    """Test the fixed database configuration"""
    
    try:
        # Import the fixed database module
        from database_fixed import test_connections, init_databases, get_database_info
        
        print("\n🧪 Testing Fixed Database Configuration")
        print("=" * 40)
        
        # Check database info
        db_info = get_database_info()
        print(f"📊 Database type: {db_info['database_type']}")
        print(f"📊 Using Azure SQL: {db_info['using_azure_sql']}")
        print(f"📊 Database URL: {db_info['database_url']}")
        
        # Test connection
        print("\n🔍 Testing database connection...")
        connection_result = test_connections()
        
        if connection_result["legislation"]:
            print("✅ Database connection successful!")
            
            # Try to initialize tables
            print("\n🔧 Initializing database tables...")
            init_result = init_databases()
            
            if init_result:
                print("✅ Database tables created successfully!")
                print("\n🎉 Your database is ready for LegiScan bills!")
                return True
            else:
                print("❌ Failed to create database tables")
                return False
        else:
            print("❌ Database connection failed:")
            for error in connection_result["errors"]:
                print(f"   - {error}")
            return False
    
    except ImportError as e:
        print(f"❌ Could not import database_fixed: {e}")
        return False
    except Exception as e:
        print(f"❌ Database test failed: {e}")
        return False

if __name__ == "__main__":
    print("🚀 LegislationVue Environment Setup")
    print("=" * 50)
    
    # Step 1: Check current environment
    env_ok = setup_azure_sql_environment()
    
    # Step 2: Create sample .env if needed
    create_sample_env_file()
    
    # Step 3: Test database if config looks good
    if env_ok:
        print("\n" + "=" * 50)
        success = test_fixed_database()
        
        if success:
            print("\n✅ SETUP COMPLETE!")
            print("Your database is ready. Try your LegiScan search again.")
        else:
            print("\n❌ Setup incomplete. Please check your configuration.")
    else:
        print("\n⚠️ Please update your .env file with proper Azure SQL credentials")
        print("Then run this script again to test the connection.")
    
    print("\n📋 Next Steps:")
    print("1. Update your .env file with correct Azure SQL credentials")
    print("2. Replace database_fixed.py with the corrected version")
    print("3. Run this script again to verify")
    print("4. Test your LegiScan integration")