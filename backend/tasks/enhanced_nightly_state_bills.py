#!/usr/bin/env python3
"""
Enhanced Azure Container Job: Nightly State Bills & Session Discovery
- Discovers new legislative sessions
- Fetches new bills from LegiScan API
- Updates existing bill statuses
- Processes with AI when needed
"""

import asyncio
import logging
import sys
import os
import argparse
from datetime import datetime, timedelta
import traceback

# Setup logging for Azure Container Jobs
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

# Define target states for monitoring (focused on our configured states)
TARGET_STATES = ['CA', 'TX', 'NV', 'KY', 'SC', 'CO']

# Approved practice area categories (matching our updates)
APPROVED_CATEGORIES = ['Civic', 'Education', 'Engineering', 'Healthcare', 'Not Applicable']

async def discover_new_sessions():
    """Discover new legislative sessions for target states"""
    logger.info("🔍 Discovering new legislative sessions...")
    
    try:
        from legiscan_service import EnhancedLegiScanClient
        from database_config import get_db_connection
        
        legiscan_client = EnhancedLegiScanClient()
        new_sessions = []
        
        for state in TARGET_STATES:
            try:
                logger.info(f"🏛️ Checking {state} for new sessions...")
                
                # Get current sessions from LegiScan
                sessions_response = await legiscan_client.get_session_list(state)
                
                if sessions_response and 'sessions' in sessions_response:
                    legiscan_sessions = sessions_response['sessions']
                    
                    # Check which sessions we don't have in database
                    with get_db_connection() as conn:
                        cursor = conn.cursor()
                        
                        for session in legiscan_sessions:
                            session_id = str(session['session_id'])
                            session_name = session.get('session_name', 'Unknown')
                            
                            # Check if session exists in database
                            cursor.execute('''
                                SELECT COUNT(*) FROM dbo.state_legislation 
                                WHERE session_id = ? AND state = ?
                            ''', (session_id, state))
                            
                            count = cursor.fetchone()[0]
                            
                            if count == 0:
                                logger.info(f"🆕 New session discovered: {state} - {session_name} (ID: {session_id})")
                                new_sessions.append({
                                    'state': state,
                                    'session_id': session_id,
                                    'session_name': session_name,
                                    'year_start': session.get('year_start'),
                                    'year_end': session.get('year_end')
                                })
                            else:
                                logger.info(f"✅ Known session: {state} - {session_name} ({count} bills)")
                
                # Rate limiting between states
                await asyncio.sleep(1)
                
            except Exception as e:
                logger.error(f"❌ Error checking sessions for {state}: {e}")
        
        logger.info(f"📊 Session discovery complete: {len(new_sessions)} new sessions found")
        return new_sessions
        
    except Exception as e:
        logger.error(f"❌ Error in session discovery: {e}")
        return []

async def fetch_new_bills_for_session(session_info):
    """Fetch new bills for a specific session"""
    try:
        from legiscan_service import EnhancedLegiScanClient
        from database_config import get_db_connection
        
        state = session_info['state']
        session_id = session_info['session_id']
        session_name = session_info['session_name']
        
        logger.info(f"📜 Fetching bills for {state} session: {session_name}")
        
        legiscan_client = EnhancedLegiScanClient()
        
        # Get bill list for session
        bills_response = await legiscan_client.get_bill_list(session_id)
        
        if not bills_response or 'bills' not in bills_response:
            logger.warning(f"⚠️ No bills found for session {session_id}")
            return 0
        
        bills = bills_response['bills']
        logger.info(f"📋 Found {len(bills)} bills in session {session_id}")
        
        new_bills_count = 0
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            for bill in bills:
                try:
                    bill_id = str(bill['bill_id'])
                    bill_number = bill.get('bill_number', 'Unknown')
                    
                    # Check if bill already exists
                    cursor.execute('''
                        SELECT COUNT(*) FROM dbo.state_legislation 
                        WHERE bill_id = ? AND state = ?
                    ''', (bill_id, state))
                    
                    exists = cursor.fetchone()[0] > 0
                    
                    if not exists:
                        # Get detailed bill information
                        bill_detail = await legiscan_client.get_bill_detail(bill_id)
                        
                        if bill_detail and 'bill' in bill_detail:
                            bill_data = bill_detail['bill']
                            
                            # Insert new bill with AI foundry processing flag
                            cursor.execute('''
                                INSERT INTO dbo.state_legislation (
                                    bill_id, session_id, state, bill_number, title, description,
                                    status, introduced_date, last_action_date, last_updated,
                                    needs_ai_processing
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ''', (
                                bill_id,
                                session_id,
                                state,
                                bill_data.get('bill_number', bill_number),
                                bill_data.get('title', '')[:500],  # Truncate if too long
                                bill_data.get('description', '')[:2000],
                                bill_data.get('status', {}).get('text', 'Unknown')[:100],
                                bill_data.get('introduced_date'),
                                bill_data.get('last_action_date'),
                                datetime.now(),
                                1  # Mark for AI foundry processing
                            ))
                            
                            new_bills_count += 1
                            logger.info(f"➕ Added new bill: {state} {bill_number}")
                        
                        # Rate limiting between bill detail requests
                        await asyncio.sleep(0.5)
                
                except Exception as e:
                    logger.error(f"❌ Error processing bill {bill.get('bill_id', 'unknown')}: {e}")
            
            # Commit all changes
            conn.commit()
        
        logger.info(f"✅ Session {session_id}: Added {new_bills_count} new bills")
        return new_bills_count
        
    except Exception as e:
        logger.error(f"❌ Error fetching bills for session {session_info}: {e}")
        return 0

