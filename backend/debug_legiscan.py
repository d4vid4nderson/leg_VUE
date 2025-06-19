# DEBUG SCRIPT TO CHECK LEGISCAN ISSUE
# Save this as debug_legiscan.py and run it

import os
import sys

def check_legiscan_setup():
    """Check what's wrong with LegiScan setup"""
    
    print("🔍 DEBUGGING LEGISCAN SETUP")
    print("=" * 50)
    
    # 1. Check current directory
    current_dir = os.getcwd()
    print(f"📁 Current directory: {current_dir}")
    
    # 2. List files in current directory
    files = os.listdir(current_dir)
    print(f"📋 Files in current directory:")
    for file in sorted(files):
        if file.endswith('.py'):
            print(f"   ✅ {file}")
    
    # 3. Check if legiscan_api.py exists
    legiscan_file = os.path.join(current_dir, 'legiscan_api.py')
    legiscan_exists = os.path.exists(legiscan_file)
    print(f"\n🔍 legiscan_api.py exists: {'✅ YES' if legiscan_exists else '❌ NO'}")
    
    if legiscan_exists:
        # Check file size to make sure it's not empty
        file_size = os.path.getsize(legiscan_file)
        print(f"📏 File size: {file_size} bytes")
        
        if file_size > 1000:
            print("✅ File appears to be a real Python file")
        else:
            print("⚠️ File seems too small - might be empty or corrupted")
    
    # 4. Check .env file
    env_file = os.path.join(current_dir, '.env')
    env_exists = os.path.exists(env_file)
    print(f"\n🔍 .env file exists: {'✅ YES' if env_exists else '❌ NO'}")
    
    # 5. Check environment variable
    api_key = os.getenv('LEGISCAN_API_KEY')
    print(f"🔑 LEGISCAN_API_KEY: {'✅ SET' if api_key else '❌ NOT SET'}")
    
    if api_key:
        print(f"   Key preview: {api_key[:8]}{'*' * (len(api_key) - 8)}")
    
    # 6. Try to import the file
    print(f"\n🔍 Testing import...")
    try:
        # Add current directory to Python path
        if current_dir not in sys.path:
            sys.path.insert(0, current_dir)
        
        import legiscan_api
        print("✅ Import successful!")
        
        # Try to get the class
        if hasattr(legiscan_api, 'LegiScanAPI'):
            print("✅ LegiScanAPI class found!")
            
            # Try to initialize (this might fail due to missing API key)
            try:
                api = legiscan_api.LegiScanAPI()
                print("✅ LegiScanAPI can be initialized!")
            except Exception as e:
                print(f"⚠️ LegiScanAPI initialization failed: {e}")
                print("   (This is probably due to missing/invalid API key)")
        else:
            print("❌ LegiScanAPI class not found in file")
            
    except ImportError as e:
        print(f"❌ Import failed: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
    
    # 7. Recommendations
    print(f"\n💡 RECOMMENDATIONS:")
    
    if not legiscan_exists:
        print("   1. ❌ legiscan_api.py file is missing!")
        print("      → Make sure the file is in the same directory as main.py")
        print("      → Check if it's in a subdirectory")
    
    if not api_key:
        print("   2. ❌ LEGISCAN_API_KEY not set!")
        print("      → Add LEGISCAN_API_KEY=your_key_here to your .env file")
    
    if legiscan_exists and api_key:
        print("   3. ✅ Files and keys look good!")
        print("      → The issue might be with the import path in your main.py")
        print("      → Try restarting your FastAPI server")
    
    print(f"\n🎯 NEXT STEPS:")
    print("   1. Fix any issues above")
    print("   2. Restart your FastAPI server")
    print("   3. Test again with: python test_backend.py")

if __name__ == "__main__":
    check_legiscan_setup()