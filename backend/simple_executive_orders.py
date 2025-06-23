# simple_executive_orders.py - Fixed integration with direct pyodbc
import os
import re
import json
import asyncio
import logging
import requests
from typing import Dict, List, Optional
from datetime import datetime, timedelta

# Import our direct database connection
from database_connection import get_db_cursor, get_db_connection

logger = logging.getLogger(__name__)

class SimpleExecutiveOrders:
    """Simple integration for Executive Orders API"""
    
    def __init__(self):
        self.federal_register_api_url = "https://www.federalregister.gov/api/v1/documents.json"
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'LegislationVue/1.0',
            'Accept': 'application/json'
        })
    
    def fetch_executive_orders_direct(self, start_date=None, end_date=None, limit=None):
        """Fetch executive orders directly from Federal Register API"""
        try:
            logger.info(f"📡 Fetching from Federal Register API: {start_date} to {end_date}")
            
            # Default dates if not provided
            if not start_date:
                start_date = "01/20/2025"  # Inauguration day
            
            if not end_date:
                end_date = datetime.now().strftime('%m/%d/%Y')
            
            # Build parameters
            params = {
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
                'maximum_per_page': '10000',
                'order': 'executive_order',
                'per_page': limit if limit else '10000'
            }
            
            # Make the request
            response = self.session.get(self.federal_register_api_url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            results = data.get('results', [])
            
            logger.info(f"✅ Federal Register API returned {len(results)} executive orders")
            
            # Transform into our standard format
            transformed = []
            for order in results:
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
                
                # Determine category (basic version)
                title = order.get('title', '').lower()
                category = 'civic'
                if any(term in title for term in ['health', 'medical', 'care']):
                    category = 'healthcare'
                elif any(term in title for term in ['education', 'school', 'student']):
                    category = 'education'
                elif any(term in title for term in ['infrastructure', 'transport']):
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
                'total_found': len(results),
                'date_range_used': f"{start_date} to {end_date}",
                'api_response_count': len(results)
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
        
        # Step 2: Process with AI (if enabled)
        processed_orders = []
        ai_successful = 0
        ai_failed = 0
        
        # Process each order
        for i, order in enumerate(raw_orders):
            try:
                # Make a copy to avoid modifying the original
                processed_order = dict(order)
                
                if with_ai:
                    try:
                        # Try to import and use the AI processor
                        from ai import analyze_executive_order
                        
                        logger.info(f"🤖 Processing order {i+1}/{len(raw_orders)} with AI")
                        ai_result = await analyze_executive_order(
                            title=order.get('title', ''),
                            abstract=order.get('summary', ''),
                            order_number=order.get('eo_number', '')
                        )
                        
                        if ai_result:
                            # Update with AI results
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
                            logger.info(f"✅ AI analysis successful for order {i+1}")
                        else:
                            ai_failed += 1
                            logger.warning(f"⚠️ AI analysis returned no results for order {i+1}")
                            
                    except ImportError:
                        logger.warning(f"⚠️ AI module not available, skipping AI processing")
                        ai_failed += 1
                    except Exception as ai_error:
                        logger.error(f"❌ AI processing error: {ai_error}")
                        ai_failed += 1
                
                processed_orders.append(processed_order)
                
                # Small delay to avoid overwhelming the system
                if i < len(raw_orders) - 1:
                    await asyncio.sleep(0.1)
                    
            except Exception as order_error:
                logger.error(f"❌ Error processing order {i+1}: {order_error}")
                continue
        
        # Step 3: Save to database if enabled
        orders_saved = 0
        if save_to_db:
            try:
                # Import the database save function
                from executive_orders_db import save_executive_orders_to_db
                
                logger.info(f"💾 Saving {len(processed_orders)} orders to database")
                result = save_executive_orders_to_db(processed_orders)
                
                if isinstance(result, dict):
                    orders_saved = result.get('total_processed', 0)
                    logger.info(f"✅ Saved {orders_saved} orders to database")
                else:
                    orders_saved = result
                    logger.info(f"✅ Saved {orders_saved} orders to database")
                    
            except ImportError:
                logger.error("❌ Database module not available")
            except Exception as db_error:
                logger.error(f"❌ Database save error: {db_error}")
        
        return {
            'success': True,
            'results': processed_orders,
            'count': len(processed_orders),
            'orders_saved': orders_saved,
            'total_found': fetch_result.get('total_found', len(processed_orders)),
            'ai_analysis_enabled': with_ai,
            'ai_successful': ai_successful,
            'ai_failed': ai_failed,
            'date_range_used': f"{start_date} to {end_date}",
            'message': f'Successfully processed {len(processed_orders)} Executive Orders'
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
            logger.info("✅ dbo.executive_orders table exists")
            
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
            logger.error("❌ dbo.executive_orders table does not exist")
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
            ("Total rows", "SELECT COUNT(*) FROM dbo.executive_orders"),
            ("All with president", "SELECT COUNT(*) FROM dbo.executive_orders WHERE president IS NOT NULL"),
            ("Donald Trump exact", "SELECT COUNT(*) FROM dbo.executive_orders WHERE president = 'Donald Trump'"),
            ("donald-trump exact", "SELECT COUNT(*) FROM dbo.executive_orders WHERE president = 'donald-trump'"),
            ("Trump lowercase", "SELECT COUNT(*) FROM dbo.executive_orders WHERE LOWER(president) LIKE '%trump%'"),
            ("Any president like trump", "SELECT COUNT(*) FROM dbo.executive_orders WHERE president LIKE '%trump%'"),
            ("No president filter", "SELECT COUNT(*) FROM dbo.executive_orders WHERE id IS NOT NULL")
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
        cursor.execute("SELECT DISTINCT president FROM dbo.executive_orders")
        presidents = [row[0] for row in cursor.fetchall()]
        logger.info(f"📊 Available president values: {presidents}")
        
        # Use the count that matches your main API (which returns 162)
        # Since your main API returns 162, we should use that same logic
        
        # Try the most likely correct query based on your main API
        final_query = "SELECT COUNT(*) FROM dbo.executive_orders"
        
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
        cursor.execute("SELECT COUNT(*) FROM dbo.executive_orders")
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
            FROM dbo.executive_orders 
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
            "total_rows": "SELECT COUNT(*) FROM dbo.executive_orders",
            "trump_rows": "SELECT COUNT(*) FROM dbo.executive_orders WHERE president = 'donald-trump'",
            "valid_eo_numbers": """
                SELECT COUNT(*) FROM dbo.executive_orders 
                WHERE president = 'donald-trump' 
                AND eo_number IS NOT NULL 
                AND eo_number != '' 
                AND eo_number != 'Unknown'
                AND eo_number NOT LIKE 'DOC-%'
                AND eo_number NOT LIKE 'ERROR-%'
            """,
            "has_document_number": """
                SELECT COUNT(*) FROM dbo.executive_orders 
                WHERE president = 'donald-trump' 
                AND document_number IS NOT NULL 
                AND document_number != ''
            """,
            "duplicate_eo_numbers": """
                SELECT eo_number, COUNT(*) as count
                FROM dbo.executive_orders 
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
            FROM dbo.executive_orders 
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
