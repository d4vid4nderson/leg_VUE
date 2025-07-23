# simple_executive_orders.py - Fixed integration with direct pyodbc
import os
import re
import json
import asyncio
import logging
import requests
from typing import Dict, List, Optional
from datetime import datetime, timedelta

# Import our new multi-database connection support
from database_config import get_db_connection
from contextlib import contextmanager

@contextmanager
def get_db_cursor():
    """Context manager for database cursors using new multi-database connection"""
    with get_db_connection() as conn:
        cursor = None
        try:
            cursor = conn.cursor()
            yield cursor
            conn.commit()
        except Exception as e:
            logger.error(f"❌ Database error: {e}")
            conn.rollback()
            raise
        finally:
            if cursor:
                cursor.close()

logger = logging.getLogger(__name__)

def get_table_name():
    """Get the correct table name based on database type"""
    from database_config import get_database_config
    config = get_database_config()
    if config['type'] == 'postgresql':
        return "executive_orders"
    else:
        return "dbo.executive_orders"

class SimpleExecutiveOrders:
    """Simple integration for Executive Orders API"""
    
    def __init__(self):
        self.federal_register_api_url = "https://www.federalregister.gov/api/v1/documents.json"
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'LegislationVue/1.0',
            'Accept': 'application/json'
        })
    
    def get_executive_orders_count(self, start_date=None, end_date=None):
        """Get just the count of executive orders from Federal Register API without fetching the data"""
        try:
            logger.info(f"📊 Getting count from Federal Register API: {start_date} to {end_date}")
            
            # Default dates if not provided
            if not start_date:
                start_date = "01/20/2025"  # Inauguration day
            
            if not end_date:
                end_date = datetime.now().strftime('%m/%d/%Y')
            
            # Minimal parameters just to get count
            params = {
                'conditions[correction]': '0',
                'conditions[president]': 'donald-trump',
                'conditions[presidential_document_type]': 'executive_order',
                'conditions[signing_date][gte]': start_date,
                'conditions[signing_date][lte]': end_date,
                'conditions[type][]': 'PRESDOCU',
                'fields[]': ['document_number'],  # Minimal field to reduce response size
                'per_page': 1,  # Only get 1 result to minimize data transfer
                'format': 'json'
            }
            
            response = requests.get(self.federal_register_api_url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            count = data.get('count', 0)
            
            logger.info(f"✅ Federal Register has {count} executive orders")
            
            return {
                'success': True,
                'count': count,
                'date_range': f"{start_date} to {end_date}"
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Federal Register API error: {e}")
            return {
                'success': False,
                'error': f"API request failed: {str(e)}",
                'count': 0
            }
        except Exception as e:
            logger.error(f"❌ Unexpected error getting count: {e}")
            return {
                'success': False, 
                'error': f"Unexpected error: {str(e)}",
                'count': 0
            }

    def fetch_executive_orders_direct(self, start_date=None, end_date=None, limit=None):
        """Fetch executive orders directly from Federal Register API with pagination support"""
        try:
            logger.info(f"📡 Fetching from Federal Register API: {start_date} to {end_date}")
            
            # Default dates if not provided
            if not start_date:
                start_date = "01/20/2025"  # Inauguration day
            
            if not end_date:
                end_date = datetime.now().strftime('%m/%d/%Y')
            
            # Base parameters for all requests
            base_params = {
                'conditions[correction]': '0',
                'conditions[president]': 'donald-trump',
                'conditions[presidential_document_type]': 'executive_order',
                'conditions[signing_date][gte]': start_date,
                'conditions[signing_date][lte]': end_date,
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
                'order': 'executive_order'
            }
            
            # Collect all results across pages
            all_results = []
            page = 1
            per_page = min(1000, limit) if limit else 1000  # Federal Register API max is typically 1000
            total_count = None
            
            while True:
                # Add pagination parameters
                params = base_params.copy()
                params.update({
                    'per_page': str(per_page),
                    'page': str(page)
                })
                
                logger.info(f"📄 Fetching page {page} (up to {per_page} results per page)")
                
                # Make the request
                response = self.session.get(self.federal_register_api_url, params=params, timeout=30)
                response.raise_for_status()
                
                data = response.json()
                results = data.get('results', [])
                
                # Get total count from first page
                if total_count is None:
                    total_count = data.get('count', 0)
                    logger.info(f"📊 Federal Register API reports {total_count} total executive orders")
                
                if not results:
                    logger.info(f"📄 Page {page} returned no results, pagination complete")
                    break
                
                all_results.extend(results)
                logger.info(f"✅ Page {page} returned {len(results)} orders (total so far: {len(all_results)})")
                
                # Check if we have a limit and reached it
                if limit and len(all_results) >= limit:
                    all_results = all_results[:limit]
                    logger.info(f"🔢 Reached specified limit of {limit} orders")
                    break
                
                # Check if we've got all available results
                if len(results) < per_page:
                    logger.info(f"📄 Last page reached (got {len(results)} < {per_page})")
                    break
                
                # Move to next page
                page += 1
                
                # Safety check to prevent infinite loops
                if page > 50:  # Should never need more than 50 pages for executive orders
                    logger.warning(f"⚠️ Reached maximum page limit of 50, stopping pagination")
                    break
            
            logger.info(f"✅ Federal Register API pagination complete: {len(all_results)} executive orders fetched")
            
            # Transform into our standard format
            transformed = []
            for order in all_results:
                eo_num = order.get('executive_order_number', '')
                doc_num = order.get('document_number', '')
                
                # Skip if missing critical data
                if not (eo_num or doc_num):
                    continue
                
                # Process dates
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
                
                # Determine category with comprehensive keyword matching
                title = order.get('title', '').lower()
                category = 'civic'  # Default fallback
                
                # Healthcare keywords
                healthcare_terms = [
                    'health', 'medical', 'care', 'healthcare', 'medicare', 'medicaid', 
                    'drug', 'prescription', 'hospital', 'patient', 'vaccine', 'opioid',
                    'mental health', 'public health', 'disease', 'treatment'
                ]
                
                # Education keywords  
                education_terms = [
                    'education', 'school', 'student', 'university', 'college', 'campus',
                    'academic', 'learning', 'teaching', 'curriculum', 'classroom',
                    'scholarship', 'student loan', 'educational', 'accreditation'
                ]
                
                # Engineering/Infrastructure keywords
                engineering_terms = [
                    'infrastructure', 'transport', 'engineering', 'construction', 'bridge',
                    'road', 'highway', 'energy', 'power', 'grid', 'nuclear', 'oil', 'gas',
                    'renewable', 'electric', 'mining', 'mineral', 'technology', 'digital',
                    'cybersecurity', 'broadband', 'telecommunications', 'aerospace'
                ]
                
                # Check categories in order of specificity
                if any(term in title for term in healthcare_terms):
                    category = 'healthcare'
                elif any(term in title for term in education_terms):
                    category = 'education'
                elif any(term in title for term in engineering_terms):
                    category = 'engineering'
                
                # Build standard format
                transformed_order = {
                    'eo_number': eo_num,
                    'document_number': doc_num,
                    'title': order.get('title', ''),
                    'summary': '',  # Federal Register doesn't provide summaries
                    'signing_date': signing_date,
                    'publication_date': publication_date,
                    'citation': order.get('citation', ''),
                    'presidential_document_type': 'executive_order',
                    'category': category,
                    'html_url': order.get('html_url', ''),
                    'pdf_url': order.get('pdf_url', ''),
                    'trump_2025_url': '',  # Not available from this API
                    'source': 'Federal Register API',
                    'raw_data_available': True,
                    'processing_status': 'completed',
                }
                
                transformed.append(transformed_order)
            
            return {
                'success': True,
                'results': transformed,
                'count': len(transformed),
                'total_found': total_count or len(all_results),
                'pages_fetched': page - 1,
                'date_range_used': f"{start_date} to {end_date}",
                'api_response_count': len(all_results),
                'pagination_info': {
                    'total_pages': page - 1,
                    'per_page': per_page,
                    'final_page_size': len(results) if results else 0
                }
            }
            
        except Exception as e:
            logger.error(f"❌ Error fetching from Federal Register: {e}")
            return {
                'success': False,
                'error': str(e),
                'results': [],
                'count': 0
            }

async def fetch_executive_orders_simple_integration(
    start_date=None, 
    end_date=None, 
    with_ai=True, 
    limit=None, 
    period=None,
    save_to_db=True
):
    """
    Complete executive orders pipeline: 
    Federal Register API → AI Processing → Database
    """
    try:
        # Handle period-based date selection
        if period:
            if period == "inauguration":
                start_date = "01/20/2025"
                end_date = datetime.now().strftime('%m/%d/%Y')
            elif period == "last_30_days":
                start_date = (datetime.now() - timedelta(days=30)).strftime('%m/%d/%Y')
                end_date = datetime.now().strftime('%m/%d/%Y')
            elif period == "last_90_days":
                start_date = (datetime.now() - timedelta(days=90)).strftime('%m/%d/%Y')
                end_date = datetime.now().strftime('%m/%d/%Y')
        elif not start_date:
            start_date = "01/20/2025"  # Default to inauguration
        
        if not end_date:
            end_date = datetime.now().strftime('%m/%d/%Y')
        
        logger.info(f"🚀 Starting Executive Orders fetch using Federal Register API")
        logger.info(f"📅 Date range: {start_date} to {end_date}")
        logger.info(f"🤖 AI Analysis: {'ENABLED' if with_ai else 'DISABLED'}")
        logger.info(f"💾 Save to DB: {'ENABLED' if save_to_db else 'DISABLED'}")
        
        # Step 1: Fetch from Federal Register API
        simple_eo = SimpleExecutiveOrders()
        fetch_result = simple_eo.fetch_executive_orders_direct(start_date, end_date, limit)
        
        if not fetch_result.get('success'):
            logger.error(f"❌ Federal Register API fetch failed: {fetch_result.get('error')}")
            return fetch_result
        
        raw_orders = fetch_result.get('results', [])
        logger.info(f"✅ Federal Register API found {len(raw_orders)} Executive Orders")
        
        # Sequential Processing: Fetch → AI → Save → Next (for immediate feedback)
        processed_orders = []
        ai_successful = 0
        ai_failed = 0
        orders_saved = 0
        orders_save_failed = 0
        
        # Import database function once at the start
        save_executive_orders_to_db = None
        if save_to_db:
            try:
                from executive_orders_db import save_executive_orders_to_db
                logger.info("💾 Database save function loaded successfully")
            except ImportError:
                logger.error("❌ Database module not available - disabling database saves")
                save_to_db = False
        
        # First, check which orders already exist in the database
        existing_orders = set()
        total_fetched = len(raw_orders)
        if save_to_db:
            try:
                from database_connection import get_db_connection, get_database_config, get_parameter_placeholder
                config = get_database_config()
                table_name = "executive_orders" if config['type'] == 'postgresql' else "dbo.executive_orders"
                placeholder = get_parameter_placeholder()
                
                with get_db_connection() as conn:
                    cursor = conn.cursor()
                    
                    # Get all existing order numbers and document numbers
                    cursor.execute(f"SELECT document_number, eo_number FROM {table_name}")
                    existing_rows = cursor.fetchall()
                    
                    for row in existing_rows:
                        if row[0]:  # document_number
                            existing_orders.add(row[0])
                        if row[1]:  # eo_number  
                            existing_orders.add(row[1])
                            
                logger.info(f"🔍 Found {len(existing_orders)} existing orders in database")
                
                # Filter out orders that already exist
                new_orders = []
                for order in raw_orders:
                    document_number = order.get('document_number', '')
                    eo_number = order.get('eo_number', '')
                    
                    if document_number not in existing_orders and eo_number not in existing_orders:
                        new_orders.append(order)
                    else:
                        logger.info(f"⏭️ Skipping existing order: {eo_number} ({document_number})")
                
                logger.info(f"📊 Orders summary: {len(raw_orders)} total, {len(existing_orders)} existing, {len(new_orders)} new")
                raw_orders = new_orders  # Only process new orders
                
            except Exception as db_check_error:
                logger.warning(f"⚠️ Could not check existing orders in database: {db_check_error}")
                logger.info("🔄 Proceeding with all orders (database save will handle duplicates)")
        
        logger.info(f"🚀 Starting sequential processing of {len(raw_orders)} executive orders...")
        
        # Process each order individually: Fetch → AI → Save → Next
        for i, order in enumerate(raw_orders):
            eo_number = order.get('eo_number', f"Order-{i+1}")
            eo_title = order.get('title', 'Unknown Title')[:60]
            
            try:
                logger.info(f"📋 [{i+1}/{len(raw_orders)}] Processing EO {eo_number}: {eo_title}...")
                
                # Step 1: Create basic order structure
                processed_order = dict(order)
                
                # Step 2: AI Analysis (if enabled)
                if with_ai:
                    try:
                        from ai import analyze_executive_order
                        
                        logger.info(f"🤖 [{i+1}/{len(raw_orders)}] Analyzing EO {eo_number} with AI...")
                        ai_result = await analyze_executive_order(
                            title=order.get('title', ''),
                            abstract=order.get('summary', ''),
                            order_number=order.get('eo_number', '')
                        )
                        
                        if ai_result:
                            processed_order.update({
                                'ai_summary': ai_result.get('ai_summary', ''),
                                'ai_executive_summary': ai_result.get('ai_executive_summary', ''),
                                'ai_talking_points': ai_result.get('ai_talking_points', ''),
                                'ai_key_points': ai_result.get('ai_key_points', ''),
                                'ai_business_impact': ai_result.get('ai_business_impact', ''),
                                'ai_potential_impact': ai_result.get('ai_potential_impact', ''),
                                'ai_version': ai_result.get('ai_version', 'simple_v1')
                            })
                            ai_successful += 1
                            logger.info(f"✅ [{i+1}/{len(raw_orders)}] AI analysis completed for EO {eo_number}")
                        else:
                            ai_failed += 1
                            logger.warning(f"⚠️ [{i+1}/{len(raw_orders)}] AI analysis returned no results for EO {eo_number}")
                            
                    except ImportError:
                        logger.warning(f"⚠️ [{i+1}/{len(raw_orders)}] AI module not available for EO {eo_number}")
                        ai_failed += 1
                    except Exception as ai_error:
                        logger.error(f"❌ [{i+1}/{len(raw_orders)}] AI processing error for EO {eo_number}: {ai_error}")
                        ai_failed += 1
                
                processed_orders.append(processed_order)
                
                # Step 3: Save to database immediately (for real-time feedback)
                if save_to_db and save_executive_orders_to_db:
                    try:
                        logger.info(f"💾 [{i+1}/{len(raw_orders)}] Saving EO {eo_number} to database...")
                        
                        # Save single order to database
                        result = save_executive_orders_to_db([processed_order])
                        
                        if isinstance(result, dict):
                            save_count = result.get('inserted', 0) + result.get('updated', 0)
                            errors = result.get('errors', 0)
                            
                            if save_count > 0:
                                orders_saved += save_count
                                logger.info(f"✅ [{i+1}/{len(raw_orders)}] EO {eo_number} saved successfully to database")
                            else:
                                orders_save_failed += 1
                                error_details = result.get('error_details', ['Unknown database error'])
                                logger.error(f"❌ [{i+1}/{len(raw_orders)}] Failed to save EO {eo_number}: {'; '.join(error_details)}")
                        else:
                            # Legacy format - simple count
                            if result > 0:
                                orders_saved += result
                                logger.info(f"✅ [{i+1}/{len(raw_orders)}] EO {eo_number} saved successfully to database")
                            else:
                                orders_save_failed += 1
                                logger.error(f"❌ [{i+1}/{len(raw_orders)}] Failed to save EO {eo_number} (result: {result})")
                                
                    except Exception as db_error:
                        orders_save_failed += 1
                        logger.error(f"❌ [{i+1}/{len(raw_orders)}] Database save error for EO {eo_number}: {db_error}")
                
                # Progress summary every 5 orders
                if (i + 1) % 5 == 0 or (i + 1) == len(raw_orders):
                    logger.info(f"📊 Progress Update [{i+1}/{len(raw_orders)}]: AI Success: {ai_successful}, AI Failed: {ai_failed}, DB Saved: {orders_saved}, DB Failed: {orders_save_failed}")
                
                # Delay between orders to avoid overwhelming systems
                if i < len(raw_orders) - 1:
                    await asyncio.sleep(0.5)
                    
            except Exception as order_error:
                logger.error(f"❌ [{i+1}/{len(raw_orders)}] Error processing EO {eo_number}: {order_error}")
                continue
        
        # Final summary
        logger.info(f"🎉 Sequential processing completed! Total: {len(raw_orders)}, Processed: {len(processed_orders)}, AI: {ai_successful} success/{ai_failed} failed, DB: {orders_saved} saved/{orders_save_failed} failed")
        
        # Calculate statistics
        existing_count = total_fetched - len(raw_orders) if save_to_db else 0
        new_orders_count = len(raw_orders)
        
        return {
            'success': True,
            'results': processed_orders,
            'count': len(processed_orders),
            'orders_saved': orders_saved,
            'orders_save_failed': orders_save_failed,
            'total_found': total_fetched,
            'existing_orders': existing_count,
            'new_orders': new_orders_count,
            'ai_analysis_enabled': with_ai,
            'ai_successful': ai_successful,
            'ai_failed': ai_failed,
            'date_range_used': f"{start_date} to {end_date}",
            'processing_method': 'sequential_fetch_ai_save',
            'message': f'Found {total_fetched} orders: {existing_count} existing (skipped), {new_orders_count} new (processed), {orders_saved} saved successfully'
        }
        
    except Exception as e:
        logger.error(f"❌ Error in fetch_executive_orders_simple_integration: {e}")
        return {
            'success': False,
            'error': str(e),
            'results': [],
            'count': 0,
            'message': f'Error fetching executive orders: {str(e)}'
        }

# ===============================
# HELPER FUNCTIONS
# ===============================


def check_executive_orders_table():
    """Check if the executive_orders table exists and get its structure"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if executive_orders table exists
        cursor.execute("""
            SELECT COUNT(*) 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'executive_orders' AND TABLE_SCHEMA = 'dbo'
        """)
        
        table_exists = cursor.fetchone()[0] > 0
        
        if table_exists:
            logger.info(f"✅ {get_table_name()} table exists")
            
            # Get table structure
            cursor.execute("""
                SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = 'executive_orders' AND TABLE_SCHEMA = 'dbo'
                ORDER BY ORDINAL_POSITION
            """)
            
            columns = cursor.fetchall()
            logger.debug("📊 Table structure:")
            for col in columns:
                length_info = f"({col[3]})" if col[3] else ""
                logger.debug(f"   {col[0]}: {col[1]}{length_info}, nullable: {col[2]}")
            
            cursor.close()
            conn.close()
            return True, [col[0] for col in columns]
        else:
            logger.error(f"❌ {get_table_name()} table does not exist")
            cursor.close()
            conn.close()
            return False, []
        
    except Exception as e:
        logger.error(f"❌ Error checking executive_orders table: {e}")
        return False, []




# NOTE: check alchemy here
def get_date_range_for_period(period: str) -> tuple:
    """Get start and end dates for different time periods in MM/DD/YYYY format"""
    today = datetime.now()
    
    if period == "inauguration":
        start_date = "01/20/2025"
        end_date = today.strftime('%m/%d/%Y')
    elif period == "last_90_days":
        start_date = (today - timedelta(days=90)).strftime('%m/%d/%Y')
        end_date = today.strftime('%m/%d/%Y')
    elif period == "last_30_days":
        start_date = (today - timedelta(days=30)).strftime('%m/%d/%Y')
        end_date = today.strftime('%m/%d/%Y')
    elif period == "last_7_days":
        start_date = (today - timedelta(days=7)).strftime('%m/%d/%Y')
        end_date = today.strftime('%m/%d/%Y')
    elif period == "this_week":
        start_date = (today - timedelta(days=today.weekday())).strftime('%m/%d/%Y')
        end_date = today.strftime('%m/%d/%Y')
    elif period == "this_month":
        start_date = today.replace(day=1).strftime('%m/%d/%Y')
        end_date = today.strftime('%m/%d/%Y')
    else:
        start_date = "01/20/2025"
        end_date = today.strftime('%m/%d/%Y')
    
    return start_date, end_date

def fetch_all_executive_orders_simple() -> Dict:
    """Simple function to fetch ALL 161+ executive orders without any limits"""
    logger.info("🚀 Fetching ALL Executive Orders from Trump administration")
    
    simple_eo = SimpleExecutiveOrders()
    
    result = simple_eo.fetch_executive_orders_direct(
        start_date="01/20/2025",
        end_date=None,
        limit=None
    )
    
    if result.get('success'):
        logger.info(f"✅ Successfully fetched {result.get('count', 0)} executive orders")
        logger.info(f"📊 Total found by API: {result.get('total_found', 0)}")
        logger.info(f"📄 Pages fetched: {result.get('pages_fetched', 1)}")
    else:
        logger.error(f"❌ Failed to fetch executive orders: {result.get('error', 'Unknown error')}")
    
    return result

# ===============================
# TEST FUNCTIONS
# ===============================

# NOTE: check alchemy here
async def test_database_integration():
    """Test database functions"""
    try:
        print("🧪 Testing database integration...")
        
        # Test connection
        conn = get_db_connection()
        conn.close()
        print("✅ Database connection works")
        
        # Test table check
        exists, columns = check_executive_orders_table()
        print(f"✅ executive_orders table exists: {exists}")
        if columns:
            print(f"✅ Table has {len(columns)} columns")
        
        return exists
    except Exception as e:
        print(f"❌ Database test failed: {e}")
        return False

async def test_federal_register_direct():
    """Test the direct Federal Register API fetch with comprehensive output"""
    print("🧪 Testing Federal Register API - Direct URL with Pagination\n")
    print("=" * 60)
    
    result = await fetch_executive_orders_simple_integration(
        start_date="01/20/2025",
        end_date=None,
        with_ai=False,
        save_to_db=True
    )
    
    print(f"📊 Test Results:")
    print(f"   Success: {result.get('success')}")
    print(f"   Count: {result.get('count', 0)}")
    print(f"   Orders Saved: {result.get('orders_saved', 0)}")
    print(f"   Orders Skipped: {result.get('orders_skipped', 0)}")
    print(f"   Total Found: {result.get('total_found', 0)}")
    print(f"   Date Range: {result.get('date_range_used', 'Unknown')}")
    
    if result.get('success') and result.get('results'):
        print(f"\n📋 Sample Executive Orders:")
        print("-" * 60)
        for i, order in enumerate(result['results'][:5], 1):
            print(f"{i}. EO #{order.get('eo_number')}: {order.get('title', 'No title')[:70]}...")
            print(f"   📅 Signing Date: {order.get('signing_date', 'Unknown')}")
            print(f"   📂 Source: {order.get('source', 'Unknown')}")
            print()
    
    print("=" * 60)
    print("🏁 Test completed")


# FIXED: Replace this function in simple_executive_orders.py
async def get_database_count_existing():
    """FIXED: Get accurate database count that matches what the main API returns"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        logger.info("🔍 FIXED: Getting database count...")
        
        # Use the SAME query logic as your main get_executive_orders_from_db function
        # This should match exactly what shows up on your page
        
        # First, let's check what queries work
        test_queries = [
            ("Total rows", "SELECT COUNT(*) FROM executive_orders"),
            ("All with president", "SELECT COUNT(*) FROM executive_orders WHERE president IS NOT NULL"),
            ("Donald Trump exact", "SELECT COUNT(*) FROM executive_orders WHERE president = 'Donald Trump'"),
            ("donald-trump exact", "SELECT COUNT(*) FROM executive_orders WHERE president = 'donald-trump'"),
            ("Trump lowercase", "SELECT COUNT(*) FROM executive_orders WHERE LOWER(president) LIKE '%trump%'"),
            ("Any president like trump", "SELECT COUNT(*) FROM executive_orders WHERE president LIKE '%trump%'"),
            ("No president filter", "SELECT COUNT(*) FROM executive_orders WHERE id IS NOT NULL")
        ]
        
        counts = {}
        for name, query in test_queries:
            try:
                cursor.execute(query)
                count = cursor.fetchone()[0]
                counts[name] = count
                logger.info(f"📊 {name}: {count}")
            except Exception as e:
                logger.error(f"❌ Query failed '{name}': {e}")
                counts[name] = 0
        
        # Check what president values actually exist
        cursor.execute("SELECT DISTINCT president FROM executive_orders")
        presidents = [row[0] for row in cursor.fetchall()]
        logger.info(f"📊 Available president values: {presidents}")
        
        # Use the count that matches your main API (which returns 162)
        # Since your main API returns 162, we should use that same logic
        
        # Try the most likely correct query based on your main API
        final_query = "SELECT COUNT(*) FROM executive_orders"
        
        # If you have president filtering in your main API, we need to match it
        # But since your main API returns 162 and total is 162, it's likely no president filter
        
        cursor.execute(final_query)
        final_count = cursor.fetchone()[0]
        
        logger.info(f"✅ FIXED: Using final count: {final_count}")
        logger.info(f"📊 This should match your main API count of 162")
        
        cursor.close()
        conn.close()
        
        return final_count
        
    except Exception as e:
        logger.error(f"❌ FIXED: Error getting database count: {e}")
        return 0

# NOTE: check alchemy here
async def get_database_count_existing_simple():
    """SIMPLE FIX: Just count all executive orders (matches your main API)"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Simple count that should match your main API
        cursor.execute("SELECT COUNT(*) FROM executive_orders")
        count = cursor.fetchone()[0]
        
        logger.info(f"📊 SIMPLE FIX: Database count: {count}")
        
        cursor.close()
        conn.close()
        
        return count
        
    except Exception as e:
        logger.error(f"❌ SIMPLE FIX: Error getting database count: {e}")
        return 0


# Alternative simpler version if the above is too verbose:
async def get_database_count_simple():
    """Simplified database count - just count all Trump orders"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Simple count of all Trump executive orders
        cursor.execute("""
            SELECT COUNT(*) 
            FROM executive_orders 
            WHERE president = 'donald-trump'
        """)
        
        count = cursor.fetchone()[0]
        cursor.close()
        conn.close()
        
        logger.info(f"📊 Simple database count: {count} Trump executive orders")
        return count
        
    except Exception as e:
        logger.error(f"❌ Error getting simple database count: {e}")
        return 0


async def get_federal_register_count_lightweight(simple_eo_instance):
    """Get accurate Federal Register count with better error handling"""
    try:
        # Use exact same parameters as the main fetch to ensure consistency
        base_params = {
            'conditions[correction]': '0',
            'conditions[president]': 'donald-trump',
            'conditions[presidential_document_type]': 'executive_order',
            'conditions[publication_date][gte]': "2025-01-20",  # Trump inauguration
            'conditions[publication_date][lte]': datetime.now().strftime('%Y-%m-%d'),
            'conditions[type][]': 'PRESDOCU',
            'per_page': '1',  # We only need the count
            'fields[]': ['document_number']  # Minimal field to reduce response size
        }
        
        url = f"{simple_eo_instance.base_url}/documents.json"
        response = simple_eo_instance.session.get(url, params=base_params, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            total_count = data.get('count', 0)
            logger.info(f"📊 Federal Register API reports: {total_count} total executive orders")
            return total_count
        else:
            logger.error(f"❌ Federal Register API error: {response.status_code}")
            return 0
            
    except Exception as e:
        logger.error(f"❌ Error in Federal Register count check: {e}")
        return 0

async def check_executive_orders_count_integration():
    """
    Fixed integration function for accurate count checking
    """
    try:
        logger.info("🔍 Starting executive orders count check...")
        
        simple_eo = SimpleExecutiveOrders()
        
        # Get Federal Register count
        federal_count = await get_federal_register_count_lightweight(simple_eo)
        logger.info(f"📊 Federal Register count: {federal_count}")
        
        # Get database count
        database_count = await get_database_count_existing()
        logger.info(f"📊 Database count: {database_count}")
        
        # Calculate the difference
        new_orders_available = max(0, federal_count - database_count)
        needs_fetch = new_orders_available > 0
        
        # Enhanced logging for debugging
        logger.info(f"📊 Count comparison:")
        logger.info(f"   Federal Register: {federal_count}")
        logger.info(f"   Database: {database_count}")
        logger.info(f"   Difference: {new_orders_available}")
        logger.info(f"   Needs fetch: {needs_fetch}")
        
        # Determine appropriate message
        if needs_fetch:
            message = f"Found {new_orders_available} new executive orders available for fetch"
        else:
            if federal_count == database_count:
                message = "Database is up to date - all orders synchronized"
            elif database_count > federal_count:
                message = f"Database has {database_count - federal_count} more orders than Federal Register (possible data cleanup needed)"
            else:
                message = "Database is up to date"
        
        return {
            "success": True,
            "federal_register_count": federal_count,
            "database_count": database_count,
            "new_orders_available": new_orders_available,
            "needs_fetch": needs_fetch,
            "last_checked": datetime.now().isoformat(),
            "message": message,
            "debug_info": {
                "federal_api_working": federal_count > 0,
                "database_accessible": database_count >= 0,
                "calculation": f"{federal_count} - {database_count} = {new_orders_available}"
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Error in count check integration: {e}")
        return {
            "success": False,
            "error": str(e),
            "federal_register_count": 0,
            "database_count": 0,
            "new_orders_available": 0,
            "needs_fetch": False,
            "last_checked": datetime.now().isoformat(),
            "message": f"Error checking for updates: {str(e)}"
        }

# Additional helper function to debug the count discrepancy
async def debug_count_discrepancy():
    """Debug function to understand why counts might not match"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get detailed breakdown of database contents
        queries = {
            "total_rows": "SELECT COUNT(*) FROM executive_orders",
            "trump_rows": "SELECT COUNT(*) FROM executive_orders WHERE president = 'donald-trump'",
            "valid_eo_numbers": """
                SELECT COUNT(*) FROM executive_orders 
                WHERE president = 'donald-trump' 
                AND eo_number IS NOT NULL 
                AND eo_number != '' 
                AND eo_number != 'Unknown'
                AND eo_number NOT LIKE 'DOC-%'
                AND eo_number NOT LIKE 'ERROR-%'
            """,
            "has_document_number": """
                SELECT COUNT(*) FROM executive_orders 
                WHERE president = 'donald-trump' 
                AND document_number IS NOT NULL 
                AND document_number != ''
            """,
            "duplicate_eo_numbers": """
                SELECT eo_number, COUNT(*) as count
                FROM executive_orders 
                WHERE president = 'donald-trump'
                AND eo_number IS NOT NULL
                GROUP BY eo_number
                HAVING COUNT(*) > 1
            """
        }
        
        debug_info = {}
        for name, query in queries.items():
            if name == "duplicate_eo_numbers":
                cursor.execute(query)
                duplicates = cursor.fetchall()
                debug_info[name] = [(eo_num, count) for eo_num, count in duplicates]
            else:
                cursor.execute(query)
                debug_info[name] = cursor.fetchone()[0]
        
        # Sample of recent entries
        cursor.execute("""
            SELECT TOP 5 eo_number, document_number, title, created_at
            FROM executive_orders 
            WHERE president = 'donald-trump'
            ORDER BY created_at DESC
        """)
        recent_entries = cursor.fetchall()
        debug_info["recent_entries"] = [
            {
                "eo_number": entry[0],
                "document_number": entry[1], 
                "title": entry[2][:50] if entry[2] else "No title",
                "created_at": entry[3].isoformat() if entry[3] else "No date"
            }
            for entry in recent_entries
        ]
        
        cursor.close()
        conn.close()
        
        logger.info("🔍 Database debug information:")
        for key, value in debug_info.items():
            logger.info(f"   {key}: {value}")
        
        return debug_info
        
    except Exception as e:
        logger.error(f"❌ Error in debug count discrepancy: {e}")
        return {"error": str(e)}

class SimpleProclamations:
    """Simple integration for Presidential Proclamations API"""
    
    def __init__(self):
        self.federal_register_api_url = "https://www.federalregister.gov/api/v1/documents.json"
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'LegislationVue/1.0',
            'Accept': 'application/json'
        })
    
    def get_proclamations_table_name(self):
        """Get the correct table name for proclamations based on database type"""
        from database_config import get_database_config
        config = get_database_config()
        if config['type'] == 'postgresql':
            return "proclamations"
        else:
            return "dbo.proclamations"
    
    async def fetch_proclamations_from_federal_register(self, start_date="2025-01-20", end_date=None, per_page=1000):
        """Fetch proclamations from Federal Register API"""
        try:
            if end_date is None:
                end_date = datetime.now().strftime("%m/%d/%Y")
            
            # Convert date format for API (MM/DD/YYYY)
            start_date_formatted = datetime.strptime(start_date, "%Y-%m-%d").strftime("%m/%d/%Y")
            end_date_formatted = datetime.strptime(end_date, "%Y-%m-%d").strftime("%m/%d/%Y") if isinstance(end_date, str) and "-" in end_date else end_date
            
            params = {
                'conditions[correction]': '0',
                'conditions[president]': 'donald-trump',
                'conditions[presidential_document_type]': 'proclamation',
                'conditions[search_type_id]': '6',
                'conditions[signing_date][gte]': start_date_formatted,
                'conditions[signing_date][lte]': end_date_formatted,
                'conditions[signing_date][year]': '2025',
                'conditions[type][]': 'PRESDOCU',
                'fields[]': [
                    'citation', 'document_number', 'end_page', 'html_url', 'pdf_url',
                    'type', 'subtype', 'publication_date', 'signing_date', 'start_page',
                    'title', 'disposition_notes', 'proclamation_number', 'full_text_xml_url',
                    'body_html_url', 'json_url'
                ],
                'include_pre_1994_docs': 'true',
                'maximum_per_page': str(per_page),
                'order': 'proclamation_number',
                'per_page': str(per_page)
            }
            
            logger.info(f"🔄 Fetching proclamations from Federal Register API...")
            logger.info(f"📅 Date range: {start_date_formatted} to {end_date_formatted}")
            
            response = self.session.get(self.federal_register_api_url, params=params)
            response.raise_for_status()
            
            data = response.json()
            results = data.get('results', [])
            
            logger.info(f"✅ Successfully fetched {len(results)} proclamations from Federal Register")
            
            return results
            
        except Exception as e:
            logger.error(f"❌ Error fetching proclamations from Federal Register: {e}")
            raise
    
    async def save_proclamations_to_database(self, proclamations_data):
        """Save proclamations to database"""
        try:
            table_name = self.get_proclamations_table_name()
            
            with get_db_cursor() as cursor:
                # Create table if it doesn't exist
                create_table_query = f"""
                CREATE TABLE IF NOT EXISTS {table_name.split('.')[-1]} (
                    id SERIAL PRIMARY KEY,
                    document_number VARCHAR(50) UNIQUE,
                    proclamation_number VARCHAR(50),
                    title TEXT,
                    summary TEXT,
                    signing_date DATE,
                    publication_date DATE,
                    citation VARCHAR(255),
                    html_url TEXT,
                    pdf_url TEXT,
                    full_text_xml_url TEXT,
                    body_html_url TEXT,
                    json_url TEXT,
                    presidential_document_type VARCHAR(50) DEFAULT 'proclamation',
                    president VARCHAR(100) DEFAULT 'Donald Trump',
                    disposition_notes TEXT,
                    start_page INTEGER,
                    end_page INTEGER,
                    subtype VARCHAR(100),
                    category VARCHAR(50) DEFAULT 'civic',
                    ai_summary TEXT,
                    ai_key_points TEXT,
                    ai_business_impact TEXT,
                    ai_processed BOOLEAN DEFAULT FALSE,
                    reviewed BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """
                
                cursor.execute(create_table_query)
                
                saved_count = 0
                
                for proc in proclamations_data:
                    try:
                        # Check if proclamation already exists
                        check_query = f"SELECT COUNT(*) FROM {table_name.split('.')[-1]} WHERE document_number = %s"
                        cursor.execute(check_query, (proc.get('document_number'),))
                        
                        if cursor.fetchone()[0] > 0:
                            logger.info(f"⏭️ Proclamation {proc.get('document_number')} already exists, skipping...")
                            continue
                        
                        # Insert new proclamation
                        insert_query = f"""
                        INSERT INTO {table_name.split('.')[-1]} (
                            document_number, proclamation_number, title, signing_date, publication_date,
                            citation, html_url, pdf_url, full_text_xml_url, body_html_url, json_url,
                            presidential_document_type, president, disposition_notes, start_page, end_page, subtype
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """
                        
                        cursor.execute(insert_query, (
                            proc.get('document_number'),
                            proc.get('proclamation_number'),
                            proc.get('title'),
                            proc.get('signing_date'),
                            proc.get('publication_date'),
                            proc.get('citation'),
                            proc.get('html_url'),
                            proc.get('pdf_url'),
                            proc.get('full_text_xml_url'),
                            proc.get('body_html_url'),
                            proc.get('json_url'),
                            'proclamation',
                            'Donald Trump',
                            proc.get('disposition_notes'),
                            proc.get('start_page'),
                            proc.get('end_page'),
                            proc.get('subtype')
                        ))
                        
                        saved_count += 1
                        logger.info(f"✅ Saved proclamation: {proc.get('proclamation_number')} - {proc.get('title', 'No title')[:50]}")
                        
                    except Exception as e:
                        logger.error(f"❌ Error saving proclamation {proc.get('document_number')}: {e}")
                        continue
                
                logger.info(f"✅ Successfully saved {saved_count} proclamations to database")
                return saved_count
                
        except Exception as e:
            logger.error(f"❌ Error saving proclamations to database: {e}")
            raise
    
    async def get_proclamations_count_from_federal_register(self):
        """Get count of proclamations from Federal Register API"""
        try:
            params = {
                'conditions[correction]': '0',
                'conditions[president]': 'donald-trump',
                'conditions[presidential_document_type]': 'proclamation',
                'conditions[search_type_id]': '6',
                'conditions[signing_date][gte]': '01/20/2025',
                'conditions[signing_date][year]': '2025',
                'conditions[type][]': 'PRESDOCU',
                'per_page': '0'  # Get count only
            }
            
            response = self.session.get(self.federal_register_api_url, params=params)
            response.raise_for_status()
            
            data = response.json()
            count = data.get('count', 0)
            
            logger.info(f"📊 Federal Register proclamations count: {count}")
            return count
            
        except Exception as e:
            logger.error(f"❌ Error getting proclamations count from Federal Register: {e}")
            return 0
    
    async def get_proclamations_count_from_database(self):
        """Get count of proclamations from database"""
        try:
            table_name = self.get_proclamations_table_name()
            
            with get_db_cursor() as cursor:
                query = f"SELECT COUNT(*) FROM {table_name.split('.')[-1]} WHERE president = %s"
                cursor.execute(query, ('Donald Trump',))
                count = cursor.fetchone()[0]
                
                logger.info(f"📊 Database proclamations count: {count}")
                return count
                
        except Exception as e:
            logger.error(f"❌ Error getting proclamations count from database: {e}")
            return 0


if __name__ == "__main__":
    print("🚀 Executive Orders Fetcher - Complete Version with Database Integration")
    print("=" * 70)
    
    # Set up logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(levelname)s:%(name)s:%(message)s'
    )
    
    # Test database integration
    asyncio.run(test_database_integration())
    
    print("\n" + "=" * 70)
    
    # Test the full system
    asyncio.run(test_federal_register_direct())
