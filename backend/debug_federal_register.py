# debug_federal_register.py - Comprehensive debugging tool
import requests
import json
from datetime import datetime
from typing import List, Dict

class FederalRegisterDebugger:
    """Debug tool to understand what's available in the Federal Register API"""
    
    BASE_URL = "https://www.federalregister.gov/api/v1/documents"
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'FederalRegisterDebugger/1.0',
            'Accept': 'application/json'
        })
    
    def safe_get(self, data, key, default=""):
        """Safe data extraction"""
        try:
            if not isinstance(data, dict):
                return default
            value = data.get(key)
            if value is None:
                return default
            return str(value).strip() if value else default
        except Exception:
            return default
    
    def analyze_raw_api_response(self, start_date="2025-01-20", end_date=None):
        """Get raw API response and analyze what's actually available"""
        
        if not end_date:
            end_date = datetime.now().strftime('%Y-%m-%d')
        
        print(f"🔍 DEBUGGING: Raw API Analysis from {start_date} to {end_date}")
        print("=" * 80)
        
        # Test 1: Get ALL documents in date range (no filters)
        print("\n📋 TEST 1: ALL documents in date range")
        try:
            params = {
                'conditions[publication_date][gte]': start_date,
                'conditions[publication_date][lte]': end_date,
                'per_page': 1000,
                'order': 'newest'
            }
            
            response = self.session.get(self.BASE_URL, params=params, timeout=30)
            if response.status_code == 200:
                data = response.json()
                total_docs = data.get('count', 0)
                results = data.get('results', [])
                
                print(f"   Total documents available: {total_docs}")
                print(f"   Documents returned: {len(results)}")
                
                # Analyze document types
                doc_types = {}
                for doc in results:
                    doc_type = self.safe_get(doc, 'type', 'unknown')
                    doc_types[doc_type] = doc_types.get(doc_type, 0) + 1
                
                print(f"   Document types found:")
                for doc_type, count in sorted(doc_types.items()):
                    print(f"     {doc_type}: {count}")
                
            else:
                print(f"   ❌ Failed with status: {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ Error: {e}")
        
        # Test 2: Just presidential documents
        print("\n📋 TEST 2: Presidential documents only (PRESDOCU)")
        try:
            params = {
                'conditions[type]': 'PRESDOCU',
                'conditions[publication_date][gte]': start_date,
                'conditions[publication_date][lte]': end_date,
                'per_page': 1000,
                'order': 'newest'
            }
            
            response = self.session.get(self.BASE_URL, params=params, timeout=30)
            if response.status_code == 200:
                data = response.json()
                results = data.get('results', [])
                
                print(f"   Presidential documents found: {len(results)}")
                
                # Analyze presidential document types
                pres_types = {}
                sample_titles = []
                
                for doc in results:
                    pres_type = self.safe_get(doc, 'presidential_document_type', 'unknown')
                    pres_types[pres_type] = pres_types.get(pres_type, 0) + 1
                    
                    if len(sample_titles) < 10:
                        title = self.safe_get(doc, 'title', 'No title')
                        sample_titles.append(title)
                
                print(f"   Presidential document types:")
                for pres_type, count in sorted(pres_types.items()):
                    print(f"     {pres_type}: {count}")
                
                print(f"   Sample titles:")
                for i, title in enumerate(sample_titles, 1):
                    print(f"     {i}. {title[:80]}...")
                
            else:
                print(f"   ❌ Failed with status: {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ Error: {e}")
        
        # Test 3: Search for "executive order" specifically
        print("\n📋 TEST 3: Search for 'executive order' term")
        try:
            params = {
                'conditions[term]': 'executive order',
                'conditions[publication_date][gte]': start_date,
                'conditions[publication_date][lte]': end_date,
                'per_page': 1000,
                'order': 'newest'
            }
            
            response = self.session.get(self.BASE_URL, params=params, timeout=30)
            if response.status_code == 200:
                data = response.json()
                results = data.get('results', [])
                
                print(f"   Documents with 'executive order': {len(results)}")
                
                for i, doc in enumerate(results[:5], 1):
                    title = self.safe_get(doc, 'title', 'No title')
                    doc_type = self.safe_get(doc, 'type', 'unknown')
                    pres_type = self.safe_get(doc, 'presidential_document_type', 'unknown')
                    eo_number = self.safe_get(doc, 'executive_order_number', 'none')
                    
                    print(f"     {i}. {title[:60]}...")
                    print(f"        Type: {doc_type} | Pres Type: {pres_type} | EO#: {eo_number}")
                
            else:
                print(f"   ❌ Failed with status: {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ Error: {e}")
        
        # Test 4: Test different search terms
        print("\n📋 TEST 4: Testing various search terms")
        search_terms = ['order', 'trump', 'border', 'immigration', 'energy', 'directing', 'establishing']
        
        for term in search_terms:
            try:
                params = {
                    'conditions[term]': term,
                    'conditions[type]': 'PRESDOCU',
                    'conditions[publication_date][gte]': start_date,
                    'conditions[publication_date][lte]': end_date,
                    'per_page': 100,
                    'order': 'newest'
                }
                
                response = self.session.get(self.BASE_URL, params=params, timeout=30)
                if response.status_code == 200:
                    data = response.json()
                    results = data.get('results', [])
                    print(f"   '{term}': {len(results)} documents")
                else:
                    print(f"   '{term}': Failed ({response.status_code})")
                    
            except Exception as e:
                print(f"   '{term}': Error - {e}")
    
    def test_specific_document_detection(self, start_date="2025-01-20", end_date=None):
        """Test our executive order detection on actual documents"""
        
        if not end_date:
            end_date = datetime.now().strftime('%Y-%m-%d')
        
        print(f"\n🔍 DEBUGGING: Executive Order Detection Test")
        print("=" * 80)
        
        # Get some presidential documents to test against
        params = {
            'conditions[type]': 'PRESDOCU',
            'conditions[publication_date][gte]': start_date,
            'conditions[publication_date][lte]': end_date,
            'per_page': 50,
            'order': 'newest'
        }
        
        try:
            response = self.session.get(self.BASE_URL, params=params, timeout=30)
            if response.status_code == 200:
                data = response.json()
                results = data.get('results', [])
                
                print(f"Testing detection on {len(results)} presidential documents:")
                
                detected_count = 0
                for i, doc in enumerate(results, 1):
                    title = self.safe_get(doc, 'title', 'No title')
                    doc_type = self.safe_get(doc, 'type', '')
                    pres_type = self.safe_get(doc, 'presidential_document_type', '')
                    eo_number = self.safe_get(doc, 'executive_order_number', '')
                    
                    # Test our detection logic
                    is_detected = self.test_eo_detection(doc)
                    
                    if is_detected:
                        detected_count += 1
                        print(f"   ✅ {i}. DETECTED: {title[:60]}...")
                        print(f"      Type: {doc_type} | Pres: {pres_type} | EO#: {eo_number}")
                    else:
                        print(f"   ❌ {i}. MISSED: {title[:60]}...")
                        print(f"      Type: {doc_type} | Pres: {pres_type} | EO#: {eo_number}")
                        
                        # Analyze why it was missed
                        self.analyze_missed_document(doc)
                
                print(f"\nDetection Summary:")
                print(f"   Total documents: {len(results)}")
                print(f"   Detected as EOs: {detected_count}")
                print(f"   Detection rate: {(detected_count/len(results)*100):.1f}%")
                
        except Exception as e:
            print(f"❌ Error testing detection: {e}")
    
    def test_eo_detection(self, document: Dict) -> bool:
        """Test our current executive order detection logic"""
        
        try:
            title = self.safe_get(document, 'title', '').lower().strip()
            doc_type = self.safe_get(document, 'type', '')
            presidential_doc_type = self.safe_get(document, 'presidential_document_type', '')
            eo_number = self.safe_get(document, 'executive_order_number', '')
            
            # Test current logic
            if eo_number:
                return True
            
            if 'executive order' in title:
                return True
            
            # Pattern matching
            eo_patterns = [
                'eo ', 'e.o.', 'executive order no', 'order no.', 'order number',
                'executive order', 'order on', 'order to', 'order establishing',
                'order directing', 'order requiring', 'order implementing',
                'order revoking', 'order amending'
            ]
            
            for pattern in eo_patterns:
                if pattern in title:
                    return True
            
            if presidential_doc_type and 'executive order' in presidential_doc_type.lower():
                return True
            
            # PRESDOCU with ordering language
            if doc_type == 'PRESDOCU':
                ordering_indicators = [
                    'order', 'directing', 'establishing', 'requiring', 'commanding',
                    'instructing', 'mandate', 'decree', 'proclamation', 'memorandum',
                    'determination', 'finding', 'revok', 'amend', 'suspend',
                    'implement', 'securing', 'restoring', 'protecting', 'promoting'
                ]
                
                for indicator in ordering_indicators:
                    if indicator in title:
                        return True
            
            return False
            
        except Exception:
            return False
    
    def analyze_missed_document(self, document: Dict):
        """Analyze why a document wasn't detected as an EO"""
        
        title = self.safe_get(document, 'title', '').lower()
        
        # Check for potential EO indicators that we might be missing
        potential_indicators = [
            'memorandum', 'proclamation', 'determination', 'national security',
            'presidential', 'administration', 'policy', 'federal', 'government'
        ]
        
        found_indicators = []
        for indicator in potential_indicators:
            if indicator in title:
                found_indicators.append(indicator)
        
        if found_indicators:
            print(f"      💡 Contains: {', '.join(found_indicators)}")
    
    def comprehensive_search_test(self, start_date="2025-01-20", end_date=None):
        """Test all different search approaches"""
        
        if not end_date:
            end_date = datetime.now().strftime('%Y-%m-%d')
        
        print(f"\n🔍 DEBUGGING: Comprehensive Search Test")
        print("=" * 80)
        
        all_found_docs = []
        
        # Approach 1: All presidential documents
        print("\n1. All Presidential Documents:")
        docs1 = self.search_presidential_docs(start_date, end_date)
        all_found_docs.extend(docs1)
        print(f"   Found: {len(docs1)} documents")
        
        # Approach 2: Executive order term search
        print("\n2. 'Executive Order' term search:")
        docs2 = self.search_by_term("executive order", start_date, end_date)
        all_found_docs.extend(docs2)
        print(f"   Found: {len(docs2)} documents")
        
        # Approach 3: Broader term searches
        print("\n3. Broader term searches:")
        broad_terms = ['order', 'directing', 'establishing', 'securing', 'implementing', 'memorandum']
        for term in broad_terms:
            docs = self.search_by_term(term, start_date, end_date, doc_type='PRESDOCU')
            all_found_docs.extend(docs)
            print(f"   '{term}': {len(docs)} documents")
        
        # Remove duplicates and analyze
        unique_docs = self.remove_duplicates_simple(all_found_docs)
        print(f"\nTotal unique documents found: {len(unique_docs)}")
        
        # Test detection on all found documents
        detected_eos = []
        for doc in unique_docs:
            if self.test_eo_detection(doc):
                detected_eos.append(doc)
        
        print(f"Documents detected as EOs: {len(detected_eos)}")
        
        # Show the detected EOs
        print(f"\nDetected Executive Orders:")
        for i, doc in enumerate(detected_eos, 1):
            title = self.safe_get(doc, 'title', 'No title')
            signing_date = self.safe_get(doc, 'signing_date', '')
            pub_date = self.safe_get(doc, 'publication_date', '')
            eo_num = self.safe_get(doc, 'executive_order_number', 'Unknown')
            
            print(f"   {i}. EO {eo_num}: {title}")
            print(f"      Date: {signing_date or pub_date}")
        
        return detected_eos
    
    def search_presidential_docs(self, start_date, end_date):
        """Search for presidential documents"""
        params = {
            'conditions[type]': 'PRESDOCU',
            'conditions[publication_date][gte]': start_date,
            'conditions[publication_date][lte]': end_date,
            'per_page': 1000,
            'order': 'newest'
        }
        
        try:
            response = self.session.get(self.BASE_URL, params=params, timeout=30)
            if response.status_code == 200:
                data = response.json()
                return data.get('results', [])
        except Exception:
            pass
        return []
    
    def search_by_term(self, term, start_date, end_date, doc_type=None):
        """Search by specific term"""
        params = {
            'conditions[term]': term,
            'conditions[publication_date][gte]': start_date,
            'conditions[publication_date][lte]': end_date,
            'per_page': 1000,
            'order': 'newest'
        }
        
        if doc_type:
            params['conditions[type]'] = doc_type
        
        try:
            response = self.session.get(self.BASE_URL, params=params, timeout=30)
            if response.status_code == 200:
                data = response.json()
                return data.get('results', [])
        except Exception:
            pass
        return []
    
    def remove_duplicates_simple(self, docs):
        """Simple duplicate removal"""
        seen_urls = set()
        unique = []
        
        for doc in docs:
            url = self.safe_get(doc, 'html_url', '')
            if url and url not in seen_urls:
                seen_urls.add(url)
                unique.append(doc)
        
        return unique

# Usage function
def run_comprehensive_debug():
    """Run all debugging tests"""
    
    print("🚀 Federal Register API Comprehensive Debug")
    print("=" * 80)
    
    debugger = FederalRegisterDebugger()
    
    # Run all debug tests
    debugger.analyze_raw_api_response()
    debugger.test_specific_document_detection()
    found_eos = debugger.comprehensive_search_test()
    
    print(f"\n🎯 FINAL SUMMARY:")
    print(f"   Executive orders found: {len(found_eos)}")
    
    if len(found_eos) <= 5:
        print(f"\n⚠️  Only {len(found_eos)} EOs found - this suggests:")
        print(f"   1. The date range may have limited executive orders")
        print(f"   2. The Federal Register may not have all orders yet")
        print(f"   3. Orders might be published with different document types")
        print(f"   4. Some orders might be memoranda or proclamations instead")
        
        print(f"\n💡 RECOMMENDATIONS:")
        print(f"   1. Expand the search to include memoranda and proclamations")
        print(f"   2. Check the official White House website for comparison")
        print(f"   3. Consider that some orders may not be in Federal Register yet")
        print(f"   4. Try searching for specific known executive order titles")
    
    return found_eos

if __name__ == "__main__":
    run_comprehensive_debug()