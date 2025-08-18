#!/usr/bin/env python3
"""
JSON Upload Processor for State Legislation and Executive Orders
Processes uploaded JSON files and saves data to appropriate database tables
"""

import json
import asyncio
from datetime import datetime
from typing import Dict, List, Any, Optional
from database_config import get_db_connection
from ai import analyze_executive_order
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Practice area keywords for categorization
PRACTICE_AREA_KEYWORDS = {
    'healthcare': ['health', 'medical', 'hospital', 'insurance', 'medicare', 'patient', 'pharmacy'],
    'education': ['school', 'education', 'student', 'teacher', 'university', 'college'],
    'tax': ['tax', 'revenue', 'fiscal', 'budget', 'appropriation', 'finance'],
    'environment': ['environment', 'climate', 'pollution', 'renewable', 'conservation'],
    'criminal-justice': ['criminal', 'crime', 'police', 'prison', 'sentence', 'conviction'],
    'labor': ['labor', 'employment', 'worker', 'wage', 'union', 'workplace'],
    'housing': ['housing', 'rent', 'tenant', 'landlord', 'eviction', 'mortgage'],
    'transportation': ['transportation', 'highway', 'road', 'vehicle', 'traffic', 'transit'],
    'agriculture': ['agriculture', 'farm', 'crop', 'livestock', 'ranch'],
    'technology': ['technology', 'internet', 'digital', 'cyber', 'data', 'privacy'],
    'civic': ['civic', 'government', 'public', 'municipal', 'federal', 'administration'],
    'engineering': ['engineering', 'infrastructure', 'construction', 'building', 'design']
}

def determine_practice_area(title: str, description: str) -> str:
    """Determine practice area based on content"""
    text = f"{title or ''} {description or ''}".lower()
    
    for area, keywords in PRACTICE_AREA_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text:
                return area
    
    return 'government-operations'

