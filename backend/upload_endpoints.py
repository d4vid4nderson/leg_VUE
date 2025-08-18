#!/usr/bin/env python3
"""
Upload endpoints for JSON and MD5 hash file processing
Adds to main FastAPI application
"""

import json
import hashlib
import tempfile
import os
from typing import Optional
from fastapi import UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import aiofiles

from json_upload_processor import process_json_upload
import asyncio

# Request models
class UploadRequest(BaseModel):
    upload_type: str  # 'state_legislation' or 'executive_orders'
    state: Optional[str] = None  # Required for state_legislation
    with_ai: bool = True
    batch_size: int = 10

# Store for background job status
upload_jobs = {}

class ProgressTracker:
    def __init__(self, job_id, total_items=0):
        from datetime import datetime
        self.job_id = job_id
        self.total_items = total_items
        self.discovered_files = 0
        self.processed_items = 0
        self.successful_items = 0
        self.failed_items = 0
        self.ai_processed = 0
        self.ai_failed = 0
        self.database_saved = 0
        self.database_failed = 0
        self.current_stage = "initializing"
        self.current_item = ""
        self.errors = []
        self.start_time = datetime.now()
        
    def update_stage(self, stage, item=""):
        self.current_stage = stage
        self.current_item = item
        self._update_job_status()
    
    def increment_discovered(self, count=1):
        self.discovered_files += count
        self._update_job_status()
        
    def increment_processed(self, success=True, ai_success=False, db_success=False, error=None):
        self.processed_items += 1
        if success:
            self.successful_items += 1
        else:
            self.failed_items += 1
            if error:
                self.errors.append(str(error)[:200])  # Limit error length
                
        if ai_success:
            self.ai_processed += 1
        elif not success and "AI" in str(error or ""):
            self.ai_failed += 1
            
        if db_success:
            self.database_saved += 1
        elif not success and ("database" in str(error or "").lower() or "sql" in str(error or "").lower()):
            self.database_failed += 1
            
        self._update_job_status()
    
    def _update_job_status(self):
        from datetime import datetime
        if self.job_id in upload_jobs:
            elapsed = (datetime.now() - self.start_time).total_seconds()
            rate = self.processed_items / elapsed if elapsed > 0 else 0
            eta = (self.total_items - self.processed_items) / rate if rate > 0 else 0
            
            upload_jobs[self.job_id].update({
                'total': self.total_items,
                'discovered_files': self.discovered_files,
                'processed': self.processed_items,
                'successful': self.successful_items,
                'failed': self.failed_items,
                'ai_processed': self.ai_processed,
                'ai_failed': self.ai_failed,
                'database_saved': self.database_saved,
                'database_failed': self.database_failed,
                'progress': round((self.processed_items / max(self.total_items, 1)) * 100, 1),
                'current_stage': self.current_stage,
                'current_item': self.current_item,
                'processing_rate': round(rate * 60, 1),  # items per minute
                'eta_minutes': round(eta / 60, 1) if eta else None,
                'errors': self.errors[-10:],  # Keep last 10 errors
                'elapsed_minutes': round(elapsed / 60, 1)
            })

def generate_job_id() -> str:
    """Generate unique job ID"""
    import uuid
    return str(uuid.uuid4())[:8]

def get_processed_bills(state: str) -> set:
    """Get set of bill numbers that already have AI summaries in database"""
    from database_config import get_db_connection
    processed_bills = set()
    
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            # Get bills that already have AI summaries
            cursor.execute("""
                SELECT bill_number 
                FROM dbo.state_legislation 
                WHERE state = ? 
                AND ai_executive_summary IS NOT NULL 
                AND ai_executive_summary != ''
                AND LEN(ai_executive_summary) > 50
            """, (state,))
            
            for row in cursor.fetchall():
                if row[0]:
                    processed_bills.add(row[0])
            
            print(f"📊 Found {len(processed_bills)} bills already processed with AI for {state}")
    except Exception as e:
        print(f"⚠️ Error checking processed bills: {e}")
    
    return processed_bills

