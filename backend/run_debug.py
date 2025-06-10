# run_debug.py - Quick script to run the debug tool
from debug_federal_register import run_comprehensive_debug

if __name__ == "__main__":
    print("🔍 Running Federal Register API Debug Analysis...")
    print("This will help us understand why only 5 executive orders are being found.")
    print()
    
    try:
        found_eos = run_comprehensive_debug()
        
        print("\n" + "="*80)
        print("🎯 DEBUG ANALYSIS COMPLETE")
        print("="*80)
        
        if len(found_eos) <= 5:
            print("\n🚨 ISSUE CONFIRMED: Only finding 5 or fewer executive orders")
            print("\nPossible causes:")
            print("1. Federal Register API may not have all Trump 2025 orders yet")
            print("2. Some orders might be published as memoranda, not executive orders") 
            print("3. Date range might be too restrictive")
            print("4. API search parameters might need adjustment")
            print("5. Some orders might be in 'pending publication' status")
            
            print("\n🔧 Next steps:")
            print("1. Check the official White House executive orders page")
            print("2. Compare with Federal Register website manually")
            print("3. Expand search to include memoranda and proclamations")
            print("4. Try searching by specific order titles/topics")
            
        else:
            print(f"\n✅ Found {len(found_eos)} executive orders - filtering may be working!")
            
    except Exception as e:
        print(f"\n❌ Debug analysis failed: {e}")
        print("Check your internet connection and try again.")