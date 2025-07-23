# executive_orders_pipeline.py - Complete pipeline for Executive Orders
# Federal Register API → Azure AI Foundry → Database → Frontend

import asyncio
import requests
import json
from datetime import datetime
from typing import List, Dict, Optional
import logging
from pydantic import BaseModel

# Import your existing AI functions
from ai import analyze_executive_order

# Federal Register API URL (the one you provided)
FEDERAL_REGISTER_API_URL = "https://www.federalregister.gov/api/v1/documents.json?conditions%5Bcorrection%5D=0&conditions%5Bpresident%5D=donald-trump&conditions%5Bpresidential_document_type%5D=executive_order&conditions%5Bsigning_date%5D%5Bgte%5D=01%2F20%2F2025&conditions%5Bsigning_date%5D%5Blte%5D=06%2F16%2F2025&conditions%5Bsigning_date%5D%5Byear%5D=2025&conditions%5Btype%5D%5B%5D=PRESDOCU&fields%5B%5D=citation&fields%5B%5D=document_number&fields%5B%5D=end_page&fields%5B%5D=html_url&fields%5B%5D=pdf_url&fields%5B%5D=type&fields%5B%5D=subtype&fields%5B%5D=publication_date&fields%5B%5D=signing_date&fields%5B%5D=start_page&fields%5B%5D=title&fields%5B%5D=disposition_notes&fields%5B%5D=executive_order_number&fields%5B%5D=not_received_for_publication&fields%5B%5D=full_text_xml_url&fields%5B%5D=body_html_url&fields%5B%5D=json_url&include_pre_1994_docs=true&maximum_per_page=10000&order=executive_order&per_page=10000"

logger = logging.getLogger(__name__)