async def process_hash_md5_file(file_content: str, upload_type: str, state: Optional[str], with_ai: bool, progress_tracker: ProgressTracker = None) -> dict:
    """Process .hash.md5 file content"""
    try:
        if progress_tracker:
            progress_tracker.update_stage("parsing", "Parsing hash.md5 file")
            
        print(f"🔍 Processing hash.md5 file - content length: {len(file_content)} chars")
        print(f"🔍 Upload type: {upload_type}, State: {state}, With AI: {with_ai}")
        
        # Parse the hash.md5 file format
        # Assuming format: hash filename
        lines = file_content.strip().split('\n')
        print(f"🔍 Found {len(lines)} lines in file")
        
        items = []
        for i, line in enumerate(lines):
            if not line.strip():
                continue
                
            line_content = line.strip()
            parts = line_content.split(None, 1)  # Split on whitespace, max 1 split
            print(f"🔍 Line {i}: '{line_content}' -> {len(parts)} parts")
            
            if len(parts) >= 2:
                # Standard format: hash filename
                hash_value = parts[0]
                filename = parts[1]
                
                # Extract information from filename or create basic item
                item = {
                    'hash': hash_value,
                    'filename': filename,
                    'bill_number': filename.split('.')[0] if '.' in filename else filename,
                    'title': f"Document: {filename}",
                    'description': f"File: {filename} (Hash: {hash_value})"
                }
                items.append(item)
                print(f"✅ Added item with filename: {item['bill_number']}")
                
            elif len(parts) == 1 and len(line_content) in [32, 40, 64]:
                # Hash-only format (MD5=32, SHA1=40, SHA256=64 chars)
                # This indicates we should scan for JSON files to process
                hash_value = parts[0]
                print(f"🔍 Hash-only format detected: {hash_value}")
                
                if progress_tracker:
                    progress_tracker.update_stage("discovering", f"Scanning for {state or 'TX'} JSON files")
                
                # Skip database check for now to prevent timeouts - just process small batch
                state_code = state or 'TX'  # Default to Texas
                processed_bills = set()  # Empty set for now - will re-enable after fixing timeouts
                
                if progress_tracker:
                    progress_tracker.update_stage("discovering", f"Scanning for unprocessed bills")
                
                # Scan for JSON files in the specific state directory
                import os
                import json
                
                # Look for state-specific directories
                possible_dirs = [
                    f'/app/data/{state_code}',     # Main state directory
                    f'/app/data/{state_code} 2',   # Alternative state directory (like TX 2)
                    f'./data/{state_code}',        # Relative path main
                    f'./data/{state_code} 2',      # Relative path alternative
                ]
                
                json_files_found = []
                skipped_count = 0
                for data_dir in possible_dirs:
                    if os.path.exists(data_dir):
                        print(f"🔍 Scanning {state_code} directory: {data_dir}")
                        # Only scan bill subdirectories to avoid processing votes, people, etc.
                        bill_dir = os.path.join(data_dir, 'bill')
                        if os.path.exists(bill_dir):
                            print(f"🔍 Found bill directory: {bill_dir}")
                            files = os.listdir(bill_dir)
                            
                            # Scan for reasonable batch - 25 files for efficient processing
                            json_files = [f for f in files if f.endswith('.json')][:100]  # Scan up to 100 files
                            for file in json_files:
                                file_path = os.path.join(bill_dir, file)
                                json_files_found.append(file_path)
                                # Stop after finding 15 files for stable batch size
                                if len(json_files_found) >= 15:
                                    break
                            
                            total_json_files = len([f for f in files if f.endswith('.json')])
                            new_files = total_json_files - skipped_count
                            
                            if progress_tracker:
                                progress_tracker.increment_discovered(new_files)
                            
                            print(f"📊 Directory scan: {total_json_files} total, {skipped_count} already processed, {new_files} new")
                        else:
                            # Fallback: scan entire directory but prioritize .json files
                            for root, dirs, files in os.walk(data_dir):
                                # Skip non-bill directories if possible
                                if 'bill' in root or root == data_dir:
                                    json_files = [f for f in files if f.endswith('.json')]
                                    for file in json_files:
                                        file_path = os.path.join(root, file)
                                        json_files_found.append(file_path)
                                    if progress_tracker:
                                        progress_tracker.increment_discovered(len(json_files))
                
                print(f"🔍 Found {len(json_files_found)} NEW unprocessed JSON files to process")
                print(f"⏭️ Skipped {skipped_count} already processed bills")
                
                if progress_tracker:
                    progress_tracker.total_items = min(len(json_files_found), 15)  # Process up to 15 bills per batch
                    progress_tracker.update_stage("extracting", f"Processing {progress_tracker.total_items} bills")
                
                if json_files_found:
                    # Process each JSON file (limit to match total_items)  
                    max_files = min(15, len(json_files_found))
                    for idx, file_path in enumerate(json_files_found[:max_files]):
                        try:
                            if progress_tracker:
                                progress_tracker.update_stage("extracting", f"Processing {os.path.basename(file_path)} ({idx+1}/{max_files})")
                                
                            with open(file_path, 'r', encoding='utf-8') as f:
                                json_data = json.load(f)
                            
                            # Extract bill information from JSON structure
                            # Handle both direct format and nested 'bill' format
                            bill_data = json_data.get('bill', json_data)
                            
                            bill_number = bill_data.get('bill_number') or bill_data.get('number') or os.path.basename(file_path).replace('.json', '')
                            
                            # Skip if this bill is already processed
                            if bill_number in processed_bills:
                                skipped_count += 1
                                if skipped_count <= 5:  # Log first few skips
                                    print(f"⏭️ Skipping already processed bill: {bill_number}")
                                continue
                            
                            title = bill_data.get('title', f"Bill {bill_number}")
                            description = bill_data.get('description', title)
                            
                            # Extract dates from history if available
                            introduced_date = None
                            last_action_date = None
                            
                            history = bill_data.get('history', [])
                            if history:
                                # First action is usually introduction
                                introduced_date = history[0].get('date') if history else None
                                # Last action is most recent
                                last_action_date = history[-1].get('date') if history else None
                            
                            # Handle session information
                            session = bill_data.get('session', {})
                            session_name = session.get('session_name') or session.get('session_title', '2025-2026 89th Legislature')
                            
                            item = {
                                'bill_id': bill_data.get('bill_id'),  # Add the missing bill_id
                                'bill_number': bill_number,
                                'title': title,
                                'description': description,
                                'state': bill_data.get('state', state or 'TX'),
                                'hash': hash_value,
                                'filename': os.path.basename(file_path),
                                'source_file': file_path,
                                'status': bill_data.get('status', 'Unknown'),
                                'introduced_date': introduced_date,
                                'last_action_date': last_action_date,
                                'session_name': session_name,
                                'url': bill_data.get('url', ''),
                                'sponsors': bill_data.get('sponsors', []),
                                'subjects': bill_data.get('subjects', [])
                            }
                            items.append(item)
                            print(f"✅ Added JSON file item: {bill_number} from {os.path.basename(file_path)}")
                            
                        except Exception as e:
                            print(f"⚠️ Error processing {file_path}: {str(e)}")
                            if progress_tracker:
                                progress_tracker.increment_processed(success=False, error=f"JSON parsing error: {str(e)}")
                            continue
                else:
                    # Fallback: create a placeholder if no JSON files found
                    item = {
                        'hash': hash_value,
                        'filename': f"collection_{hash_value[:8]}.json",
                        'bill_number': f"COLLECTION-{hash_value[:8]}",
                        'title': f"Document Collection (Hash: {hash_value[:8]})",
                        'description': f"Hash-only file uploaded but no JSON files found in data directory."
                    }
                    items.append(item)
                    print(f"✅ Added fallback placeholder: {item['bill_number']}")
                    
            else:
                print(f"⚠️ Skipping invalid line {i}: '{line_content}' (length: {len(line_content)})")
        
        print(f"🔍 Total items extracted: {len(items)} items")
        print(f"📊 First few items: {[item.get('bill_number', 'unknown') for item in items[:5]]}")
        
        if not items:
            raise ValueError("No valid entries found in hash.md5 file. Expected format: 'hash filename' or just 'hash' per line")
        
        if progress_tracker:
            progress_tracker.update_stage("ready", f"Ready to process {len(items)} items with AI analysis")
        
        print(f"🔍 Calling process_json_upload with {len(items)} items")
        # Process the extracted items
        return await process_json_upload(items, upload_type, state, with_ai, 100, progress_tracker)
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"❌ Error in process_hash_md5_file: {str(e)}")
        print(f"❌ Full traceback: {error_details}")
        if progress_tracker:
            progress_tracker.increment_processed(success=False, error=f"Hash processing error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error processing hash.md5 file: {str(e)}")

