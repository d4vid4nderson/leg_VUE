#!/usr/bin/env python3
"""
Legislative Bill Processing Pipeline
Processes JSON bill files through Azure AI and saves to SQL database
Integrates with existing PoliticalVue infrastructure
"""

import os
import sys
import argparse
import asyncio
import json
import time
from datetime import datetime
from typing import Dict, Any, List, Optional
from pathlib import Path
import logging
from dataclasses import dataclass, asdict
import traceback

# Azure imports
from openai import AsyncAzureOpenAI
import pyodbc
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('bill_processing.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class ProcessingStats:
    """Track processing statistics"""
    total_bills: int = 0
    processed: int = 0
    successful: int = 0
    failed: int = 0
    skipped: int = 0
    start_time: datetime = None
    current_batch: int = 0
    total_batches: int = 0
    
    def get_progress_percentage(self) -> float:
        if self.total_bills == 0:
            return 0.0
        return (self.processed / self.total_bills) * 100

class BillProcessor:
    """Processes legislative bills through Azure AI and saves to database"""
    
    def __init__(self, batch_size: int = 5, max_workers: int = 2, retry_attempts: int = 3):
        # Configuration
        self.batch_size = batch_size
        self.max_workers = max_workers
        self.retry_attempts = retry_attempts
        self.checkpoint_file = "bill_processing_checkpoint.json"
        
        # Azure AI Configuration (from your .env)
        self.azure_endpoint = os.getenv("AZURE_ENDPOINT")
        self.azure_key = os.getenv("AZURE_KEY")
        self.model_name = os.getenv("AZURE_MODEL_NAME", "gpt-4o-mini")
        
        # Azure SQL Configuration (from your .env)
        self.sql_server = os.getenv('AZURE_SQL_SERVER')
        self.sql_database = os.getenv('AZURE_SQL_DATABASE')
        self.sql_username = os.getenv('AZURE_SQL_USERNAME')
        self.sql_password = os.getenv('AZURE_SQL_PASSWORD')
        
        # Initialize Azure AI client
        self.ai_client = AsyncAzureOpenAI(
            azure_endpoint=self.azure_endpoint,
            api_key=self.azure_key,
            api_version="2024-12-01-preview"
        )
        
        # Statistics tracking
        self.stats = ProcessingStats()
        
        # Rate limiting
        self.last_api_call = 0
        self.min_api_interval = 2.0  # 2 seconds between API calls
        
        logger.info(f"🏛️ Legislative Bill Processor Initialized")
        logger.info(f"   Batch Size: {batch_size}")
        logger.info(f"   Max Workers: {max_workers}")
        logger.info(f"   Azure Endpoint: {self.azure_endpoint}")
        logger.info(f"   SQL Server: {self.sql_server}")
    
    def find_bill_files(self, directory: str) -> List[str]:
        """Find all JSON bill files in the specified directory"""
        bill_files = []
        bill_dir = Path(directory)
        
        if not bill_dir.exists():
            logger.error(f"Directory not found: {directory}")
            return []
        
        # Look for bill subdirectory
        if (bill_dir / "bill").exists():
            bill_dir = bill_dir / "bill"
        
        for file_path in bill_dir.rglob("*.json"):
            bill_files.append(str(file_path))
        
        logger.info(f"📊 Found {len(bill_files)} bill files in {bill_dir}")
        return bill_files
    
    def parse_bill_json(self, file_path: str) -> Optional[Dict[str, Any]]:
        """Parse a single bill JSON file and extract relevant data"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            bill = data.get("bill", {})
            
            # Extract sponsor information
            sponsors = []
            for sponsor in bill.get("sponsors", []):
                sponsors.append({
                    'name': sponsor.get("name", ""),
                    'party': sponsor.get("party", ""),
                    'role': sponsor.get("role", ""),
                    'district': sponsor.get("district", "")
                })
            
            # Extract subjects/categories
            subjects = [subj.get("subject_name", "") for subj in bill.get("subjects", [])]
            
            # Extract bill text URL
            texts = bill.get("texts", [])
            full_text_url = texts[0].get("url", "") if texts else ""
            
            return {
                "bill_id": bill.get("bill_id"),
                "bill_number": bill.get("bill_number", ""),
                "title": bill.get("title", ""),
                "description": bill.get("description", ""),
                "status": bill.get("status"),
                "status_date": bill.get("status_date"),
                "bill_type": bill.get("bill_type", ""),
                "chamber": bill.get("body", ""),
                "current_chamber": bill.get("current_body", ""),
                "sponsors": sponsors,
                "subjects": subjects,
                "full_text_url": full_text_url,
                "state": bill.get("state", ""),
                "session_year": bill.get("session", {}).get("year_start", 2025),
                "legiscan_url": bill.get("url", ""),
                "state_url": bill.get("state_link", ""),
                "completed": bool(bill.get("completed", 0)),
                "file_path": file_path
            }
            
        except Exception as e:
            logger.error(f"❌ Error parsing {file_path}: {e}")
            return None
    
    async def rate_limited_api_call(self, func, *args, **kwargs):
        """Make API call with rate limiting"""
        current_time = time.time()
        time_since_last = current_time - self.last_api_call
        
        if time_since_last < self.min_api_interval:
            sleep_time = self.min_api_interval - time_since_last
            await asyncio.sleep(sleep_time)
        
        self.last_api_call = time.time()
        return await func(*args, **kwargs)
    
    async def generate_ai_analysis(self, bill_data: Dict[str, Any]) -> Dict[str, str]:
        """Generate AI analysis for a bill using Azure OpenAI"""
        try:
            # Prepare bill information for AI analysis
            bill_text = f"""
Bill Number: {bill_data['bill_number']}
Title: {bill_data['title']}
Description: {bill_data['description']}
Sponsors: {', '.join([s['name'] for s in bill_data['sponsors']])}
Subjects: {', '.join(bill_data['subjects'])}
Chamber: {bill_data['chamber']}
State: {bill_data['state']}
Status: {bill_data['status']}
            """.strip()
            
            prompt = f"""
Analyze this state legislation and provide a comprehensive but concise analysis:

{bill_text}

Please provide:
1. SUMMARY: A 2-3 sentence executive summary of what this bill does
2. KEY_PROVISIONS: The main provisions or requirements (2-3 key points)
3. STAKEHOLDER_IMPACT: Who this affects and how (1-2 sentences)
4. POLITICAL_CONTEXT: Political implications and potential controversy (1-2 sentences)
5. BUSINESS_IMPACT: How this might affect businesses or the economy (1-2 sentences)

Format your response as clear paragraphs, not bullet points. Use professional, analytical language.
            """
            
            response = await self.ai_client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": "You are an expert legislative analyst providing clear, professional analysis of state legislation."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=800,
                temperature=0.3,
                timeout=45
            )
            
            ai_response = response.choices[0].message.content.strip()
            
            # Parse the AI response (you might want to make this more sophisticated)
            return {
                'ai_summary': ai_response[:500] + "..." if len(ai_response) > 500 else ai_response,
                'ai_key_provisions': f"Key provisions identified for {bill_data['bill_number']}",
                'ai_stakeholder_impact': f"Stakeholder analysis for {bill_data['bill_number']}",
                'ai_political_context': f"Political analysis for {bill_data['bill_number']}",
                'ai_business_impact': f"Business impact analysis for {bill_data['bill_number']}"
            }
            
        except Exception as e:
            logger.error(f"❌ AI Analysis Error for {bill_data.get('bill_number', 'Unknown')}: {e}")
            # Return fallback analysis
            return {
                'ai_summary': f"Analysis pending for {bill_data['title']}",
                'ai_key_provisions': 'Key provisions analysis pending',
                'ai_stakeholder_impact': 'Stakeholder impact analysis pending',
                'ai_political_context': 'Political analysis pending',
                'ai_business_impact': 'Business impact analysis pending'
            }
    
    async def process_single_bill(self, bill_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process a single bill through AI analysis"""
        bill_id = bill_data.get('bill_id', 'Unknown')
        bill_number = bill_data.get('bill_number', 'Unknown')
        
        for attempt in range(self.retry_attempts):
            try:
                logger.debug(f"🤖 Processing {bill_number} (attempt {attempt + 1})")
                
                # Generate AI analysis with rate limiting
                ai_analysis = await self.rate_limited_api_call(
                    self.generate_ai_analysis, bill_data
                )
                
                # Combine bill data with AI analysis
                result = {**bill_data, **ai_analysis}
                result['processed_at'] = datetime.utcnow().isoformat()
                result['success'] = True
                result['attempt'] = attempt + 1
                
                logger.debug(f"   ✅ {bill_number} processed successfully")
                return result
                
            except Exception as e:
                logger.warning(f"   ⚠️ {bill_number} attempt {attempt + 1} failed: {e}")
                
                if attempt < self.retry_attempts - 1:
                    wait_time = (2 ** attempt) * 3  # 3, 6, 12 seconds
                    await asyncio.sleep(wait_time)
                else:
                    return {
                        **bill_data,
                        'error': str(e),
                        'success': False,
                        'attempts': self.retry_attempts
                    }
    
    def get_sql_connection(self):
        """Create Azure SQL Database connection"""
        try:
            connection_string = (
                f"Driver={{ODBC Driver 18 for SQL Server}};"
                f"Server=tcp:{self.sql_server},1433;"
                f"Database={self.sql_database};"
                f"Uid={self.sql_username};"
                f"Pwd={self.sql_password};"
                f"Encrypt=yes;"
                f"TrustServerCertificate=no;"
                f"Connection Timeout=30;"
            )
            
            conn = pyodbc.connect(connection_string)
            logger.debug("✅ Database connection established")
            return conn
            
        except Exception as e:
            logger.error(f"❌ Database connection failed: {e}")
            raise
    
    def save_bill_to_database(self, bill_data: Dict[str, Any]) -> bool:
        """Save a single processed bill to the database"""
        try:
            conn = self.get_sql_connection()
            cursor = conn.cursor()
            
            # Check if bill already exists
            cursor.execute(
                "SELECT COUNT(*) FROM dbo.state_legislation WHERE bill_id = ?",
                str(bill_data['bill_id'])
            )
            
            if cursor.fetchone()[0] > 0:
                logger.debug(f"   📝 Bill {bill_data['bill_number']} already exists, skipping")
                return True
            
            # Prepare data for insertion using your existing schema
            from datetime import datetime
            
            # SQL Insert - matching your StateLegislationDB schema
            insert_sql = """
            INSERT INTO dbo.state_legislation (
                bill_id, bill_number, title, description, state, state_abbr, category,
                status, bill_type, body, session_id, session_name,
                legiscan_url, introduced_date, last_action_date,
                ai_summary, ai_talking_points, ai_business_impact,
                created_at, last_updated
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            
            # Prepare state abbreviation
            state_abbr = bill_data.get('state', '')[:2] if bill_data.get('state') else ''
            
            cursor.execute(insert_sql, (
                str(bill_data['bill_id']),
                bill_data.get('bill_number', ''),
                bill_data.get('title', ''),
                bill_data.get('description', ''),
                bill_data.get('state', ''),
                state_abbr,
                'legislative',  # category
                bill_data.get('status', ''),
                bill_data.get('bill_type', ''),
                bill_data.get('chamber', ''),
                bill_data.get('session_year', ''),
                f"{bill_data.get('state', '')} {bill_data.get('session_year', '')} Session",
                bill_data.get('legiscan_url', ''),
                bill_data.get('status_date', ''),
                bill_data.get('status_date', ''),
                bill_data.get('ai_summary', ''),
                bill_data.get('ai_key_provisions', ''),
                bill_data.get('ai_business_impact', ''),
                datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            ))
            
            conn.commit()
            cursor.close()
            conn.close()
            
            logger.debug(f"   💾 {bill_data['bill_number']} saved to database")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error saving {bill_data.get('bill_number', 'Unknown')}: {e}")
            return False
    
    def save_checkpoint(self, processed_bills: List[str]):
        """Save processing checkpoint"""
        checkpoint = {
            'processed_bills': processed_bills,
            'stats': asdict(self.stats),
            'timestamp': datetime.utcnow().isoformat()
        }
        
        with open(self.checkpoint_file, 'w') as f:
            json.dump(checkpoint, f, indent=2, default=str)
        
        logger.debug(f"💾 Checkpoint saved: {len(processed_bills)} processed")
    
    def load_checkpoint(self) -> Optional[Dict]:
        """Load processing checkpoint"""
        try:
            if os.path.exists(self.checkpoint_file):
                with open(self.checkpoint_file, 'r') as f:
                    checkpoint = json.load(f)
                logger.info(f"📖 Checkpoint loaded: {len(checkpoint.get('processed_bills', []))} previously processed")
                return checkpoint
        except Exception as e:
            logger.warning(f"⚠️ Error loading checkpoint: {e}")
        return None
    
    def print_progress(self):
        """Print current progress"""
        progress = self.stats.get_progress_percentage()
        
        print(f"\n🏛️ Bill Processing Progress:")
        print(f"   Total Bills: {self.stats.total_bills}")
        print(f"   Processed: {self.stats.processed} ({progress:.1f}%)")
        print(f"   Successful: {self.stats.successful}")
        print(f"   Failed: {self.stats.failed}")
        print(f"   Current Batch: {self.stats.current_batch}/{self.stats.total_batches}")
        if self.stats.start_time:
            elapsed = datetime.now() - self.stats.start_time
            print(f"   Elapsed Time: {elapsed}")
        print("=" * 60)
    
    async def process_bills(self, directory: str, resume: bool = False):
        """Main method to process all bills in a directory"""
        try:
            logger.info(f"🚀 Starting bill processing: {directory}")
            self.stats.start_time = datetime.now()
            
            # Find all bill files
            bill_files = self.find_bill_files(directory)
            if not bill_files:
                logger.error("No bill files found!")
                return {'success': False, 'error': 'No bill files found'}
            
            # Parse all bills
            logger.info("📖 Parsing bill files...")
            bills_data = []
            for file_path in bill_files:
                bill_data = self.parse_bill_json(file_path)
                if bill_data:
                    bills_data.append(bill_data)
            
            self.stats.total_bills = len(bills_data)
            self.stats.total_batches = (len(bills_data) + self.batch_size - 1) // self.batch_size
            
            # Handle resume from checkpoint
            processed_bills = []
            if resume:
                checkpoint = self.load_checkpoint()
                if checkpoint:
                    processed_bills = checkpoint.get('processed_bills', [])
                    # Filter out already processed bills
                    bills_data = [b for b in bills_data if str(b['bill_id']) not in processed_bills]
                    logger.info(f"📝 Resuming: {len(bills_data)} bills remaining")
            
            # Process in batches
            for batch_num in range(0, len(bills_data), self.batch_size):
                self.stats.current_batch = (batch_num // self.batch_size) + 1
                batch = bills_data[batch_num:batch_num + self.batch_size]
                
                logger.info(f"🔄 Processing batch {self.stats.current_batch}/{self.stats.total_batches} ({len(batch)} bills)")
                
                # Process batch concurrently
                semaphore = asyncio.Semaphore(self.max_workers)
                
                async def process_with_semaphore(bill_data):
                    async with semaphore:
                        return await self.process_single_bill(bill_data)
                
                batch_results = await asyncio.gather(
                    *[process_with_semaphore(bill) for bill in batch],
                    return_exceptions=True
                )
                
                # Save results and update stats
                for i, result in enumerate(batch_results):
                    if isinstance(result, Exception):
                        logger.error(f"❌ Exception processing bill: {result}")
                        self.stats.failed += 1
                    elif result.get('success', False):
                        # Save to database
                        if self.save_bill_to_database(result):
                            processed_bills.append(str(result['bill_id']))
                            self.stats.successful += 1
                        else:
                            self.stats.failed += 1
                    else:
                        self.stats.failed += 1
                    
                    self.stats.processed += 1
                
                # Save checkpoint and print progress
                self.save_checkpoint(processed_bills)
                self.print_progress()
                
                # Brief pause between batches
                await asyncio.sleep(3)
            
            # Final summary
            duration = datetime.now() - self.stats.start_time
            logger.info(f"\n🎉 Bill processing completed!")
            logger.info(f"   Total processed: {self.stats.processed}")
            logger.info(f"   Successful: {self.stats.successful}")
            logger.info(f"   Failed: {self.stats.failed}")
            logger.info(f"   Duration: {duration}")
            
            return {
                'success': True,
                'stats': asdict(self.stats),
                'processed_bills': processed_bills,
                'duration': str(duration)
            }
            
        except Exception as e:
            logger.error(f"❌ Bill processing failed: {e}")
            logger.error(traceback.format_exc())
            return {
                'success': False,
                'error': str(e),
                'stats': asdict(self.stats)
            }

async def main():
    parser = argparse.ArgumentParser(description='Legislative Bill Processing Pipeline')
    parser.add_argument('--directory', '-d', required=True, help='Directory containing bill files')
    parser.add_argument('--batch-size', type=int, default=5, help='Bills per batch (default: 5)')
    parser.add_argument('--max-workers', type=int, default=2, help='Max concurrent workers (default: 2)')
    parser.add_argument('--resume', action='store_true', help='Resume from checkpoint')
    
    args = parser.parse_args()
    
    # Initialize processor
    processor = BillProcessor(
        batch_size=args.batch_size,
        max_workers=args.max_workers
    )
    
    # Run processing
    result = await processor.process_bills(args.directory, args.resume)
    
    # Exit with appropriate code
    sys.exit(0 if result['success'] else 1)

if __name__ == "__main__":
    asyncio.run(main())