async def check_bill_status_updates():
    """Check for status updates on existing bills with latest action tracking"""
    logger.info("🔄 Checking for bill status updates...")
    
    try:
        from database_config import get_db_connection
        from legiscan_service import EnhancedLegiScanClient
        
        # Get bills that haven't been updated in the last 7 days
        cutoff_date = datetime.now() - timedelta(days=7)
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Sample recent bills to check for updates (limit to prevent API overuse)
            cursor.execute('''
                SELECT TOP 50 bill_id, state, bill_number, status, last_updated
                FROM dbo.state_legislation
                WHERE last_updated < ?
                AND state IN ('CA', 'TX', 'NV', 'KY', 'SC', 'CO')
                ORDER BY last_updated ASC
            ''', (cutoff_date,))
            
            bills_to_check = cursor.fetchall()
            
            if not bills_to_check:
                logger.info("✅ No bills need status updates")
                return 0
            
            logger.info(f"🔍 Checking status updates for {len(bills_to_check)} bills")
            
            legiscan_client = EnhancedLegiScanClient()
            updates_count = 0
            
            for bill_id, state, bill_number, current_status, last_updated in bills_to_check:
                try:
                    # Get current bill detail from LegiScan
                    bill_detail = await legiscan_client.get_bill_detail(bill_id)
                    
                    if bill_detail and 'bill' in bill_detail:
                        bill_data = bill_detail['bill']
                        
                        # Get the most recent action from history (like we did for Texas 2nd Special)
                        latest_action = ''
                        latest_action_date = ''
                        
                        if 'history' in bill_data and bill_data['history']:
                            latest_history = bill_data['history'][-1]  # Most recent entry
                            latest_action = latest_history.get('action', '')
                            latest_action_date = latest_history.get('date', '')
                        
                        # Use latest action as status if available, otherwise use status_desc
                        new_status = latest_action if latest_action else bill_data.get('status', {}).get('text', current_status)
                        
                        # Check if status changed
                        if new_status != current_status:
                            logger.info(f"📊 Status change: {state} {bill_number}: '{current_status}' → '{new_status}'")
                            
                            # Update in database with latest action information
                            cursor.execute('''
                                UPDATE dbo.state_legislation
                                SET status = ?, 
                                    last_action_date = ?,
                                    last_updated = ?,
                                    needs_ai_processing = 1
                                WHERE bill_id = ?
                            ''', (new_status[:200], latest_action_date, datetime.now(), bill_id))
                            
                            updates_count += 1
                    
                    # Rate limiting
                    await asyncio.sleep(1)
                    
                except Exception as e:
                    logger.error(f"❌ Error checking bill {bill_id}: {e}")
            
            # Commit updates
            conn.commit()
            logger.info(f"✅ Updated {updates_count} bills with status changes")
            return updates_count
            
    except Exception as e:
        logger.error(f"❌ Error checking bill status updates: {e}")
        return 0

