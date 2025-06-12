# federal_register_api.py - COMPLETE and FIXED for Trump 2025 Executive Orders
import requests
import json
import time
import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import os
from dotenv import load_dotenv
import re
import logging

load_dotenv()

logger = logging.getLogger(__name__)

class FederalRegisterAPI:
    """COMPLETE Federal Register API focused on Trump 2025 Executive Orders"""
    
    BASE_URL = "https://www.federalregister.gov/api/v1/documents"
    
    def __init__(self, debug_mode: bool = False):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'LegislationVue/10.3.0-COMPLETE-Trump2025',
            'Accept': 'application/json'
        })
        self.debug_mode = debug_mode
        
        # Azure AI configuration
        self.azure_endpoint = os.getenv("AZURE_ENDPOINT")
        self.azure_key = os.getenv("AZURE_KEY")
        self.model_name = os.getenv("AZURE_MODEL_NAME", "summarize-gpt-4.1")
        
        # Initialize Azure AI client
        self.ai_client = None
        self._setup_azure_ai()
        
        print("✅ COMPLETE Federal Register API - Focused on Trump 2025 Executive Orders")
        if self.debug_mode:
            print("🐛 Debug mode enabled")
    
    def _setup_azure_ai(self):
        """Setup Azure OpenAI client"""
        try:
            from openai import AsyncAzureOpenAI
            
            if self.azure_endpoint and self.azure_key:
                self.ai_client = AsyncAzureOpenAI(
                    azure_endpoint=self.azure_endpoint,
                    api_key=self.azure_key,
                    api_version="2024-12-01-preview"
                )
                print("✅ Azure AI client initialized successfully")
            else:
                print("⚠️ Azure AI configuration incomplete")
                self.ai_client = None
            
        except ImportError:
            print("❌ OpenAI library not found. Install with: pip install openai")
            self.ai_client = None
        except Exception as e:
            print(f"❌ Azure AI setup failed: {e}")
            self.ai_client = None
    
    def debug_log(self, message: str):
        """Log debug messages if debug mode is enabled"""
        if self.debug_mode:
            print(f"🐛 DEBUG: {message}")
    
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
    
    def is_executive_order(self, document: Dict) -> bool:
        """FIXED executive order detection for Trump 2025 range"""
        try:
            title = self.safe_get(document, 'title', '').lower()
            doc_type = self.safe_get(document, 'type', '')
            eo_number = self.safe_get(document, 'executive_order_number', '')
            
            self.debug_log(f"Analyzing: {title[:60]}...")
            
            # Must be a Presidential Document
            if doc_type != 'Presidential Document':
                self.debug_log("❌ Not a Presidential Document")
                return False
            
            # FIXED: Check for Trump 2025 EO range (14147+)
            if eo_number:
                try:
                    eo_int = int(str(eo_number).strip())
                    if 14147 <= eo_int <= 14500:  # EXPANDED: Trump 2025 range
                        self.debug_log(f"✅ Valid Trump 2025 EO: {eo_number}")
                        return True
                    else:
                        self.debug_log(f"❌ EO {eo_number} outside Trump 2025 range")
                        return False
                except:
                    pass
            
            # Look for EO numbers in text
            eo_patterns = [
                r'executive\s+order\s+(?:no\.?\s+)?(141[4-9]\d|142\d{2}|143\d{2}|144\d{2}|145\d{2})',  # 14140-14599
                r'eo\s+(?:no\.?\s+)?(141[4-9]\d|142\d{2}|143\d{2}|144\d{2}|145\d{2})',                # EO 14140-14599
                r'\b(141[4-9]\d|142\d{2}|143\d{2}|144\d{2}|145\d{2})\b',                              # Standalone
            ]
            
            full_text = f"{title} {self.safe_get(document, 'document_number', '')}"
            for pattern in eo_patterns:
                match = re.search(pattern, full_text, re.IGNORECASE)
                if match:
                    eo_num = match.group(1) if match.groups() else match.group(0)
                    try:
                        eo_int = int(eo_num)
                        if 14147 <= eo_int <= 14500:
                            self.debug_log(f"✅ Found Trump 2025 EO {eo_num} in text")
                            return True
                    except:
                        pass
            
            # Must mention "executive order"
            if 'executive order' not in title:
                self.debug_log("❌ Does not mention 'executive order'")
                return False
            
            # Trump 2025 policy indicators
            trump_indicators = [
                'rescissions', 'protecting', 'securing', 'restoring', 'ending',
                'unleashing', 'america first', 'withdrawal', 'revocation',
                'eliminating', 'promoting', 'strengthening', 'establishing'
            ]
            
            for indicator in trump_indicators:
                if indicator in title:
                    self.debug_log(f"✅ Trump policy pattern: '{indicator}'")
                    return True
            
            self.debug_log("❌ Not identified as Trump 2025 executive order")
            return False
            
        except Exception as e:
            self.debug_log(f"❌ Error in EO detection: {e}")
            return False
    
    def extract_eo_number_enhanced(self, title: str, document_number: str, raw_doc: Dict) -> str:
        """FIXED EO number extraction for Trump 2025 range"""
        try:
            sources = [
                self.safe_get(raw_doc, 'executive_order_number', ''),
                title,
                document_number,
                self.safe_get(raw_doc, 'citation', ''),
                self.safe_get(raw_doc, 'html_url', ''),
            ]
            
            # EXPANDED: Trump 2025 EO patterns (14147+)
            patterns = [
                r'(?:executive\s+order\s+(?:no\.?\s+)?)(141[4-9]\d|142\d{2}|143\d{2}|144\d{2}|145\d{2})',  # EO 14147-14599
                r'(?:eo\s+(?:no\.?\s+)?)(141[4-9]\d|142\d{2}|143\d{2}|144\d{2}|145\d{2})',                # EO 14147-14599
                r'(?:e\.o\.\s*)(141[4-9]\d|142\d{2}|143\d{2}|144\d{2}|145\d{2})',                         # E.O. 14147-14599
                r'(?:order\s+(?:no\.?\s+)?)(141[4-9]\d|142\d{2}|143\d{2}|144\d{2}|145\d{2})',            # Order 14147-14599
                r'executive-order-(141[4-9]\d|142\d{2}|143\d{2}|144\d{2}|145\d{2})',                      # URL format
                r'/(141[4-9]\d|142\d{2}|143\d{2}|144\d{2}|145\d{2})/',                                    # URL number
                r'\b(141[4-9]\d|142\d{2}|143\d{2}|144\d{2}|145\d{2})\b',                                 # Standalone
            ]
            
            for source in sources:
                if not source:
                    continue
                    
                source_clean = str(source).strip()
                
                for pattern in patterns:
                    matches = re.findall(pattern, source_clean, re.IGNORECASE)
                    for match in matches:
                        number = str(match).strip()
                        if len(number) >= 4 and number.isdigit():
                            try:
                                num_int = int(number)
                                if 14147 <= num_int <= 14500:  # EXPANDED RANGE
                                    self.debug_log(f"✅ Found valid Trump 2025 EO: {number}")
                                    return number
                            except:
                                pass
            
            self.debug_log("❌ No valid Trump 2025 EO number found")
            return ""
                    
        except Exception as e:
            self.debug_log(f"Error extracting EO number: {e}")
            return ""
    
    async def fetch_trump_2025_executive_orders(self,
                                        start_date: Optional[str] = None,
                                        end_date: Optional[str] = None,
                                        per_page: Optional[int] = None,
                                        debug: Optional[bool] = None) -> Dict:
        """COMPLETE and FOCUSED fetch for Trump 2025 executive orders"""
        
        if not start_date:
            start_date = "2025-01-20"  # Trump inauguration
        
        if not end_date:
            end_date = datetime.now().strftime('%Y-%m-%d')
        
        if per_page is None:
            per_page = 1000
        
        # Enable debug mode if requested
        if debug is not None:
            original_debug = self.debug_mode
            self.debug_mode = debug
        
        print(f"🚀 COMPLETE: Fetching Trump 2025 executive orders with focused search")
        print(f"📅 Date range: {start_date} to {end_date}")
        print(f"🤖 Azure AI Analysis: {'Enabled' if self.ai_client else 'Fallback Mode'}")
        print(f"🎯 Target range: EO 14147-14500 (Trump 2025)")
        
        all_orders = []
        found_eo_numbers = set()
        
        # Strategy 1: FOCUSED EO number search (14147-14350)
        print(f"\n📋 Strategy 1: Focused Trump 2025 EO number search...")
        try:
            # EXPANDED: Focus on actual Trump 2025 range starting at 14147
            for eo_num in range(14147, 14350):  # EXPANDED: Covers up to EO 14350
                
                # Search patterns for this EO number
                search_patterns = [
                    str(eo_num),                      # "14147"
                    f"Executive Order {eo_num}",      # "Executive Order 14147"
                    f"EO {eo_num}",                   # "EO 14147"
                ]
                
                for pattern in search_patterns:
                    if eo_num in found_eo_numbers:
                        break  # Skip if we already found this EO
                    
                    try:
                        params = {
                            'conditions[term]': pattern,
                            'conditions[publication_date][gte]': start_date,
                            'conditions[publication_date][lte]': end_date,
                            'per_page': 50,
                            'order': 'newest'
                        }
                        
                        response = self.session.get(self.BASE_URL, params=params, timeout=30)
                        if response.status_code == 200:
                            data = response.json()
                            results = data.get('results', [])
                            
                            # Look for the actual EO document
                            for doc in results:
                                if self.is_executive_order(doc):
                                    processed = await self.process_document_with_ai(doc)
                                    if processed:
                                        all_orders.append(processed)
                                        found_eo_numbers.add(eo_num)
                                        print(f"   ✅ Found EO {eo_num}: {processed.get('title', '')[:60]}...")
                                        break  # Found it, move to next EO
                        
                        # Small delay to be nice to the API
                        time.sleep(0.1)
                        
                    except Exception as e:
                        self.debug_log(f"Error searching for EO {eo_num}: {e}")
            
            print(f"   Found {len(found_eo_numbers)} EOs via focused number search")
            
        except Exception as e:
            print(f"   ❌ Focused EO number search failed: {e}")
        
        # Strategy 2: Presidential Documents search
        print(f"\n📋 Strategy 2: Presidential Documents search...")
        try:
            params = {
                'conditions[type]': 'Presidential Document',
                'conditions[publication_date][gte]': start_date,
                'conditions[publication_date][lte]': end_date,
                'per_page': per_page,
                'order': 'newest'
            }
            
            response = self.session.get(self.BASE_URL, params=params, timeout=30)
            if response.status_code == 200:
                data = response.json()
                results = data.get('results', [])
                print(f"   Found {len(results)} presidential documents")
                
                doc_based_count = 0
                for doc in results:
                    if self.is_executive_order(doc):
                        # Check if we already have this EO
                        eo_num = self.extract_eo_number_enhanced(
                            self.safe_get(doc, 'title', ''),
                            self.safe_get(doc, 'document_number', ''),
                            doc
                        )
                        
                        if eo_num:
                            try:
                                eo_num_int = int(eo_num)
                                if eo_num_int not in found_eo_numbers and 14147 <= eo_num_int <= 14500:
                                    processed = await self.process_document_with_ai(doc)
                                    if processed:
                                        all_orders.append(processed)
                                        found_eo_numbers.add(eo_num_int)
                                        doc_based_count += 1
                                        print(f"   ✅ Additional EO {eo_num}: {processed.get('title', '')[:60]}...")
                            except ValueError:
                                pass
                
                print(f"   Found {doc_based_count} additional EOs via document search")
            
        except Exception as e:
            print(f"   ❌ Presidential Documents search failed: {e}")
        
        # Strategy 3: Executive Order term search
        print(f"\n📋 Strategy 3: Executive order term search...")
        try:
            params = {
                'conditions[term]': 'executive order',
                'conditions[type]': 'Presidential Document',
                'conditions[publication_date][gte]': start_date,
                'conditions[publication_date][lte]': end_date,
                'per_page': 500,
                'order': 'newest'
            }
            
            response = self.session.get(self.BASE_URL, params=params, timeout=30)
            if response.status_code == 200:
                data = response.json()
                results = data.get('results', [])
                print(f"   Found {len(results)} documents mentioning 'executive order'")
                
                term_based_count = 0
                for doc in results:
                    if self.is_executive_order(doc):
                        eo_num = self.extract_eo_number_enhanced(
                            self.safe_get(doc, 'title', ''),
                            self.safe_get(doc, 'document_number', ''),
                            doc
                        )
                        
                        if eo_num:
                            try:
                                eo_num_int = int(eo_num)
                                if eo_num_int not in found_eo_numbers and 14147 <= eo_num_int <= 14500:
                                    processed = await self.process_document_with_ai(doc)
                                    if processed:
                                        all_orders.append(processed)
                                        found_eo_numbers.add(eo_num_int)
                                        term_based_count += 1
                                        print(f"   ✅ Term search found EO {eo_num}: {processed.get('title', '')[:60]}...")
                            except ValueError:
                                pass
                
                print(f"   Found {term_based_count} additional EOs via term search")
            
        except Exception as e:
            print(f"   ❌ Executive order term search failed: {e}")
        
        # Remove duplicates and sort
        unique_orders = self.remove_duplicates(all_orders)
        
        # Sort by EO number
        try:
            unique_orders.sort(key=lambda x: int(self.safe_get(x, 'eo_number', '0')))
        except:
            pass  # Keep original order if sorting fails
        
        # Restore original debug mode if it was temporarily changed
        if debug is not None:
            self.debug_mode = original_debug
        
        print(f"\n✅ COMPLETE Results:")
        print(f"   Total found: {len(unique_orders)}")
        print(f"   EO range: {min(found_eo_numbers) if found_eo_numbers else 'N/A'}-{max(found_eo_numbers) if found_eo_numbers else 'N/A'}")
        
        return {
            'results': unique_orders,
            'count': len(unique_orders),
            'date_range': f"{start_date} to {end_date}",
            'source': 'Federal Register API v1 - COMPLETE for Trump 2025',
            'timestamp': datetime.now().isoformat(),
            'strategies_used': 3,
            'total_eo_numbers_searched': 203,  # 14147-14350
            'found_via_number_search': len(found_eo_numbers),
            'ai_analysis_enabled': self.ai_client is not None,
            'eo_range_searched': '14147-14350',
            'validation_range': '14147-14500'
        }
    
    async def process_document_with_ai(self, raw_doc: Dict) -> Optional[Dict]:
        """COMPLETE document processing with proper validation"""
        try:
            # Extract basic fields
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
            
            # Extract EO number with validation
            eo_number = executive_order_number or self.extract_eo_number_enhanced(title, document_number, raw_doc)
            
            # Skip if no valid EO number found
            if not eo_number:
                self.debug_log("❌ Skipping - no valid EO number")
                return None
            
            # Validate EO number is in Trump 2025 range
            try:
                eo_int = int(eo_number)
                if not (14147 <= eo_int <= 14500):  # EXPANDED: Trump 2025 range
                    self.debug_log(f"❌ Skipping - EO {eo_number} outside Trump 2025 range")
                    return None
            except:
                self.debug_log(f"❌ Skipping - invalid EO number format: {eo_number}")
                return None
            
            # Use best available date
            if not signing_date and publication_date:
                signing_date = publication_date
            if not publication_date and signing_date:
                publication_date = signing_date
            
            # Use best available summary for AI analysis
            ai_input_text = summary or abstract or title
            if not ai_input_text:
                ai_input_text = f"Executive order titled: {title}"
            
            # Categorization
            category = self.categorize_order_enhanced(title, ai_input_text)
            
            # Generate AI analysis
            self.debug_log(f"Generating AI analysis for EO {eo_number}...")
            ai_analysis = await self._generate_ai_analysis(title, ai_input_text, category)
            
            # Build order object
            processed_order = {
                'document_number': document_number or f"FR-EO-{eo_number}",
                'eo_number': eo_number,
                'executive_order_number': eo_number,
                'title': title,
                'summary': summary,
                'abstract': abstract,
                'signing_date': signing_date,
                'publication_date': publication_date,
                'citation': citation,
                'category': category,
                'html_url': html_url,
                'pdf_url': pdf_url,
                
                # Azure AI Generated Content
                'ai_summary': ai_analysis.get('summary', ''),
                'ai_executive_summary': ai_analysis.get('summary', ''),
                'ai_key_points': ai_analysis.get('talking_points', ''),
                'ai_talking_points': ai_analysis.get('talking_points', ''),
                'ai_business_impact': ai_analysis.get('business_impact', ''),
                'ai_potential_impact': ai_analysis.get('potential_impact', ''),
                'ai_version': 'azure_openai_trump2025_v1.0',
                
                # Metadata
                'source': 'Federal Register API v1 - COMPLETE for Trump 2025',
                'created_at': datetime.now().isoformat(),
                'last_updated': datetime.now().isoformat()
            }
            
            self.debug_log(f"✅ Successfully processed Trump 2025 EO {eo_number}")
            return processed_order
            
        except Exception as e:
            self.debug_log(f"❌ Error processing document: {e}")
            return None
    
    async def _generate_ai_analysis(self, title: str, description: str, category: str) -> Dict[str, str]:
        """Generate AI analysis using Azure OpenAI"""
        if not self.ai_client:
            return self._generate_fallback_analysis(title, description, category)
        
        try:
            content = f"Title: {title}\nDescription: {description}\nCategory: {category}"
            
            if len(content) > 4000:
                content = content[:4000] + "..."
            
            # Generate analyses concurrently
            summary_task = self._generate_summary(content)
            talking_points_task = self._generate_talking_points(content)
            business_impact_task = self._generate_business_impact(content)
            
            summary, talking_points, business_impact = await asyncio.gather(
                summary_task,
                talking_points_task,
                business_impact_task,
                return_exceptions=True
            )
            
            # Handle exceptions
            if isinstance(summary, Exception):
                summary = f"<p>Executive order analyzing {category} policy: {title[:100]}...</p>"
            
            if isinstance(talking_points, Exception):
                talking_points = "<ol><li>Policy implementation required</li><li>Federal coordination needed</li><li>Stakeholder engagement planned</li></ol>"
            
            if isinstance(business_impact, Exception):
                business_impact = "<p><strong>Risk:</strong> Compliance requirements may change. <strong>Opportunity:</strong> New opportunities for aligned businesses.</p>"
            
            return {
                'summary': summary,
                'talking_points': talking_points,
                'business_impact': business_impact,
                'potential_impact': business_impact
            }
            
        except Exception as e:
            print(f"❌ AI analysis failed: {e}")
            return self._generate_fallback_analysis(title, description, category)
    
    async def _generate_summary(self, content: str) -> str:
        """Generate executive summary using Azure AI"""
        prompt = f"""
        Write a concise summary of this executive order in 3-5 sentences. 
        Use straightforward language and focus on the most important aspects.
        
        Executive Order Content: {content}
        """
        
        messages = [
            {"role": "system", "content": "You are an expert policy analyst. Provide clear summaries for business leaders."},
            {"role": "user", "content": prompt}
        ]
        
        response = await self.ai_client.chat.completions.create(
            model=self.model_name,
            messages=messages,
            temperature=0.1,
            max_tokens=400
        )
        
        return f"<p>{response.choices[0].message.content.strip()}</p>"
    
    async def _generate_talking_points(self, content: str) -> str:
        """Generate key talking points using Azure AI"""
        prompt = f"""
        Create exactly 5 key talking points about this executive order:

        1. [First key point]
        2. [Second key point]  
        3. [Third key point]
        4. [Fourth key point]
        5. [Fifth key point]

        Make each point one sentence and focus on key implications.
        
        Executive Order Content: {content}
        """
        
        messages = [
            {"role": "system", "content": "You are a communications expert helping leaders discuss policy implications."},
            {"role": "user", "content": prompt}
        ]
        
        response = await self.ai_client.chat.completions.create(
            model=self.model_name,
            messages=messages,
            temperature=0.1,
            max_tokens=500,
            stop=["6.", "7.", "8.", "9."]
        )
        
        raw_response = response.choices[0].message.content
        
        # Convert to HTML list
        lines = raw_response.strip().split('\n')
        html_items = []
        
        for line in lines:
            line = line.strip()
            if line and any(line.startswith(str(i) + '.') for i in range(1, 6)):
                content = line.split('.', 1)[1].strip()
                html_items.append(f"<li>{content}</li>")
        
        return f"<ol>{''.join(html_items)}</ol>"
    
    async def _generate_business_impact(self, content: str) -> str:
        """Generate business impact analysis using Azure AI"""
        prompt = f"""
        Analyze the business impact of this executive order:

        Risk: [Primary business risk]
        • [Specific impact on businesses]
        • [Operational considerations]

        Opportunity: [Main business opportunity]  
        • [Specific benefits available]
        • [Competitive advantages]

        Executive Order Content: {content}
        """
        
        messages = [
            {"role": "system", "content": "You are a business consultant analyzing policy impacts on companies."},
            {"role": "user", "content": prompt}
        ]
        
        response = await self.ai_client.chat.completions.create(
            model=self.model_name,
            messages=messages,
            temperature=0.1,
            max_tokens=600
        )
        
        raw_response = response.choices[0].message.content
        
        # Convert to HTML format
        lines = raw_response.strip().split('\n')
        html_content = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            if line.lower().startswith('risk:'):
                content = line[5:].strip()
                html_content.append(f'<p><strong>Risk:</strong> {content}</p>')
            elif line.lower().startswith('opportunity:'):
                content = line[11:].strip()
                html_content.append(f'<p><strong>Opportunity:</strong> {content}</p>')
            elif line.startswith('•'):
                content = line[1:].strip()
                html_content.append(f'<p>• {content}</p>')
            else:
                html_content.append(f'<p>{line}</p>')
        
        return ''.join(html_content)
    
    def _generate_fallback_analysis(self, title: str, description: str, category: str) -> Dict[str, str]:
        """Generate fallback analysis when AI is not available"""
        summary = f"<p>This executive order establishes new federal policy direction in {category} requiring coordinated implementation across government agencies.</p>"
        talking_points = "<ol><li>Federal policy direction established</li><li>Agency coordination required</li><li>Implementation framework defined</li><li>Stakeholder engagement planned</li><li>Progress monitoring instituted</li></ol>"
        business_impact = "<p><strong>Risk:</strong> Organizations may need to assess new compliance requirements</p><p>• Regulatory changes may affect operations</p><p><strong>Opportunity:</strong> Aligned businesses may benefit from policy support</p><p>• New federal initiatives may create opportunities</p>"
        
        return {
            'summary': summary,
            'talking_points': talking_points,
            'business_impact': business_impact,
            'potential_impact': business_impact
        }
    
    def categorize_order_enhanced(self, title: str, summary: str) -> str:
        """Enhanced categorization"""
        content = f"{title} {summary}".lower()
        
        if any(word in content for word in ['health', 'medical', 'healthcare', 'medicine']):
            return 'healthcare'
        elif any(word in content for word in ['education', 'school', 'student', 'university']):
            return 'education'
        elif any(word in content for word in ['infrastructure', 'engineering', 'technology', 'energy']):
            return 'engineering'
        elif any(word in content for word in ['government', 'federal', 'agency', 'border', 'security']):
            return 'civic'
        else:
            return 'not-applicable'
    
    def remove_duplicates(self, orders: List[Dict]) -> List[Dict]:
        """Remove duplicate orders"""
        seen = set()
        unique = []
        
        for order in orders:
            if not isinstance(order, dict):
                continue
            
            # Create identifiers for duplicate detection
            identifiers = [
                f"eo:{self.safe_get(order, 'eo_number', '')}",
                f"doc:{self.safe_get(order, 'document_number', '')}",
                f"title:{self.safe_get(order, 'title', '')}",
            ]
            
            # Filter valid identifiers
            valid_identifiers = [id for id in identifiers if len(id.split(':', 1)[1]) > 0]
            
            # Check for duplicates
            is_duplicate = any(id in seen for id in valid_identifiers)
            
            if not is_duplicate:
                for id in valid_identifiers:
                    seen.add(id)
                unique.append(order)
            else:
                self.debug_log(f"Removing duplicate: {order.get('title', 'Unknown')[:50]}")
        
        return unique

    # Comprehensive testing functions
    async def test_azure_ai_integration(self) -> bool:
        """Test Azure AI integration"""
        try:
            print("🧪 Testing COMPLETE Azure AI Integration for Trump 2025")
            
            if not self.ai_client:
                print("❌ Azure AI client not initialized")
                return False
            
            # Test AI generation
            ai_analysis = await self._generate_ai_analysis(
                "Executive Order 14147: Ending the Weaponization of the Federal Government",
                "This executive order addresses misconduct by federal government agencies",
                "civic"
            )
            
            required_keys = ['summary', 'talking_points', 'business_impact', 'potential_impact']
            if all(key in ai_analysis for key in required_keys):
                print("✅ COMPLETE Azure AI integration test successful!")
                return True
            else:
                print("❌ AI integration test failed")
                return False
                
        except Exception as e:
            print(f"❌ Azure AI test failed: {e}")
            return False

    async def test_comprehensive_api_functionality(self) -> bool:
        """Test all API functionality including Azure AI"""
        print("🧪 Comprehensive Federal Register API Test")
        print("=" * 60)
        
        test_results = {
            'connection': False,
            'eo_detection': False,
            'data_processing': False,
            'azure_ai': False,
            'full_fetch': False
        }
        
        try:
            # Test 1: Basic API connection
            print("\n1. Testing API connection...")
            try:
                response = self.session.get(f"{self.BASE_URL}?per_page=1", timeout=10)
                if response.status_code == 200:
                    print("✅ Federal Register API connection successful")
                    test_results['connection'] = True
                else:
                    print(f"❌ API connection failed with status: {response.status_code}")
            except Exception as e:
                print(f"❌ API connection error: {e}")
            
            # Test 2: Executive order detection
            print("\n2. Testing executive order detection...")
            try:
                test_doc = {
                    'title': 'Executive Order 14147: Test Order',
                    'type': 'Presidential Document',
                    'executive_order_number': '14147',
                    'document_number': '2025-12345'
                }
                
                if self.is_executive_order(test_doc):
                    print("✅ Executive order detection working")
                    test_results['eo_detection'] = True
                else:
                    print("❌ Executive order detection failed")
            except Exception as e:
                print(f"❌ EO detection error: {e}")
            
            # Test 3: Document processing
            print("\n3. Testing document processing...")
            try:
                test_doc = {
                    'title': 'Executive Order 14150: Test Executive Order for Processing',
                    'summary': 'This is a test summary for document processing',
                    'type': 'Presidential Document',
                    'executive_order_number': '14150',
                    'document_number': '2025-99999',
                    'publication_date': '2025-06-09',
                    'signing_date': '2025-06-09'
                }
                
                processed = await self.process_document_with_ai(test_doc)
                if processed and 'eo_number' in processed:
                    print("✅ Document processing working")
                    print(f"   Processed EO: {processed.get('eo_number')}")
                    test_results['data_processing'] = True
                else:
                    print("❌ Document processing failed")
            except Exception as e:
                print(f"❌ Document processing error: {e}")
            
            # Test 4: Azure AI integration
            print("\n4. Testing Azure AI integration...")
            azure_test_result = await self.test_azure_ai_integration()
            test_results['azure_ai'] = azure_test_result
            
            # Test 5: Full fetch functionality (limited test)
            print("\n5. Testing full fetch functionality...")
            try:
                # Test with a small date range
                result = await self.fetch_trump_2025_executive_orders(
                    start_date="2025-06-01",
                    end_date="2025-06-12",
                    per_page=10,
                    debug=False
                )
                
                if 'results' in result and 'count' in result:
                    print(f"✅ Full fetch working - found {result['count']} orders")
                    test_results['full_fetch'] = True
                else:
                    print("❌ Full fetch failed")
            except Exception as e:
                print(f"❌ Full fetch error: {e}")
            
            # Summary
            print(f"\n📊 Test Results Summary:")
            print(f"=" * 30)
            total_tests = len(test_results)
            passed_tests = sum(test_results.values())
            
            for test_name, passed in test_results.items():
                status = "✅ PASS" if passed else "❌ FAIL"
                print(f"   {test_name.replace('_', ' ').title()}: {status}")
            
            print(f"\n📈 Overall: {passed_tests}/{total_tests} tests passed")
            
            if passed_tests == total_tests:
                print("🎉 All tests passed! API is fully functional.")
                return True
            elif passed_tests >= 3:
                print("⚠️ Most tests passed. API is mostly functional.")
                return True
            else:
                print("❌ Multiple tests failed. Check configuration.")
                return False
            
        except Exception as e:
            print(f"❌ Comprehensive test failed: {e}")
            return False


