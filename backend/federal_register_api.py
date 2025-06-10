# federal_register_api.py - Enhanced with Improved Filtering and Azure AI Integration
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
    """Enhanced Federal Register API with improved filtering and Azure AI integration"""
    
    BASE_URL = "https://www.federalregister.gov/api/v1/documents"
    TRUMP_2025_URL = "https://www.federalregister.gov/presidential-documents/executive-orders/donald-trump/2025"
    
    def __init__(self, debug_mode: bool = False):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'LegislationVue/7.0 Production with Azure AI',
            'Accept': 'application/json'
        })
        self.debug_mode = debug_mode
        
        # Azure AI configuration - load from .env file
        self.azure_endpoint = os.getenv("AZURE_ENDPOINT")
        self.azure_key = os.getenv("AZURE_KEY")
        self.model_name = os.getenv("AZURE_MODEL_NAME", "summarize-gpt-4.1")
        
        # Validate required Azure configuration
        if not self.azure_endpoint:
            print("⚠️ AZURE_ENDPOINT not found in .env file")
        if not self.azure_key:
            print("⚠️ AZURE_KEY not found in .env file")
        
        self.debug_log(f"Azure endpoint loaded: {self.azure_endpoint[:50] + '...' if self.azure_endpoint else 'None'}")
        self.debug_log(f"Azure model: {self.model_name}")
        self.debug_log(f"Azure key configured: {'Yes' if self.azure_key else 'No'}")
        
        # Initialize Azure AI client
        self.ai_client = None
        self._setup_azure_ai()
        
        print("✅ Federal Register API initialized with enhanced filtering and Azure AI integration")
        if self.debug_mode:
            print("🐛 Debug mode enabled - will show detailed filtering information")
    
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
    
    def is_executive_order(self, document: Dict) -> bool:
        """Enhanced executive order detection with EXPANDED validation range"""
        try:
            title = self.safe_lower(self.safe_get(document, 'title', ''))
            doc_type = self.safe_get(document, 'type', '')
            eo_number = self.safe_get(document, 'executive_order_number', '')
            document_number = self.safe_get(document, 'document_number', '')
            
            self.debug_log(f"Analyzing: {title[:60]}...")
            
            # Must be a Presidential Document
            if doc_type != 'Presidential Document':
                self.debug_log("❌ Not a Presidential Document")
                return False
            
            # FIXED: Expanded range for 2025 Trump EOs
            if eo_number:
                try:
                    eo_int = int(str(eo_number).strip())
                    # EXPANDED: Much broader range to catch all 2025 EOs
                    if 14000 <= eo_int <= 15000:  # EXPANDED from 14147-14400
                        self.debug_log(f"✅ Valid EO number field: {eo_number}")
                        return True
                    else:
                        self.debug_log(f"❌ EO number {eo_number} outside expanded range")
                        return False
                except:
                    pass
            
            # Look for EO numbers in document text (EXPANDED range)
            eo_patterns = [
                r'executive\s+order\s+(?:no\.?\s+)?(14\d{3}|15\d{3})',  # 14XXX or 15XXX
                r'eo\s+(?:no\.?\s+)?(14\d{3}|15\d{3})',                # EO 14XXX/15XXX
                r'\b(14\d{3}|15\d{3})\b',                              # Standalone 14XXX/15XXX
            ]
            
            full_text = f"{title} {document_number}"
            for pattern in eo_patterns:
                match = re.search(pattern, full_text, re.IGNORECASE)
                if match:
                    eo_num = match.group(1) if match.groups() else match.group(0)
                    try:
                        eo_int = int(eo_num)
                        # EXPANDED: Much broader range
                        if 14000 <= eo_int <= 15000:
                            self.debug_log(f"✅ Found valid EO {eo_num} in text")
                            return True
                    except:
                        pass
            
            # Must explicitly mention "executive order" to proceed
            if 'executive order' not in title:
                self.debug_log("❌ Does not mention 'executive order'")
                return False
            
            # Additional validation for known Trump 2025 EO patterns
            trump_eo_indicators = [
                'rescissions',
                'protecting the american people',
                'securing the border',
                'restoring',
                'ending',
                'unleashing',
                'america first',
                'department of government efficiency',
                'withdrawal from',
                'revocation of',
                'eliminating',
                'promoting',
                'strengthening',
                'clarifying',
                'establishing'
            ]
            
            for indicator in trump_eo_indicators:
                if indicator in title:
                    self.debug_log(f"✅ Trump EO pattern: '{indicator}'")
                    return True
            
            self.debug_log("❌ Not identified as valid executive order")
            return False
            
        except Exception as e:
            self.debug_log(f"❌ Error in EO detection: {e}")
            return False
    
    def is_actual_executive_order(self, document: Dict, eo_number: int) -> bool:
        """Verify this is the actual executive order document, not a notice about it"""
        try:
            title = self.safe_lower(self.safe_get(document, 'title', ''))
            doc_type = self.safe_get(document, 'type', '')
            
            # Must be Presidential Document
            if doc_type != 'Presidential Document':
                return False
            
            # Should contain the EO number
            if str(eo_number) not in f"{title} {self.safe_get(document, 'document_number', '')}":
                return False
            
            # Should not be a notice or correction
            exclusion_terms = ['notice', 'correction', 'erratum', 'amendment']
            if any(term in title for term in exclusion_terms):
                return False
            
            return True
            
        except Exception:
            return False
    
    def extract_eo_number_enhanced(self, title: str, document_number: str, raw_doc: Dict) -> str:
        """Enhanced EO number extraction with EXPANDED 2025 range"""
        try:
            # Check all possible fields for EO numbers
            sources = [
                self.safe_get(raw_doc, 'executive_order_number', ''),
                title,
                document_number,
                self.safe_get(raw_doc, 'citation', ''),
                self.safe_get(raw_doc, 'presidential_document_type', ''),
                self.safe_get(raw_doc, 'html_url', ''),
                self.safe_get(raw_doc, 'abstract', ''),
            ]
            
            # EXPANDED: 2025 Trump EO patterns (14000-15000 range)
            patterns = [
                r'(?:executive\s+order\s+(?:no\.?\s+)?)(14\d{3}|15\d{3})',  # Executive Order 14XXX/15XXX
                r'(?:eo\s+(?:no\.?\s+)?)(14\d{3}|15\d{3})',                # EO 14XXX/15XXX
                r'(?:e\.o\.\s*)(14\d{3}|15\d{3})',                         # E.O. 14XXX/15XXX
                r'(?:order\s+(?:no\.?\s+)?)(14\d{3}|15\d{3})',            # Order 14XXX/15XXX
                r'executive-order-(14\d{3}|15\d{3})',                      # URL format
                r'/(14\d{3}|15\d{3})/',                                    # URL number
                r'\b(14\d{3}|15\d{3})\b',                                 # Standalone 14xxx/15xxx
            ]
            
            for source in sources:
                if not source:
                    continue
                    
                source_clean = str(source).strip()
                
                for pattern in patterns:
                    matches = re.findall(pattern, source_clean, re.IGNORECASE)
                    for match in matches:
                        number = str(match).strip()
                        if len(number) == 5 and number.isdigit():
                            # EXPANDED: Validate it's in expanded 2025 range
                            try:
                                num_int = int(number)
                                if 14000 <= num_int <= 15000:  # EXPANDED RANGE
                                    self.debug_log(f"✅ Found valid 2025 EO: {number}")
                                    return number
                            except:
                                pass
            
            # If no valid EO number found, this might not be an EO
            self.debug_log("❌ No valid 2025 EO number found in expanded range")
            return ""  # Return empty instead of generating fake numbers
                    
        except Exception as e:
            self.debug_log(f"Error extracting EO number: {e}")
            return ""
    
    def fetch_with_multiple_strategies(self, start_date: str, end_date: str, per_page: int) -> List[Dict]:
        """Enhanced search strategies"""
        all_results = []
        
        # Strategy 1: All Presidential Documents
        print("📋 Strategy 1: All Presidential Documents...")
        try:
            params1 = {
                'conditions[type]': 'Presidential Document',
                'conditions[publication_date][gte]': start_date,
                'conditions[publication_date][lte]': end_date,
                'per_page': per_page,
                'order': 'newest'
            }
            response1 = self.session.get(self.BASE_URL, params=params1, timeout=30)
            if response1.status_code == 200:
                data1 = response1.json()
                results1 = data1.get('results', [])
                print(f"   Found {len(results1)} presidential documents")
                all_results.extend(results1)
            else:
                print(f"   Strategy 1 failed with status: {response1.status_code}")
        except Exception as e:
            print(f"   Strategy 1 failed: {e}")
        
        # Strategy 2: Search for "executive order"
        print("📋 Strategy 2: Documents mentioning 'executive order'...")
        try:
            params2 = {
                'conditions[term]': 'executive order',
                'conditions[publication_date][gte]': start_date,
                'conditions[publication_date][lte]': end_date,
                'per_page': min(per_page // 2, 500),
                'order': 'newest'
            }
            response2 = self.session.get(self.BASE_URL, params=params2, timeout=30)
            if response2.status_code == 200:
                data2 = response2.json()
                results2 = data2.get('results', [])
                filtered_results2 = [doc for doc in results2 
                                   if self.safe_get(doc, 'type', '') == 'Presidential Document']
                print(f"   Found {len(results2)} total, {len(filtered_results2)} presidential documents")
                all_results.extend(filtered_results2)
            else:
                print(f"   Strategy 2 failed with status: {response2.status_code}")
        except Exception as e:
            print(f"   Strategy 2 failed: {e}")
        
        # Strategy 3: Trump policy terms
        print("📋 Strategy 3: Trump administration policy terms...")
        try:
            trump_policy_terms = ['restoring', 'securing', 'protecting', 'ending', 'unleashing']
            for term in trump_policy_terms:
                params3 = {
                    'conditions[term]': term,
                    'conditions[type]': 'Presidential Document',
                    'conditions[publication_date][gte]': start_date,
                    'conditions[publication_date][lte]': end_date,
                    'per_page': min(per_page // len(trump_policy_terms), 100),
                    'order': 'newest'
                }
                response3 = self.session.get(self.BASE_URL, params=params3, timeout=30)
                if response3.status_code == 200:
                    data3 = response3.json()
                    results3 = data3.get('results', [])
                    print(f"   '{term}': {len(results3)} documents")
                    all_results.extend(results3)
                time.sleep(0.1)  # Be nice to the API
        except Exception as e:
            print(f"   Strategy 3 failed: {e}")
        
        print(f"📊 Total raw documents from strategies: {len(all_results)}")
        return all_results
    
    async def fetch_trump_2025_executive_orders(self,
                                        start_date: Optional[str] = None,
                                        end_date: Optional[str] = None,
                                        per_page: Optional[int] = None,
                                        debug: Optional[bool] = None) -> Dict:
        """Enhanced fetch with EO number-based search and improved filtering"""
        
        if not start_date:
            start_date = "2025-01-01"  # EXPANDED: Start from beginning of year
        
        if not end_date:
            end_date = datetime.now().strftime('%Y-%m-%d')
        
        if per_page is None:
            per_page = self.calculate_optimal_per_page(start_date, end_date)
        
        # Enable debug mode if requested
        if debug is not None:
            original_debug = self.debug_mode
            self.debug_mode = debug
        
        print(f"🚀 ENHANCED: Fetching Trump 2025 executive orders")
        print(f"📅 Date range: {start_date} to {end_date}")
        print(f"🔧 Using EO number-based search to overcome API publication delays")
        print(f"🤖 Azure AI Analysis: {'Enabled' if self.ai_client else 'Fallback Mode'}")
        
        all_orders = []
        found_eo_numbers = set()
        
        # Strategy 1: Search by EO numbers (most effective for recent EOs)
        print(f"\n📋 Strategy 1: EO number-based search...")
        try:
            # FIXED: Dramatically expanded range to catch all 2025 EOs
            # Original was too narrow: range(14146, 14350) - only 204 numbers
            # New range covers all possible 2025 Trump EOs: 14000-15000
            for eo_num in range(14000, 15000):  # MUCH BROADER RANGE
                
                # Search patterns for this EO number
                search_patterns = [
                    str(eo_num),              # "14146"
                    f"EO {eo_num}",           # "EO 14146"
                    f"Executive Order {eo_num}", # "Executive Order 14146"
                    f"E.O. {eo_num}",         # "E.O. 14146"
                    f"Order {eo_num}",        # "Order 14146"
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
                                if self.is_actual_executive_order(doc, eo_num):
                                    processed = await self.process_document_with_ai(doc)
                                    if processed:
                                        all_orders.append(processed)
                                        found_eo_numbers.add(eo_num)
                                        print(f"   ✅ Found EO {eo_num}: {processed.get('title', '')[:60]}...")
                                        break  # Found it, move to next EO
                        
                        # Small delay to be nice to the API
                        time.sleep(0.02)  # Reduced delay for faster searching
                        
                    except Exception as e:
                        self.debug_log(f"Error searching for EO {eo_num}: {e}")
            
            print(f"   Found {len(found_eo_numbers)} EOs via number search")
            
        except Exception as e:
            print(f"   ❌ EO number search failed: {e}")
        
        # Strategy 2: Original document-based search (for any we missed)
        print(f"\n📋 Strategy 2: Document-based search...")
        try:
            doc_based_results = self.fetch_with_multiple_strategies(start_date, end_date, per_page)
            doc_based_count = 0
            
            for doc in doc_based_results:
                if self.is_executive_order(doc):
                    # Check if we already have this EO
                    eo_num = self.extract_eo_number_enhanced(
                        self.safe_get(doc, 'title', ''),
                        self.safe_get(doc, 'document_number', ''),
                        doc
                    )
                    
                    if eo_num:  # Only process if we found a valid EO number
                        try:
                            eo_num_int = int(eo_num)
                            if eo_num_int not in found_eo_numbers:
                                processed = await self.process_document_with_ai(doc)
                                if processed:
                                    all_orders.append(processed)
                                    found_eo_numbers.add(eo_num_int)
                                    doc_based_count += 1
                                    print(f"   ✅ Additional EO {eo_num}: {processed.get('title', '')[:60]}...")
                        except ValueError:
                            pass  # Skip if EO number isn't valid
            
            print(f"   Found {doc_based_count} additional EOs via document search")
            
        except Exception as e:
            print(f"   ❌ Document-based search failed: {e}")
        
        # Strategy 3: Comprehensive term-based search
        print("📋 Strategy 3: Comprehensive term-based search...")
        try:
            comprehensive_terms = [
                'presidential documents',
                'trump',
                'biden transition',  # Include transition period
                'executive action',
                'presidential memorandum',
                'proclamation',
                'administrative order',
                'federal agencies',
                'department of',
                'revoke',
                'establish',
                'directing',
                'implementing'
            ]
            
            comprehensive_count = 0
            for term in comprehensive_terms:
                try:
                    params4 = {
                        'conditions[term]': term,
                        'conditions[type]': 'Presidential Document',
                        'conditions[publication_date][gte]': "2025-01-01",  # Broader date range
                        'conditions[publication_date][lte]': end_date,
                        'per_page': 100,
                        'order': 'newest'
                    }
                    response4 = self.session.get(self.BASE_URL, params=params4, timeout=30)
                    if response4.status_code == 200:
                        data4 = response4.json()
                        results4 = data4.get('results', [])
                        
                        for doc in results4:
                            if self.is_executive_order(doc):
                                eo_num = self.extract_eo_number_enhanced(
                                    self.safe_get(doc, 'title', ''),
                                    self.safe_get(doc, 'document_number', ''),
                                    doc
                                )
                                
                                if eo_num:
                                    try:
                                        eo_num_int = int(eo_num)
                                        if eo_num_int not in found_eo_numbers:
                                            processed = await self.process_document_with_ai(doc)
                                            if processed:
                                                all_orders.append(processed)
                                                found_eo_numbers.add(eo_num_int)
                                                comprehensive_count += 1
                                                print(f"   ✅ Comprehensive search found EO {eo_num}: {processed.get('title', '')[:60]}...")
                                    except ValueError:
                                        pass
                        
                        print(f"   '{term}': {len(results4)} documents checked")
                    
                    time.sleep(0.1)  # Be nice to the API
                except Exception as e:
                    print(f"   Error with term '{term}': {e}")
            
            print(f"   Found {comprehensive_count} additional EOs via comprehensive search")
                    
        except Exception as e:
            print(f"   ❌ Comprehensive search failed: {e}")
        
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
        
        print(f"\n✅ Final Results:")
        print(f"   Total found: {len(unique_orders)}")
        
        return {
            'results': unique_orders,
            'count': len(unique_orders),
            'date_range': f"{start_date} to {end_date}",
            'trump_2025_url': self.TRUMP_2025_URL,
            'source': 'Federal Register API v1 - Enhanced with EO Number Search',
            'timestamp': datetime.now().isoformat(),
            'strategies_used': 3,
            'total_eo_numbers_searched': len(range(14000, 15000)),
            'found_via_number_search': len(found_eo_numbers),
            'ai_analysis_enabled': self.ai_client is not None,
        }
    
    def calculate_optimal_per_page(self, start_date: str, end_date: str, max_per_page: int = 1000) -> int:
        """Calculate optimal per_page based on date range"""
        try:
            start_dt = datetime.strptime(start_date, '%Y-%m-%d')
            end_dt = datetime.strptime(end_date, '%Y-%m-%d')
            days_diff = (end_dt - start_dt).days
            
            # Estimate orders per day
            if days_diff <= 7:
                estimated_orders = days_diff * 2
            elif days_diff <= 30:
                estimated_orders = days_diff * 1.5
            elif days_diff <= 90:
                estimated_orders = days_diff * 1
            else:
                estimated_orders = days_diff * 0.5
            
            optimal_per_page = min(max(int(estimated_orders * 2), 50), max_per_page)
            
            self.debug_log(f"Date range: {days_diff} days, estimated orders: {int(estimated_orders)}, fetching: {optimal_per_page}")
            return optimal_per_page
            
        except Exception as e:
            self.debug_log(f"Error calculating optimal per_page: {e}")
            return 100
    
    async def process_document_with_ai(self, raw_doc: Dict) -> Optional[Dict]:
        """Process document with proper EO number and date formatting"""
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
            presidential_document_type = self.safe_get(raw_doc, 'presidential_document_type', '')
            
            # Extract EO number with validation
            eo_number = executive_order_number or self.extract_eo_number_enhanced(title, document_number, raw_doc)
            
            # Skip if no valid EO number found
            if not eo_number:
                self.debug_log("❌ Skipping - no valid EO number")
                return None
            
            # Validate EO number is in correct range
            try:
                eo_int = int(eo_number)
                # EXPANDED: Much broader range for 2025 Trump EOs
                if not (14000 <= eo_int <= 15000):  # EXPANDED from 14147-14400
                    self.debug_log(f"❌ Skipping - EO {eo_number} outside expanded valid range")
                    return None
            except:
                self.debug_log(f"❌ Skipping - invalid EO number format: {eo_number}")
                return None
            
            # Use best available date
            if not signing_date and publication_date:
                signing_date = publication_date
            if not publication_date and signing_date:
                publication_date = signing_date
            
            # Skip if no valid dates
            if not signing_date and not publication_date:
                self.debug_log("❌ Skipping - no valid dates")
                return None
            
            # Use best available summary for AI analysis
            ai_input_text = summary or abstract or title
            if not ai_input_text:
                ai_input_text = f"Executive order titled: {title}"
            
            # Enhanced categorization
            category = self.categorize_order_enhanced(title, ai_input_text, presidential_document_type)
            
            # Generate AI analysis
            self.debug_log(f"Generating AI analysis for EO {eo_number}...")
            ai_analysis = await self._generate_ai_analysis(title, ai_input_text, category)
            
            # Format publication date for display
            formatted_pub_date = ""
            if publication_date:
                try:
                    date_obj = datetime.strptime(publication_date[:10], '%Y-%m-%d')
                    formatted_pub_date = date_obj.strftime('%m/%d/%Y')
                except:
                    formatted_pub_date = publication_date
            
            # Format signing date for display
            formatted_signing_date = ""
            if signing_date:
                try:
                    date_obj = datetime.strptime(signing_date[:10], '%Y-%m-%d')
                    formatted_signing_date = date_obj.strftime('%m/%d/%Y')
                except:
                    formatted_signing_date = signing_date
            
            # Build order object with proper formatting
            processed_order = {
                'document_number': document_number or f"FR-EO-{eo_number}",
                'eo_number': eo_number,
                'executive_order_number': eo_number,
                'title': title,
                'summary': summary,
                'abstract': abstract,
                'signing_date': signing_date,
                'publication_date': publication_date,
                'formatted_publication_date': formatted_pub_date,  # For UI display
                'formatted_signing_date': formatted_signing_date,  # For UI display
                'citation': citation,
                'presidential_document_type': presidential_document_type,
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
                'ai_version': 'azure_openai_federal_register_v1.0',
                
                # Metadata
                'source': 'Federal Register API v1 with Azure AI',
                'raw_data_available': bool(raw_doc),
                'created_at': datetime.now().isoformat(),
                'last_updated': datetime.now().isoformat()
            }
            
            self.debug_log(f"✅ Successfully processed EO {eo_number}")
            return processed_order
            
        except Exception as e:
            self.debug_log(f"❌ Error processing document: {e}")
            return None
    
    async def _generate_ai_analysis(self, title: str, description: str, category: str) -> Dict[str, str]:
        """Generate dynamic AI analysis using Azure OpenAI"""
        if not self.ai_client:
            print("⚠️ Azure AI not available, using fallback analysis")
            return self._generate_fallback_analysis(title, description, category)
        
        try:
            content = f"Title: {title}\n"
            if description:
                content += f"Description: {description}\n"
            content += f"Category: {category}"
            
            if len(content) > 4000:
                content = content[:4000] + "..."
            
            print(f"🤖 Generating AI analysis for: {title[:50]}...")
            
            # Generate all analyses concurrently
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
                'potential_impact': business_impact
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
                else:
                    self.debug_log(f"Removing duplicate: {order.get('title', 'Unknown')[:50]}")
            
            return unique
            
        except Exception:
            return orders if isinstance(orders, list) else []

    # NEW: Azure AI Test Function
    async def test_azure_ai_integration(self) -> bool:
        """Test Azure AI integration with a sample executive order"""
        print("🧪 Testing Azure AI Integration")
        print("=" * 50)
        
        try:
            # Test 1: Check AI client initialization
            print("\n1. Testing AI client initialization...")
            if not self.ai_client:
                print("❌ Azure AI client not initialized")
                return False
            print("✅ Azure AI client initialized successfully")
            
            # Test 2: Test summary generation
            print("\n2. Testing summary generation...")
            test_content = """
            Title: Protecting the American People From Foreign Adversary Controlled Applications Act
            Description: This executive order addresses national security concerns related to applications controlled by foreign adversaries and implements protective measures for American users.
            Category: civic
            """
            
            try:
                summary = await self._generate_summary(test_content)
                if summary and len(summary) > 20:
                    print("✅ Summary generation working")
                    print(f"   Sample: {summary[:100]}...")
                else:
                    print("❌ Summary generation failed")
                    return False
            except Exception as e:
                print(f"❌ Summary generation error: {e}")
                return False
            
            # Test 3: Test talking points generation
            print("\n3. Testing talking points generation...")
            try:
                talking_points = await self._generate_talking_points(test_content)
                if talking_points and "<ol>" in talking_points:
                    print("✅ Talking points generation working")
                    print(f"   Sample: {talking_points[:100]}...")
                else:
                    print("❌ Talking points generation failed")
                    return False
            except Exception as e:
                print(f"❌ Talking points generation error: {e}")
                return False
            
            # Test 4: Test business impact generation
            print("\n4. Testing business impact generation...")
            try:
                business_impact = await self._generate_business_impact(test_content)
                if business_impact and len(business_impact) > 20:
                    print("✅ Business impact generation working")
                    print(f"   Sample: {business_impact[:100]}...")
                else:
                    print("❌ Business impact generation failed")
                    return False
            except Exception as e:
                print(f"❌ Business impact generation error: {e}")
                return False
            
            # Test 5: Test full AI analysis
            print("\n5. Testing full AI analysis integration...")
            try:
                full_analysis = await self._generate_ai_analysis(
                    "Test Executive Order",
                    "This is a test executive order for Azure AI integration testing",
                    "civic"
                )
                
                required_keys = ['summary', 'talking_points', 'business_impact', 'potential_impact']
                if all(key in full_analysis for key in required_keys):
                    print("✅ Full AI analysis integration working")
                    print(f"   Generated {len(full_analysis)} analysis components")
                else:
                    print("❌ Full AI analysis integration failed")
                    return False
            except Exception as e:
                print(f"❌ Full AI analysis error: {e}")
                return False
            
            print("\n✅ All Azure AI tests passed!")
            print(f"   Azure Endpoint: {self.azure_endpoint[:50]}...")
            print(f"   Model: {self.model_name}")
            print(f"   API Key: {'✅ Configured' if self.azure_key else '❌ Missing'}")
            
            return True
            
        except Exception as e:
            print(f"❌ Azure AI test failed: {e}")
            return False

    # NEW: Comprehensive API Test Function
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
                    'title': 'Executive Order 14150: Test Order',
                    'type': 'Presidential Document',
                    'executive_order_number': '14150',
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
                    'title': 'Executive Order 14200: Test Executive Order for Processing',
                    'summary': 'This is a test summary for document processing',
                    'type': 'Presidential Document',
                    'executive_order_number': '14200',
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
                    end_date="2025-06-09",
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


# Test function to verify enhanced filtering
async def test_enhanced_filtering():
    """Test the enhanced filtering with debug output"""
    print("🧪 Testing Enhanced Federal Register API Filtering")
    print("=" * 60)
    
    try:
        # Initialize API with debug mode
        api = FederalRegisterAPI(debug_mode=True)
        
        print(f"🔍 Testing enhanced filtering for recent executive orders...")
        
        # Fetch with debug enabled
        result = await api.fetch_trump_2025_executive_orders(
            start_date="2025-01-20",
            end_date=datetime.now().strftime('%Y-%m-%d'),
            per_page=500,
            debug=True
        )
        
        print(f"\n✅ Enhanced Filtering Test Results:")
        print(f"   Total EO Numbers Searched: {result.get('total_eo_numbers_searched', 0)}")
        print(f"   Found via Number Search: {result.get('found_via_number_search', 0)}")
        print(f"   Final Count: {result.get('count', 0)}")
        
        # Show found orders
        orders = result.get('results', [])
        if orders:
            print(f"\n🎯 Found Executive Orders:")
            for i, order in enumerate(orders, 1):
                print(f"   {i}. EO {order.get('eo_number')}: {order.get('title', 'No title')}")
                print(f"      Category: {order.get('category', 'Unknown')}")
                print(f"      Date: {order.get('signing_date', 'Unknown')}")
                print()
        else:
            print(f"\n⚠️ No executive orders found")
        
        return len(orders) > 0
        
    except Exception as e:
        print(f"❌ Enhanced filtering test failed: {e}")
        return False


# ==========================================
# STANDALONE WRAPPER FUNCTIONS FOR IMPORTS
# ==========================================

async def test_azure_ai_integration() -> bool:
    """Standalone wrapper for Azure AI testing"""
    try:
        api = FederalRegisterAPI(debug_mode=False)
        return await api.test_azure_ai_integration()
    except Exception as e:
        print(f"❌ Standalone Azure AI test failed: {e}")
        return False

async def test_comprehensive_api_functionality() -> bool:
    """Standalone wrapper for comprehensive testing"""
    try:
        api = FederalRegisterAPI(debug_mode=False)
        return await api.test_comprehensive_api_functionality()
    except Exception as e:
        print(f"❌ Standalone comprehensive test failed: {e}")
        return False

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

async def fetch_trump_2025_executive_orders_standalone(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    per_page: Optional[int] = None,
    debug: Optional[bool] = None
) -> Dict:
    """Standalone wrapper for fetching executive orders"""
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
    """Synchronous wrapper for fetching executive orders"""
    try:
        return asyncio.run(fetch_trump_2025_executive_orders_standalone(start_date, end_date, per_page, debug))
    except Exception as e:
        print(f"❌ Synchronous fetch failed: {e}")
        return {
            'results': [],
            'count': 0,
            'error': str(e)
        }


# Main execution for testing
if __name__ == "__main__":
    print("🚀 Enhanced Federal Register API with Azure AI Integration")
    print("=" * 60)
    
    # Run async test
    async def main():
        # Initialize API
        api = FederalRegisterAPI(debug_mode=False)
        
        # Run comprehensive test
        print("\n🧪 Running comprehensive API test...")
        comprehensive_test_result = await api.test_comprehensive_api_functionality()
        
        if comprehensive_test_result:
            print("\n✅ API is working correctly!")
            print("\n🔧 Integration ready:")
            print("1. Replace your existing FederalRegisterAPI class with this enhanced version")
            print("2. Azure AI integration is working and will generate dynamic content")
            print("3. Enhanced filtering should find more executive orders")
            print("4. Use test_azure_ai_integration() to verify AI functionality")
        else:
            print("\n⚠️ Some tests failed. Check configuration:")
            print("1. Verify .env file has AZURE_ENDPOINT, AZURE_KEY, AZURE_MODEL_NAME")
            print("2. Check internet connection for Federal Register API")
            print("3. Ensure OpenAI library is installed: pip install openai")
            print("4. Review error messages above for specific issues")
    
    # Run the test
    asyncio.run(main())