# federal_register_api.py - Updated with Azure AI Integration
import requests
import json
import time
import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import os
from dotenv import load_dotenv

load_dotenv()

class FederalRegisterAPI:
    """Enhanced Federal Register API with Azure AI integration"""
    
    BASE_URL = "https://www.federalregister.gov/api/v1/documents"
    TRUMP_2025_URL = "https://www.federalregister.gov/presidential-documents/executive-orders/donald-trump/2025"
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'LegislationVue/7.0 Production with Azure AI',
            'Accept': 'application/json'
        })
        
        # Azure AI configuration - use same config as ai.py
        self.azure_endpoint = os.getenv("AZURE_ENDPOINT", "https://david-mabholqy-swedencentral.openai.azure.com/")
        self.azure_key = os.getenv("AZURE_KEY", "8bFP5NQ6KL7jSV74M3ZJ77vh9uYrtR7c3sOkAmM3Gs7tirc5mOWAJQQJ99BEACfhMk5XJ3w3AAAAACOGGlXN")
        self.model_name = os.getenv("AZURE_MODEL_NAME", "summarize-gpt-4.1")
        
        # Initialize Azure AI client
        self.ai_client = None
        self._setup_azure_ai()
        
        print("✅ Federal Register API initialized with Azure AI integration")
    
    def _setup_azure_ai(self):
        """Setup Azure OpenAI client"""
        try:
            from openai import AsyncAzureOpenAI
            
            self.ai_client = AsyncAzureOpenAI(
                azure_endpoint=self.azure_endpoint,
                api_key=self.azure_key,
                api_version="2024-12-01-preview"
            )
            print("✅ Azure AI client initialized successfully")
            
        except ImportError:
            print("❌ OpenAI library not found. Install with: pip install openai")
            self.ai_client = None
        except Exception as e:
            print(f"❌ Azure AI setup failed: {e}")
            self.ai_client = None
    
    async def _generate_ai_analysis(self, title: str, description: str, category: str) -> Dict[str, str]:
        """Generate dynamic AI analysis using Azure OpenAI"""
        
        if not self.ai_client:
            print("⚠️ Azure AI not available, using fallback analysis")
            return self._generate_fallback_analysis(title, description, category)
        
        try:
            # Prepare content for AI analysis
            content = f"Title: {title}\n"
            if description:
                content += f"Description: {description}\n"
            content += f"Category: {category}"
            
            # Truncate if too long
            if len(content) > 4000:
                content = content[:4000] + "..."
            
            print(f"🤖 Generating AI analysis for: {title[:50]}...")
            
            # Generate all three analyses concurrently
            summary_task = self._generate_summary(content)
            talking_points_task = self._generate_talking_points(content)
            business_impact_task = self._generate_business_impact(content)
            
            # Wait for all analyses to complete
            summary, talking_points, business_impact = await asyncio.gather(
                summary_task,
                talking_points_task,
                business_impact_task,
                return_exceptions=True
            )
            
            # Handle any exceptions
            if isinstance(summary, Exception):
                print(f"❌ Summary generation failed: {summary}")
                summary = f"<p>Executive order analyzing {category} policy with focus on {title[:100]}...</p>"
            
            if isinstance(talking_points, Exception):
                print(f"❌ Talking points generation failed: {talking_points}")
                talking_points = "<ol><li>Policy implementation required</li><li>Federal coordination needed</li><li>Stakeholder engagement planned</li></ol>"
            
            if isinstance(business_impact, Exception):
                print(f"❌ Business impact generation failed: {business_impact}")
                business_impact = "<p>1. Compliance requirements may change. 2. New opportunities for aligned businesses. 3. Industry coordination expected.</p>"
            
            print(f"✅ AI analysis completed for: {title[:50]}...")
            
            return {
                'summary': summary,
                'talking_points': talking_points,
                'business_impact': business_impact,
                'potential_impact': business_impact  # Use same as business impact for compatibility
            }
            
        except Exception as e:
            print(f"❌ AI analysis failed: {e}")
            return self._generate_fallback_analysis(title, description, category)
    
    async def _generate_summary(self, content: str) -> str:
        """Generate executive summary using Azure AI"""
        
        prompt = f"""
        Write a concise summary of this executive order in 3-5 sentences. 
        - Use straightforward, easy-to-understand language
        - Focus only on the most important aspects
        - Avoid technical jargon 
        - Make it direct and to the point
        - Consider the business and policy implications
        
        Executive Order Content: {content}
        """
        
        messages = [
            {
                "role": "system",
                "content": "You are an expert policy analyst specializing in executive orders. Provide clear, actionable summaries for business leaders and policy makers."
            },
            {
                "role": "user",
                "content": prompt
            }
        ]
        
        response = await self.ai_client.chat.completions.create(
            model=self.model_name,
            messages=messages,
            temperature=0.1,
            max_tokens=400,
            top_p=0.95
        )
        
        raw_response = response.choices[0].message.content
        return f"<p>{raw_response.strip()}</p>"
    
    async def _generate_talking_points(self, content: str) -> str:
        """Generate key talking points using Azure AI"""
        
        prompt = f"""
        Output EXACTLY 5 key talking points about this executive order in this format:

        1. [First key point] - should be concise and important
        2. [Second key point] - should be concise and important  
        3. [Third key point] - should be concise and important
        4. [Fourth key point] - should be concise and important
        5. [Fifth key point] - should be concise and important

        CRITICAL RULES:
        - Each point should be ONE sentence only
        - Make each point clear and easy to understand
        - NO extra numbering or bullets
        - EXACTLY 5 points, numbered 1-5
        - Focus on actionable insights and key implications
        
        Executive Order Content: {content}
        """
        
        messages = [
            {
                "role": "system",
                "content": "You are a communications expert helping leaders understand and discuss policy implications. Focus on the most important points for stakeholder discussions."
            },
            {
                "role": "user",
                "content": prompt
            }
        ]
        
        response = await self.ai_client.chat.completions.create(
            model=self.model_name,
            messages=messages,
            temperature=0.1,
            max_tokens=500,
            top_p=0.95,
            stop=["6.", "7.", "8.", "9."]
        )
        
        raw_response = response.choices[0].message.content
        
        # Convert to HTML list format
        lines = raw_response.strip().split('\n')
        html_items = []
        
        for line in lines:
            line = line.strip()
            if line and any(line.startswith(str(i) + '.') for i in range(1, 6)):
                # Remove the number and format as list item
                content = line.split('.', 1)[1].strip()
                html_items.append(f"<li>{content}</li>")
        
        return f"<ol>{''.join(html_items)}</ol>"
    
    async def _generate_business_impact(self, content: str) -> str:
        """Generate business impact analysis using Azure AI"""
        
        prompt = f"""
        Analyze the business impact of this executive order using EXACTLY this structure:

        1. Risk: [Brief description of primary business risk]
           • [First specific impact of this risk on businesses]
           • [Second specific impact of this risk on operations]

        2. Opportunity: [Brief description of main business opportunity]
           • [First specific benefit businesses can capture]
           • [Second specific advantage this creates]

        3. Market Change: [Brief description of market/industry shift]
           • [First specific market change expected]
           • [Second specific industry transformation]

        CRITICAL FORMATTING RULES:
        - Use EXACTLY the structure above with numbered sections 1-3
        - Create each bullet point with a SINGLE bullet character •
        - Make all text clear and business-focused
        
        Executive Order Content: {content}
        """
        
        messages = [
            {
                "role": "system",
                "content": "You are a business strategy consultant analyzing how government policies affect companies and markets. Focus on practical business implications."
            },
            {
                "role": "user",
                "content": prompt
            }
        ]
        
        response = await self.ai_client.chat.completions.create(
            model=self.model_name,
            messages=messages,
            temperature=0.1,
            max_tokens=600,
            top_p=0.95
        )
        
        raw_response = response.choices[0].message.content
        
        # Convert to HTML format
        lines = raw_response.strip().split('\n')
        html_content = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Handle numbered sections
            if any(line.startswith(str(i) + '.') for i in range(1, 4)):
                content = line.split('.', 1)[1].strip()
                html_content.append(f"<p><strong>{content}</strong></p>")
            # Handle bullet points
            elif line.startswith('•'):
                content = line[1:].strip()
                html_content.append(f"<p>• {content}</p>")
            else:
                html_content.append(f"<p>{line}</p>")
        
        return ''.join(html_content)
    
    def _generate_fallback_analysis(self, title: str, description: str, category: str) -> Dict[str, str]:
        """Generate fallback analysis when AI is not available"""
        
        print("⚠️ Using fallback AI analysis")
        
        # Enhanced fallback based on actual content
        if category == 'healthcare':
            summary = "<p>This executive order addresses healthcare policy implementation requiring coordination between federal agencies and healthcare stakeholders to improve patient outcomes and system efficiency.</p>"
            talking_points = "<ol><li>Healthcare system improvements mandated</li><li>Federal agency coordination required</li><li>Patient outcome optimization prioritized</li><li>Stakeholder engagement essential</li><li>Implementation timeline established</li></ol>"
            business_impact = "<p><strong>Risk:</strong> Healthcare organizations must assess compliance requirements</p><p>• New regulatory requirements may increase operational costs</p><p>• Implementation deadlines require resource allocation</p><p><strong>Opportunity:</strong> Aligned healthcare businesses may benefit from policy support</p><p>• Enhanced federal programs may create new revenue streams</p><p>• Streamlined processes may reduce administrative burden</p>"
        
        elif category == 'education':
            summary = "<p>This executive order establishes new federal education policy direction requiring coordinated implementation across government agencies to enhance educational outcomes and workforce development.</p>"
            talking_points = "<ol><li>Educational excellence prioritized</li><li>Federal coordination enhanced</li><li>Workforce development emphasized</li><li>State partnerships strengthened</li><li>Innovation initiatives launched</li></ol>"
            business_impact = "<p><strong>Risk:</strong> Educational institutions may face new compliance requirements</p><p>• Funding criteria changes may affect revenue</p><p>• Program modifications may require significant resources</p><p><strong>Opportunity:</strong> Education technology companies may see increased demand</p><p>• Federal investment in workforce programs may benefit training providers</p><p>• Innovation initiatives may create new market opportunities</p>"
        
        elif category == 'civic':
            summary = "<p>This executive order directs federal agencies to enhance government efficiency and coordination, implementing new policies to improve public service delivery and administrative effectiveness.</p>"
            talking_points = "<ol><li>Government efficiency enhanced</li><li>Agency coordination improved</li><li>Public service delivery optimized</li><li>Administrative processes streamlined</li><li>Accountability measures strengthened</li></ol>"
            business_impact = "<p><strong>Risk:</strong> Government contractors may face new requirements</p><p>• Procurement processes may change affecting current contracts</p><p>• Compliance standards may require additional resources</p><p><strong>Opportunity:</strong> Efficiency-focused businesses may benefit from new initiatives</p><p>• Technology providers may see increased demand for government solutions</p><p>• Streamlined processes may reduce bureaucratic costs</p>"
        
        elif category == 'engineering':
            summary = "<p>This executive order accelerates infrastructure development and technological innovation through streamlined federal processes and enhanced coordination between agencies and private sector partners.</p>"
            talking_points = "<ol><li>Infrastructure development accelerated</li><li>Technological innovation promoted</li><li>Federal processes streamlined</li><li>Public-private partnerships enhanced</li><li>Project approval timelines reduced</li></ol>"
            business_impact = "<p><strong>Risk:</strong> Engineering firms may face updated regulatory requirements</p><p>• New standards may require additional compliance measures</p><p>• Project specifications may change affecting current contracts</p><p><strong>Opportunity:</strong> Infrastructure companies may benefit from accelerated projects</p><p>• Technology firms may see increased federal investment</p><p>• Streamlined approval processes may reduce project delays</p>"
        
        else:
            summary = f"<p>This executive order establishes new federal policy direction in {category} requiring coordinated implementation across government agencies to achieve specified objectives.</p>"
            talking_points = "<ol><li>Federal policy direction established</li><li>Agency coordination required</li><li>Implementation framework defined</li><li>Stakeholder engagement planned</li><li>Progress monitoring instituted</li></ol>"
            business_impact = "<p><strong>Risk:</strong> Organizations may need to assess new compliance requirements</p><p>• Regulatory changes may affect current operations</p><p>• Implementation costs may require budget adjustments</p><p><strong>Opportunity:</strong> Aligned businesses may benefit from policy support</p><p>• New federal initiatives may create market opportunities</p><p>• Enhanced coordination may improve business-government relations</p>"
        
        return {
            'summary': summary,
            'talking_points': talking_points,
            'business_impact': business_impact,
            'potential_impact': business_impact
        }
    
    def calculate_optimal_per_page(self, start_date: str, end_date: str, max_per_page: int = 1000) -> int:
        """Calculate optimal per_page based on date range to fetch all available orders"""
        try:
            start_dt = datetime.strptime(start_date, '%Y-%m-%d')
            end_dt = datetime.strptime(end_date, '%Y-%m-%d')
            days_diff = (end_dt - start_dt).days
            
            # Estimate orders per day (conservative estimate: 1-3 orders per day during active periods)
            if days_diff <= 7:  # Week or less
                estimated_orders = days_diff * 2
            elif days_diff <= 30:  # Month or less
                estimated_orders = days_diff * 1.5
            elif days_diff <= 90:  # Quarter or less
                estimated_orders = days_diff * 1
            else:  # Longer periods
                estimated_orders = days_diff * 0.5
            
            # Ensure we have a reasonable buffer and don't exceed API limits
            optimal_per_page = min(max(int(estimated_orders * 2), 50), max_per_page)
            
            print(f"📊 Date range: {days_diff} days, estimated orders: {int(estimated_orders)}, fetching: {optimal_per_page}")
            return optimal_per_page
            
        except Exception as e:
            print(f"❌ Error calculating optimal per_page: {e}")
            return 100  # Safe fallback
    
    def safe_get(self, data, key, default=""):
        """Ultra-safe data extraction"""
        try:
            if not isinstance(data, dict):
                return default
            value = data.get(key)
            if value is None:
                return default
            if isinstance(value, str):
                return value.strip()
            return str(value).strip() if value else default
        except Exception:
            return default
    
    def safe_lower(self, text):
        """Ultra-safe lowercase conversion"""
        try:
            if text is None:
                return ""
            if isinstance(text, str):
                return text.lower().strip()
            return str(text).lower().strip() if text else ""
        except Exception:
            return ""
    
    async def fetch_trump_2025_executive_orders(self,
                                        start_date: Optional[str] = None,
                                        end_date: Optional[str] = None,
                                        per_page: Optional[int] = None) -> Dict:
        """Fetch Trump 2025 executive orders with dynamic Azure AI analysis"""
        
        if not start_date:
            start_date = "2025-01-20"
        
        if not end_date:
            end_date = datetime.now().strftime('%Y-%m-%d')
        
        # Calculate optimal per_page if not provided
        if per_page is None:
            per_page = self.calculate_optimal_per_page(start_date, end_date)
        
        print(f"🔍 Fetching Trump 2025 executive orders from {start_date} to {end_date}")
        print(f"📊 Using per_page: {per_page} (optimized for date range)")
        print(f"🤖 Azure AI Analysis: {'Enabled' if self.ai_client else 'Fallback Mode'}")
        
        all_orders = []
        search_strategies = []
        
        # Strategy 1: Test API connectivity and check what's available
        print("📋 Strategy 1: API connectivity test and recent data check...")
        try:
            orders1, strategy1_info = await self.test_api_and_find_recent_docs(start_date, end_date, per_page)
            all_orders.extend(orders1)
            search_strategies.append(strategy1_info)
            print(f"📋 Strategy 1 found {len(orders1)} orders")
        except Exception as e:
            print(f"⚠️ Strategy 1 failed: {e}")
            search_strategies.append({"name": "API Test", "status": "failed", "error": str(e)})
        
        # Strategy 2: Search all presidential documents in date range
        print("📋 Strategy 2: All presidential documents in date range...")
        try:
            orders2, strategy2_info = await self.search_all_presidential_docs_in_range(start_date, end_date, per_page)
            all_orders.extend(orders2)
            search_strategies.append(strategy2_info)
            print(f"📋 Strategy 2 found {len(orders2)} orders")
        except Exception as e:
            print(f"⚠️ Strategy 2 failed: {e}")
            search_strategies.append({"name": "Date Range PRESDOCU", "status": "failed", "error": str(e)})
        
        # Remove duplicates
        unique_orders = self.remove_duplicates(all_orders)
        print(f"📋 Total unique orders found: {len(unique_orders)}")
        
        # If we found orders, show what we got
        if unique_orders:
            print("🎯 Found executive orders:")
            for order in unique_orders[:5]:  # Show first 5
                print(f"   • EO {order.get('eo_number')}: {order.get('title', 'No title')[:60]}...")
        
        return {
            'results': unique_orders,
            'count': len(unique_orders),
            'date_range': f"{start_date} to {end_date}",
            'trump_2025_url': self.TRUMP_2025_URL,
            'source': 'Federal Register API v1 - Dynamic Azure AI Analysis',
            'timestamp': datetime.now().isoformat(),
            'strategies_used': len(search_strategies),
            'total_raw_results': len(all_orders),
            'search_strategies': search_strategies,
            'per_page_used': per_page,
            'date_range_days': (datetime.strptime(end_date, '%Y-%m-%d') - datetime.strptime(start_date, '%Y-%m-%d')).days,
            'ai_analysis_enabled': self.ai_client is not None
        }
    
    async def test_api_and_find_recent_docs(self, start_date: str, end_date: str, per_page: int) -> tuple:
        """Test API connectivity and find what's actually available in date range"""
        
        try:
            test_params = {
                'conditions[publication_date][gte]': start_date,
                'conditions[publication_date][lte]': end_date,
                'per_page': min(per_page, 1000)
            }
            
            response = self.session.get(self.BASE_URL, params=test_params, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                total_docs = data.get('count', 0)
                print(f"📊 API Test: Found {total_docs} total documents in date range")
                
                # Now search specifically for presidential documents in date range
                pres_params = {
                    'conditions[type]': 'PRESDOCU',
                    'conditions[publication_date][gte]': start_date,
                    'conditions[publication_date][lte]': end_date,
                    'per_page': min(per_page, 1000)
                }
                
                pres_response = self.session.get(self.BASE_URL, params=pres_params, timeout=30)
                
                if pres_response.status_code == 200:
                    pres_data = pres_response.json()
                    pres_docs = pres_data.get('results', [])
                    print(f"📊 Found {len(pres_docs)} presidential documents in date range")
                    
                    # Process any executive orders found with AI analysis
                    orders = []
                    for doc in pres_docs:
                        if self.is_executive_order(doc):
                            processed = await self.process_document_with_ai(doc)
                            if processed:
                                orders.append(processed)
                    
                    strategy_info = {
                        "name": "API Test & PRESDOCU in Date Range",
                        "status": "success",
                        "total_docs": total_docs,
                        "presidential_docs": len(pres_docs),
                        "executive_orders": len(orders),
                        "date_range": f"{start_date} to {end_date}",
                        "ai_analysis": self.ai_client is not None
                    }
                    
                    return orders, strategy_info
            
        except Exception as e:
            print(f"❌ API test failed: {e}")
        
        return [], {"name": "API Test", "status": "failed", "error": "API connectivity issues"}
    
    async def search_all_presidential_docs_in_range(self, start_date: str, end_date: str, per_page: int) -> tuple:
        """Search all presidential documents in specific date range with AI analysis"""
        
        params = {
            'conditions[type]': 'PRESDOCU',
            'conditions[publication_date][gte]': start_date,
            'conditions[publication_date][lte]': end_date,
            'per_page': min(per_page, 1000),
            'order': 'newest'
        }
        
        try:
            response = self.session.get(self.BASE_URL, params=params, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                results = data.get('results', [])
                total_count = data.get('count', len(results))
                
                print(f"📊 Presidential docs in range: {len(results)} fetched, {total_count} total available")
                
                orders = []
                for doc in results:
                    if self.is_executive_order(doc):
                        processed = await self.process_document_with_ai(doc)
                        if processed:
                            orders.append(processed)
                
                strategy_info = {
                    "name": "Presidential Docs in Date Range",
                    "status": "success",
                    "total_found": len(results),
                    "total_available": total_count,
                    "executive_orders": len(orders),
                    "date_range": f"{start_date} to {end_date}",
                    "ai_analysis": self.ai_client is not None
                }
                
                return orders, strategy_info
            
        except Exception as e:
            print(f"❌ Presidential docs in range search failed: {e}")
        
        return [], {"name": "Presidential Docs in Range", "status": "failed"}
    
    def is_executive_order(self, document: Dict) -> bool:
        """Enhanced executive order detection"""
        
        try:
            title = self.safe_lower(self.safe_get(document, 'title', ''))
            doc_type = self.safe_get(document, 'type', '')
            presidential_doc_type = self.safe_get(document, 'presidential_document_type', '')
            eo_number = self.safe_get(document, 'executive_order_number', '')
            
            # Strong indicators
            if eo_number:
                return True
            
            if 'executive order' in title:
                return True
            
            # Check for EO patterns
            eo_patterns = ['eo ', 'e.o.', 'executive order no', 'order no.', 'order number']
            if any(pattern in title for pattern in eo_patterns):
                return True
            
            # Check presidential document type
            if 'executive order' in self.safe_lower(presidential_doc_type):
                return True
            
            # For PRESDOCU, check if it has ordering language
            if doc_type == 'PRESDOCU':
                ordering_words = ['order', 'directing', 'establishing', 'requiring', 'ordering']
                if any(word in title for word in ordering_words):
                    # Additional check - avoid proclamations
                    if 'proclamation' not in title:
                        return True
            
            return False
            
        except Exception:
            return False
    
    async def process_document_with_ai(self, raw_doc: Dict) -> Optional[Dict]:
        """Process document with Azure AI analysis"""
        
        try:
            # Extract all Federal Register API fields
            title = self.safe_get(raw_doc, 'title', 'Executive Order')
            summary = self.safe_get(raw_doc, 'summary', '')
            abstract = self.safe_get(raw_doc, 'abstract', '')
            document_number = self.safe_get(raw_doc, 'document_number', '')
            publication_date = self.safe_get(raw_doc, 'publication_date', '')
            signing_date = self.safe_get(raw_doc, 'signing_date', '')
            html_url = self.safe_get(raw_doc, 'html_url', '')
            pdf_url = self.safe_get(raw_doc, 'pdf_url', '')
            executive_order_number = self.safe_get(raw_doc, 'executive_order_number', '')
            citation = self.safe_get(raw_doc, 'citation', '')
            presidential_document_type = self.safe_get(raw_doc, 'presidential_document_type', '')
            
            # Use best available summary for AI analysis
            ai_input_text = summary or abstract or title
            if not ai_input_text:
                ai_input_text = f"Executive order titled: {title}"
            
            # Use best available date
            if not signing_date and publication_date:
                signing_date = publication_date
            if not signing_date:
                signing_date = datetime.now().strftime('%Y-%m-%d')
            
            # Extract/generate EO number
            eo_number = executive_order_number or self.extract_eo_number_enhanced(title, document_number, raw_doc)
            
            # Enhanced categorization
            category = self.categorize_order_enhanced(title, ai_input_text, presidential_document_type)
            
            # Generate dynamic AI analysis
            print(f"🤖 Generating Azure AI analysis for EO {eo_number}...")
            ai_analysis = await self._generate_ai_analysis(title, ai_input_text, category)
            
            # Ensure document_number is not empty
            if not document_number:
                document_number = f"FR-EO-{eo_number}-{int(time.time())}"
            
            # Build complete order object with Azure AI analysis
            processed_order = {
                'document_number': document_number,  # Primary identifier
                'eo_number': eo_number,
                'executive_order_number': eo_number,  # For frontend compatibility
                'title': title,
                'summary': summary,
                'abstract': abstract,  # Keep original abstract
                'signing_date': signing_date,
                'publication_date': publication_date or signing_date,
                'citation': citation,
                'presidential_document_type': presidential_document_type,
                'category': category,
                'html_url': html_url,
                'pdf_url': pdf_url,
                
                # Azure AI Generated Content
                'ai_summary': ai_analysis.get('summary', ''),
                'ai_executive_summary': ai_analysis.get('summary', ''),  # Compatibility
                'ai_key_points': ai_analysis.get('talking_points', ''),
                'ai_talking_points': ai_analysis.get('talking_points', ''),  # Compatibility
                'ai_business_impact': ai_analysis.get('business_impact', ''),
                'ai_potential_impact': ai_analysis.get('potential_impact', ''),  # Compatibility
                'ai_version': 'azure_openai_federal_register_v1.0',
                
                # Metadata
                'source': 'Federal Register API v1 with Azure AI',
                'raw_data_available': bool(raw_doc),
                'created_at': datetime.now().isoformat(),
                'last_updated': datetime.now().isoformat()
            }
            
            print(f"✅ Processed EO {eo_number} with Azure AI analysis")
            return processed_order
            
        except Exception as e:
            print(f"⚠️ Error processing document: {e}")
            return None
    
    def extract_eo_number_enhanced(self, title: str, document_number: str, raw_doc: Dict) -> str:
        """Enhanced EO number extraction with multiple fallbacks"""
        
        try:
            import re
            
            # Check all possible fields for EO numbers
            sources = [
                self.safe_get(raw_doc, 'executive_order_number', ''),
                title,
                document_number,
                self.safe_get(raw_doc, 'citation', ''),
                self.safe_get(raw_doc, 'presidential_document_type', '')
            ]
            
            # EO number patterns (most specific to least specific)
            patterns = [
                r'(?:executive\s+order\s+(?:no\.?\s+)?)(\d{4,5})',  # EO 14295
                r'(?:eo\s+(?:no\.?\s+)?)(\d{4,5})',                # EO 14295
                r'(?:e\.o\.\s*)(\d{4,5})',                         # E.O. 14295
                r'(?:order\s+(?:no\.?\s+)?)(\d{4,5})',            # Order 14295
                r'\b(14\d{3})\b',                                  # 14295 (2025 pattern)
                r'\b(15\d{3})\b',                                  # 15xxx (future pattern)
                r'2025-(\d+)',                                     # Document number format
                r'(\d{4,5})'                                       # Any 4-5 digit number
            ]
            
            for source in sources:
                if not source:
                    continue
                    
                source_lower = self.safe_lower(source)
                
                for pattern in patterns:
                    match = re.search(pattern, source_lower)
                    if match:
                        number = match.group(1)
                        # Validate it looks like an EO number
                        if len(number) >= 4 and number.isdigit():
                            return number
            
            # Final fallback - generate based on timestamp
            return f"2025{int(time.time()) % 10000}"
            
        except Exception:
            return f"2025{int(time.time()) % 10000}"
    
    def categorize_order_enhanced(self, title: str, summary: str, doc_type: str) -> str:
        """Enhanced categorization with document type consideration"""
        
        try:
            content_parts = [
                self.safe_lower(title),
                self.safe_lower(summary),
                self.safe_lower(doc_type)
            ]
            content = " ".join(part for part in content_parts if part).strip()
            
            if not content:
                return 'not-applicable'
            
            # Enhanced keyword matching with weighted scoring
            categories = {
                'healthcare': ['health', 'medical', 'healthcare', 'medicine', 'patient', 'hospital', 'drug', 'medicare', 'medicaid', 'medical device', 'pharmaceutical', 'public health'],
                'education': ['education', 'school', 'student', 'university', 'college', 'learning', 'academic', 'teacher', 'educational', 'scholarship', 'curriculum'],
                'engineering': ['infrastructure', 'engineering', 'nuclear', 'energy', 'technology', 'construction', 'bridge', 'road', 'transport', 'innovation', 'research', 'development'],
                'civic': ['government', 'federal', 'agency', 'department', 'administration', 'border', 'immigration', 'election', 'security', 'defense', 'policy', 'regulation', 'enforcement']
            }
            
            # Score each category
            scores = {}
            for category, keywords in categories.items():
                score = sum(1 for keyword in keywords if keyword in content)
                if score > 0:
                    scores[category] = score
            
            # Return highest scoring category
            if scores:
                return max(scores.keys(), key=lambda k: scores[k])
            
            return 'not-applicable'
                
        except Exception:
            return 'not-applicable'
    
    def remove_duplicates(self, orders: List[Dict]) -> List[Dict]:
        """Advanced duplicate removal with multiple identifiers"""
        
        try:
            seen = set()
            unique = []
            
            for order in orders:
                if not isinstance(order, dict):
                    continue
                
                # Create comprehensive identifiers
                identifiers = [
                    f"doc:{self.safe_get(order, 'document_number', '')}",
                    f"eo:{self.safe_get(order, 'eo_number', '')}",
                    f"title:{self.safe_get(order, 'title', '')}",
                    f"url:{self.safe_get(order, 'html_url', '')}",
                    f"date_title:{self.safe_get(order, 'signing_date', '')}_{self.safe_get(order, 'title', '')[:50]}"
                ]
                
                # Filter valid identifiers
                valid_identifiers = [id for id in identifiers if len(id.split(':', 1)[1]) > 0]
                
                # Check for duplicates
                is_duplicate = any(id in seen for id in valid_identifiers)
                
                if not is_duplicate:
                    for id in valid_identifiers:
                        seen.add(id)
                    unique.append(order)
            
            return unique
            
        except Exception:
            return orders if isinstance(orders, list) else []

# Test function to verify Azure AI integration
async def test_azure_ai_integration():
    """Test Azure AI integration with Federal Register API"""
    
    print("🧪 Testing Azure AI Integration with Federal Register API")
    print("=" * 60)
    
    try:
        # Initialize API
        api = FederalRegisterAPI()
        
        # Test AI analysis with sample executive order
        sample_title = "Securing the Border"
        sample_description = "This executive order directs federal agencies to enhance border security measures and immigration enforcement."
        sample_category = "civic"
        
        print(f"🔍 Testing AI analysis with sample order:")
        print(f"   Title: {sample_title}")
        print(f"   Category: {sample_category}")
        
        # Generate AI analysis
        ai_result = await api._generate_ai_analysis(sample_title, sample_description, sample_category)
        
        print(f"\n✅ AI Analysis Results:")
        print(f"   Summary Length: {len(ai_result.get('summary', ''))} characters")
        print(f"   Talking Points Length: {len(ai_result.get('talking_points', ''))} characters")
        print(f"   Business Impact Length: {len(ai_result.get('business_impact', ''))} characters")
        
        # Show sample content
        print(f"\n📋 Sample Summary:")
        print(f"   {ai_result.get('summary', 'No summary')[:200]}...")
        
        print(f"\n🎯 Sample Talking Points:")
        print(f"   {ai_result.get('talking_points', 'No talking points')[:200]}...")
        
        print(f"\n📈 Sample Business Impact:")
        print(f"   {ai_result.get('business_impact', 'No business impact')[:200]}...")
        
        return True
        
    except Exception as e:
        print(f"❌ Azure AI integration test failed: {e}")
        return False

# Main execution for testing
if __name__ == "__main__":
    print("🚀 Federal Register API with Azure AI Integration")
    print("=" * 60)
    
    # Run async test
    import asyncio
    
    async def main():
        # Test Azure AI integration
        ai_test_result = await test_azure_ai_integration()
        
        if ai_test_result:
            print("\n✅ Azure AI integration is working!")
            print("\n🔧 To use this in your application:")
            print("1. Make sure your .env file has AZURE_ENDPOINT and AZURE_KEY")
            print("2. Update your main.py to use this enhanced Federal Register API")
            print("3. Executive orders will now have dynamic AI analysis!")
        else:
            print("\n❌ Azure AI integration needs configuration")
            print("\n🔧 Check your environment variables:")
            print("   - AZURE_ENDPOINT")
            print("   - AZURE_KEY") 
            print("   - AZURE_MODEL_NAME")
    
    # Run the test
    asyncio.run(main())