async def process_upload_job(
    job_id: str,
    file_content: str,
    filename: str,
    upload_type: str,
    state: Optional[str],
    with_ai: bool,
    batch_size: int
):
    """Background job to process uploaded file"""
    
    # Initialize progress tracker
    progress_tracker = ProgressTracker(job_id, 0)  # Total will be set during processing
    
    upload_jobs[job_id] = {
        'status': 'processing',
        'progress': 0,
        'message': f'Processing {filename}...',
        'filename': filename,
        'total': 0,
        'discovered_files': 0,
        'processed': 0,
        'successful': 0,
        'failed': 0,
        'ai_processed': 0,
        'ai_failed': 0,
        'database_saved': 0,
        'database_failed': 0,
        'current_stage': 'initializing',
        'current_item': '',
        'processing_rate': 0,
        'eta_minutes': None,
        'elapsed_minutes': 0,
        'errors': []
    }
    
    try:
        print(f"🔍 Processing upload job {job_id}: {filename}")
        progress_tracker.update_stage("starting", f"Initializing {filename}")
        
        # Determine file type and process accordingly
        if filename.endswith('.json'):
            # Parse JSON content
            progress_tracker.update_stage("parsing", "Parsing JSON data")
            json_data = json.loads(file_content)
            progress_tracker.total_items = len(json_data) if isinstance(json_data, list) else 1
            results = await process_json_upload(json_data, upload_type, state, with_ai, batch_size, progress_tracker)
        elif filename.endswith('.hash.md5') or filename.endswith('.md5'):
            # Process hash.md5 file
            results = await process_hash_md5_file(file_content, upload_type, state, with_ai, progress_tracker)
        else:
            raise ValueError("Unsupported file type. Please upload .json or .hash.md5 files")
        
        # Update job with final results
        upload_jobs[job_id].update({
            'status': 'completed',
            'progress': 100,
            'message': f'Completed processing successfully',
            'current_stage': 'completed',
            'result': results
        })
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"❌ Upload processing failed for {filename}: {str(e)}")
        print(f"❌ Full traceback: {error_details}")
        
        upload_jobs[job_id].update({
            'status': 'failed',
            'progress': 0,
            'message': f'Failed to process {filename}: {str(e)}',
            'errors': [str(e), error_details[:500]]  # Include traceback
        })

