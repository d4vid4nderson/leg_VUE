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
