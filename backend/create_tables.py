# create_tables.py - Quick fix to create missing database tables
from dotenv import load_dotenv
load_dotenv()

def create_missing_tables():
    """Create the missing state_legislation table"""
    
    print("🔧 Creating missing database tables...")
    
    try:
        # Import and create tables
        from database_fixed import init_databases, test_connections, Base, engine
        
        print(f"📊 Database engine: {engine.url}")
        
        # Test connection first
        print("🔍 Testing connection...")
        connection_test = test_connections()
        
        if connection_test["legislation"]:
            print("✅ Database connection works!")
            
            # Create all tables
            print("🏗️ Creating all tables...")
            Base.metadata.create_all(engine)
            print("✅ Tables created successfully!")
            
            # Verify the table exists
            print("🔍 Verifying table creation...")
            from sqlalchemy import inspect
            inspector = inspect(engine)
            tables = inspector.get_table_names()
            
            if 'state_legislation' in tables:
                print("✅ state_legislation table confirmed!")
                
                # Get column info
                columns = inspector.get_columns('state_legislation')
                print(f"📋 Table has {len(columns)} columns:")
                for col in columns[:5]:  # Show first 5 columns
                    print(f"   - {col['name']} ({col['type']})")
                if len(columns) > 5:
                    print(f"   ... and {len(columns) - 5} more columns")
                
                return True
            else:
                print("❌ state_legislation table not found after creation")
                print(f"Available tables: {tables}")
                return False
        else:
            print("❌ Database connection failed:")
            for error in connection_test["errors"]:
                print(f"   - {error}")
            return False
            
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        return False

def test_table_operations():
    """Test basic table operations"""
    
    try:
        from database_fixed import LegislationSession, StateLegislationDB
        from datetime import datetime
        
        print("\n🧪 Testing table operations...")
        
        # Test inserting a sample record
        with LegislationSession() as session:
            # Check current count
            count_before = session.query(StateLegislationDB).count()
            print(f"📊 Records before test: {count_before}")
            
            # Try to insert a test record
            test_bill = StateLegislationDB(
                bill_id="TEST_12345",
                bill_number="TEST-1",
                title="Test Bill for Database Verification",
                description="This is a test bill to verify database functionality",
                state="California",
                state_abbr="CA",
                category="healthcare",
                status="Test",
                ai_summary="Test AI summary",
                ai_version="test_v1",
                created_at=datetime.now(),
                last_updated=datetime.now()
            )
            
            session.add(test_bill)
            session.commit()
            
            # Check count after
            count_after = session.query(StateLegislationDB).count()
            print(f"📊 Records after test: {count_after}")
            
            if count_after > count_before:
                print("✅ Table insert/query operations work!")
                
                # Clean up test record
                session.delete(test_bill)
                session.commit()
                print("🧹 Test record cleaned up")
                
                return True
            else:
                print("❌ Table operations failed")
                return False
                
    except Exception as e:
        print(f"❌ Table operations test failed: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Quick Database Table Creation")
    print("=" * 40)
    
    # Step 1: Create tables
    tables_created = create_missing_tables()
    
    if tables_created:
        # Step 2: Test operations
        operations_ok = test_table_operations()
        
        if operations_ok:
            print("\n✅ SUCCESS! Your database is ready!")
            print("\n📋 Next steps:")
            print("1. Your LegiScan search should now save bills to the database")
            print("2. Your frontend should display the analyzed bills")
            print("3. Try your search again!")
            
            print("\n🔧 Test your LegiScan endpoint:")
            print('curl -X POST "http://localhost:8000/api/legiscan/search-and-analyze" \\')
            print('-H "Content-Type: application/json" \\')
            print('-d \'{"query": "healthcare", "state": "CA", "limit": 3, "save_to_db": true}\'')
        else:
            print("\n⚠️ Tables created but operations failed")
    else:
        print("\n❌ Failed to create tables")
        
        # Show alternative approach
        print("\n🔧 Alternative: Manual table creation")
        print("Try running this in Python:")
        print("from database_fixed import Base, engine")
        print("Base.metadata.create_all(engine)")