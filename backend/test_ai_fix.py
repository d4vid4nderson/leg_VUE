#!/usr/bin/env python3
"""
Test script to verify AI analysis now includes talking points and business impacts
"""

import asyncio
import sys
from ai import analyze_executive_order

async def test_executive_order_analysis():
    """Test executive order analysis with all three components"""
    print("🧪 Testing Executive Order AI Analysis")
    print("=" * 60)

    # Sample executive order
    title = "Strengthening American Leadership in Clean Energy Industries and Jobs"
    abstract = """This executive order establishes a comprehensive framework for
    advancing clean energy manufacturing and deployment across the United States.
    It directs federal agencies to accelerate permitting for renewable energy projects,
    provide incentives for domestic manufacturing of solar panels and wind turbines,
    and create workforce development programs for clean energy jobs."""
    order_number = "14117"

    print(f"Testing with: EO {order_number}")
    print(f"Title: {title[:60]}...")
    print()

    try:
        result = await analyze_executive_order(title, abstract, order_number)

        print("✅ Analysis Complete!")
        print("=" * 60)

        # Check executive summary
        if result.get('ai_executive_summary'):
            summary = result['ai_executive_summary']
            print(f"\n📝 Executive Summary ({len(summary)} chars):")
            print(f"{summary[:200]}...")
            print("✅ Executive Summary: PRESENT")
        else:
            print("❌ Executive Summary: MISSING")

        # Check talking points
        if result.get('ai_talking_points'):
            points = result['ai_talking_points']
            print(f"\n💬 Talking Points ({len(points)} chars):")
            print(f"{points[:200]}...")
            print("✅ Talking Points: PRESENT")
        else:
            print("❌ Talking Points: MISSING")

        # Check business impact
        if result.get('ai_business_impact'):
            impact = result['ai_business_impact']
            print(f"\n💼 Business Impact ({len(impact)} chars):")
            print(f"{impact[:200]}...")
            print("✅ Business Impact: PRESENT")
        else:
            print("❌ Business Impact: MISSING")

        # Summary
        print("\n" + "=" * 60)
        all_present = (
            result.get('ai_executive_summary') and
            result.get('ai_talking_points') and
            result.get('ai_business_impact')
        )

        if all_present:
            print("🎉 SUCCESS: All three AI components are present!")
            return True
        else:
            print("⚠️ FAILURE: Some AI components are missing")
            return False

    except Exception as e:
        print(f"❌ Error during analysis: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(test_executive_order_analysis())
    sys.exit(0 if success else 1)
