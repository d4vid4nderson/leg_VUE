#!/usr/bin/env python3
"""
Fix Executive Orders Missing Talking Points and Business Impact
This script regenerates AI analysis for executive orders that are missing
talking points or business impact fields.
"""

import asyncio
import sys
from datetime import datetime
from database_config import get_db_connection
from ai import analyze_executive_order

async def check_missing_ai_fields():
    """Check how many executive orders are missing AI fields"""
    print("🔍 Checking executive orders for missing AI fields...")
    print("=" * 60)

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Check total executive orders
        cursor.execute('SELECT COUNT(*) FROM dbo.executive_orders')
        total = cursor.fetchone()[0]

        # Check missing talking points
        cursor.execute('''
            SELECT COUNT(*) FROM dbo.executive_orders
            WHERE ai_talking_points IS NULL OR ai_talking_points = ''
        ''')
        missing_talking_points = cursor.fetchone()[0]

        # Check missing business impact
        cursor.execute('''
            SELECT COUNT(*) FROM dbo.executive_orders
            WHERE ai_business_impact IS NULL OR ai_business_impact = ''
        ''')
        missing_business_impact = cursor.fetchone()[0]

        # Check missing both
        cursor.execute('''
            SELECT COUNT(*) FROM dbo.executive_orders
            WHERE (ai_talking_points IS NULL OR ai_talking_points = '')
            AND (ai_business_impact IS NULL OR ai_business_impact = '')
        ''')
        missing_both = cursor.fetchone()[0]

        print(f"📊 Total Executive Orders: {total}")
        print(f"❌ Missing Talking Points: {missing_talking_points} ({missing_talking_points/total*100:.1f}%)")
        print(f"❌ Missing Business Impact: {missing_business_impact} ({missing_business_impact/total*100:.1f}%)")
        print(f"❌ Missing Both: {missing_both} ({missing_both/total*100:.1f}%)")
        print()

        return {
            'total': total,
            'missing_talking_points': missing_talking_points,
            'missing_business_impact': missing_business_impact,
            'missing_both': missing_both
        }

async def fix_executive_orders(batch_size=10, dry_run=False):
    """Regenerate AI analysis for executive orders missing fields"""

    stats = await check_missing_ai_fields()

    if stats['missing_both'] == 0:
        print("✅ All executive orders have complete AI analysis!")
        return 0

    print(f"\n🔧 {'DRY RUN - ' if dry_run else ''}Fixing {stats['missing_both']} executive orders...")
    print(f"Processing in batches of {batch_size}")
    print()

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Get executive orders that need fixing
        cursor.execute('''
            SELECT eo_number, title, summary, ai_executive_summary
            FROM dbo.executive_orders
            WHERE (ai_talking_points IS NULL OR ai_talking_points = '')
               OR (ai_business_impact IS NULL OR ai_business_impact = '')
            ORDER BY eo_number DESC
        ''')

        eos_to_fix = cursor.fetchall()

        total_to_fix = len(eos_to_fix)
        print(f"📋 Found {total_to_fix} executive orders to fix")
        print()

        if dry_run:
            print("🔍 DRY RUN - Showing what would be fixed:")
            for i, (eo_number, title, summary, ai_summary) in enumerate(eos_to_fix[:5], 1):
                print(f"{i}. EO {eo_number}: {title[:50] if title else 'No title'}...")
                print(f"   Has Summary: {'✅' if ai_summary else '❌'}")

            if total_to_fix > 5:
                print(f"   ... and {total_to_fix - 5} more")

            print()
            print("Run without --dry-run to actually fix these")
            return 0

        # Process in batches
        processed = 0
        successful = 0
        failed = 0

        for i in range(0, total_to_fix, batch_size):
            batch = eos_to_fix[i:i+batch_size]

            print(f"\n📦 Processing batch {i//batch_size + 1}/{(total_to_fix + batch_size - 1)//batch_size}")
            print("-" * 60)

            for eo_number, title, summary, existing_summary in batch:
                try:
                    processed += 1
                    print(f"[{processed}/{total_to_fix}] Processing EO {eo_number}...")

                    # Generate complete AI analysis
                    ai_result = await analyze_executive_order(
                        title=title or '',
                        abstract=summary or '',
                        order_number=str(eo_number)
                    )

                    if ai_result and isinstance(ai_result, dict):
                        executive_summary = ai_result.get('ai_executive_summary', '')
                        talking_points = ai_result.get('ai_talking_points', '')
                        business_impact = ai_result.get('ai_business_impact', '')

                        # Update database
                        cursor.execute('''
                            UPDATE dbo.executive_orders
                            SET ai_executive_summary = ?,
                                ai_talking_points = ?,
                                ai_business_impact = ?,
                                ai_summary = ?,
                                ai_key_points = ?,
                                ai_potential_impact = ?,
                                ai_version = ?,
                                last_updated = ?
                            WHERE eo_number = ?
                        ''', (
                            executive_summary[:2000] if executive_summary else '',
                            talking_points[:2000] if talking_points else '',
                            business_impact[:2000] if business_impact else '',
                            executive_summary[:2000] if executive_summary else '',
                            talking_points[:2000] if talking_points else '',  # ai_key_points
                            business_impact[:2000] if business_impact else '',  # ai_potential_impact
                            'azure_openai_backfill_v1',
                            datetime.now(),
                            eo_number
                        ))

                        conn.commit()

                        successful += 1
                        print(f"  ✅ Updated EO {eo_number}")
                        print(f"     Summary: {len(executive_summary)} chars")
                        print(f"     Talking Points: {len(talking_points)} chars")
                        print(f"     Business Impact: {len(business_impact)} chars")
                    else:
                        failed += 1
                        print(f"  ❌ Failed to generate AI for EO {eo_number}")

                    # Rate limiting
                    await asyncio.sleep(2)

                except Exception as e:
                    failed += 1
                    print(f"  ❌ Error processing EO {eo_number}: {e}")
                    continue

        print()
        print("=" * 60)
        print("📊 Final Results:")
        print(f"  Total Processed: {processed}")
        print(f"  ✅ Successful: {successful}")
        print(f"  ❌ Failed: {failed}")
        print(f"  Success Rate: {successful/processed*100:.1f}%")

        return successful

async def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description='Fix Executive Orders AI Analysis')
    parser.add_argument('--batch-size', type=int, default=10, help='Number of EOs to process at once')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be fixed without actually fixing')
    parser.add_argument('--check-only', action='store_true', help='Only check status, do not fix')

    args = parser.parse_args()

    print("🚀 Executive Orders AI Fix Script")
    print("=" * 60)
    print()

    if args.check_only:
        await check_missing_ai_fields()
        return 0

    try:
        fixed_count = await fix_executive_orders(
            batch_size=args.batch_size,
            dry_run=args.dry_run
        )

        print()
        print("🎉 Script completed successfully!")
        return 0

    except Exception as e:
        print(f"❌ Critical error: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