class ExecutiveOrderProcessor:
    """Processes Executive Orders: Fetch → AI Analysis → Database Storage"""
    
    def __init__(self, save_to_db_func=None):
        self.save_to_db = save_to_db_func
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'LegislationVue/1.0',
            'Accept': 'application/json'
        })
    
    def fetch_executive_orders_from_federal_register(self) -> Dict:
        """
        STEP 1: Fetch Executive Orders from Federal Register API
        """
        try:
            logger.info("📡 Fetching Executive Orders from Federal Register API...")
            
            response = self.session.get(FEDERAL_REGISTER_API_URL, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            executive_orders = data.get('results', [])
            
            logger.info(f"✅ Found {len(executive_orders)} Executive Orders from Federal Register")
            
            # Transform to our standard format
            transformed_orders = []
            for order in executive_orders:
                transformed_order = self._transform_federal_register_order(order)
                if transformed_order:
                    transformed_orders.append(transformed_order)
            
            logger.info(f"📋 Transformed {len(transformed_orders)} Executive Orders")
            
            return {
                'success': True,
                'count': len(transformed_orders),
                'orders': transformed_orders,
                'source': 'Federal Register API',
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"❌ Error fetching from Federal Register: {e}")
            return {
                'success': False,
                'error': str(e),
                'orders': [],
                'count': 0
            }
    
    def _transform_federal_register_order(self, order: Dict) -> Optional[Dict]:
        """Transform Federal Register order to our database format"""
        try:
            # Extract EO number with better logic
            eo_number = order.get('executive_order_number')
            if not eo_number:
                eo_number = order.get('document_number', 'UNKNOWN')
            
            # Categorize based on title
            category = self._categorize_order(order.get('title', ''))
            
            # Format dates
            signing_date = order.get('signing_date', '')
            publication_date = order.get('publication_date', '')
            
            return {
                'bill_id': f"eo-{eo_number}",
                'bill_number': str(eo_number),
                'title': order.get('title', 'Untitled Executive Order'),
                'description': f"Executive Order {eo_number} - {order.get('title', '')}",
                'state': 'Federal',
                'state_abbr': 'US',
                'status': 'Signed',
                'category': category,
                'introduced_date': signing_date,
                'last_action_date': publication_date or signing_date,
                'session_id': '2025',
                'session_name': 'Trump 2025 Administration',
                'bill_type': 'executive_order',
                'body': 'executive',
                'legiscan_url': order.get('html_url', ''),
                'pdf_url': order.get('pdf_url', ''),
                'document_number': order.get('document_number', ''),
                'citation': order.get('citation', ''),
                # AI fields - will be populated in next step
                'ai_summary': '',
                'ai_executive_summary': '',
                'ai_talking_points': '',
                'ai_key_points': '',
                'ai_business_impact': '',
                'ai_potential_impact': '',
                'ai_version': '',
                'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'last_updated': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                # Original Federal Register data for reference
                'federal_register_data': order
            }
            
        except Exception as e:
            logger.error(f"❌ Error transforming order: {e}")
            return None
    
    def _categorize_order(self, title: str) -> str:
        """Simple categorization based on title keywords"""
        if not title:
            return 'civic'
        
        title_lower = title.lower()
        
        if any(keyword in title_lower for keyword in ['health', 'medical', 'healthcare']):
            return 'healthcare'
        elif any(keyword in title_lower for keyword in ['education', 'school', 'student']):
            return 'education'
        elif any(keyword in title_lower for keyword in ['infrastructure', 'transport', 'construction']):
            return 'engineering'
        else:
            return 'civic'
    
    async def process_with_azure_ai(self, orders: List[Dict], max_concurrent: int = 3) -> List[Dict]:
        """
        STEP 2: Process orders through Azure AI Foundry
        Uses your existing ai.py analyze_executive_order function
        """
        try:
            logger.info(f"🤖 Processing {len(orders)} orders with Azure AI Foundry...")
            
            # Create semaphore for rate limiting
            semaphore = asyncio.Semaphore(max_concurrent)
            
            async def analyze_single_order(order: Dict) -> Dict:
                async with semaphore:
                    try:
                        logger.info(f"🧠 Analyzing EO {order.get('bill_number')} with Azure AI...")
                        
                        # Call your existing Azure AI function
                        ai_result = await analyze_executive_order(
                            title=order.get('title', ''),
                            abstract=order.get('description', ''),
                            order_number=order.get('bill_number', '')
                        )
                        
                        if ai_result:
                            # Update order with AI results
                            order.update({
                                'ai_summary': ai_result.get('ai_summary', ''),
                                'ai_executive_summary': ai_result.get('ai_executive_summary', ''),
                                'ai_talking_points': ai_result.get('ai_talking_points', ''),
                                'ai_key_points': ai_result.get('ai_key_points', ''),
                                'ai_business_impact': ai_result.get('ai_business_impact', ''),
                                'ai_potential_impact': ai_result.get('ai_potential_impact', ''),
                                'ai_version': ai_result.get('ai_version', 'azure_openai_enhanced_v1')
                            })
                            
                            logger.info(f"✅ Azure AI analysis completed for EO {order.get('bill_number')}")
                        else:
                            logger.warning(f"⚠️ No AI result for EO {order.get('bill_number')}")
                        
                        # Rate limiting delay
                        await asyncio.sleep(1.5)
                        
                        return order
                        
                    except Exception as e:
                        logger.error(f"❌ AI analysis failed for EO {order.get('bill_number')}: {e}")
                        order.update({
                            'ai_summary': f'AI analysis failed: {str(e)}',
                            'ai_executive_summary': '',
                            'ai_talking_points': '',
                            'ai_key_points': '',
                            'ai_business_impact': '',
                            'ai_potential_impact': '',
                            'ai_version': 'error'
                        })
                        return order
            
            # Process all orders concurrently with rate limiting
            processed_orders = await asyncio.gather(
                *[analyze_single_order(order) for order in orders],
                return_exceptions=True
            )
            
            # Filter out exceptions
            valid_orders = []
            for result in processed_orders:
                if isinstance(result, dict):
                    valid_orders.append(result)
                else:
                    logger.error(f"❌ Exception in AI processing: {result}")
            
            logger.info(f"🎉 Azure AI processing completed: {len(valid_orders)} orders processed")
            
            return valid_orders
            
        except Exception as e:
            logger.error(f"❌ Error in Azure AI processing: {e}")
            return orders  # Return original orders if AI processing fails
    
    def save_to_database(self, orders: List[Dict]) -> int:
        """
        STEP 3: Save processed orders to database
        """
        try:
            if not self.save_to_db:
                logger.warning("⚠️ No database save function provided")
                return 0
            
            logger.info(f"💾 Saving {len(orders)} orders to database...")
            
            saved_count = self.save_to_db(orders)
            
            logger.info(f"✅ Saved {saved_count} orders to database")
            
            return saved_count
            
        except Exception as e:
            logger.error(f"❌ Error saving to database: {e}")
            return 0
    
    async def run_complete_pipeline(self, with_ai: bool = True, max_concurrent: int = 3) -> Dict:
        """
        COMPLETE PIPELINE: Federal Register → Azure AI → Database
        """
        try:
            logger.info("🚀 Starting complete Executive Orders pipeline...")
            
            # STEP 1: Fetch from Federal Register
            fetch_result = self.fetch_executive_orders_from_federal_register()
            
            if not fetch_result.get('success'):
                return {
                    'success': False,
                    'error': fetch_result.get('error'),
                    'stage': 'fetch'
                }
            
            orders = fetch_result.get('orders', [])
            
            if not orders:
                return {
                    'success': False,
                    'error': 'No orders found from Federal Register',
                    'stage': 'fetch'
                }
            
            # STEP 2: Process with Azure AI (optional)
            if with_ai:
                orders = await self.process_with_azure_ai(orders, max_concurrent)
            
            # STEP 3: Save to database
            saved_count = self.save_to_database(orders)
            
            logger.info("🎉 Complete pipeline finished successfully!")
            
            return {
                'success': True,
                'message': f'Pipeline completed successfully',
                'orders_fetched': len(orders),
                'orders_saved': saved_count,
                'ai_analysis': with_ai,
                'stages_completed': ['fetch', 'ai_analysis' if with_ai else 'skip_ai', 'database_save'],
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"❌ Pipeline failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'stage': 'pipeline'
            }

# Pydantic models for API
class ExecutiveOrderPipelineRequest(BaseModel):
    with_ai: bool = True
    max_concurrent: int = 3
    save_to_db: bool = True

# Add these endpoints to your main.py
"""
Add these endpoints to your main.py:

@app.post("/api/executive-orders/run-pipeline")
async def run_executive_orders_pipeline(request: ExecutiveOrderPipelineRequest):
    '''
    Complete Executive Orders Pipeline:
    Federal Register API → Azure AI Foundry → Database
    '''
    try:
        logger.info("🚀 Starting Executive Orders pipeline...")
        
        # Import your database save function
        if EXECUTIVE_ORDERS_AVAILABLE and request.save_to_db:
            processor = ExecutiveOrderProcessor(save_to_db_func=save_executive_orders_to_db)
        else:
            processor = ExecutiveOrderProcessor()
        
        # Run the complete pipeline
        result = await processor.run_complete_pipeline(
            with_ai=request.with_ai,
            max_concurrent=request.max_concurrent
        )
        
        if result.get('success'):
            logger.info(f"✅ Pipeline completed: {result.get('orders_saved', 0)} orders saved")
            
            return {
                "success": True,
                "message": result.get('message'),
                "orders_fetched": result.get('orders_fetched', 0),
                "orders_saved": result.get('orders_saved', 0),
                "ai_analysis_enabled": request.with_ai,
                "pipeline_stages": result.get('stages_completed', []),
                "method": "federal_register_to_azure_ai_to_database",
                "timestamp": datetime.now().isoformat()
            }
        else:
            logger.error(f"❌ Pipeline failed: {result.get('error')}")
            raise HTTPException(
                status_code=500,
                detail=f"Pipeline failed at {result.get('stage')}: {result.get('error')}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Pipeline endpoint error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Pipeline execution failed: {str(e)}"
        )

@app.post("/api/executive-orders/quick-pipeline")
async def quick_executive_orders_pipeline():
    '''Quick pipeline with default settings'''
    try:
        processor = ExecutiveOrderProcessor(save_to_db_func=save_executive_orders_to_db if EXECUTIVE_ORDERS_AVAILABLE else None)
        
        result = await processor.run_complete_pipeline(
            with_ai=True,
            max_concurrent=2  # Conservative for quick run
        )
        
        if result.get('success'):
            return {
                "success": True,
                "message": f"Quick pipeline completed: {result.get('orders_saved', 0)} orders processed",
                "count": result.get('orders_saved', 0),
                "method": "quick_federal_register_pipeline"
            }
        else:
            return {
                "success": False,
                "message": f"Pipeline failed: {result.get('error')}",
                "error": result.get('error')
            }
            
    except Exception as e:
        return {
            "success": False,
            "message": f"Quick pipeline failed: {str(e)}",
            "error": str(e)
        }

@app.get("/api/executive-orders/test-federal-register")
async def test_federal_register_connection():
    '''Test connection to Federal Register API'''
    try:
        processor = ExecutiveOrderProcessor()
        
        result = processor.fetch_executive_orders_from_federal_register()
        
        if result.get('success'):
            return {
                "success": True,
                "message": f"Federal Register API working: {result.get('count', 0)} orders found",
                "count": result.get('count', 0),
                "source": "Federal Register API",
                "sample_titles": [
                    order.get('title', 'No title')[:60] + "..." 
                    for order in result.get('orders', [])[:3]
                ]
            }
        else:
            return {
                "success": False,
                "message": f"Federal Register API failed: {result.get('error')}",
                "error": result.get('error')
            }
            
    except Exception as e:
        return {
            "success": False,
            "message": f"Test failed: {str(e)}",
            "error": str(e)
        }
"""

# Usage example:
async def example_usage():
    """Example of how to use the pipeline"""
    
    # Import your database save function
    try:
        from backend.main_old import save_executive_orders_to_db
        save_func = save_executive_orders_to_db
    except ImportError:
        print("Database save function not available")
        save_func = None
    
    # Create processor
    processor = ExecutiveOrderProcessor(save_to_db_func=save_func)
    
    # Run complete pipeline
    result = await processor.run_complete_pipeline(
        with_ai=True,  # Use Azure AI analysis
        max_concurrent=3  # Process 3 orders at once
    )
    
    if result.get('success'):
        print(f"✅ Pipeline completed successfully!")
        print(f"   Orders fetched: {result.get('orders_fetched', 0)}")
        print(f"   Orders saved: {result.get('orders_saved', 0)}")
    else:
        print(f"❌ Pipeline failed: {result.get('error')}")

if __name__ == "__main__":
    # Test the pipeline
    asyncio.run(example_usage())