async def process_state_legislation_item(item: Dict, state: str, with_ai: bool = True) -> Dict:
    """Process a single state legislation item"""
    result = {
        'bill_number': item.get('bill_number') or item.get('number'),
        'success': False,
        'message': '',
        'ai_processed': False
    }
    
    try:
        # Extract data from JSON
        bill_number = item.get('bill_number') or item.get('number') or item.get('bill_id')
        title = item.get('title') or item.get('bill_title') or ''
        description = item.get('description') or item.get('summary') or ''
        status = item.get('status') or item.get('bill_status') or ''
        introduced_date = item.get('introduced_date') or item.get('introduction_date')
        session_name = item.get('session_name') or item.get('session') or ''
        bill_id = item.get('bill_id') or item.get('id')
        
        # Process with AI if requested
        ai_summary = ''
        ai_talking_points = ''
        ai_business_impact = ''
        category = determine_practice_area(title, description)
        
        if with_ai:
            try:
                bill_context = f"""
                State: {state}
                Bill Number: {bill_number}
                Title: {title}
                Description: {description}
                Status: {status}
                Session: {session_name}
                """
                
                ai_result = await asyncio.wait_for(
                    analyze_executive_order(bill_context),
                    timeout=30.0
                )
                
                if ai_result and isinstance(ai_result, dict):
                    ai_summary = ai_result.get('ai_executive_summary', '')[:2000]
                    ai_talking_points = ai_result.get('ai_talking_points', '')[:2000]
                    ai_business_impact = ai_result.get('ai_business_impact', '')[:2000]
                    result['ai_processed'] = True
                    
            except Exception as e:
                logger.warning(f"AI processing failed for {bill_number}: {e}")
        
        # Save to database
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Check if bill already exists
            cursor.execute("""
                SELECT COUNT(*) FROM dbo.state_legislation
                WHERE state = ? AND bill_number = ?
            """, (state, bill_number))
            
            exists = cursor.fetchone()[0] > 0
            
            if exists:
                # Update existing bill
                cursor.execute("""
                    UPDATE dbo.state_legislation
                    SET title = ?,
                        description = ?,
                        status = ?,
                        introduced_date = ?,
                        session_name = ?,
                        ai_executive_summary = COALESCE(?, ai_executive_summary),
                        ai_talking_points = COALESCE(?, ai_talking_points),
                        ai_business_impact = COALESCE(?, ai_business_impact),
                        ai_summary = COALESCE(?, ai_summary),
                        category = ?,
                        last_updated = ?
                    WHERE state = ? AND bill_number = ?
                """, (
                    title, description, status, introduced_date, session_name,
                    ai_summary or None, ai_talking_points or None, 
                    ai_business_impact or None, ai_summary or None,
                    category, datetime.now(),
                    state, bill_number
                ))
                result['message'] = 'Updated existing bill'
            else:
                # Insert new bill
                cursor.execute("""
                    INSERT INTO dbo.state_legislation (
                        state, bill_id, bill_number, title, description,
                        status, introduced_date, session_name,
                        ai_executive_summary, ai_talking_points, ai_business_impact,
                        ai_summary, category, last_updated
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    state, bill_id, bill_number, title, description,
                    status, introduced_date, session_name,
                    ai_summary, ai_talking_points, ai_business_impact,
                    ai_summary, category, datetime.now()
                ))
                result['message'] = 'Created new bill'
            
            conn.commit()
            result['success'] = True
            
    except Exception as e:
        result['message'] = f"Error: {str(e)}"
        logger.error(f"Error processing {bill_number}: {e}")
    
    return result

async def process_executive_order_item(item: Dict, with_ai: bool = True) -> Dict:
    """Process a single executive order item"""
    result = {
        'order_number': item.get('executive_order_number') or item.get('number'),
        'success': False,
        'message': '',
        'ai_processed': False
    }
    
    try:
        # Extract data from JSON
        order_number = item.get('executive_order_number') or item.get('number') or item.get('eo_number')
        title = item.get('title') or ''
        signing_date = item.get('signing_date') or item.get('date_signed')
        summary = item.get('summary') or item.get('description') or ''
        url = item.get('url') or item.get('link') or ''
        pdf_url = item.get('pdf_url') or item.get('pdf_link') or ''
        
        # Process with AI if requested
        ai_summary = ''
        ai_talking_points = ''
        ai_business_impact = ''
        category = determine_practice_area(title, summary)
        
        if with_ai:
            try:
                order_context = f"""
                Executive Order: {order_number}
                Title: {title}
                Summary: {summary}
                Date: {signing_date}
                """
                
                ai_result = await asyncio.wait_for(
                    analyze_executive_order(order_context),
                    timeout=30.0
                )
                
                if ai_result and isinstance(ai_result, dict):
                    ai_summary = ai_result.get('ai_executive_summary', '')[:2000]
                    ai_talking_points = ai_result.get('ai_talking_points', '')[:2000]
                    ai_business_impact = ai_result.get('ai_business_impact', '')[:2000]
                    result['ai_processed'] = True
                    
            except Exception as e:
                logger.warning(f"AI processing failed for {order_number}: {e}")
        
        # Save to database
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Check if order already exists
            cursor.execute("""
                SELECT COUNT(*) FROM dbo.executive_orders
                WHERE executive_order_number = ?
            """, (order_number,))
            
            exists = cursor.fetchone()[0] > 0
            
            if exists:
                # Update existing order
                cursor.execute("""
                    UPDATE dbo.executive_orders
                    SET title = ?,
                        signing_date = ?,
                        summary = ?,
                        url = ?,
                        pdf_url = ?,
                        ai_executive_summary = COALESCE(?, ai_executive_summary),
                        ai_talking_points = COALESCE(?, ai_talking_points),
                        ai_business_impact = COALESCE(?, ai_business_impact),
                        ai_summary = COALESCE(?, ai_summary),
                        category = ?,
                        last_updated = ?
                    WHERE executive_order_number = ?
                """, (
                    title, signing_date, summary, url, pdf_url,
                    ai_summary or None, ai_talking_points or None,
                    ai_business_impact or None, ai_summary or None,
                    category, datetime.now(),
                    order_number
                ))
                result['message'] = 'Updated existing order'
            else:
                # Insert new order
                cursor.execute("""
                    INSERT INTO dbo.executive_orders (
                        executive_order_number, title, signing_date,
                        summary, url, pdf_url,
                        ai_executive_summary, ai_talking_points, ai_business_impact,
                        ai_summary, category, last_updated
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    order_number, title, signing_date,
                    summary, url, pdf_url,
                    ai_summary, ai_talking_points, ai_business_impact,
                    ai_summary, category, datetime.now()
                ))
                result['message'] = 'Created new order'
            
            conn.commit()
            result['success'] = True
            
    except Exception as e:
        result['message'] = f"Error: {str(e)}"
        logger.error(f"Error processing {order_number}: {e}")
    
    return result

