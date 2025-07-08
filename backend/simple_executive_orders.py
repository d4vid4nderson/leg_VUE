# simple_executive_orders.py - FIXED DATABASE CONNECTION USAGE
import os
import json
import asyncio
import logging
import requests
from typing import Dict, List, Optional, Set
from datetime import datetime, timedelta

# Import database connection
from database_connection import get_db_connection

logger = logging.getLogger(__name__)

class SimpleExecutiveOrders:
    """Simple integration for Executive Orders API with individual order checking"""
    
    def __init__(self):
        self.federal_register_api_url = "https://www.federalregister.gov/api/v1/documents.json"
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'LegislationVue/1.0',
            'Accept': 'application/json'
        })
        # Cache for existing orders to avoid repeated database queries
        self._existing_orders_cache = None
    
    def get_existing_orders_from_database(self):
        """Get existing order identifiers - MATCHES YOUR EXACT dbo.executive_orders TABLE"""
        try:
            if hasattr(self, '_existing_orders_cache') and self._existing_orders_cache is not None:
                return self._existing_orders_cache
            
            from database_connection import get_db_connection
            
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Query using your EXACT column names from the screenshot
                cursor.execute("""
                    SELECT DISTINCT eo_number, document_number 
                    FROM dbo.executive_orders 
                    WHERE (eo_number IS NOT NULL OR document_number IS NOT NULL)
                """)
                
                existing_orders = set()
                for row in cursor.fetchall():
                    eo_number, doc_number = row
                    if eo_number:
                        existing_orders.add(str(eo_number).strip())
                    if doc_number:
                        existing_orders.add(str(doc_number).strip())
                
                cursor.close()
            
            self._existing_orders_cache = existing_orders
            logger.info(f"📊 SCHEMA MATCH: Loaded {len(existing_orders)} existing orders from dbo.executive_orders")
            return existing_orders
            
        except Exception as e:
            logger.error(f"❌ SCHEMA MATCH ERROR: {e}")
            return set()

    def check_database_for_existing_orders(self):
        """Check database status - MATCHES YOUR EXACT dbo.executive_orders TABLE"""
        try:
            from database_connection import get_db_connection
            
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Check if your executive_orders table exists
                cursor.execute("""
                    SELECT COUNT(*) 
                    FROM INFORMATION_SCHEMA.TABLES 
                    WHERE TABLE_NAME = 'executive_orders' AND TABLE_SCHEMA = 'dbo'
                """)
                
                table_exists = cursor.fetchone()[0] > 0
                
                if not table_exists:
                    cursor.close()
                    return {
                        'table_exists': False,
                        'count': 0,
                        'latest_date': None,
                        'latest_eo_number': None,
                        'needs_fetch': True,
                        'message': 'dbo.executive_orders table does not exist'
                    }
                
                # Get total count from your table
                cursor.execute("SELECT COUNT(*) FROM dbo.executive_orders")
                existing_count = cursor.fetchone()[0]
                
                # Get latest order using your exact column names
                cursor.execute("""
                    SELECT TOP 1 signing_date, eo_number, title
                    FROM dbo.executive_orders 
                    ORDER BY signing_date DESC, created_at DESC
                """)
                
                latest_row = cursor.fetchone()
                latest_date = None
                latest_eo_number = None
                latest_title = None
                
                if latest_row:
                    latest_date = latest_row[0]
                    latest_eo_number = latest_row[1]
                    latest_title = latest_row[2]
                    
                    if latest_date and hasattr(latest_date, 'strftime'):
                        latest_date = latest_date.strftime('%Y-%m-%d')
                
                cursor.close()
            
            logger.info(f"📊 dbo.executive_orders status:")
            logger.info(f"   - Total records: {existing_count}")
            logger.info(f"   - Latest EO: #{latest_eo_number} ({latest_date})")
            
            return {
                'table_exists': True,
                'count': existing_count,
                'latest_date': latest_date,
                'latest_eo_number': latest_eo_number,
                'latest_title': latest_title,
                'needs_fetch': existing_count == 0,
                'message': f'dbo.executive_orders has {existing_count} records, latest: EO #{latest_eo_number}'
            }
            
        except Exception as e:
            logger.error(f"❌ Database check failed: {e}")
            return {
                'table_exists': False,
                'count': 0,
                'latest_date': None,
                'latest_eo_number': None,
                'needs_fetch': True,
                'error': str(e),
                'message': f'Database check error: {str(e)}'
            }

    def is_order_already_processed(self, order):
        """Check if order exists in dbo.executive_orders - EXACT TABLE MATCH"""
        try:
            existing_orders = self.get_existing_orders_from_database()
            
            # Check both eo_number and document_number (your exact columns)
            eo_number = order.get('executive_order_number', '')
            doc_number = order.get('document_number', '')
            
            if eo_number and str(eo_number).strip() in existing_orders:
                logger.debug(f"⏭️ EO #{eo_number} already exists in dbo.executive_orders")
                return True
                
            if doc_number and str(doc_number).strip() in existing_orders:
                logger.debug(f"⏭️ Doc #{doc_number} already exists in dbo.executive_orders")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"❌ Error checking existing order: {e}")
            return False  # Assume new if we can't check
    
    def get_federal_register_count_only(self):
        """Get just the count from Federal Register API without fetching all data"""
        try:
            logger.info("📊 Checking Federal Register API for total count...")
            
            base_params = {
                'conditions[correction]': '0',
                'conditions[president]': 'donald-trump',
                'conditions[presidential_document_type]': 'executive_order',
                'conditions[signing_date][gte]': "01/20/2025",
                'conditions[signing_date][lte]': datetime.now().strftime('%m/%d/%Y'),
                'conditions[type][]': 'PRESDOCU',
                'per_page': '1',  # Only need count, not data
                'fields[]': ['document_number']  # Minimal field
            }
            
            response = self.session.get(self.federal_register_api_url, params=base_params, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                total_count = data.get('count', 0)
                logger.info(f"📊 Federal Register reports {total_count} total executive orders")
                return {
                    'success': True,
                    'count': total_count,
                    'message': f'Federal Register has {total_count} total orders'
                }
            else:
                logger.error(f"❌ Federal Register API error: {response.status_code}")
                return {
                    'success': False,
                    'count': 0,
                    'error': f'API error: {response.status_code}',
                    'message': 'Failed to get Federal Register count'
                }
                
        except Exception as e:
            logger.error(f"❌ Error getting Federal Register count: {e}")
            return {
                'success': False,
                'count': 0,
                'error': str(e),
                'message': f'Count check failed: {str(e)}'
            }
    
    def should_fetch_orders(self, force_fetch=False):
        """Determine if we should fetch orders based on database state and Federal Register count"""
        try:
            logger.info("🔍 Checking if we need to fetch executive orders...")
            
            # Check database first
            db_check = self.check_database_for_existing_orders()
            
            # If force fetch is requested, always fetch
            if force_fetch:
                logger.info("🔄 Force fetch requested - will fetch regardless of database state")
                # Reset cache for force fetch
                self._existing_orders_cache = None
                return {
                    'should_fetch': True,
                    'reason': 'force_fetch_requested',
                    'db_count': db_check.get('count', 0),
                    'federal_count': None,
                    'new_orders_available': None,
                    'message': 'Force fetch requested by user'
                }
            
            # If no table or no orders, definitely fetch
            if not db_check.get('table_exists') or db_check.get('count', 0) == 0:
                logger.info("🆕 No existing orders found - full fetch required")
                return {
                    'should_fetch': True,
                    'reason': 'no_existing_orders',
                    'db_count': db_check.get('count', 0),
                    'federal_count': None,
                    'new_orders_available': None,
                    'message': 'No existing orders in database - full fetch required'
                }
            
            # Check Federal Register count
            federal_check = self.get_federal_register_count_only()
            
            if not federal_check.get('success'):
                logger.warning("⚠️ Could not check Federal Register - will skip fetch for now")
                return {
                    'should_fetch': False,
                    'reason': 'federal_api_error',
                    'db_count': db_check.get('count', 0),
                    'federal_count': None,
                    'new_orders_available': None,
                    'message': 'Federal Register API error - skipping fetch'
                }
            
            db_count = db_check.get('count', 0)
            federal_count = federal_check.get('count', 0)
            new_orders_available = max(0, federal_count - db_count)
            
            # Compare counts
            if federal_count > db_count:
                logger.info(f"🆕 New orders detected: Federal={federal_count}, DB={db_count}, New={new_orders_available}")
                # Reset cache when fetching new orders
                self._existing_orders_cache = None
                return {
                    'should_fetch': True,
                    'reason': 'new_orders_available',
                    'db_count': db_count,
                    'federal_count': federal_count,
                    'new_orders_available': new_orders_available,
                    'message': f'{new_orders_available} new orders available for fetch'
                }
            else:
                logger.info(f"✅ Database is up to date: Federal={federal_count}, DB={db_count}")
                return {
                    'should_fetch': False,
                    'reason': 'database_up_to_date',
                    'db_count': db_count,
                    'federal_count': federal_count,
                    'new_orders_available': 0,
                    'message': 'Database is up to date - no fetch needed'
                }
                
        except Exception as e:
            logger.error(f"❌ Error in should_fetch_orders: {e}")
            return {
                'should_fetch': True,  # Default to fetch on error
                'reason': 'error_occurred',
                'db_count': 0,
                'federal_count': None,
                'new_orders_available': None,
                'error': str(e),
                'message': f'Error checking - defaulting to fetch: {str(e)}'
            }
    
    def fetch_executive_orders_direct(self, start_date=None, end_date=None, limit=None):
        """Fetch executive orders with individual order checking to skip existing ones"""
        try:
            logger.info(f"📡 Fetching Executive Orders from Federal Register API: {start_date} to {end_date}")
            
            # Default dates if not provided
            if not start_date:
                start_date = "01/20/2025"  # Inauguration day
            
            if not end_date:
                end_date = datetime.now().strftime('%m/%d/%Y')
            
            logger.info(f"📅 Using date range: {start_date} to {end_date}")
            
            # Pre-load existing orders for efficient checking
            existing_orders = self.get_existing_orders_from_database()
            logger.info(f"📊 Pre-loaded {len(existing_orders)} existing orders for duplicate checking")
            
            all_results = []
            page = 1
            total_pages = 1
            
            while page <= total_pages:
                logger.info(f"📄 Fetching page {page} of {total_pages}...")
                
                base_params = {
                    'conditions[correction]': '0',
                    'conditions[president]': 'donald-trump',
                    'conditions[presidential_document_type]': 'executive_order',
                    'conditions[signing_date][gte]': start_date,
                    'conditions[signing_date][lte]': end_date,
                    'conditions[signing_date][year]': '2025',
                    'conditions[type][]': 'PRESDOCU',
                    'fields[]': [
                        'citation',
                        'document_number', 
                        'end_page',
                        'html_url',
                        'pdf_url',
                        'type',
                        'subtype',
                        'publication_date',
                        'signing_date',
                        'start_page',
                        'title',
                        'disposition_notes',
                        'executive_order_number',
                        'not_received_for_publication',
                        'full_text_xml_url',
                        'body_html_url',
                        'json_url'
                    ],
                    'include_pre_1994_docs': 'true',
                    'per_page': '100',
                    'page': str(page),
                    'order': 'executive_order'
                }
                
                response = self.session.get(self.federal_register_api_url, params=base_params, timeout=60)
                
                if response.status_code != 200:
                    logger.error(f"❌ API request failed: {response.status_code} - {response.text}")
                    break
                    
                data = response.json()
                results = data.get('results', [])
                
                if not results:
                    logger.info("✅ No more results found")
                    break
                
                all_results.extend(results)
                
                total_count = data.get('count', 0)
                per_page = data.get('per_page', 100)
                total_pages = max(1, (total_count + per_page - 1) // per_page)
                
                logger.info(f"📊 Page {page}: Got {len(results)} orders, {len(all_results)} total so far")
                logger.info(f"📊 API reports {total_count} total orders across {total_pages} pages")
                
                page += 1
                
                if page > 100:
                    logger.warning("⚠️ Reached maximum page limit (100 pages)")
                    break
            
            logger.info(f"✅ Federal Register API returned {len(all_results)} total executive orders")
            
            # Transform and filter - ENHANCED with individual checking
            transformed = []
            skipped_existing = 0
            
            for index, order in enumerate(all_results):
                try:
                    # FIRST: Check if this order already exists in database
                    if self.is_order_already_processed(order):
                        skipped_existing += 1
                        logger.debug(f"⏭️ Skipping existing order {index+1}: {order.get('executive_order_number', order.get('document_number', 'unknown'))}")
                        continue
                    
                    # Get basic info
                    eo_num = order.get('executive_order_number', '')
                    doc_num = order.get('document_number', '')
                    primary_eo_number = eo_num if eo_num else doc_num
                    title = order.get('title', '')
                    
                    # Skip if missing critical data
                    if not primary_eo_number:
                        logger.warning(f"⚠️ Skipping order {index+1}: missing EO number")
                        continue
                    
                    logger.info(f"🆕 Processing NEW order {index+1}: {primary_eo_number} - {title[:50]}...")
                    
                    # Process dates safely
                    signing_date = None
                    if order.get('signing_date'):
                        try:
                            signing_date_obj = datetime.strptime(order['signing_date'], '%Y-%m-%d')
                            signing_date = signing_date_obj.strftime('%Y-%m-%d')
                        except:
                            signing_date = order['signing_date']
                    
                    publication_date = None
                    if order.get('publication_date'):
                        try:
                            pub_date_obj = datetime.strptime(order['publication_date'], '%Y-%m-%d')
                            publication_date = pub_date_obj.strftime('%Y-%m-%d')
                        except:
                            publication_date = order['publication_date']
                    
                    # Determine category
                    category = self._categorize_order(title.lower())
                    
                    # Create transformed_order object
                    transformed_order = {
                        'document_number': doc_num,
                        'eo_number': eo_num,
                        'executive_order_number': eo_num,
                        'primary_identifier': primary_eo_number,
                        'title': title,
                        'summary': order.get('abstract', '') or order.get('disposition_notes', ''),
                        'signing_date': signing_date,
                        'publication_date': publication_date,
                        'citation': order.get('citation', ''),
                        'presidential_document_type': 'executive_order',
                        'category': category,
                        'html_url': order.get('html_url', ''),
                        'pdf_url': order.get('pdf_url', ''),
                        'trump_2025_url': order.get('html_url', ''),
                        'source': 'federal_register_api',
                        'raw_data_available': True,
                        'processing_status': 'fetched',
                        'created_at': datetime.now(),
                        'last_updated': datetime.now(),
                        'last_scraped_at': datetime.now(),
                        'president': 'donald-trump'
                    }
                    
                    transformed.append(transformed_order)
                    logger.debug(f"✅ Successfully processed NEW order {index+1}: {primary_eo_number}")
                    
                except Exception as processing_error:
                    logger.error(f"❌ Failed to process order {index+1}: {processing_error}")
                    continue
            
            logger.info(f"✅ Processing summary:")
            logger.info(f"   - Total from API: {len(all_results)}")
            logger.info(f"   - Skipped existing: {skipped_existing}")
            logger.info(f"   - New orders to process: {len(transformed)}")
            
            return {
                'success': True,
                'results': transformed,
                'count': len(transformed),
                'total_found': len(all_results),
                'skipped_existing': skipped_existing,
                'pages_fetched': page - 1,
                'message': f'Successfully fetched {len(transformed)} NEW executive orders (skipped {skipped_existing} existing)'
            }
            
        except requests.RequestException as e:
            logger.error(f"❌ Network error fetching executive orders: {e}")
            return {
                'success': False,
                'error': f'Network error: {str(e)}',
                'results': [],
                'count': 0
            }
        except Exception as e:
            logger.error(f"❌ Error fetching executive orders: {e}")
            return {
                'success': False,
                'error': str(e),
                'results': [],
                'count': 0
            }
    
    def _categorize_order(self, title_lower):
        """Categorize order based on title"""
        if not title_lower:
            return 'civic'
        
        categorization_rules = {
            'healthcare': ['health', 'medical', 'care', 'medicare', 'medicaid', 'insurance', 'pharmaceutical', 'drug', 'doctor', 'hospital', 'clinic', 'healthcare', 'hospitals', 'hospice', 'nursing', 'vaccine', 'vaccines', 'immunization'],
            'education': ['education', 'school', 'student', 'university', 'college', 'teacher', 'professor', 'academic', 'learning', 'training', 'curriculum', 'scholarship', 'tuition'],
            'engineering': ['infrastructure', 'transport', 'highway', 'bridge', 'road', 'rail', 'airport', 'port', 'construction', 'engineering'],
            'civic': ['business', 'trade', 'economic', 'commerce', 'criminal', 'justice', 'police', 'court', 'law', 'legal', 'legislation', 'regulation', 'government', 'public policy', 'transportation', 'first responders', 'emergency']
        }
        
        for category, keywords in categorization_rules.items():
            if any(keyword in title_lower for keyword in keywords):
                return category
        
        return 'civic'

def get_date_range_for_period(period: str) -> tuple:
    """Generate date ranges for periods"""
    current_date = datetime.now()
    
    period_mappings = {
        "inauguration": ("01/20/2025", current_date.strftime('%m/%d/%Y')),
        "last_90_days": ((current_date - timedelta(days=90)).strftime('%m/%d/%Y'), current_date.strftime('%m/%d/%Y')),
        "last_30_days": ((current_date - timedelta(days=30)).strftime('%m/%d/%Y'), current_date.strftime('%m/%d/%Y')),
        "last_7_days": ((current_date - timedelta(days=7)).strftime('%m/%d/%Y'), current_date.strftime('%m/%d/%Y')),
        "this_week": ((current_date - timedelta(days=current_date.weekday())).strftime('%m/%d/%Y'), current_date.strftime('%m/%d/%Y')),
        "this_month": (current_date.replace(day=1).strftime('%m/%d/%Y'), current_date.strftime('%m/%d/%Y'))
    }
    
    return period_mappings.get(period, ("01/20/2025", current_date.strftime('%m/%d/%Y')))

async def fetch_executive_orders_simple_integration(
    start_date=None, 
    end_date=None, 
    with_ai=True, 
    limit=None,
    period=None, 
    save_to_db=True,
    force_fetch=False
):
    """
    Complete integration pipeline - ENHANCED WITH INDIVIDUAL ORDER CHECKING
    """
    processed_orders = []
    ai_stats = {'successful': 0, 'failed': 0, 'skipped': 0}
    
    try:
        logger.info("🚀 Starting Enhanced Executive Orders Integration with Individual Order Checking")
        
        # Handle dates
        if period:
            start_date, end_date = get_date_range_for_period(period)
        elif not start_date:
            start_date = "01/20/2025"
        
        if not end_date:
            end_date = datetime.now().strftime('%m/%d/%Y')
        
        logger.info(f"📅 Processing date range: {start_date} to {end_date}")
        logger.info(f"🤖 AI Analysis: {'ENABLED' if with_ai else 'DISABLED'}")
        logger.info(f"💾 Database Save: {'ENABLED' if save_to_db else 'DISABLED'}")
        logger.info(f"🔄 Force Fetch: {'ENABLED' if force_fetch else 'DISABLED'}")
        
        # Step 1: Check if we should fetch orders
        api_client = SimpleExecutiveOrders()
        fetch_decision = api_client.should_fetch_orders(force_fetch=force_fetch)
        
        logger.info(f"📊 Fetch Decision: {fetch_decision.get('message')}")
        logger.info(f"📊 DB Count: {fetch_decision.get('db_count', 'unknown')}")
        logger.info(f"📊 Federal Count: {fetch_decision.get('federal_count', 'unknown')}")
        logger.info(f"📊 New Available: {fetch_decision.get('new_orders_available', 'unknown')}")
        
        # If we don't need to fetch, return database info
        if not fetch_decision.get('should_fetch', True):
            logger.info("✅ No fetch needed - database is up to date")
            
            # Try to return existing orders from database
            try:
                from executive_orders_db import get_executive_orders_from_db
                
                db_result = get_executive_orders_from_db(limit=1000, offset=0, filters={})
                if db_result.get('success'):
                    existing_orders = db_result.get('results', [])
                    logger.info(f"📋 Returning {len(existing_orders)} existing orders from database")
                    
                    return {
                        'success': True,
                        'results': existing_orders,
                        'count': len(existing_orders),
                        'orders_saved': 0,  # No new orders saved
                        'total_found': fetch_decision.get('db_count', len(existing_orders)),
                        'ai_analysis_enabled': False,
                        'ai_successful': 0,
                        'ai_failed': 0,
                        'ai_skipped': 0,
                        'date_range_used': f"{start_date} to {end_date}",
                        'fetch_skipped': True,
                        'fetch_reason': fetch_decision.get('reason'),
                        'database_was_current': True,
                        'processing_method': 'database_current_skip_fetch',
                        'message': f'Database current: {fetch_decision.get("message")} - returned {len(existing_orders)} existing orders'
                    }
                
            except ImportError:
                logger.warning("⚠️ Could not import database functions")
            except Exception as db_error:
                logger.warning(f"⚠️ Could not retrieve existing orders: {db_error}")
            
            # If we can't get existing orders, return minimal response
            return {
                'success': True,
                'results': [],
                'count': 0,
                'orders_saved': 0,
                'total_found': fetch_decision.get('db_count', 0),
                'fetch_skipped': True,
                'fetch_reason': fetch_decision.get('reason'),
                'database_was_current': True,
                'processing_method': 'database_current_skip_fetch',
                'message': f'Database current: {fetch_decision.get("message")}'
            }
        
        # Step 2: Proceed with fetch since it's needed
        logger.info("🔄 Proceeding with fetch - new orders available or force requested")
        
        fetch_result = api_client.fetch_executive_orders_direct(start_date, end_date, None)
        
        if not fetch_result.get('success'):
            logger.error(f"❌ Federal Register fetch failed: {fetch_result.get('error')}")
            return fetch_result
        
        raw_orders = fetch_result.get('results', [])
        skipped_existing = fetch_result.get('skipped_existing', 0)
        
        logger.info(f"✅ Federal Register: {len(raw_orders)} NEW orders retrieved")
        logger.info(f"⏭️ Skipped {skipped_existing} existing orders")
        
        if len(raw_orders) == 0:
            return {
                'success': True,
                'results': [],
                'count': 0,
                'orders_saved': 0,
                'skipped_existing': skipped_existing,
                'message': f'No new executive orders found (skipped {skipped_existing} existing)'
            }
        
        # Step 3: Process each NEW order (now all orders are confirmed to be new)
        for index, order in enumerate(raw_orders):
            try:
                current_order = dict(order)
                
                # AI processing if enabled
                if with_ai:
                    try:
                        from ai import analyze_executive_order
                        
                        logger.info(f"🔍 Analyzing NEW executive order: {order.get('title', 'Unknown')[:50]}...")
                        
                        ai_result = await analyze_executive_order(
                            title=order.get('title', ''),
                            abstract=order.get('summary', ''),
                            order_number=order.get('eo_number', '')
                        )
                        
                        if ai_result and isinstance(ai_result, dict):
                            current_order.update({
                                'ai_summary': ai_result.get('ai_summary', ''),
                                'ai_executive_summary': ai_result.get('ai_executive_summary', ''),
                                'ai_talking_points': ai_result.get('ai_talking_points', ''),
                                'ai_key_points': ai_result.get('ai_key_points', ''),
                                'ai_business_impact': ai_result.get('ai_business_impact', ''),
                                'ai_potential_impact': ai_result.get('ai_potential_impact', ''),
                                'ai_version': 'azure_ai_production_v2',
                                'ai_processed_at': datetime.now().isoformat()
                            })
                            ai_stats['successful'] += 1
                        else:
                            ai_stats['failed'] += 1
                            
                    except ImportError:
                        logger.warning("⚠️ AI module not available")
                        ai_stats['skipped'] = len(raw_orders) - index
                        with_ai = False
                    except Exception as ai_error:
                        logger.warning(f"⚠️ AI failed for order {index+1}: {ai_error}")
                        ai_stats['failed'] += 1
                
                processed_orders.append(current_order)
                
                # Small delay for AI processing
                if index < len(raw_orders) - 1 and with_ai:
                    await asyncio.sleep(0.1)
                
            except Exception as processing_error:
                logger.error(f"❌ Failed to process order {index+1}: {processing_error}")
                if order:
                    processed_orders.append(order)
                continue
        
        logger.info(f"✅ Processing complete: {len(processed_orders)} NEW orders processed")
        if with_ai:
            logger.info(f"🤖 AI Stats: {ai_stats['successful']} successful, {ai_stats['failed']} failed")
        
        # Step 4: Save to database
        saved_count = 0
        if save_to_db and len(processed_orders) > 0:
            try:
                from executive_orders_db import save_executive_orders_to_db
                
                logger.info(f"💾 Saving {len(processed_orders)} NEW orders to database...")
                save_result = save_executive_orders_to_db(processed_orders)
                
                if isinstance(save_result, dict):
                    saved_count = save_result.get('total_processed', 0)
                else:
                    saved_count = int(save_result) if save_result else 0
                    
                logger.info(f"✅ Database save complete: {saved_count} NEW orders saved")
                    
            except ImportError:
                logger.error("❌ Database module not available")
            except Exception as db_error:
                logger.error(f"❌ Database save failed: {db_error}")
        
        return {
            'success': True,
            'results': processed_orders,
            'count': len(processed_orders),
            'orders_saved': saved_count,
            'total_found': fetch_result.get('total_found', len(processed_orders)),
            'skipped_existing': skipped_existing,
            'ai_analysis_enabled': with_ai,
            'ai_successful': ai_stats['successful'],
            'ai_failed': ai_stats['failed'],
            'ai_skipped': ai_stats['skipped'],
            'date_range_used': f"{start_date} to {end_date}",
            'fetch_performed': True,
            'fetch_reason': fetch_decision.get('reason'),
            'new_orders_fetched': len(processed_orders),
            'database_count_before': fetch_decision.get('db_count', 0),
            'federal_count': fetch_decision.get('federal_count', len(processed_orders)),
            'processing_method': 'enhanced_with_individual_order_checking',
            'message': f'Enhanced pipeline complete: {len(processed_orders)} NEW orders processed, {saved_count} saved (skipped {skipped_existing} existing)'
        }
        
    except Exception as pipeline_error:
        logger.error(f"❌ Pipeline error: {pipeline_error}")
        return {
            'success': False,
            'error': str(pipeline_error),
            'results': [],
            'count': 0,
            'message': f'Enhanced pipeline failed: {str(pipeline_error)}'
        }

# Keep all other existing functions unchanged...
def fetch_all_executive_orders_simple() -> Dict:
    """Fetch all executive orders"""
    logger.info("🚀 Fetching ALL Executive Orders")
    
    api_client = SimpleExecutiveOrders()
    result = api_client.fetch_executive_orders_direct(
        start_date="01/20/2025",
        end_date=None,
        limit=None
    )
    
    if result.get('success'):
        count = result.get('count', 0)
        total = result.get('total_found', 0)
        logger.info(f"✅ Fetch complete: {count} orders processed from {total} available")
    else:
        logger.error(f"❌ Fetch failed: {result.get('error', 'Unknown error')}")
    
    return result

def check_executive_orders_table():
    """Check if table exists"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT COUNT(*) 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_NAME = 'executive_orders' AND TABLE_SCHEMA = 'dbo'
            """)
            
            table_exists = cursor.fetchone()[0] > 0
            
            if table_exists:
                cursor.execute("""
                    SELECT COLUMN_NAME
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_NAME = 'executive_orders' AND TABLE_SCHEMA = 'dbo'
                    ORDER BY ORDINAL_POSITION
                """)
                
                columns = [row[0] for row in cursor.fetchall()]
                cursor.close()
                
                logger.info(f"✅ executive_orders table verified: {len(columns)} columns")
                return True, columns
            else:
                cursor.close()
                logger.warning("⚠️ executive_orders table not found")
                return False, []
            
    except Exception as e:
        logger.error(f"❌ Table check error: {e}")
        return False, []

async def get_federal_register_count_lightweight(simple_eo_instance):
    """Get count from Federal Register"""
    try:
        result = simple_eo_instance.get_federal_register_count_only()
        return result.get('count', 0)
    except Exception as e:
        logger.error(f"❌ Count check error: {e}")
        return 0

async def get_database_count_existing():
    """Get database count"""
    try:
        api_client = SimpleExecutiveOrders()
        db_check = api_client.check_database_for_existing_orders()
        return db_check.get('count', 0)
    except Exception as e:
        logger.error(f"❌ Database count error: {e}")
        return 0

async def check_executive_orders_count_integration():
    """Enhanced count check with database awareness"""
    try:
        logger.info("🔍 Starting enhanced count check with database awareness...")
        
        simple_eo = SimpleExecutiveOrders()
        
        # Use the enhanced should_fetch_orders method
        fetch_decision = simple_eo.should_fetch_orders(force_fetch=False)
        
        return {
            "success": True,
            "federal_register_count": fetch_decision.get('federal_count', 0),
            "database_count": fetch_decision.get('db_count', 0),
            "new_orders_available": fetch_decision.get('new_orders_available', 0),
            "needs_fetch": fetch_decision.get('should_fetch', False),
            "reason": fetch_decision.get('reason', 'unknown'),
            "last_checked": datetime.now().isoformat(),
            "message": fetch_decision.get('message', 'Count check completed')
        }
        
    except Exception as e:
        logger.error(f"❌ Enhanced count check error: {e}")
        return {
            "success": False,
            "error": str(e),
            "federal_register_count": 0,
            "database_count": 0,
            "new_orders_available": 0,
            "needs_fetch": False,
            "message": f"Error: {str(e)}"
        }

# Test functions remain the same...
async def test_database_integration():
    """Test database"""
    try:
        print("🧪 Testing database...")
        with get_db_connection() as conn:
            print("✅ Database connection works")
        
        exists, columns = check_executive_orders_table()
        print(f"✅ Table exists: {exists}")
        if columns:
            print(f"✅ Columns: {len(columns)}")
        
        return exists
    except Exception as e:
        print(f"❌ Database test failed: {e}")
        return False

async def test_federal_register_direct():
    """Test the enhanced pipeline with individual order checking"""
    print("🧪 Testing Enhanced Pipeline with Individual Order Checking")
    print("=" * 60)
    
    result = await fetch_executive_orders_simple_integration(
        start_date="01/20/2025",
        end_date=None,
        with_ai=False,
        save_to_db=True,
        force_fetch=False  # Test the individual order checking logic
    )
    
    print(f"📊 Results:")
    print(f"   Success: {result.get('success')}")
    print(f"   NEW Orders Processed: {result.get('count', 0)}")
    print(f"   Saved: {result.get('orders_saved', 0)}")
    print(f"   Total Found: {result.get('total_found', 0)}")
    print(f"   Skipped Existing: {result.get('skipped_existing', 0)}")
    print(f"   Fetch Performed: {result.get('fetch_performed', 'unknown')}")
    print(f"   Fetch Reason: {result.get('fetch_reason', 'unknown')}")
    
    if result.get('success') and result.get('results'):
        print(f"\n📋 Sample NEW Orders:")
        for i, order in enumerate(result['results'][:3], 1):
            eo_num = order.get('eo_number', 'N/A')
            title = order.get('title', 'No title')[:50] + "..."
            date = order.get('signing_date', 'Unknown')
            print(f"{i}. EO #{eo_num}: {title}")
            print(f"   📅 Signed: {date}")
    
    print("🏁 Enhanced Test Complete")

if __name__ == "__main__":
    import asyncio
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(levelname)s:%(name)s:%(message)s'
    )
    
    print("🚀 Testing Enhanced Executive Orders Integration with Individual Order Checking")
    print("=" * 70)
    
    async def run_tests():
        await test_database_integration()
        print("\n" + "=" * 70)
        await test_federal_register_direct()
    
    asyncio.run(run_tests())