async def ensure_source_links():
    """Ensure all bills have source material links"""
    logger.info("🔗 Ensuring all bills have source links...")
    
    try:
        from database_config import get_db_connection
        from legiscan_service import EnhancedLegiScanClient
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Get bills missing legiscan_url
            cursor.execute('''
                SELECT TOP 20 bill_id, state, bill_number
                FROM dbo.state_legislation 
                WHERE state IN ('CA', 'TX', 'NV', 'KY', 'SC', 'CO')
                AND (legiscan_url IS NULL OR legiscan_url = '')
                ORDER BY last_updated DESC
            ''')
            
            bills_missing_links = cursor.fetchall()
            
            if not bills_missing_links:
                logger.info("✅ All bills have source links")
                return 0
            
            logger.info(f"🔗 Adding source links for {len(bills_missing_links)} bills")
            
            legiscan_client = EnhancedLegiScanClient()
            updated_count = 0
            
            for bill_id, state, bill_number in bills_missing_links:
                try:
                    # Get bill details for URL
                    bill_detail = await legiscan_client.get_bill_detail(bill_id)
                    
                    if bill_detail and 'bill' in bill_detail:
                        bill_data = bill_detail['bill']
                        
                        legiscan_url = bill_data.get('url', '')
                        pdf_url = ''
                        
                        # Extract PDF URL from documents if available
                        if 'texts' in bill_data and bill_data['texts']:
                            for text in bill_data['texts']:
                                if text.get('type_id') == '1':  # Original bill text
                                    pdf_url = text.get('state_link', '')
                                    break
                        
                        if legiscan_url:
                            cursor.execute('''
                                UPDATE dbo.state_legislation 
                                SET legiscan_url = ?, pdf_url = ?, last_updated = ?
                                WHERE bill_id = ?
                            ''', (
                                legiscan_url,
                                pdf_url if pdf_url else legiscan_url,
                                datetime.now(),
                                bill_id
                            ))
                            
                            updated_count += 1
                            logger.info(f"✅ Added source link for {state} {bill_number}")
                    
                    # Rate limiting
                    await asyncio.sleep(0.5)
                
                except Exception as e:
                    logger.error(f"❌ Error adding source link for {bill_number}: {e}")
            
            conn.commit()
            logger.info(f"✅ Added source links for {updated_count} bills")
            return updated_count
            
    except Exception as e:
        logger.error(f"❌ Error ensuring source links: {e}")
        return 0