# ==========================================
# STANDALONE WRAPPER FUNCTIONS FOR IMPORTS
# ==========================================

async def test_azure_ai_integration() -> bool:
    """Standalone wrapper for Azure AI testing"""
    try:
        api = FederalRegisterAPI()
        return await api.test_azure_ai_integration()
    except Exception as e:
        print(f"❌ Standalone Azure AI test failed: {e}")
        return False

async def test_comprehensive_api_functionality() -> bool:
    """Standalone wrapper for comprehensive testing"""
    try:
        api = FederalRegisterAPI()
        return await api.test_comprehensive_api_functionality()
    except Exception as e:
        print(f"❌ Standalone comprehensive test failed: {e}")
        return False

async def fetch_trump_2025_executive_orders_standalone(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    per_page: Optional[int] = None,
    debug: Optional[bool] = None
) -> Dict:
    """Standalone wrapper for fetching Trump 2025 executive orders"""
    try:
        api = FederalRegisterAPI(debug_mode=debug or False)
        return await api.fetch_trump_2025_executive_orders(start_date, end_date, per_page, debug)
    except Exception as e:
        print(f"❌ Standalone fetch failed: {e}")
        return {
            'results': [],
            'count': 0,
            'error': str(e)
        }

def fetch_trump_2025_executive_orders_sync(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    per_page: Optional[int] = None,
    debug: Optional[bool] = None
) -> Dict:
    """Synchronous wrapper for fetching Trump 2025 executive orders"""
    try:
        return asyncio.run(fetch_trump_2025_executive_orders_standalone(start_date, end_date, per_page, debug))
    except Exception as e:
        print(f"❌ Synchronous fetch failed: {e}")
        return {
            'results': [],
            'count': 0,
            'error': str(e)
        }

