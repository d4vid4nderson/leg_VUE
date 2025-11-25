#!/usr/bin/env python3
"""
Generate AI Summaries for State Legislation Bills

This script:
1. Loads environment variables from .env file
2. Connects to Azure OpenAI
3. Finds bills without AI summaries
4. Generates summaries using the state bill prompt from ai.py
5. Updates the database
6. Works in batches to avoid overloading the AI service
"""

import asyncio
import os
import sys
import time
import json
import re
import requests
from datetime import datetime
from typing import List, Dict, Any, Optional

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    print("✅ Imported dotenv module")
    
    # Load .env file
    load_dotenv()
    print("✅ Loaded environment variables from .env file")
except ImportError:
    print("⚠️ dotenv module not found, trying to load .env manually")
    try:
        # Manual load of .env file
        with open('.env', 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    key, value = line.split('=', 1)
                    os.environ[key] = value
        print("✅ Manually loaded .env file")
    except Exception as e:
        print(f"❌ Failed to load .env file: {e}")

# Check if OpenAI is available
try:
    from openai import AsyncAzureOpenAI
    print("✅ Imported AsyncAzureOpenAI module")
except ImportError:
    print("❌ OpenAI module not found. Installing required dependencies...")
    import subprocess
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'openai>=1.0.0'])
    from openai import AsyncAzureOpenAI
    print("✅ Installed and imported AsyncAzureOpenAI module")

# Check for required Azure OpenAI variables
AZURE_ENDPOINT = os.getenv("AZURE_ENDPOINT")
AZURE_KEY = os.getenv("AZURE_KEY")
AZURE_MODEL_NAME = os.getenv("AZURE_MODEL_NAME", "gpt-4o-mini")

if not all([AZURE_ENDPOINT, AZURE_KEY, AZURE_MODEL_NAME]):
    print("❌ Missing required Azure OpenAI environment variables.")
    print(f"   AZURE_ENDPOINT: {'✅ Set' if AZURE_ENDPOINT else '❌ Not set'}")
    print(f"   AZURE_KEY: {'✅ Set' if AZURE_KEY else '❌ Not set'}")
    print(f"   AZURE_MODEL_NAME: {'✅ Set' if AZURE_MODEL_NAME else '❌ Not set'}")
    sys.exit(1)

print(f"🔑 Using Azure OpenAI endpoint: {AZURE_ENDPOINT}")
print(f"🔑 Using Azure OpenAI model: {AZURE_MODEL_NAME}")

# Initialize Azure OpenAI client
client = AsyncAzureOpenAI(
    azure_endpoint=AZURE_ENDPOINT,
    api_key=AZURE_KEY,
    api_version="2024-02-15-preview"
)

# Check for SQL Database credentials
AZURE_SQL_SERVER = os.getenv("AZURE_SQL_SERVER")
AZURE_SQL_DATABASE = os.getenv("AZURE_SQL_DATABASE")
AZURE_SQL_USERNAME = os.getenv("AZURE_SQL_USERNAME")
AZURE_SQL_PASSWORD = os.getenv("AZURE_SQL_PASSWORD")

if not all([AZURE_SQL_SERVER, AZURE_SQL_DATABASE, AZURE_SQL_USERNAME, AZURE_SQL_PASSWORD]):
    print("❌ Missing required Azure SQL Database environment variables.")
    print(f"   AZURE_SQL_SERVER: {'✅ Set' if AZURE_SQL_SERVER else '❌ Not set'}")
    print(f"   AZURE_SQL_DATABASE: {'✅ Set' if AZURE_SQL_DATABASE else '❌ Not set'}")
    print(f"   AZURE_SQL_USERNAME: {'✅ Set' if AZURE_SQL_USERNAME else '❌ Not set'}")
    print(f"   AZURE_SQL_PASSWORD: {'✅ Set' if AZURE_SQL_PASSWORD else '❌ Not set'}")
    sys.exit(1)

print(f"🔑 Using Azure SQL Server: {AZURE_SQL_SERVER}")
print(f"🔑 Using Azure SQL Database: {AZURE_SQL_DATABASE}")