async def ensure_practice_area_tags():
    """Ensure all bills have appropriate practice area tags"""
    logger.info("🏷️ Ensuring proper practice area tags...")
    
    try:
        from database_config import get_db_connection
        
        # Practice area keywords (same as in AI processing)
        PRACTICE_AREA_KEYWORDS = {
            'Education': [
                'school', 'education', 'student', 'teacher', 'university', 'college', 
                'academic', 'curriculum', 'tuition', 'scholarship', 'classroom', 
                'campus', 'diploma', 'degree', 'learning', 'instruction', 'educational',
                'kindergarten', 'elementary', 'secondary', 'assessment instrument',
                'property tax', 'property taxes', 'ad valorem', 'school district', 'school funding'
            ],
            'Healthcare': [
                'health', 'medical', 'hospital', 'insurance', 'medicare', 'medicaid', 
                'patient', 'pharmacy', 'physician', 'nurse', 'clinic', 'treatment', 
                'disease', 'mental health', 'dental', 'vision', 'prescription', 'drug', 
                'medicine', 'therapeutic', 'diagnosis', 'surgery', 'emergency medical'
            ],
            'Engineering': [
                'engineering', 'infrastructure', 'construction', 'bridge', 'highway',
                'transportation', 'road', 'vehicle', 'traffic', 'transit', 'building',
                'structural', 'civil engineering', 'mechanical', 'electrical',
                'environment', 'environmental', 'water management', 'stormwater',
                'drainage', 'pollution', 'waste management'
            ],
            'Civic': [
                'election', 'voting', 'ballot', 'campaign', 'political', 'democracy', 
                'citizenship', 'voter', 'candidate', 'ethics', 'transparency',
                'accountability', 'public meeting', 'open records'
            ]
        }
        
        def determine_practice_area(title, description):
            """Determine practice area based on content with proper fallback"""
            text = f"{title or ''} {description or ''}".lower()
            
            # Check each approved category
            for area, keywords in PRACTICE_AREA_KEYWORDS.items():
                for keyword in keywords:
                    if keyword in text:
                        return area
            
            # Default fallback to Not Applicable
            return 'Not Applicable'
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Get bills that need proper categorization
            cursor.execute('''
                SELECT TOP 50 bill_id, bill_number, title, description, category, state
                FROM dbo.state_legislation 
                WHERE state IN ('CA', 'TX', 'NV', 'KY', 'SC', 'CO')
                AND (category IS NULL OR category = '' OR category NOT IN ('Civic', 'Education', 'Engineering', 'Healthcare', 'Not Applicable'))
                ORDER BY last_updated DESC
            ''')
            
            bills_needing_tags = cursor.fetchall()
            
            if not bills_needing_tags:
                logger.info("✅ All bills have proper practice area tags")
                return 0
            
            logger.info(f"🏷️ Updating practice area tags for {len(bills_needing_tags)} bills")
            
            updated_count = 0
            for bill_id, bill_number, title, description, current_category, state in bills_needing_tags:
                try:
                    # Determine correct practice area
                    new_category = determine_practice_area(title, description)
                    
                    if new_category != current_category:
                        cursor.execute('''
                            UPDATE dbo.state_legislation 
                            SET category = ?, last_updated = ?
                            WHERE bill_id = ?
                        ''', (new_category, datetime.now(), bill_id))
                        
                        updated_count += 1
                        logger.info(f"✅ Updated {state} {bill_number}: {current_category} -> {new_category}")
                
                except Exception as e:
                    logger.error(f"❌ Error updating category for {bill_number}: {e}")
            
            conn.commit()
            logger.info(f"✅ Updated practice area tags for {updated_count} bills")
            return updated_count
            
    except Exception as e:
        logger.error(f"❌ Error ensuring practice area tags: {e}")
        return 0

