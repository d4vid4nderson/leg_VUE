#!/usr/bin/env python3
"""
Check AI Summary Status for State Legislation Bills
This script analyzes how many bills have AI summaries vs those that don't.
"""

import requests
import json

def get_ai_summary_status():
    """Get AI summary status by querying the running server"""
    
    base_url = "http://localhost:8000"
    
    try:
        print("📊 Analyzing AI Summary Coverage for State Legislation Bills")
        print("=" * 70)
        
        # Get total count
        response = requests.get(f"{base_url}/api/state-legislation/count")
        if response.status_code == 200:
            data = response.json()
            total_bills = data.get('count', 0)
            print(f"📊 Total state legislation bills: {total_bills:,}")
        else:
            print(f"❌ Error getting total count: {response.status_code}")
            return
            
        # Get a sample of bills to analyze AI summary coverage
        print("\n🔍 Analyzing AI summary coverage...")
        
        # Query for bills to get a representative sample
        sample_response = requests.get(f"{base_url}/api/state-legislation", params={
            'limit': 1000,  # Get a good sample
            'offset': 0
        })
        
        if sample_response.status_code != 200:
            print(f"❌ Error getting sample bills: {sample_response.status_code}")
            return
            
        sample_data = sample_response.json()
        sample_bills = sample_data.get('results', [])
        
        if not sample_bills:
            print("❌ No bills found in sample")
            return
            
        print(f"📋 Analyzing sample of {len(sample_bills):,} bills...")
        
        # Analyze the sample
        with_ai_summary = 0
        without_ai_summary = 0
        state_breakdown = {}
        version_breakdown = {}
        
        for bill in sample_bills:
            ai_summary = bill.get('ai_summary', '')
            summary = bill.get('summary', '')
            state = bill.get('state', 'Unknown')
            ai_version = bill.get('ai_version', '')
            
            # Check if bill has any AI-generated summary
            has_summary = bool(ai_summary and ai_summary.strip()) or bool(summary and summary.strip())
            
            if has_summary:
                with_ai_summary += 1
                if ai_version:
                    version_breakdown[ai_version] = version_breakdown.get(ai_version, 0) + 1
            else:
                without_ai_summary += 1
                # Track states missing summaries
                state_breakdown[state] = state_breakdown.get(state, 0) + 1
        
        # Calculate percentages based on sample
        sample_total = len(sample_bills)
        with_pct = (with_ai_summary / sample_total) * 100 if sample_total > 0 else 0
        without_pct = (without_ai_summary / sample_total) * 100 if sample_total > 0 else 0
        
        print(f"\n✅ Bills WITH AI summaries: {with_ai_summary:,} ({with_pct:.1f}% of sample)")
        print(f"❌ Bills WITHOUT AI summaries: {without_ai_summary:,} ({without_pct:.1f}% of sample)")
        
        # Extrapolate to total database
        estimated_with_summary = int((with_ai_summary / sample_total) * total_bills) if sample_total > 0 else 0
        estimated_without_summary = total_bills - estimated_with_summary
        
        print(f"\n📊 Estimated totals (based on sample):")
        print(f"✅ Estimated bills WITH summaries: {estimated_with_summary:,}")
        print(f"❌ Estimated bills WITHOUT summaries: {estimated_without_summary:,}")
        
        # Show states with most missing summaries
        if state_breakdown:
            print(f"\n📋 States with most bills missing summaries (from sample):")
            sorted_states = sorted(state_breakdown.items(), key=lambda x: x[1], reverse=True)
            for state, count in sorted_states[:10]:
                print(f"   {state}: {count:,} bills missing summaries")
        
        # Show AI version breakdown
        if version_breakdown:
            print(f"\n🤖 AI versions used (from sample):")
            sorted_versions = sorted(version_breakdown.items(), key=lambda x: x[1], reverse=True)
            for version, count in sorted_versions:
                print(f"   {version}: {count:,} bills")
                
        print(f"\n💡 Next Steps:")
        if without_ai_summary > 0:
            print(f"   • Process {estimated_without_summary:,} bills that need AI summaries")
            print(f"   • Focus on states with most missing summaries")
            print(f"   • Use the state bill summary prompt from ai.py")
        else:
            print(f"   • All bills appear to have AI summaries! ✅")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    get_ai_summary_status()