# Endpoint functions to add to main.py
async def upload_data_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    upload_type: str = Form(...),
    state: Optional[str] = Form(None),
    with_ai: bool = Form(True),
    batch_size: int = Form(10)
):
    """Upload and process JSON or MD5 hash file"""
    
    # Validate upload type
    if upload_type not in ['state_legislation', 'executive_orders']:
        raise HTTPException(
            status_code=400,
            detail="upload_type must be 'state_legislation' or 'executive_orders'"
        )
    
    # Validate state for state legislation
    if upload_type == 'state_legislation' and not state:
        raise HTTPException(
            status_code=400,
            detail="state is required for state_legislation uploads"
        )
    
    # Validate file type
    if not (file.filename.endswith('.json') or 
            file.filename.endswith('.hash.md5') or 
            file.filename.endswith('.md5')):
        raise HTTPException(
            status_code=400,
            detail="Only .json and .hash.md5 files are supported"
        )
    
    try:
        # Read file content
        content = await file.read()
        file_content = content.decode('utf-8')
        
        # Generate job ID
        job_id = generate_job_id()
        
        # Start background processing
        background_tasks.add_task(
            process_upload_job,
            job_id=job_id,
            file_content=file_content,
            filename=file.filename,
            upload_type=upload_type,
            state=state,
            with_ai=with_ai,
            batch_size=batch_size
        )
        
        return JSONResponse({
            'success': True,
            'job_id': job_id,
            'message': f'Upload started for {file.filename}',
            'filename': file.filename,
            'upload_type': upload_type,
            'state': state,
            'with_ai': with_ai
        })
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing upload: {str(e)}"
        )

async def get_upload_status(job_id: str):
    """Get status of upload job"""
    
    if job_id not in upload_jobs:
        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )
    
    job_status = upload_jobs[job_id]
    return JSONResponse({
        'success': True,
        'job_id': job_id,
        **job_status
    })

async def list_upload_jobs():
    """List all upload jobs (last 50)"""
    
    jobs = []
    for job_id, job_data in list(upload_jobs.items())[-50:]:
        jobs.append({
            'job_id': job_id,
            'status': job_data.get('status'),
            'filename': job_data.get('filename'),
            'progress': job_data.get('progress', 0),
            'message': job_data.get('message', ''),
            'successful': job_data.get('successful', 0),
            'failed': job_data.get('failed', 0)
        })
    
    return JSONResponse({
        'success': True,
        'jobs': jobs
    })

# Add these endpoints to main.py:
"""
# Add these imports at the top of main.py
from fastapi import UploadFile, File, Form, BackgroundTasks
from upload_endpoints import upload_data_file, get_upload_status, list_upload_jobs

# Add these routes to main.py
@app.post("/api/admin/upload-data")
async def upload_data_endpoint(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    upload_type: str = Form(...),
    state: str = Form(None),
    with_ai: bool = Form(True),
    batch_size: int = Form(10)
):
    return await upload_data_file(background_tasks, file, upload_type, state, with_ai, batch_size)

@app.get("/api/admin/upload-status/{job_id}")
async def get_upload_status_endpoint(job_id: str):
    return await get_upload_status(job_id)

@app.get("/api/admin/upload-jobs")
async def list_upload_jobs_endpoint():
    return await list_upload_jobs()
"""