async def process_ai_queue():
    """Process bills that need AI analysis using existing state legislation AI"""
    logger.info("🤖 Processing AI analysis queue with state legislation AI...")
    
    try:
        from database_config import get_db_connection
        from ai import analyze_state_legislation
        
        # Practice area keywords for categorization (updated to match our approved categories)
        PRACTICE_AREA_KEYWORDS = {
            'Education': [
                'school', 'education', 'student', 'teacher', 'university', 'college', 
                'academic', 'curriculum', 'tuition', 'scholarship', 'classroom', 
                'campus', 'diploma', 'degree', 'learning', 'instruction', 'educational',
                'kindergarten', 'elementary', 'secondary', 'assessment instrument',
                'property tax', 'property taxes', 'ad valorem', 'school district', 'school funding'
            ],
            'Healthcare': [
                'health', 'medical', 'hospital', 'insurance', 'medicare', 'medicaid', 
                'patient', 'pharmacy', 'physician', 'nurse', 'clinic', 'treatment', 
                'disease', 'mental health', 'dental', 'vision', 'prescription', 'drug', 
                'medicine', 'therapeutic', 'diagnosis', 'surgery', 'emergency medical'
            ],
            'Engineering': [
                'engineering', 'infrastructure', 'construction', 'bridge', 'highway',
                'transportation', 'road', 'vehicle', 'traffic', 'transit', 'building',
                'structural', 'civil engineering', 'mechanical', 'electrical',
                'environment', 'environmental', 'water management', 'stormwater',
                'drainage', 'pollution', 'waste management'
            ],
            'Civic': [
                'election', 'voting', 'ballot', 'campaign', 'political', 'democracy', 
                'citizenship', 'voter', 'candidate', 'ethics', 'transparency',
                'accountability', 'public meeting', 'open records'
            ]
        }
        
        def determine_practice_area(title, description):
            """Determine practice area based on content with proper fallback"""
            text = f"{title or ''} {description or ''}".lower()
            
            # Check each approved category
            for area, keywords in PRACTICE_AREA_KEYWORDS.items():
                for keyword in keywords:
                    if keyword in text:
                        return area
            
            # Default fallback to Not Applicable (not not-applicable)
            return 'Not Applicable'
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Get bills needing AI processing (using same query pattern as existing code)
            cursor.execute('''
                SELECT TOP 10 id, bill_number, title, description, status, state
                FROM dbo.state_legislation
                WHERE needs_ai_processing = 1
                AND (ai_executive_summary IS NULL OR ai_executive_summary = '')
                ORDER BY last_updated DESC
            ''')
            
            bills_for_ai = cursor.fetchall()
            
            if not bills_for_ai:
                logger.info("✅ No bills need AI processing")
                return 0
            
            logger.info(f"🧠 Processing {len(bills_for_ai)} bills with state legislation AI")
            
            processed_count = 0
            ai_successful = 0
            ai_failed = 0
            
            for id_val, bill_number, title, description, status, state in bills_for_ai:
                try:
                    logger.info(f"🤖 [{processed_count + 1}/{len(bills_for_ai)}] Processing: {state} {bill_number}")
                    
                    # Process with state legislation AI (matching existing pattern)
                    ai_result = await analyze_state_legislation(
                        title=title or 'No title',
                        description=description or 'No description',
                        state=state,
                        bill_number=bill_number
                    )
                    
                    if ai_result and ai_result.get('ai_executive_summary'):
                        # Extract summary
                        executive_summary = ai_result.get('ai_executive_summary', '')
                        
                        # Determine practice area
                        practice_area = determine_practice_area(title, description)
                        
                        # Update database (matching existing pattern)
                        cursor.execute('''
                            UPDATE dbo.state_legislation
                            SET ai_executive_summary = ?,
                                ai_summary = ?,
                                category = ?,
                                ai_version = ?,
                                needs_ai_processing = 0,
                                last_updated = ?
                            WHERE id = ?
                        ''', (
                            executive_summary[:2000] if executive_summary else '',
                            executive_summary[:2000] if executive_summary else '',  # Copy to ai_summary for frontend
                            practice_area,
                            'azure_openai_nightly_v1',
                            datetime.now(),
                            id_val
                        ))
                        
                        ai_successful += 1
                        logger.info(f"✅ [{processed_count + 1}/{len(bills_for_ai)}] AI analysis completed for {state} {bill_number} - {practice_area}")
                    else:
                        # Mark as processed but note AI failure
                        cursor.execute('''
                            UPDATE dbo.state_legislation
                            SET needs_ai_processing = 0,
                                last_updated = ?
                            WHERE id = ?
                        ''', (datetime.now(), id_val))
                        
                        ai_failed += 1
                        logger.warning(f"⚠️ [{processed_count + 1}/{len(bills_for_ai)}] AI analysis failed for {state} {bill_number}")
                    
                    processed_count += 1
                    
                    # Rate limiting between AI calls (matching existing pattern)
                    await asyncio.sleep(2)
                    
                except Exception as e:
                    logger.error(f"❌ Error processing {state} {bill_number}: {e}")
                    
                    # Mark as processed to avoid infinite retries
                    cursor.execute('''
                        UPDATE dbo.state_legislation
                        SET needs_ai_processing = 0,
                            last_updated = ?
                        WHERE id = ?
                    ''', (datetime.now(), id_val))
                    
                    ai_failed += 1
                    processed_count += 1
            
            conn.commit()
            
            logger.info(f"✅ State legislation AI processing completed:")
            logger.info(f"  📊 Total processed: {processed_count}")
            logger.info(f"  🤖 AI successful: {ai_successful}")
            logger.info(f"  ❌ AI failed: {ai_failed}")
            
            return processed_count
            
    except Exception as e:
        logger.error(f"❌ Error in AI processing: {e}")
        return 0

