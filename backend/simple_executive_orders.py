# simple_executive_orders.py - Complete Fixed Version
import os
import json
import asyncio
import logging
import requests
from typing import Dict, List, Optional
from datetime import datetime, timedelta

# Import database connection
from database_connection import get_db_connection

logger = logging.getLogger(__name__)

class SimpleExecutiveOrders:
    """Simple integration for Executive Orders API with proper pagination"""
    
    def __init__(self):
        self.federal_register_api_url = "https://www.federalregister.gov/api/v1/documents.json"
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'LegislationVue/1.0',
            'Accept': 'application/json'
        })
    
    def fetch_executive_orders_direct(self, start_date=None, end_date=None, limit=None):
        """Fetch ALL executive orders with proper pagination"""
        try:
            logger.info(f"📡 Fetching ALL Executive Orders from Federal Register API: {start_date} to {end_date}")
            
            # Default dates if not provided
            if not start_date:
                start_date = "01/20/2025"  # Inauguration day
            
            if not end_date:
                end_date = datetime.now().strftime('%m/%d/%Y')
            
            logger.info(f"📅 Using date range: {start_date} to {end_date}")
            
            all_results = []
            page = 1
            total_pages = 1
            
            while page <= total_pages:
                logger.info(f"📄 Fetching page {page} of {total_pages}...")
                
                # Use smaller per_page to avoid API timeouts
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
                    'per_page': '100',  # Smaller page size for reliability
                    'page': str(page),   # Add pagination
                    'order': 'executive_order'
                }
                
                # Make the request
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
                
                # Update pagination info
                total_count = data.get('count', 0)
                per_page = data.get('per_page', 100)
                total_pages = max(1, (total_count + per_page - 1) // per_page)  # Ceiling division
                
                logger.info(f"📊 Page {page}: Got {len(results)} orders, {len(all_results)} total so far")
                logger.info(f"📊 API reports {total_count} total orders across {total_pages} pages")
                
                # Move to next page
                page += 1
                
                # Safety check to prevent infinite loops
                if page > 100:  # Max 100 pages = 10,000 orders
                    logger.warning("⚠️ Reached maximum page limit (100 pages)")
                    break
            
            logger.info(f"✅ Federal Register API returned {len(all_results)} total executive orders")
            
            # Transform into our standard format
            transformed = []
            for order in all_results:
                eo_num = order.get('executive_order_number', '')
                doc_num = order.get('document_number', '')

                primary_eo_number = eo_num if eo_num else doc_num
                
                # Skip if missing critical data
                if not primary_eo_number:
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
                
                # Determine category (basic version)
                title = order.get('title', '').lower()
                category = 'civic'
                if any(term in title for term in ['health', 'medical', 'care']):
                    category = 'healthcare'
                elif any(term in title for term in ['education', 'school', 'student']):
                    category = 'education'
                elif any(term in title for term in ['environment', 'climate', 'energy']):
                    category = 'environment'
                elif any(term in title for term in ['tax', 'economic', 'trade']):
                    category = 'economic'
                elif any(term in title for term in ['immigration', 'border', 'visa']):
                    category = 'immigration'
                elif any(term in title for term in ['defense', 'military', 'security']):
                    category = 'defense'
                
                # Build the transformed order
                    transformed_order = {
                    'document_number': doc_num,                    # Keep original document number
                    'eo_number': eo_num,                          # Store the actual EO number (like "14312")
                    'executive_order_number': eo_num,             # Also store in this field for compatibility
                    'primary_identifier': primary_eo_number,
                    'title': order.get('title', ''),
                    'summary': order.get('abstract', '') or order.get('disposition_notes', ''),
                    'signing_date': signing_date,
                    'publication_date': publication_date,
                    'citation': order.get('citation', ''),
                    'presidential_document_type': 'executive_order',
                    'category': category,
                    'html_url': order.get('html_url', ''),
                    'pdf_url': order.get('pdf_url', ''),
                    'trump_2025_url': order.get('html_url', ''),  # Use html_url as fallback
                    'source': 'federal_register_api',
                    'raw_data_available': True,
                    'processing_status': 'fetched',
                    'created_at': datetime.now(),
                    'last_updated': datetime.now(),
                    'last_scraped_at': datetime.now()
                }
                
                transformed.append(transformed_order)
            
            return {
                'success': True,
                'results': transformed,
                'count': len(transformed),
                'total_found': len(all_results),
                'pages_fetched': page - 1,
                'message': f'Successfully fetched {len(transformed)} executive orders from {page - 1} pages'
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
    
    def _process_date(self, date_string):
        """Process date strings safely"""
        if not date_string:
            return None
        
        try:
            if isinstance(date_string, str):
                if 'T' in date_string:
                    date_obj = datetime.fromisoformat(date_string.replace('Z', '+00:00'))
                    return date_obj.strftime('%Y-%m-%d')
                else:
                    date_obj = datetime.strptime(date_string, '%Y-%m-%d')
                    return date_obj.strftime('%Y-%m-%d')
            else:
                return str(date_string)
        except (ValueError, TypeError):
            return str(date_string) if date_string else None
    
    def _categorize_order(self, title_lower):
        """Categorize order based on title"""
        categorization_rules = {
            'healthcare': ['health', 'medical', 'care', 'medicare', 'medicaid', 'insurance', 'pharmaceutical', 'drug', 'doctor', 'hospital', 'clinic', 'healthcare', 'hospitals', 'hospice', 'nursing', 'nursing home', 'nursing homes', 'nursing facility', 'nursing facilities', 'nurses', 'nursing staff', 'nursing care', 'nursing services', 'nursing service', 'nursing', 'doctors', 'physicians', 'physician', 'medical professionals', 'medical professional', 'healthcare professionals', 'healthcare professional', 'doctors office', 'doctors offices', 'medical office', 'medical offices', 'healthcare office', 'healthcare offices', 'healthcare facility', 'healthcare facilities', "vaccine", "vaccines", "immunization", "immunizations", "immunize", "immunizes", "immunizing"],
            'education': ['education', 'school', 'student', 'university', 'college', 'teacher', 'professor', 'academic', 'learning', 'training', 'curriculum', 'scholarship', 'tuition', 'student loan', 'student loans', 'educational', 'educational institution', 'educational institutions', 'school district', 'school districts', 'school board', 'school boards', 'school system', 'school systems', 'school administration', 'school administrations', 'school policy', 'school policies', 'school program', 'school programs', 'teacher training', 'teacher training program', 'teacher training programs', 'teacher certification', 'teacher certifications', 'teacher education', 'teacher education program', 'teacher education programs', 'student assessment', 'student assessments', 'student achievement', 'student achievements', 'teacher', 'teachers', 'educators', 'educator', 'school principal', 'school principals', 'school counselor', 'school counselors', 'school psychologist', 'school psychologists', 'school nurse', 'school nurses'],
            'engineering': ['infrastructure', 'transport', 'highway', 'bridge', 'road', 'rail', 'airport', 'port', 'construction', 'engineering', 'engineering project', 'engineering projects', 'civil engineering', 'civil engineer', 'civil engineers', 'structural engineering', 'structural engineer', 'structural engineers', 'mechanical engineering', 'mechanical engineer', 'mechanical engineers', 'electrical engineering', 'electrical engineer', 'electrical engineers', 'environmental engineering', 'environmental engineer', 'environmental engineers'],
            'civic': ['business', 'trade', 'economic', 'commerce', 'criminal', 'justice', 'police', 'court', 'law', 'legal', 'legislation', 'regulation', 'government', 'public policy', 'public service', 'public safety', 'public health', 'public works', 'public infrastructure', 'public transportation', 'public utilities', 'public education', 'public finance', 'public administration', 'trainsportation', 'transportation system', 'transportation systems', 'transportation infrastructure', 'transportation infrastructure project', 'transportation infrastructure projects', 'transportation engineering', 'transportation engineer', 'transportation engineers', 'transportation policy', 'transportation policies', 'transportation program', 'transportation programs', 'transportation planning', 'transportation planner', 'transportation planners', 'first responders', 'first responder', 'first responders', 'emergency response', 'emergency responder', 'emergency responders', 'emergency management', 'emergency manager', 'emergency managers', 'public safety officer', 'public safety officers', 'public safety agency', 'public safety agencies', 'police officer', 'police officers', 'law enforcement officer', 'law enforcement officers', 'law enforcement agency', 'law enforcement agencies', 'court system', 'court systems', 'court administration', 'court administrations', 'court policy', 'court policies', 'court program', 'court programs', 'legal system', 'legal systems', 'legal administration', 'legal administrations', 'legal policy', 'legal policies', 'firefighter', 'firefighters', 'fire department', 'fire departments', 'fire service', 'fire services', 'emergency medical technician', 'emergency medical technicians', 'emergency medical service', 'emergency medical services', 'emergency medical response', 'emergency medical responder', 'emergency medical responders'],
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
    save_to_db=True
):
    """
    Complete integration pipeline - FIXED
    """
    # Initialize at function scope
    processed_orders = []
    ai_stats = {'successful': 0, 'failed': 0, 'skipped': 0}
    
    try:
        logger.info("🚀 Starting Production Executive Orders Integration")
        
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
        
        # Step 1: Fetch from API
        api_client = SimpleExecutiveOrders()
        fetch_result = api_client.fetch_executive_orders_direct(start_date, end_date, None)
        
        if not fetch_result.get('success'):
            logger.error(f"❌ Federal Register fetch failed: {fetch_result.get('error')}")
            return fetch_result
        
        raw_orders = fetch_result.get('results', [])
        logger.info(f"✅ Federal Register: {len(raw_orders)} orders retrieved")
        
        if len(raw_orders) == 0:
            return {
                'success': True,
                'results': [],
                'count': 0,
                'message': 'No executive orders found'
            }
        
        # Step 2: Process each order
        for index, order in enumerate(raw_orders):
            current_order = None  # Initialize for each order
            
            try:
                current_order = dict(order)
                
                # AI processing if enabled
                if with_ai:
                    try:
                        from ai import analyze_executive_order
                        
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
                
                if current_order:
                    processed_orders.append(current_order)
                
                # Small delay for AI processing
                if index < len(raw_orders) - 1 and with_ai:
                    await asyncio.sleep(0.1)
                
            except Exception as processing_error:
                logger.error(f"❌ Failed to process order {index+1}: {processing_error}")
                if order:
                    processed_orders.append(order)
                continue
        
        logger.info(f"✅ Processing complete: {len(processed_orders)} orders")
        if with_ai:
            logger.info(f"🤖 AI Stats: {ai_stats['successful']} successful, {ai_stats['failed']} failed")
        
        # Step 3: Save to database
        saved_count = 0
        if save_to_db and len(processed_orders) > 0:
            try:
                from executive_orders_db import save_executive_orders_to_db
                
                logger.info(f"💾 Saving {len(processed_orders)} orders to database...")
                save_result = save_executive_orders_to_db(processed_orders)
                
                if isinstance(save_result, dict):
                    saved_count = save_result.get('total_processed', 0)
                else:
                    saved_count = int(save_result) if save_result else 0
                    
                logger.info(f"✅ Database save complete: {saved_count} orders saved")
                    
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
            'ai_analysis_enabled': with_ai,
            'ai_successful': ai_stats['successful'],
            'ai_failed': ai_stats['failed'],
            'ai_skipped': ai_stats['skipped'],
            'date_range_used': f"{start_date} to {end_date}",
            'unlimited_fetch_used': True,
            'skipped_orders': fetch_result.get('skipped', 0),
            'processing_method': 'production_pipeline_v5_fixed',
            'message': f'Pipeline complete: {len(processed_orders)} orders processed, {saved_count} saved'
        }
        
    except Exception as pipeline_error:
        logger.error(f"❌ Pipeline error: {pipeline_error}")
        return {
            'success': False,
            'error': str(pipeline_error),
            'results': [],
            'count': 0,
            'message': f'Pipeline failed: {str(pipeline_error)}'
        }

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
        conn = get_db_connection()
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
            conn.close()
            
            logger.info(f"✅ executive_orders table verified: {len(columns)} columns")
            return True, columns
        else:
            cursor.close()
            conn.close()
            logger.warning("⚠️ executive_orders table not found")
            return False, []
            
    except Exception as e:
        logger.error(f"❌ Table check error: {e}")
        return False, []

async def get_federal_register_count_lightweight(simple_eo_instance):
    """Get count from Federal Register"""
    try:
        base_params = {
            'conditions[correction]': '0',
            'conditions[president]': 'donald-trump',
            'conditions[presidential_document_type]': 'executive_order',
            'conditions[signing_date][gte]': "2025-01-20",
            'conditions[signing_date][lte]': datetime.now().strftime('%Y-%m-%d'),
            'conditions[type][]': 'PRESDOCU',
            'per_page': '1',
            'fields[]': ['document_number']
        }
        
        url = simple_eo_instance.federal_register_api_url
        response = simple_eo_instance.session.get(url, params=base_params, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            total_count = data.get('count', 0)
            logger.info(f"📊 Federal Register count: {total_count}")
            return total_count
        else:
            logger.error(f"❌ Federal Register API error: {response.status_code}")
            return 0
            
    except Exception as e:
        logger.error(f"❌ Count check error: {e}")
        return 0

async def get_database_count_existing():
    """Get database count"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT COUNT(*) 
            FROM dbo.executive_orders 
            WHERE president = 'donald-trump'
        """)
        
        count = cursor.fetchone()[0]
        cursor.close()
        conn.close()
        
        logger.info(f"📊 Database count: {count}")
        return count
        
    except Exception as e:
        logger.error(f"❌ Database count error: {e}")
        return 0

async def check_executive_orders_count_integration():
    """Check counts and compare"""
    try:
        logger.info("🔍 Starting count check...")
        
        simple_eo = SimpleExecutiveOrders()
        
        federal_count = await get_federal_register_count_lightweight(simple_eo)
        database_count = await get_database_count_existing()
        
        new_orders_available = max(0, federal_count - database_count)
        needs_fetch = new_orders_available > 0
        
        if needs_fetch:
            message = f"Found {new_orders_available} new executive orders available"
        else:
            message = "Database is up to date"
        
        return {
            "success": True,
            "federal_register_count": federal_count,
            "database_count": database_count,
            "new_orders_available": new_orders_available,
            "needs_fetch": needs_fetch,
            "last_checked": datetime.now().isoformat(),
            "message": message
        }
        
    except Exception as e:
        logger.error(f"❌ Count check error: {e}")
        return {
            "success": False,
            "error": str(e),
            "federal_register_count": 0,
            "database_count": 0,
            "new_orders_available": 0,
            "needs_fetch": False,
            "message": f"Error: {str(e)}"
        }

# Test functions
async def test_database_integration():
    """Test database"""
    try:
        print("🧪 Testing database...")
        conn = get_db_connection()
        conn.close()
        print("✅ Database works")
        
        exists, columns = check_executive_orders_table()
        print(f"✅ Table exists: {exists}")
        if columns:
            print(f"✅ Columns: {len(columns)}")
        
        return exists
    except Exception as e:
        print(f"❌ Database test failed: {e}")
        return False

async def test_federal_register_direct():
    """Test pipeline"""
    print("🧪 Testing Pipeline")
    print("=" * 60)
    
    result = await fetch_executive_orders_simple_integration(
        start_date="01/20/2025",
        end_date=None,
        with_ai=False,
        save_to_db=True
    )
    
    print(f"📊 Results:")
    print(f"   Success: {result.get('success')}")
    print(f"   Count: {result.get('count', 0)}")
    print(f"   Saved: {result.get('orders_saved', 0)}")
    print(f"   Total: {result.get('total_found', 0)}")
    
    if result.get('success') and result.get('results'):
        print(f"\n📋 Sample Orders:")
        for i, order in enumerate(result['results'][:3], 1):
            eo_num = order.get('eo_number', 'N/A')
            title = order.get('title', 'No title')[:50] + "..."
            date = order.get('signing_date', 'Unknown')
            print(f"{i}. EO #{eo_num}: {title}")
            print(f"   📅 Signed: {date}")
    
    print("🏁 Test Complete")

if __name__ == "__main__":
    import asyncio
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(levelname)s:%(name)s:%(message)s'
    )
    
    print("🚀 Testing Executive Orders Integration")
    print("=" * 70)
    
    async def run_tests():
        await test_database_integration()
        print("\n" + "=" * 70)
        await test_federal_register_direct()
    
    asyncio.run(run_tests())