async def process_json_upload(
    json_data: Dict,
    upload_type: str,
    state: Optional[str] = None,
    with_ai: bool = True,
    batch_size: int = 100,
    progress_tracker = None
) -> Dict:
    """
    Process uploaded JSON data
    
    Args:
        json_data: Parsed JSON data
        upload_type: 'state_legislation' or 'executive_orders'
        state: State code for state legislation (e.g., 'TX')
        with_ai: Whether to process with AI
        batch_size: Number of items to process at once
    
    Returns:
        Processing results
    """
    
    results = {
        'total_items': 0,
        'processed': 0,
        'successful': 0,
        'failed': 0,
        'ai_processed': 0,
        'details': [],
        'errors': []
    }
    
    try:
        # Extract items array from JSON
        items = []
        if isinstance(json_data, list):
            items = json_data
        elif isinstance(json_data, dict):
            # Try common keys for arrays
            items = (json_data.get('items') or 
                    json_data.get('bills') or 
                    json_data.get('orders') or 
                    json_data.get('data') or 
                    json_data.get('results') or
                    [])
        
        if not items:
            raise ValueError("No items found in JSON data")
        
        results['total_items'] = len(items)
        logger.info(f"Processing {len(items)} items for {upload_type}")
        
        # Update progress tracker with total
        logger.info(f"Progress tracker received: {progress_tracker is not None}")
        if progress_tracker:
            progress_tracker.total_items = len(items)
            progress_tracker.update_stage("processing", f"Starting batch processing of {len(items)} items")
            logger.info(f"Progress tracker initialized with {len(items)} items")
        else:
            logger.warning("No progress tracker provided to process_json_upload")
        
        # Process items in batches
        for i in range(0, len(items), batch_size):
            batch = items[i:i+batch_size]
            batch_tasks = []
            
            for item in batch:
                if upload_type == 'state_legislation':
                    if not state:
                        raise ValueError("State is required for state legislation")
                    batch_tasks.append(process_state_legislation_item(item, state, with_ai))
                elif upload_type == 'executive_orders':
                    batch_tasks.append(process_executive_order_item(item, with_ai))
                else:
                    raise ValueError(f"Invalid upload type: {upload_type}")
            
            # Update progress for current batch
            if progress_tracker:
                batch_start = i + 1
                batch_end = min(i + batch_size, len(items))
                progress_tracker.update_stage("ai_processing", f"Processing batch {batch_start}-{batch_end} of {len(items)}")
            
            # Process batch concurrently
            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
            
            # Process results and update tracker immediately after each batch
            for idx, result in enumerate(batch_results):
                if isinstance(result, Exception):
                    results['failed'] += 1
                    results['errors'].append(str(result))
                    if progress_tracker:
                        progress_tracker.increment_processed(success=False, error=str(result))
                        logger.info(f"Progress update (error): {progress_tracker.processed_items}/{progress_tracker.total_items}")
                elif isinstance(result, dict):
                    results['processed'] += 1
                    ai_success = result.get('ai_processed', False)
                    db_success = result.get('success', False)
                    
                    if result.get('success'):
                        results['successful'] += 1
                        if result.get('ai_processed'):
                            results['ai_processed'] += 1
                    else:
                        results['failed'] += 1
                    
                    results['details'].append(result)
                    
                    # Update progress tracker for each item
                    if progress_tracker:
                        progress_tracker.increment_processed(
                            success=db_success, 
                            ai_success=ai_success, 
                            db_success=db_success,
                            error=result.get('message') if not db_success else None
                        )
                        # Log every 10th update to avoid log spam
                        if (results['processed'] % 10) == 0:
                            logger.info(f"Progress: {progress_tracker.processed_items}/{progress_tracker.total_items}, AI: {progress_tracker.ai_processed}")
            
            # Log progress
            logger.info(f"Processed batch: {results['processed']}/{results['total_items']}")
            
            # Small delay between batches
            if i + batch_size < len(items):
                await asyncio.sleep(1)  # Reduced delay for faster processing
        
    except Exception as e:
        logger.error(f"Error processing JSON upload: {e}")
        results['errors'].append(str(e))
    
    return results