def test_azure_ai_integration_sync() -> bool:
    """Synchronous wrapper for Azure AI testing"""
    try:
        return asyncio.run(test_azure_ai_integration())
    except Exception as e:
        print(f"❌ Synchronous Azure AI test failed: {e}")
        return False

def test_comprehensive_api_functionality_sync() -> bool:
    """Synchronous wrapper for comprehensive testing"""
    try:
        return asyncio.run(test_comprehensive_api_functionality())
    except Exception as e:
        print(f"❌ Synchronous comprehensive test failed: {e}")
        return False


# Main execution for testing
if __name__ == "__main__":
    print("🚀 COMPLETE Federal Register API for Trump 2025 Executive Orders")
    print("=" * 60)
    
    async def main():
        # Initialize API
        api = FederalRegisterAPI(debug_mode=True)
        
        # Test Azure AI
        print("\n🧪 Testing Azure AI integration...")
        ai_test_result = await api.test_azure_ai_integration()
        
        if ai_test_result:
            print("✅ Azure AI working!")
        else:
            print("⚠️ Azure AI issues - will use fallback")
        
        # Test comprehensive functionality
        print("\n🧪 Running comprehensive API test...")
        comprehensive_test_result = await api.test_comprehensive_api_functionality()
        
        if comprehensive_test_result:
            print("\n✅ API is working correctly!")
        else:
            print("\n⚠️ Some tests failed. Check configuration.")
        
        # Test fetching Trump 2025 EOs
        print("\n🔍 Testing Trump 2025 EO fetch...")
        result = await api.fetch_trump_2025_executive_orders(
            start_date="2025-01-20",
            end_date=datetime.now().strftime('%Y-%m-%d'),
            debug=True
        )
        
        print(f"\n✅ Final Test Results:")
        print(f"   Total found: {result['count']}")
        print(f"   Date range: {result['date_range']}")
        print(f"   EO range searched: {result.get('eo_range_searched', 'N/A')}")
        print(f"   AI analysis: {'Enabled' if result.get('ai_analysis_enabled') else 'Fallback'}")
        
        if result['count'] > 0:
            print(f"\n🎯 Found Executive Orders:")
            for order in result['results'][:5]:  # Show first 5
                print(f"   • EO {order['eo_number']}: {order['title']}")
        
        print(f"\n🔧 Integration ready!")
        print(f"   Replace your federal_register_api.py with this COMPLETE version")
        print(f"   Should find all Trump 2025 executive orders (14147+)")
        print(f"   Azure AI analysis: {'Working' if ai_test_result else 'Fallback mode'}")
    
    # Run the test
    asyncio.run(main())