async def main():
    """Main entry point for enhanced nightly state bills job"""
    parser = argparse.ArgumentParser(description='Enhanced Nightly State Bills & Session Discovery')
    parser.add_argument('--production', action='store_true', help='Run in production mode')
    parser.add_argument('--discover-sessions', action='store_true', help='Discover new sessions')
    parser.add_argument('--fetch-new-bills', action='store_true', help='Fetch new bills for new sessions')
    parser.add_argument('--check-updates', action='store_true', help='Check for status updates')
    parser.add_argument('--process-ai', action='store_true', help='Process AI analysis queue')
    parser.add_argument('--ensure-links', action='store_true', help='Ensure all bills have source links')
    parser.add_argument('--ensure-categories', action='store_true', help='Ensure proper practice area tags')
    args = parser.parse_args()
    
    logger.info("🚀 Starting Enhanced Azure Container Job: State Bills & Session Discovery")
    logger.info(f"⏰ Execution time: {datetime.utcnow().isoformat()}Z")
    logger.info(f"🌐 Environment: {os.getenv('ENVIRONMENT', 'unknown')}")
    logger.info(f"🏭 Production mode: {args.production}")
    
    total_stats = {
        'new_sessions': 0,
        'new_bills': 0,
        'status_updates': 0,
        'ai_processed': 0,
        'source_links_added': 0,
        'categories_updated': 0
    }
    
    try:
        # 1. Discover new sessions (if enabled or in production)
        if args.discover_sessions or args.production:
            logger.info("1️⃣ PHASE 1: Session Discovery")
            new_sessions = await discover_new_sessions()
            total_stats['new_sessions'] = len(new_sessions)
            
            # 2. Fetch bills for new sessions
            if new_sessions and (args.fetch_new_bills or args.production):
                logger.info("2️⃣ PHASE 2: Fetching Bills for New Sessions")
                for session in new_sessions:
                    new_bills = await fetch_new_bills_for_session(session)
                    total_stats['new_bills'] += new_bills
        
        # 3. Check for status updates on existing bills
        if args.check_updates or args.production:
            logger.info("3️⃣ PHASE 3: Status Updates Check")
            status_updates = await check_bill_status_updates()
            total_stats['status_updates'] = status_updates
        
        # 4. Process AI analysis queue
        if args.process_ai or args.production:
            logger.info("4️⃣ PHASE 4: AI Processing Queue")
            ai_processed = await process_ai_queue()
            total_stats['ai_processed'] = ai_processed
        
        # 5. Ensure source links (new functionality)
        if args.ensure_links or args.production:
            logger.info("5️⃣ PHASE 5: Ensuring Source Links")
            source_links_added = await ensure_source_links()
            total_stats['source_links_added'] = source_links_added
        
        # 6. Ensure proper practice area categories (new functionality)
        if args.ensure_categories or args.production:
            logger.info("6️⃣ PHASE 6: Ensuring Practice Area Tags")
            categories_updated = await ensure_practice_area_tags()
            total_stats['categories_updated'] = categories_updated
        
        # Summary
        logger.info("✅ Enhanced nightly job completed successfully!")
        logger.info(f"📊 Final Summary:")
        logger.info(f"  🆕 New sessions discovered: {total_stats['new_sessions']}")
        logger.info(f"  📜 New bills added: {total_stats['new_bills']}")
        logger.info(f"  🔄 Status updates: {total_stats['status_updates']}")
        logger.info(f"  🤖 AI summaries processed: {total_stats['ai_processed']}")
        logger.info(f"  🔗 Source links added: {total_stats['source_links_added']}")
        logger.info(f"  🏷️ Categories updated: {total_stats['categories_updated']}")
        
        # Verify AI processing in database
        if total_stats['ai_processed'] > 0:
            try:
                from database_config import get_db_connection
                with get_db_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute('''
                        SELECT COUNT(*) FROM dbo.state_legislation
                        WHERE ai_executive_summary IS NOT NULL 
                        AND ai_executive_summary != ''
                        AND last_updated >= DATEADD(hour, -1, GETDATE())
                    ''')
                    recent_ai_count = cursor.fetchone()[0]
                    logger.info(f"🔍 Verification: {recent_ai_count} bills with AI summaries in last hour")
            except Exception as e:
                logger.warning(f"⚠️ Could not verify AI processing: {e}")
        
        logger.info("🎉 Azure Container Job completed successfully!")
        sys.exit(0)  # Success
        
    except Exception as e:
        logger.error(f"❌ Critical error in enhanced nightly job: {e}")
        logger.error(f"📋 Traceback: {traceback.format_exc()}")
        logger.error("💥 Azure Container Job failed!")
        sys.exit(1)  # Failure

if __name__ == "__main__":
    asyncio.run(main())