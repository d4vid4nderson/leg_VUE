#!/usr/bin/env python3
"""
Process Missing AI Summaries for State Legislation Bills

This script will:
1. Find all bills without AI summaries
2. Generate AI summaries using the state bill summary prompt
3. Update the database with the new summaries
4. Process in batches to avoid overwhelming the AI service
"""

import asyncio
import sys
import os
import time
from datetime import datetime
from typing import List, Dict, Any

# Add current directory to Python path
sys.path.insert(0, '.')

# Import your existing modules
try:
    from ai import get_state_bill_summary, categorize_bill, BillCategory
    from main import get_azure_sql_connection
    print("✅ Successfully imported AI and database modules")
except ImportError as e:
    print(f"❌ Error importing modules: {e}")
    print("Make sure you're running this from the backend directory")
    sys.exit(1)

class MissingSummaryProcessor:
    def __init__(self, batch_size: int = 10, delay_between_batches: float = 2.0):
        self.batch_size = batch_size
        self.delay_between_batches = delay_between_batches
        self.processed_count = 0
        self.error_count = 0
        self.start_time = None
        
    def get_bills_without_summaries(self, limit: int = None) -> List[Dict[str, Any]]:
        """Get all bills that don't have AI summaries"""
        try:
            conn = get_azure_sql_connection()
            cursor = conn.cursor()
            
            query = """
                SELECT TOP {} id, bill_id, bill_number, title, description, state, state_abbr, 
                       session_name, introduced_date, last_action_date, category, ai_version
                FROM state_legislation 
                WHERE (ai_summary IS NULL OR ai_summary = '') 
                  AND (summary IS NULL OR summary = '')
                  AND title IS NOT NULL 
                  AND title != ''
                ORDER BY state, bill_number
            """.format(limit if limit else 10000)  # Default limit to prevent overwhelming
            
            cursor.execute(query)
            bills = []
            
            for row in cursor.fetchall():
                bills.append({
                    'id': row[0],
                    'bill_id': row[1],
                    'bill_number': row[2],
                    'title': row[3],
                    'description': row[4] or '',
                    'state': row[5],
                    'state_abbr': row[6],
                    'session_name': row[7] or '',
                    'introduced_date': row[8],
                    'last_action_date': row[9],
                    'category': row[10] or '',
                    'ai_version': row[11]
                })
            
            conn.close()
            print(f"📋 Found {len(bills)} bills without AI summaries")
            return bills
            
        except Exception as e:
            print(f"❌ Error getting bills without summaries: {e}")
            return []
    
    def update_bill_summary(self, bill_id: int, ai_summary: str, category: str, ai_version: str) -> bool:
        """Update a bill's AI summary in the database"""
        try:
            conn = get_azure_sql_connection()
            cursor = conn.cursor()
            
            update_query = """
                UPDATE state_legislation 
                SET ai_summary = ?, 
                    summary = ?, 
                    category = ?, 
                    ai_version = ?,
                    last_updated = ?
                WHERE id = ?
            """
            
            current_time = datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
            cursor.execute(update_query, (
                ai_summary, ai_summary, category, ai_version, current_time, bill_id
            ))
            
            conn.commit()
            conn.close()
            return True
            
        except Exception as e:
            print(f"❌ Error updating bill {bill_id}: {e}")
            return False
    
    async def process_bill(self, bill: Dict[str, Any]) -> bool:
        """Process a single bill to generate AI summary"""
        try:
            bill_id = bill['id']
            bill_number = bill['bill_number']
            title = bill['title']
            description = bill['description']
            state = bill['state']
            
            print(f"🔄 Processing {state} {bill_number}: {title[:50]}...")
            
            # Build content for AI processing
            content_parts = []
            if title:
                content_parts.append(f"Title: {title}")
            if state:
                content_parts.append(f"State: {state}")
            if bill_number:
                content_parts.append(f"Bill Number: {bill_number}")
            if description:
                content_parts.append(f"Description: {description}")
            if bill['session_name']:
                content_parts.append(f"Legislative Session: {bill['session_name']}")
            
            content = "\n\n".join(content_parts)
            
            # Generate AI summary using your existing function
            context = f"State Bill - {state} {bill_number}" if state and bill_number else "State Legislation"
            ai_summary = await get_state_bill_summary(content, context)
            
            # Categorize the bill
            category = categorize_bill(title, description)
            
            # Update the database
            success = self.update_bill_summary(
                bill_id=bill_id,
                ai_summary=ai_summary,
                category=category.value,
                ai_version='azure_openai_v2_simplified'
            )
            
            if success:
                self.processed_count += 1
                print(f"✅ Updated {state} {bill_number}")
                return True
            else:
                self.error_count += 1
                print(f"❌ Failed to update {state} {bill_number}")
                return False
                
        except Exception as e:
            self.error_count += 1
            print(f"❌ Error processing bill {bill.get('bill_number', 'unknown')}: {e}")
            return False
    
    async def process_batch(self, bills: List[Dict[str, Any]]) -> None:
        """Process a batch of bills concurrently"""
        print(f"\n🚀 Processing batch of {len(bills)} bills...")
        
        # Process bills in the batch concurrently
        tasks = [self.process_bill(bill) for bill in bills]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Count successful vs failed
        successful = sum(1 for r in results if r is True)
        failed = len(bills) - successful
        
        print(f"📊 Batch complete: {successful} successful, {failed} failed")
        
        if self.delay_between_batches > 0:
            print(f"⏱️  Waiting {self.delay_between_batches} seconds before next batch...")
            await asyncio.sleep(self.delay_between_batches)
    
    def print_progress(self, current: int, total: int) -> None:
        """Print progress information"""
        if self.start_time:
            elapsed = time.time() - self.start_time
            rate = current / elapsed if elapsed > 0 else 0
            remaining = (total - current) / rate if rate > 0 else 0
            
            print(f"\n📈 Progress: {current}/{total} ({current/total*100:.1f}%)")
            print(f"✅ Processed: {self.processed_count}")
            print(f"❌ Errors: {self.error_count}")
            print(f"⏱️  Rate: {rate:.1f} bills/second")
            print(f"🕐 Estimated time remaining: {remaining/60:.1f} minutes")
    
    async def process_all_missing_summaries(self, limit: int = None) -> None:
        """Main function to process all bills missing AI summaries"""
        self.start_time = time.time()
        
        print("🚀 Starting AI Summary Processing for State Legislation")
        print("=" * 60)
        
        # Get all bills without summaries
        bills = self.get_bills_without_summaries(limit)
        
        if not bills:
            print("✅ No bills found without AI summaries!")
            return
        
        total_bills = len(bills)
        print(f"📋 Found {total_bills} bills to process")
        
        # Group bills by state for reporting
        by_state = {}
        for bill in bills:
            state = bill['state']
            by_state[state] = by_state.get(state, 0) + 1
        
        print(f"\n📊 Bills to process by state:")
        for state, count in sorted(by_state.items(), key=lambda x: x[1], reverse=True):
            print(f"   {state}: {count} bills")
        
        # Process in batches
        print(f"\n🔄 Processing in batches of {self.batch_size}...")
        
        for i in range(0, total_bills, self.batch_size):
            batch = bills[i:i + self.batch_size]
            current_batch = i // self.batch_size + 1
            total_batches = (total_bills + self.batch_size - 1) // self.batch_size
            
            print(f"\n📦 Batch {current_batch}/{total_batches}")
            await self.process_batch(batch)
            
            self.print_progress(min(i + self.batch_size, total_bills), total_bills)
        
        # Final summary
        elapsed_time = time.time() - self.start_time
        print(f"\n🎉 Processing Complete!")
        print("=" * 60)
        print(f"📊 Total bills processed: {self.processed_count}")
        print(f"❌ Errors encountered: {self.error_count}")
        print(f"⏱️  Total time: {elapsed_time/60:.1f} minutes")
        print(f"📈 Average rate: {self.processed_count/elapsed_time:.1f} bills/second")
        
        if self.processed_count > 0:
            print(f"\n✅ Successfully generated AI summaries for {self.processed_count} bills!")
            print("💡 Bills should now appear with summaries on your frontend")
        
        if self.error_count > 0:
            print(f"\n⚠️  {self.error_count} bills had errors - you may want to retry these")

async def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Process missing AI summaries for state legislation')
    parser.add_argument('--limit', type=int, help='Limit number of bills to process (for testing)')
    parser.add_argument('--batch-size', type=int, default=5, help='Number of bills to process concurrently')
    parser.add_argument('--delay', type=float, default=1.0, help='Delay between batches (seconds)')
    
    args = parser.parse_args()
    
    processor = MissingSummaryProcessor(
        batch_size=args.batch_size,
        delay_between_batches=args.delay
    )
    
    await processor.process_all_missing_summaries(limit=args.limit)

if __name__ == "__main__":
    # Run the async main function
    asyncio.run(main())
