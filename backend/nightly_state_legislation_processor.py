#!/usr/bin/env python3
"""
Comprehensive Nightly State Legislation Processor

This script handles all aspects of state legislation processing:
1. Check for active/inactive/special sessions for each state
2. Update session status in database and frontend
3. Check for new legislation in active sessions
4. Pull new bills and generate AI summaries
5. Update bill statuses and progress tracking
6. Ensure all bills have source material links
7. Apply appropriate practice area tags with proper fallback

Usage: python nightly_state_legislation_processor.py [STATE_ABBR]
If no state specified, processes all configured states.
"""

import os
import sys
import asyncio
import requests
import json
import logging
from datetime import datetime, timedelta
from database_config import get_db_connection
from ai import analyze_executive_order

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('nightly_state_processor.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Import configuration
try:
    from state_processor_config import (
        CONFIGURED_STATES, APPROVED_CATEGORIES, PRACTICE_AREA_KEYWORDS,
        PROCESSING_LIMITS, DATA_SETTINGS
    )
except ImportError:
    # Fallback configuration if config file doesn't exist
    CONFIGURED_STATES = ['TX', 'CA', 'NV', 'KY', 'SC', 'CO']
    APPROVED_CATEGORIES = ['Civic', 'Education', 'Engineering', 'Healthcare', 'Not Applicable']
    PRACTICE_AREA_KEYWORDS = {
        'Education': ['school', 'education', 'student', 'teacher', 'university'],
        'Healthcare': ['health', 'medical', 'hospital', 'patient', 'physician'],
        'Engineering': ['engineering', 'infrastructure', 'construction', 'transportation'],
        'Civic': ['election', 'voting', 'ballot', 'campaign', 'political']
    }
    PROCESSING_LIMITS = {
        'new_bills_per_session': 10,
        'status_updates_per_session': 50,
        'source_links_per_state': 20,
        'category_updates_per_state': 50,
        'api_delay_seconds': 1,
        'status_update_delay_seconds': 0.5
    }
    DATA_SETTINGS = {
        'status_update_cutoff_days': 30,
        'ai_summary_max_length': 2000,
        'title_max_length': 500,
        'description_max_length': 500,
        'status_max_length': 200
    }

# API Configuration
API_KEY = os.getenv('LEGISCAN_API_KEY')
BASE_URL = 'https://api.legiscan.com/'

class StatelegislationProcessor:
    def __init__(self):
        self.session_stats = {}
        self.processing_stats = {
            'sessions_updated': 0,
            'new_bills_added': 0,
            'bills_status_updated': 0,
            'bills_categorized': 0,
            'ai_summaries_generated': 0,
            'source_links_added': 0
        }

    def determine_practice_area(self, title, description):
        """Determine practice area based on title and description content"""
        text = f'{title or ""} {description or ""}'.lower()
        
        # Check each approved category
        for category, keywords in PRACTICE_AREA_KEYWORDS.items():
            for keyword in keywords:
                if keyword in text:
                    return category
        
        # Default fallback
        return 'Not Applicable'

    async def check_sessions_for_state(self, state_abbr):
        """Check and update session information for a state"""
        try:
            logger.info(f"Checking sessions for {state_abbr}")
            
            # Get session list from LegiScan
            response = requests.get(f'{BASE_URL}?key={API_KEY}&op=getSessionList&state={state_abbr}')
            sessions_data = response.json()
            
            if 'sessions' not in sessions_data:
                logger.warning(f"No sessions data for {state_abbr}")
                return []
            
            active_sessions = []
            
            for session in sessions_data['sessions']:
                session_id = session['session_id']
                session_name = session['session_name']
                is_special = session.get('special', 0) == 1
                sine_die = session.get('sine_die', 0) == 1  # 1 = closed, 0 = active
                
                # Get detailed session info
                session_response = requests.get(f'{BASE_URL}?key={API_KEY}&op=getSession&id={session_id}')
                session_detail = session_response.json()
                
                # Update database with session info
                with get_db_connection() as conn:
                    cursor = conn.cursor()
                    
                    # Check if session exists in our tracking
                    cursor.execute('''
                        SELECT COUNT(*) FROM dbo.legislative_sessions 
                        WHERE session_id = ?
                    ''', (str(session_id),))
                    
                    exists = cursor.fetchone()[0] > 0
                    
                    if not exists:
                        # Insert new session
                        cursor.execute('''
                            INSERT INTO dbo.legislative_sessions 
                            (session_id, state, session_name, is_special, is_active, created_at, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        ''', (
                            str(session_id),
                            state_abbr,
                            session_name,
                            is_special,
                            not sine_die,  # Active if not sine_die
                            datetime.now(),
                            datetime.now()
                        ))
                    else:
                        # Update existing session
                        cursor.execute('''
                            UPDATE dbo.legislative_sessions 
                            SET is_active = ?, updated_at = ?
                            WHERE session_id = ?
                        ''', (
                            not sine_die,
                            datetime.now(),
                            str(session_id)
                        ))
                    
                    conn.commit()
                
                if not sine_die:  # Active session
                    active_sessions.append({
                        'session_id': session_id,
                        'session_name': session_name,
                        'is_special': is_special
                    })
                    logger.info(f"  Active session: {session_name}")
            
            self.processing_stats['sessions_updated'] += len(sessions_data['sessions'])
            return active_sessions
            
        except Exception as e:
            logger.error(f"Error checking sessions for {state_abbr}: {e}")
            return []

    async def check_new_bills_in_session(self, state_abbr, session_id, session_name):
        """Check for new bills in an active session"""
        try:
            logger.info(f"Checking new bills in {session_name}")
            
            # Get master list from LegiScan
            master_response = requests.get(f'{BASE_URL}?key={API_KEY}&op=getMasterList&state={state_abbr}&id={session_id}')
            master_data = master_response.json()
            
            if 'masterlist' not in master_data:
                logger.warning(f"No masterlist for {session_name}")
                return []
            
            # Get existing bills from database
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT bill_id FROM dbo.state_legislation 
                    WHERE state = ? AND session_id = ?
                ''', (state_abbr, str(session_id)))
                
                existing_bill_ids = set(row[0] for row in cursor.fetchall())
            
            # Find new bills
            new_bills = []
            bills = master_data['masterlist']
            
            for bill_id, bill_info in bills.items():
                if bill_id == 'session' or not isinstance(bill_info, dict):
                    continue
                
                legiscan_bill_id = str(bill_info['bill_id'])
                
                if legiscan_bill_id not in existing_bill_ids:
                    new_bills.append({
                        'bill_id': legiscan_bill_id,
                        'bill_number': bill_info.get('number', ''),
                        'title': bill_info.get('title', ''),
                        'description': bill_info.get('description', ''),
                        'url': bill_info.get('url', '')
                    })
            
            logger.info(f"Found {len(new_bills)} new bills in {session_name}")
            return new_bills
            
        except Exception as e:
            logger.error(f"Error checking new bills for {session_name}: {e}")
            return []

    async def process_new_bill(self, state_abbr, session_id, session_name, bill_info):
        """Process a single new bill: fetch details, generate AI summary, categorize"""
        try:
            bill_id = bill_info['bill_id']
            bill_number = bill_info['bill_number']
            
            logger.info(f"Processing new bill {bill_number}")
            
            # Get detailed bill information
            bill_response = requests.get(f'{BASE_URL}?key={API_KEY}&op=getBill&id={bill_id}')
            bill_data = bill_response.json()
            
            if 'bill' not in bill_data:
                logger.warning(f"No detailed data for bill {bill_number}")
                return False
            
            bill = bill_data['bill']
            
            # Extract bill details
            title = bill.get('title', bill_info['title'])
            description = bill.get('description', bill_info['description'])
            status = bill.get('status_desc', 'Unknown')
            
            # Get latest action from history
            latest_action = ''
            latest_action_date = ''
            if 'history' in bill and bill['history']:
                latest_history = bill['history'][-1]
                latest_action = latest_history.get('action', '')
                latest_action_date = latest_history.get('date', '')
            
            # Use latest action as status if available
            if latest_action:
                status = latest_action
            
            # Get URLs
            legiscan_url = bill.get('url', bill_info['url'])
            pdf_url = ''
            if 'texts' in bill and bill['texts']:
                for text in bill['texts']:
                    if text.get('type_id') == '1':  # Original bill text
                        pdf_url = text.get('state_link', '')
                        break
            
            # Generate AI summary
            bill_context = f"""
            Bill Number: {bill_number}
            Title: {title or 'No title'}
            Description: {description or 'No description'}
            Status: {status}
            State: {state_abbr}
            Session: {session_name}
            """
            
            ai_result = await analyze_executive_order(bill_context)
            
            executive_summary = ''
            talking_points = ''
            business_impact = ''
            
            if ai_result and isinstance(ai_result, dict):
                executive_summary = str(ai_result.get('ai_executive_summary', ''))[:2000]
                talking_points = str(ai_result.get('ai_talking_points', ''))[:2000]
                business_impact = str(ai_result.get('ai_business_impact', ''))[:2000]
            
            # Determine practice area
            practice_area = self.determine_practice_area(title, description)
            
            # Insert into database
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO dbo.state_legislation (
                        state, bill_number, title, description, status,
                        introduced_date, last_action_date,
                        session_name, session_id, bill_id,
                        legiscan_url, pdf_url,
                        ai_executive_summary, ai_talking_points, ai_business_impact, ai_summary,
                        category, ai_version,
                        created_at, last_updated, reviewed
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    state_abbr,
                    bill_number,
                    title[:500] if title else '',
                    description[:500] if description else '',
                    status[:200] if status else '',
                    bill.get('introduced_date') or bill.get('status_date'),
                    latest_action_date,
                    session_name,
                    str(session_id),
                    bill_id,
                    legiscan_url,
                    pdf_url if pdf_url else legiscan_url,
                    executive_summary,
                    talking_points,
                    business_impact,
                    executive_summary,  # Copy to ai_summary for frontend
                    practice_area,
                    '1.0',
                    datetime.now().isoformat(),
                    datetime.now().isoformat(),
                    0  # reviewed = false
                ))
                conn.commit()
            
            self.processing_stats['new_bills_added'] += 1
            self.processing_stats['ai_summaries_generated'] += 1
            self.processing_stats['bills_categorized'] += 1
            self.processing_stats['source_links_added'] += 1
            
            logger.info(f"✅ Added {bill_number} with AI summary and {practice_area} category")
            return True
            
        except Exception as e:
            logger.error(f"Error processing new bill {bill_info.get('bill_number', 'Unknown')}: {e}")
            return False
        
        # Rate limiting
        delay = PROCESSING_LIMITS['api_delay_seconds']
        await asyncio.sleep(delay)

    async def update_bill_statuses(self, state_abbr, session_id, session_name):
        """Update statuses for existing bills in active sessions"""
        try:
            logger.info(f"Updating bill statuses for {session_name}")
            
            # Get bills that need status updates (recent activity)
            cutoff_days = DATA_SETTINGS['status_update_cutoff_days']
            cutoff_date = datetime.now() - timedelta(days=cutoff_days)
            
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT bill_id, bill_number, status
                    FROM dbo.state_legislation 
                    WHERE state = ? AND session_id = ?
                    AND (last_updated IS NULL OR last_updated < ?)
                    ORDER BY bill_number
                ''', (state_abbr, str(session_id), cutoff_date.isoformat()))
                
                bills_to_update = cursor.fetchall()
            
            logger.info(f"Checking status for {len(bills_to_update)} bills")
            
            updated_count = 0
            limit = PROCESSING_LIMITS['status_updates_per_session']
            for bill_id, bill_number, current_status in bills_to_update[:limit]:
                try:
                    # Get current bill details
                    bill_response = requests.get(f'{BASE_URL}?key={API_KEY}&op=getBill&id={bill_id}')
                    bill_data = bill_response.json()
                    
                    if 'bill' in bill_data:
                        bill = bill_data['bill']
                        
                        # Get latest action
                        latest_action = ''
                        latest_action_date = ''
                        
                        if 'history' in bill and bill['history']:
                            latest_history = bill['history'][-1]
                            latest_action = latest_history.get('action', '')
                            latest_action_date = latest_history.get('date', '')
                        
                        new_status = latest_action if latest_action else bill.get('status_desc', current_status)
                        
                        # Update if status changed
                        if new_status and new_status != current_status:
                            with get_db_connection() as conn:
                                cursor = conn.cursor()
                                cursor.execute('''
                                    UPDATE dbo.state_legislation 
                                    SET status = ?, last_action_date = ?, last_updated = ?
                                    WHERE bill_id = ?
                                ''', (
                                    new_status[:200],
                                    latest_action_date,
                                    datetime.now().isoformat(),
                                    bill_id
                                ))
                                conn.commit()
                            
                            updated_count += 1
                            logger.info(f"Updated {bill_number}: {current_status} -> {new_status}")
                    
                except Exception as e:
                    logger.error(f"Error updating status for {bill_number}: {e}")
                
                # Rate limiting
                delay = PROCESSING_LIMITS['status_update_delay_seconds']
                await asyncio.sleep(delay)
            
            self.processing_stats['bills_status_updated'] += updated_count
            logger.info(f"Updated status for {updated_count} bills")
            
        except Exception as e:
            logger.error(f"Error updating bill statuses for {session_name}: {e}")

    async def ensure_source_links(self, state_abbr):
        """Ensure all bills have source material links"""
        try:
            logger.info(f"Checking source links for {state_abbr}")
            
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT bill_id, bill_number
                    FROM dbo.state_legislation 
                    WHERE state = ?
                    AND (legiscan_url IS NULL OR legiscan_url = '')
                    ORDER BY last_updated DESC
                ''', (state_abbr,))
                
                limit = PROCESSING_LIMITS['source_links_per_state']
                bills_missing_links = cursor.fetchall()[:limit]
            
            if not bills_missing_links:
                logger.info(f"All {state_abbr} bills have source links")
                return
            
            logger.info(f"Adding source links for {len(bills_missing_links)} bills")
            
            for bill_id, bill_number in bills_missing_links:
                try:
                    # Get bill details for URL
                    bill_response = requests.get(f'{BASE_URL}?key={API_KEY}&op=getBill&id={bill_id}')
                    bill_data = bill_response.json()
                    
                    if 'bill' in bill_data:
                        bill = bill_data['bill']
                        
                        legiscan_url = bill.get('url', '')
                        pdf_url = ''
                        
                        if 'texts' in bill and bill['texts']:
                            for text in bill['texts']:
                                if text.get('type_id') == '1':
                                    pdf_url = text.get('state_link', '')
                                    break
                        
                        if legiscan_url:
                            with get_db_connection() as conn:
                                cursor = conn.cursor()
                                cursor.execute('''
                                    UPDATE dbo.state_legislation 
                                    SET legiscan_url = ?, pdf_url = ?, last_updated = ?
                                    WHERE bill_id = ?
                                ''', (
                                    legiscan_url,
                                    pdf_url if pdf_url else legiscan_url,
                                    datetime.now().isoformat(),
                                    bill_id
                                ))
                                conn.commit()
                            
                            self.processing_stats['source_links_added'] += 1
                            logger.info(f"Added source link for {bill_number}")
                
                except Exception as e:
                    logger.error(f"Error adding source link for {bill_number}: {e}")
                
                await asyncio.sleep(0.5)
            
        except Exception as e:
            logger.error(f"Error ensuring source links for {state_abbr}: {e}")

    async def ensure_practice_area_tags(self, state_abbr):
        """Ensure all bills have appropriate practice area tags"""
        try:
            logger.info(f"Checking practice area tags for {state_abbr}")
            
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT bill_id, bill_number, title, description, category
                    FROM dbo.state_legislation 
                    WHERE state = ?
                    AND (category IS NULL OR category = '' OR category NOT IN (?, ?, ?, ?, ?))
                    ORDER BY last_updated DESC
                ''', (state_abbr, 'Civic', 'Education', 'Engineering', 'Healthcare', 'Not Applicable'))
                
                limit = PROCESSING_LIMITS['category_updates_per_state']
                bills_needing_tags = cursor.fetchall()[:limit]
            
            if not bills_needing_tags:
                logger.info(f"All {state_abbr} bills have proper practice area tags")
                return
            
            logger.info(f"Updating practice area tags for {len(bills_needing_tags)} bills")
            
            for bill_id, bill_number, title, description, current_category in bills_needing_tags:
                try:
                    # Determine correct practice area
                    new_category = self.determine_practice_area(title, description)
                    
                    if new_category != current_category:
                        with get_db_connection() as conn:
                            cursor = conn.cursor()
                            cursor.execute('''
                                UPDATE dbo.state_legislation 
                                SET category = ?, last_updated = ?
                                WHERE bill_id = ?
                            ''', (
                                new_category,
                                datetime.now().isoformat(),
                                bill_id
                            ))
                            conn.commit()
                        
                        self.processing_stats['bills_categorized'] += 1
                        logger.info(f"Updated {bill_number}: {current_category} -> {new_category}")
                
                except Exception as e:
                    logger.error(f"Error updating category for {bill_number}: {e}")
            
        except Exception as e:
            logger.error(f"Error ensuring practice area tags for {state_abbr}: {e}")

    async def process_state(self, state_abbr):
        """Process all aspects for a single state"""
        try:
            logger.info(f"🔄 Processing state: {state_abbr}")
            
            # 1. Check and update sessions
            active_sessions = await self.check_sessions_for_state(state_abbr)
            
            # 2. Process active sessions
            for session in active_sessions:
                session_id = session['session_id']
                session_name = session['session_name']
                
                # Check for new bills
                new_bills = await self.check_new_bills_in_session(state_abbr, session_id, session_name)
                
                # Process each new bill
                limit = PROCESSING_LIMITS['new_bills_per_session']
                for bill_info in new_bills[:limit]:
                    await self.process_new_bill(state_abbr, session_id, session_name, bill_info)
                
                # Update existing bill statuses
                await self.update_bill_statuses(state_abbr, session_id, session_name)
            
            # 3. Ensure all bills have proper data
            await self.ensure_source_links(state_abbr)
            await self.ensure_practice_area_tags(state_abbr)
            
            logger.info(f"✅ Completed processing for {state_abbr}")
            
        except Exception as e:
            logger.error(f"Error processing state {state_abbr}: {e}")

    async def run(self, target_states=None):
        """Run the complete nightly processing"""
        start_time = datetime.now()
        logger.info(f"🌙 Starting nightly state legislation processing at {start_time}")
        
        states_to_process = target_states or CONFIGURED_STATES
        
        for state_abbr in states_to_process:
            await self.process_state(state_abbr)
        
        # Log final statistics
        end_time = datetime.now()
        duration = end_time - start_time
        
        logger.info("🎉 Nightly processing completed!")
        logger.info(f"Duration: {duration}")
        logger.info("Statistics:")
        for key, value in self.processing_stats.items():
            logger.info(f"  {key}: {value}")

async def main():
    """Main entry point"""
    target_states = None
    
    if len(sys.argv) > 1:
        target_states = [sys.argv[1].upper()]
        logger.info(f"Processing specific state: {target_states[0]}")
    else:
        logger.info(f"Processing all configured states: {CONFIGURED_STATES}")
    
    processor = StatelegislationProcessor()
    await processor.run(target_states)

if __name__ == "__main__":
    asyncio.run(main())