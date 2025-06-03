# test_azure_sql.py - Standalone Azure SQL Connection Test
import os
import urllib.parse
import traceback
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_azure_sql_connection_only():
    """Test Azure SQL connection without SQLAlchemy first"""
    print("🧪 Testing Azure SQL Connection")
    print("=" * 50)
    
    # Get connection details
    server = os.getenv('AZURE_SQL_SERVER', 'sql-legislation-tracker.database.windows.net')
    database = os.getenv('AZURE_SQL_DATABASE', 'db-executiveorders')
    username = os.getenv('AZURE_SQL_USERNAME', 'david.anderson')
    password = os.getenv('AZURE_SQL_PASSWORD', '_MOREgroup')
    
    print(f"Server: {server}")
    print(f"Database: {database}")
    print(f"Username: {username}")
    print(f"Password: {'*' * len(password) if password else 'NOT SET'}")
    print()
    
    if not all([server, database, username, password]):
        print("❌ Missing required Azure SQL configuration")
        return False
    
    # Test 1: Try pyodbc direct connection
    print("1. Testing direct pyodbc connection...")
    try:
        import pyodbc
        
        # Build connection string for pyodbc
        connection_string = (
            f"Driver={{ODBC Driver 18 for SQL Server}};"
            f"Server=tcp:{server},1433;"
            f"Database={database};"
            f"Uid={username};"
            f"Pwd={password};"
            f"Encrypt=yes;"
            f"TrustServerCertificate=no;"
            f"Connection Timeout=30;"
        )
        
        print("   Attempting connection...")
        conn = pyodbc.connect(connection_string, timeout=30)
        cursor = conn.cursor()
        
        # Test query
        cursor.execute("SELECT 1 as test_column")
        result = cursor.fetchone()
        
        if result and result[0] == 1:
            print("   ✅ Direct pyodbc connection successful!")
            
            # Test if our table exists
            cursor.execute("""
                SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_NAME = 'state_legislation'
            """)
            table_exists = cursor.fetchone()[0] > 0
            print(f"   📋 state_legislation table exists: {'✅ Yes' if table_exists else '❌ No'}")
            
            cursor.close()
            conn.close()
            return True
        else:
            print("   ❌ Test query failed")
            return False
            
    except ImportError:
        print("   ❌ pyodbc not installed. Run: pip install pyodbc")
        return False
    except Exception as e:
        print(f"   ❌ Direct connection failed: {e}")
        return False
    
def test_sqlalchemy_connection():
    """Test SQLAlchemy connection to Azure SQL"""
    print("\n2. Testing SQLAlchemy connection...")
    
    try:
        from sqlalchemy import create_engine, text
        
        # Get connection details
        server = os.getenv('AZURE_SQL_SERVER')
        database = os.getenv('AZURE_SQL_DATABASE')
        username = os.getenv('AZURE_SQL_USERNAME')
        password = os.getenv('AZURE_SQL_PASSWORD')
        
        # URL encode credentials
        password_encoded = urllib.parse.quote_plus(password)
        username_encoded = urllib.parse.quote_plus(username)
        
        # Build SQLAlchemy connection string
        connection_string = (
            f"mssql+pyodbc://{username_encoded}:{password_encoded}@{server}:1433/{database}"
            f"?driver=ODBC+Driver+18+for+SQL+Server"
            f"&Encrypt=yes"
            f"&TrustServerCertificate=no"
            f"&Connection+Timeout=30"
        )
        
        print("   Creating SQLAlchemy engine...")
        engine = create_engine(
            connection_string,
            pool_pre_ping=True,
            pool_recycle=300,
            pool_timeout=20,
            echo=False  # Set to True to see SQL queries
        )
        
        print("   Testing connection...")
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1 as test_column")).fetchone()
            if result and result[0] == 1:
                print("   ✅ SQLAlchemy connection successful!")
                
                # Check table existence
                table_check = conn.execute(text("""
                    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
                    WHERE TABLE_NAME = 'state_legislation'
                """)).fetchone()
                
                table_exists = table_check[0] > 0 if table_check else False
                print(f"   📋 state_legislation table: {'✅ Exists' if table_exists else '❌ Missing'}")
                
                if table_exists:
                    # Count records
                    try:
                        count_result = conn.execute(text("SELECT COUNT(*) FROM state_legislation")).fetchone()
                        record_count = count_result[0] if count_result else 0
                        print(f"   📊 Records in table: {record_count}")
                    except Exception as e:
                        print(f"   ⚠️ Could not count records: {e}")
                
                return True
            else:
                print("   ❌ SQLAlchemy test query failed")
                return False
                
    except ImportError as e:
        print(f"   ❌ Missing dependency: {e}")
        return False
    except Exception as e:
        print(f"   ❌ SQLAlchemy connection failed: {e}")
        traceback.print_exc()
        return False