# State Bill Summary Prompt (from your ai.py)
STATE_BILL_SUMMARY_PROMPT = """
Write a clear, natural summary of this state bill that sounds like it was written by a knowledgeable policy analyst, not an AI.

CRITICAL INSTRUCTIONS:
- Write in simple, everyday English that anyone can understand
- Vary your sentence structure and opening - DO NOT use formulaic patterns
- Avoid AI-sounding phrases like "This legislation aims to..." or "The bill seeks to..."
- Don't use overly formal or robotic language
- Write as if explaining to a neighbor what this bill actually does
- Be specific about the actual changes, not vague generalizations
- Use active voice when possible
- Keep it between 4-6 sentences (100-150 words)

Focus on: What problem does this solve? What specific changes will happen? Who will notice the difference? When would this take effect?

Write naturally - each summary should sound unique based on what the specific bill actually does.

State Bill Content: {text}
"""

SYSTEM_MESSAGE = "You are a local policy expert who explains legislation to community members in plain English. You write naturally and conversationally, like you're talking to a neighbor over coffee. You avoid formulaic AI patterns and corporate jargon. Each summary you write sounds unique and human, focusing on what actually matters to regular people. You never use templates or robotic phrases."

class BillSummaryGenerator:
    def __init__(self, batch_size: int = 5, delay_between_batches: float = 1.0):
        self.batch_size = batch_size
        self.delay_between_batches = delay_between_batches
        self.processed_count = 0
        self.error_count = 0
        self.start_time = None
        
    def get_database_connection(self):
        """Get direct connection to the database"""
        try:
            import pyodbc
            
            connection_string = (
                "Driver={ODBC Driver 18 for SQL Server};"
                f"Server=tcp:{AZURE_SQL_SERVER},1433;"
                f"Database={AZURE_SQL_DATABASE};"
                f"UID={AZURE_SQL_USERNAME};"
                f"PWD={AZURE_SQL_PASSWORD};"
                "Encrypt=yes;"
                "TrustServerCertificate=no;"
                "Connection Timeout=30;"
            )
            
            conn = pyodbc.connect(connection_string, timeout=30)
            conn.autocommit = False
            print("✅ Successfully connected to the database")
            return conn
            
        except Exception as e:
            print(f"❌ Error connecting to database: {e}")
            return None
    
    def get_bills_without_summaries(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Get bills that don't have AI summaries"""
        try:
            conn = self.get_database_connection()
            if not conn:
                return []
                
            cursor = conn.cursor()
            
            # Query for bills without summaries
            limit_clause = f"TOP {limit}" if limit else "TOP 10000"
            query = f"""
                SELECT {limit_clause} 
                       id, bill_id, bill_number, title, description, 
                       state, state_abbr, session_name
                FROM state_legislation 
                WHERE (ai_summary IS NULL OR ai_summary = '') 
                  AND (summary IS NULL OR summary = '')
                  AND title IS NOT NULL 
                  AND title != ''
                ORDER BY state, bill_number
            """
            
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
                    'session_name': row[7] or ''
                })
            
            conn.close()
            print(f"📋 Found {len(bills)} bills without AI summaries")
            return bills
            
        except Exception as e:
            print(f"❌ Error getting bills without summaries: {e}")
            return []
    
    def categorize_bill(self, title: str, description: str) -> str:
        """Simple bill categorization"""
        content = f"{title} {description}".lower().strip()
        
        if not content:
            return "not_applicable"
        
        if any(word in content for word in ['health', 'medical', 'healthcare', 'medicine', 'hospital', 'patient']):
            return "healthcare"
        elif any(word in content for word in ['education', 'school', 'student', 'university', 'college']):
            return "education"
        elif any(word in content for word in ['infrastructure', 'engineering', 'construction', 'bridge', 'road']):
            return "engineering"
        elif any(word in content for word in ['business', 'commerce', 'trade', 'economic']):
            return "business"
        elif any(word in content for word in ['environment', 'climate', 'pollution', 'conservation']):
            return "environment"
        elif any(word in content for word in ['government', 'federal', 'agency', 'department', 'civic']):
            return "civic"
        else:
            return "not_applicable"
    
    def clean_summary_format(self, text: str) -> str:
        """Clean and format summary for HTML"""
        if not text:
            return "<p>No summary available</p>"
        
        # Remove any bullet points or numbering
        text = re.sub(r'^\s*[•\-\*]\s*', '', text, flags=re.MULTILINE)
        text = re.sub(r'^\s*\d+\.\s*', '', text, flags=re.MULTILINE)
        
        # Split into sentences and rejoin as paragraphs
        sentences = text.strip().split('. ')
        
        if len(sentences) <= 3:
            return f"<p>{'. '.join(sentences)}</p>"
        else:
            mid = len(sentences) // 2
            para1 = '. '.join(sentences[:mid]) + '.'
            para2 = '. '.join(sentences[mid:])
            return f"<p>{para1}</p><p>{para2}</p>"
    
    async def generate_ai_summary(self, title: str, description: str, state: str, bill_number: str) -> str:
        """Generate AI summary using Azure OpenAI"""
        try:
            print(f"🤖 Generating AI summary for {state} {bill_number}...")
            
            # Build content
            content_parts = []
            if title:
                content_parts.append(f"Title: {title}")
            if state:
                content_parts.append(f"State: {state}")
            if bill_number:
                content_parts.append(f"Bill Number: {bill_number}")
            if description:
                content_parts.append(f"Description: {description}")
            
            content = "\n\n".join(content_parts)
            
            # Prepare prompt
            prompt = STATE_BILL_SUMMARY_PROMPT.format(text=content)
            
            messages = [
                {"role": "system", "content": SYSTEM_MESSAGE},
                {"role": "user", "content": prompt}
            ]
            
            # Call Azure OpenAI
            response = await client.chat.completions.create(
                model=AZURE_MODEL_NAME,
                messages=messages,
                temperature=0.7,
                max_tokens=250,
                timeout=60,
                top_p=0.95,
                frequency_penalty=0.3,
                presence_penalty=0.2
            )
            
            raw_response = response.choices[0].message.content
            formatted_response = self.clean_summary_format(raw_response)
            
            return formatted_response
            
        except Exception as e:
            print(f"❌ Error generating AI summary: {e}")
            return f"<p>Error generating summary: {str(e)}</p>"
    
    def update_bill_summary(self, bill_id: int, ai_summary: str, category: str) -> bool:
        """Update bill in the database with new AI summary"""
        try:
            conn = self.get_database_connection()
            if not conn:
                return False
                
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
                ai_summary, ai_summary, category, 'azure_openai_v2_simplified', current_time, bill_id
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
            
            # Generate AI summary
            ai_summary = await self.generate_ai_summary(title, description, state, bill_number)
            
            # Skip update if we got an error
            if ai_summary.startswith("<p>Error generating summary:"):
                self.error_count += 1
                print(f"❌ Failed to generate summary for {state} {bill_number}")
                return False
            
            # Categorize the bill
            category = self.categorize_bill(title, description)
            
            # Update the database
            success = self.update_bill_summary(bill_id, ai_summary, category)
            
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
    
    async def process_all_missing_summaries(self, limit: Optional[int] = None, state_filter: Optional[str] = None) -> None:
        """Main function to process all bills missing AI summaries"""
        self.start_time = time.time()
        
        print("🚀 Starting AI Summary Processing for State Legislation")
        print("=" * 60)
        
        # Get all bills without summaries
        bills = self.get_bills_without_summaries(limit)
        
        if not bills:
            print("✅ No bills found without AI summaries!")
            return
            
        # Apply state filter if provided
        if state_filter:
            print(f"🔍 Filtering for state: {state_filter}")
            bills = [b for b in bills if b['state'] == state_filter or b['state_abbr'] == state_filter]
            print(f"📋 Found {len(bills)} bills for state {state_filter}")
        
        total_bills = len(bills)
        
        if total_bills == 0:
            print("✅ No bills found matching the criteria!")
            return
            
        print(f"📋 Processing {total_bills} bills total")
        
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
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Generate AI summaries for state legislation bills')
    parser.add_argument('--limit', type=int, help='Limit number of bills to process')
    parser.add_argument('--batch-size', type=int, default=5, help='Number of bills to process concurrently')
    parser.add_argument('--delay', type=float, default=1.0, help='Delay between batches (seconds)')
    parser.add_argument('--state', type=str, help='Process only bills for this state (e.g., NV, CA, TX)')
    
    args = parser.parse_args()
    
    processor = BillSummaryGenerator(
        batch_size=args.batch_size,
        delay_between_batches=args.delay
    )
    
    await processor.process_all_missing_summaries(limit=args.limit, state_filter=args.state)

if __name__ == "__main__":
    # Check for required dependencies
    try:
        import pyodbc
        print("✅ Found pyodbc module")
    except ImportError:
        print("❌ pyodbc module not found. Please install:")
        print("pip install pyodbc")
        sys.exit(1)
        
    # Run the async main function
    asyncio.run(main())
