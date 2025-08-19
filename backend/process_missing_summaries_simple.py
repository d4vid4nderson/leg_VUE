#!/usr/bin/env python3
"""
Process Missing AI Summaries for State Legislation Bills (Simplified Version)

This script will:
1. Find all bills without AI summaries using the API
2. Generate AI summaries using Azure OpenAI directly
3. Update the database via API calls
"""

import asyncio
import requests
import json
import time
from datetime import datetime
from typing import List, Dict, Any
from openai import AsyncAzureOpenAI
import os
import re

# Azure OpenAI Configuration (from your ai.py)
AZURE_ENDPOINT = os.getenv("AZURE_ENDPOINT", "val here")
AZURE_KEY = os.getenv("AZURE_KEY", "key here") 
MODEL_NAME = os.getenv("AZURE_MODEL_NAME", "summarize-gpt-4.1")

# Initialize Azure OpenAI client
client = AsyncAzureOpenAI(
    azure_endpoint=AZURE_ENDPOINT,
    api_key=AZURE_KEY,
    api_version="2024-02-15-preview"
)

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

class SimpleMissingSummaryProcessor:
    def __init__(self, base_url: str = "http://localhost:8000", batch_size: int = 5, delay: float = 1.0):
        self.base_url = base_url
        self.batch_size = batch_size
        self.delay = delay
        self.processed_count = 0
        self.error_count = 0
        self.start_time = None
        
    def get_bills_without_summaries(self, limit: int = None) -> List[Dict[str, Any]]:
        """Get bills without AI summaries via API"""
        try:
            bills_without_summaries = []
            offset = 0
            page_size = 1000
            
            print("🔍 Fetching bills without summaries...")
            
            while True:
                # Get a batch of bills
                response = requests.get(f"{self.base_url}/api/state-legislation", params={
                    'limit': page_size,
                    'offset': offset
                })
                
                if response.status_code != 200:
                    print(f"❌ Error fetching bills: {response.status_code}")
                    break
                
                data = response.json()
                bills = data.get('results', [])
                
                if not bills:
                    break
                
                # Filter for bills without summaries
                for bill in bills:
                    ai_summary = bill.get('ai_summary', '')
                    summary = bill.get('summary', '')
                    title = bill.get('title', '')
                    
                    # Check if bill needs a summary
                    if not (ai_summary and ai_summary.strip()) and not (summary and summary.strip()) and title.strip():
                        bills_without_summaries.append(bill)
                        
                        if limit and len(bills_without_summaries) >= limit:
                            return bills_without_summaries
                
                offset += page_size
                print(f"📄 Processed {offset} bills, found {len(bills_without_summaries)} without summaries")
                
                # If we got fewer bills than requested, we're at the end
                if len(bills) < page_size:
                    break
            
            print(f"📋 Found {len(bills_without_summaries)} total bills without summaries")
            return bills_without_summaries
            
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
        """Clean and format summary"""
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
                model=MODEL_NAME,
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
    
    def update_bill_via_api(self, bill_id: int, ai_summary: str, category: str) -> bool:
        """Update bill via API (if available) or direct database call"""
        # For now, we'll use direct database update since we don't have a PUT API
        # You could add this to your main.py API if needed
        try:
            import pyodbc
            
            # Use the same connection logic as your main.py
            is_container = bool(os.getenv("CONTAINER_APP_NAME") or os.getenv("MSI_ENDPOINT"))
            server = os.getenv('AZURE_SQL_SERVER', 'sql-legislation-tracker.database.windows.net')
            database = os.getenv('AZURE_SQL_DATABASE', 'db-executiveorders')
            
            if is_container:
                connection_string = (
                    "Driver={ODBC Driver 18 for SQL Server};"
                    f"Server=tcp:{server},1433;"
                    f"Database={database};"
                    "Authentication=ActiveDirectoryMSI;"
                    "Encrypt=yes;"
                    "TrustServerCertificate=no;"
                    "Connection Timeout=30;"
                )
            else:
                username = os.getenv('AZURE_SQL_USERNAME')
                password = os.getenv('AZURE_SQL_PASSWORD')
                if not username or not password:
                    print("❌ SQL credentials required")
                    return False
                    
                connection_string = (
                    "Driver={ODBC Driver 18 for SQL Server};"
                    f"Server=tcp:{server},1433;"
                    f"Database={database};"
                    f"UID={username};"
                    f"PWD={password};"
                    "Encrypt=yes;"
                    "TrustServerCertificate=no;"
                    "Connection Timeout=30;"
                )
            
            conn = pyodbc.connect(connection_string, timeout=30)
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
        """Process a single bill"""
        try:
            bill_id = bill.get('id')
            bill_number = bill.get('bill_number', '')
            title = bill.get('title', '')
            description = bill.get('description', '')
            state = bill.get('state', '')
            
            print(f"🔄 Processing {state} {bill_number}: {title[:50]}...")
            
            # Generate AI summary
            ai_summary = await self.generate_ai_summary(title, description, state, bill_number)
            
            # Categorize bill
            category = self.categorize_bill(title, description)
            
            # Update database
            success = self.update_bill_via_api(bill_id, ai_summary, category)
            
            if success:
                self.processed_count += 1
                print(f"✅ Updated {state} {bill_number}")
                return True
            else:
                self.error_count += 1
                return False
                
        except Exception as e:
            self.error_count += 1
            print(f"❌ Error processing bill: {e}")
            return False
    
    async def process_batch(self, bills: List[Dict[str, Any]]) -> None:
        """Process a batch of bills"""
        print(f"\n🚀 Processing batch of {len(bills)} bills...")
        
        tasks = [self.process_bill(bill) for bill in bills]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        successful = sum(1 for r in results if r is True)
        failed = len(bills) - successful
        
        print(f"📊 Batch complete: {successful} successful, {failed} failed")
        
        if self.delay > 0:
            print(f"⏱️  Waiting {self.delay} seconds...")
            await asyncio.sleep(self.delay)
    
    async def process_all_missing_summaries(self, limit: int = None) -> None:
        """Process all missing summaries"""
        self.start_time = time.time()
        
        print("🚀 Starting AI Summary Processing (Simplified)")
        print("=" * 50)
        
        # Get bills without summaries
        bills = self.get_bills_without_summaries(limit)
        
        if not bills:
            print("✅ No bills found without AI summaries!")
            return
        
        total_bills = len(bills)
        print(f"📋 Found {total_bills} bills to process")
        
        # Process in batches
        for i in range(0, total_bills, self.batch_size):
            batch = bills[i:i + self.batch_size]
            current_batch = i // self.batch_size + 1
            total_batches = (total_bills + self.batch_size - 1) // self.batch_size
            
            print(f"\n📦 Batch {current_batch}/{total_batches}")
            await self.process_batch(batch)
            
            # Progress update
            current = min(i + self.batch_size, total_bills)
            print(f"📈 Progress: {current}/{total_bills} ({current/total_bills*100:.1f}%)")
        
        # Final summary
        elapsed_time = time.time() - self.start_time
        print(f"\n🎉 Processing Complete!")
        print("=" * 50)
        print(f"📊 Total processed: {self.processed_count}")
        print(f"❌ Errors: {self.error_count}")
        print(f"⏱️  Time: {elapsed_time/60:.1f} minutes")

async def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Process missing AI summaries')
    parser.add_argument('--limit', type=int, help='Limit number of bills to process')
    parser.add_argument('--batch-size', type=int, default=3, help='Batch size')
    parser.add_argument('--delay', type=float, default=1.0, help='Delay between batches')
    
    args = parser.parse_args()
    
    processor = SimpleMissingSummaryProcessor(
        batch_size=args.batch_size,
        delay=args.delay
    )
    
    await processor.process_all_missing_summaries(limit=args.limit)

if __name__ == "__main__":
    asyncio.run(main())