def test_database_azure_fixed_import():
    """Test importing our fixed Azure SQL module"""
    print("\n3. Testing database_azure_fixed import...")
    
    try:
        from database_azure_fixed import (
            test_azure_sql_connection,
            init_databases,
            save_legislation_to_azure_sql,
            get_legislation_from_azure_sql
        )
        print("   ✅ database_azure_fixed import successful!")
        
        # Test the connection function
        print("   Testing Azure SQL connection function...")
        connection_test = test_azure_sql_connection()
        if connection_test:
            print("   ✅ Azure SQL connection function works!")
            
            # Test table initialization
            print("   Testing table initialization...")
            init_result = init_databases()
            if init_result:
                print("   ✅ Table initialization successful!")
                return True
            else:
                print("   ❌ Table initialization failed")
                return False
        else:
            print("   ❌ Azure SQL connection function failed")
            return False
            
    except ImportError as e:
        print(f"   ❌ Import failed: {e}")
        return False
    except Exception as e:
        print(f"   ❌ Test failed: {e}")
        traceback.print_exc()
        return False

def test_full_integration():
    """Test full integration with a sample bill"""
    print("\n4. Testing full integration with sample data...")
    
    try:
        from database_azure_fixed import (
            save_legislation_to_azure_sql,
            get_legislation_from_azure_sql,
            LegislationSession,
            StateLegislationDB
        )
        
        # Create a test bill
        test_bill = {
            'bill_id': f'INTEGRATION_TEST_{int(datetime.now().timestamp())}',
            'bill_number': 'INT-TEST-001',
            'title': 'Integration Test Bill for Azure SQL',
            'description': 'This is a test bill to verify full Azure SQL integration is working.',
            'state': 'California',
            'state_abbr': 'CA',
            'status': 'Active',
            'category': 'civic',
            'introduced_date': '2025-06-02',
            'ai_summary': 'Test AI summary for integration verification',
            'ai_talking_points': '1. Test point one. 2. Test point two. 3. Test point three.',
            'ai_business_impact': '1. Test business impact. 2. Test compliance requirement.',
            'ai_version': 'integration_test_v1'
        }
        
        print("   📝 Saving test bill...")
        saved_count = save_legislation_to_azure_sql([test_bill])
        
        if saved_count == 1:
            print("   ✅ Test bill saved successfully!")
            
            print("   📖 Retrieving test bill...")
            result = get_legislation_from_azure_sql(state='California', page=1, per_page=5)
            
            if result and result.get('count', 0) > 0:
                print(f"   ✅ Retrieved {result['count']} bills from Azure SQL!")
                
                # Find our test bill
                test_bill_found = any(
                    bill['bill_id'] == test_bill['bill_id'] 
                    for bill in result.get('results', [])
                )
                
                if test_bill_found:
                    print("   ✅ Test bill found in results!")
                    
                    # Clean up - remove test bill
                    try:
                        with LegislationSession() as session:
                            test_record = session.query(StateLegislationDB).filter_by(
                                bill_id=test_bill['bill_id']
                            ).first()
                            if test_record:
                                session.delete(test_record)
                                session.commit()
                                print("   🧹 Test bill cleaned up")
                    except Exception as e:
                        print(f"   ⚠️ Cleanup warning: {e}")
                    
                    return True
                else:
                    print("   ❌ Test bill not found in results")
                    return False
            else:
                print("   ❌ Could not retrieve bills")
                return False
        else:
            print("   ❌ Test bill save failed")
            return False
            
    except Exception as e:
        print(f"   ❌ Integration test failed: {e}")
        traceback.print_exc()
        return False

def main():
    """Run all Azure SQL tests"""
    print("🚀 Azure SQL Database Integration Test Suite")
    print("=" * 60)
    print()
    
    # Check if .env file exists
    env_file_exists = os.path.exists('.env')
    print(f"📋 .env file exists: {'✅ Yes' if env_file_exists else '❌ No'}")
    
    if not env_file_exists:
        print("❌ Please create a .env file with your Azure SQL credentials")
        return False
    
    tests = [
        ("Direct pyodbc connection", test_azure_sql_connection_only),
        ("SQLAlchemy connection", test_sqlalchemy_connection),
        ("Database module import", test_database_azure_fixed_import),
        ("Full integration test", test_full_integration)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n{'='*20} {test_name} {'='*20}")
        try:
            result = test_func()
            results.append((test_name, result))
            if result:
                print(f"✅ {test_name} PASSED")
            else:
                print(f"❌ {test_name} FAILED")
        except Exception as e:
            print(f"❌ {test_name} CRASHED: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "="*60)
    print("📊 TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"   {test_name}: {status}")
    
    print(f"\n🎯 Overall: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! Your Azure SQL integration is working correctly.")
        print("\nNext steps:")
        print("1. Update your main.py to use database_azure_fixed")
        print("2. Test the /api/test-azure-sql endpoint")
        print("3. Try fetching some state legislation")
    else:
        print(f"\n⚠️ {total - passed} test(s) failed. Please check the errors above.")
        print("\nCommon fixes:")
        print("1. Verify your Azure SQL credentials in .env")
        print("2. Ensure the database server is accessible")
        print("3. Check if ODBC Driver 18 for SQL Server is installed")
        print("4. Verify the database and table exist")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)