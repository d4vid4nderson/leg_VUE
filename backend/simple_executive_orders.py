# simple_executive_orders.py - COMPLETE VERSION with database integration and main.py compatibility
import requests
import json
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import logging
import re
import hashlib
import pyodbc
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

class SimpleExecutiveOrders:
    """Simple executive orders fetcher using Federal Register API with pagination support"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'LegislationVue/1.0',
            'Accept': 'application/json'
        })
        self.base_url = "https://www.federalregister.gov/api/v1"
    
    def convert_date_format(self, date_str: str) -> str:
        """Convert MM/DD/YYYY to YYYY-MM-DD format for API"""
        try:
            if '/' in date_str:
                dt = datetime.strptime(date_str, '%m/%d/%Y')
                return dt.strftime('%Y-%m-%d')
            elif '-' in date_str and len(date_str) == 10:
                return date_str
            else:
                dt = datetime.strptime(date_str, '%m/%d/%Y')
                return dt.strftime('%Y-%m-%d')
        except Exception as e:
            logger.warning(f"⚠️ Could not convert date format '{date_str}': {e}")
            return date_str
    
    def fetch_executive_orders_direct(self, start_date: str = "01/20/2025", end_date: str = None, limit: int = None) -> Dict:
        """
        Fetch ALL executive orders using pagination to get complete results
        """
        if not end_date:
            end_date = datetime.now().strftime('%m/%d/%Y')
        
        logger.info(f"🔍 Fetching Executive Orders from Federal Register API")
        logger.info(f"📅 Date range: {start_date} to {end_date}")
        
        try:
            # Base parameters - using YYYY-MM-DD format for the API
            start_date_api = self.convert_date_format(start_date)
            end_date_api = self.convert_date_format(end_date)
            
            base_params = {
                'conditions[correction]': '0',
                'conditions[president]': 'donald-trump',
                'conditions[presidential_document_type]': 'executive_order',
                'conditions[publication_date][gte]': start_date_api,
                'conditions[publication_date][lte]': end_date_api,
                'conditions[type][]': 'PRESDOCU',
                'order': 'executive_order_number',
                'per_page': '100',  # Use high per_page value for efficiency
                'fields[]': [
                    'citation', 'document_number', 'end_page', 'html_url', 'pdf_url',
                    'type', 'subtype', 'publication_date', 'signing_date', 'start_page',
                    'title', 'disposition_notes', 'executive_order_number',
                    'not_received_for_publication', 'full_text_xml_url', 'body_html_url', 'json_url'
                ]
            }
            
            url = f"{self.base_url}/documents.json"
            all_executive_orders = []
            page = 1
            total_count = 0
            
            while True:
                # Add page parameter for pagination
                params = base_params.copy()
                params['page'] = str(page)
                
                logger.info(f"📡 Fetching page {page} from Federal Register API")
                
                response = self.session.get(url, params=params, timeout=45)
                logger.info(f"📊 Page {page} response status: {response.status_code}")
                
                if response.status_code != 200:
                    if page == 1:
                        # If first page fails, return error
                        try:
                            error_data = response.json()
                            error_message = error_data.get('message', 'Unknown API error')
                        except:
                            error_message = response.text[:500] if response.text else 'No response text'
                        
                        return {
                            'success': False,
                            'error': f'Federal Register API returned status {response.status_code}: {error_message}',
                            'results': [],
                            'count': 0,
                            'api_url': url,
                            'status_code': response.status_code
                        }
                    else:
                        # If subsequent page fails, we might have reached the end
                        logger.info(f"📄 Reached end of results at page {page}")
                        break
                
                try:
                    data = response.json()
                except json.JSONDecodeError as json_error:
                    logger.error(f"❌ Failed to parse JSON response on page {page}: {json_error}")
                    if page == 1:
                        return {
                            'success': False,
                            'error': f'Invalid JSON response from Federal Register API: {json_error}',
                            'results': [],
                            'count': 0
                        }
                    else:
                        break
                
                # Get results from this page
                page_results = data.get('results', [])
                
                if page == 1:
                    total_count = data.get('count', 0)
                    logger.info(f"📊 Total documents available: {total_count}")
                
                if not page_results:
                    logger.info(f"📄 No more results found on page {page}")
                    break
                
                all_executive_orders.extend(page_results)
                logger.info(f"✅ Page {page}: Found {len(page_results)} orders (Total so far: {len(all_executive_orders)})")
                
                # Check if we've got all results
                if len(page_results) < int(base_params['per_page']) or (limit and len(all_executive_orders) >= limit):
                    logger.info(f"📄 Finished fetching. Got {len(all_executive_orders)} total orders")
                    break
                
                page += 1
                
                # Safety check to prevent infinite loops
                if page > 50:  # Reasonable safety limit
                    logger.warning(f"⚠️ Reached safety limit of 50 pages")
                    break
            
            # Apply limit if specified
            if limit and len(all_executive_orders) > limit:
                all_executive_orders = all_executive_orders[:limit]
            
            logger.info(f"📋 Raw results found: {len(all_executive_orders)} executive orders")
            
            if not all_executive_orders:
                return {
                    'success': True,
                    'results': [],
                    'count': 0,
                    'total_found': total_count,
                    'message': 'No executive orders found in the specified date range',
                    'api_response_count': total_count
                }
            
            # Process all the orders
            processed_orders = []
            for i, doc in enumerate(all_executive_orders):
                try:
                    processed_order = self.process_executive_order_direct(doc)
                    if processed_order:
                        processed_orders.append(processed_order)
                        eo_num = processed_order.get('eo_number', 'Unknown')
                        title = doc.get('title', 'No title')[:60]
                        logger.info(f"✅ Processed EO #{eo_num}: {title}...")
                    else:
                        logger.warning(f"⚠️ Failed to process document {i+1}")
                except Exception as doc_error:
                    logger.warning(f"⚠️ Error processing document {i+1}: {doc_error}")
                    continue
            
            # Sort by EO number (descending - newest first)
            try:
                processed_orders.sort(key=lambda x: self.get_sort_key(x), reverse=True)
            except Exception as sort_error:
                logger.warning(f"⚠️ Error sorting orders: {sort_error}")
            
            logger.info(f"🎯 Total Executive Orders processed: {len(processed_orders)}")
            
            return {
                'success': True,
                'results': processed_orders,
                'count': len(processed_orders),
                'total_found': total_count,
                'pages_fetched': page - 1,
                'date_range': f"{start_date} to {end_date}",
                'api_response_count': len(all_executive_orders),
                'message': f'Found {len(processed_orders)} Executive Orders from Federal Register API',
                'api_url': url,
                'search_params': {
                    'president': 'donald-trump',
                    'document_type': 'executive_order',
                    'date_range': f"{start_date} to {end_date}"
                }
            }
            
        except requests.exceptions.Timeout:
            logger.error("❌ Request to Federal Register API timed out")
            return {
                'success': False,
                'error': 'Request to Federal Register API timed out after 45 seconds',
                'results': [],
                'count': 0
            }
        except requests.exceptions.ConnectionError:
            logger.error("❌ Connection error to Federal Register API")
            return {
                'success': False,
                'error': 'Could not connect to Federal Register API. Check internet connection.',
                'results': [],
                'count': 0
            }
        except Exception as e:
            logger.error(f"❌ Unexpected error in Federal Register API fetch: {e}")
            return {
                'success': False,
                'error': f'Unexpected error: {str(e)}',
                'results': [],
                'count': 0
            }
    
    def get_sort_key(self, order):
        """Get sort key for executive orders with improved number extraction"""
        eo_number = order.get('eo_number', '0')
        try:
            # Handle string conversion
            eo_str = str(eo_number).strip()
            
            # Direct numeric conversion
            if eo_str.isdigit():
                return int(eo_str)
            
            # Extract numbers from string
            numbers = re.findall(r'\d+', eo_str)
            if numbers:
                # Use the largest number found (likely the EO number)
                return max(int(num) for num in numbers)
            
            # Fallback for completely non-numeric
            return 0
        except Exception as e:
            logger.warning(f"⚠️ Error getting sort key for {eo_number}: {e}")
            return 0
    
    def process_executive_order_direct(self, doc: Dict) -> Optional[Dict]:
        """
        Process a document from the Federal Register API with improved error handling
        """
        try:
            if not doc or not isinstance(doc, dict):
                logger.warning("⚠️ Invalid document data received")
                return None
            
            # Extract EO number - FIXED to use actual executive_order_number field
            eo_number = self.extract_eo_number_from_doc(doc)
            
            # Get dates with fallbacks - FIXED to prioritize signing_date
            signing_date = doc.get('signing_date', '') or ''  # This is the official signing date!
            publication_date = doc.get('publication_date', '') or ''
            
            # Log the actual dates we're getting
            logger.debug(f"📅 EO {eo_number} dates - Signing: '{signing_date}', Publication: '{publication_date}'")
            
            # Get title with fallback
            title = doc.get('title', '') or f'Executive Order {eo_number}'
            
            # Categorize the order
            category = self.categorize_executive_order(doc)
            
            # Extract summary
            summary = self.extract_summary_from_doc(doc)
            
            processed_order = {
                # Core identification
                'eo_number': eo_number,
                'executive_order_number': eo_number,
                'document_number': doc.get('document_number', '') or '',
                'title': title,
                'summary': summary,
                
                # Dates
                'signing_date': signing_date,
                'publication_date': publication_date,
                'formatted_publication_date': self.format_date(publication_date),
                'formatted_signing_date': self.format_date(signing_date),
                
                # URLs and links
                'html_url': doc.get('html_url', '') or '',
                'pdf_url': doc.get('pdf_url', '') or '',
                'full_text_xml_url': doc.get('full_text_xml_url', '') or '',
                'body_html_url': doc.get('body_html_url', '') or '',
                'json_url': doc.get('json_url', '') or '',
                
                # Document metadata
                'citation': doc.get('citation', '') or '',
                'type': doc.get('type', '') or '',
                'subtype': doc.get('subtype', '') or '',
                'disposition_notes': doc.get('disposition_notes', '') or '',
                'start_page': doc.get('start_page', '') or '',
                'end_page': doc.get('end_page', '') or '',
                'not_received_for_publication': bool(doc.get('not_received_for_publication', False)),
                
                # Classification
                'president': 'donald-trump',
                'source': 'Federal Register API - Direct URL',
                'category': category,
                
                # Initialize empty AI fields
                'ai_summary': '',
                'ai_executive_summary': '',
                'ai_key_points': '',
                'ai_talking_points': '',
                'ai_business_impact': '',
                'ai_potential_impact': '',
                'ai_processed': False,
                'ai_version': ''
            }
            
            return processed_order
            
        except Exception as e:
            logger.error(f"❌ Error processing executive order: {e}")
            logger.error(f"Document data: {doc}")
            return None
    
    def extract_eo_number_from_doc(self, doc: Dict) -> str:
        """
        Extract EO number from Federal Register document with better debugging
        """
        try:
            logger.debug(f"🔍 Extracting EO number from document: {doc.get('title', 'No title')[:50]}...")
            logger.debug(f"🔍 Available fields: {list(doc.keys())}")
            
            # Method 1: Direct executive_order_number field (THIS IS THE CORRECT FIELD!)
            eo_number = doc.get('executive_order_number')
            if eo_number:
                eo_str = str(eo_number).strip()
                logger.debug(f"🎯 Found executive_order_number field: '{eo_str}'")
                
                # Clean up the EO number - remove any non-digit characters except spaces and dashes
                clean_eo = re.sub(r'[^\d\-\s]', '', eo_str).strip()
                
                if clean_eo.isdigit() and int(clean_eo) > 0:
                    logger.info(f"✅ Using actual EO number: {clean_eo}")
                    return clean_eo
                elif clean_eo:
                    # Try to extract just the numeric part
                    numbers = re.findall(r'\d+', clean_eo)
                    if numbers:
                        main_number = numbers[0]  # Take the first number found
                        if int(main_number) > 0:
                            logger.info(f"✅ Extracted EO number: {main_number}")
                            return main_number
            
            # Method 2: Extract from title as backup
            title = doc.get('title', '') or ''
            logger.debug(f"🔍 Checking title for EO number: {title}")
            
            if title:
                # Look for explicit EO patterns in title
                eo_patterns = [
                    r'Executive Order(?:\s+No\.?)?\s*(\d{4,5})',
                    r'EO\s*(?:No\.?)?\s*(\d{4,5})',
                    r'E\.O\.?\s*(?:No\.?)?\s*(\d{4,5})'
                ]
                
                for pattern in eo_patterns:
                    eo_match = re.search(pattern, title, re.IGNORECASE)
                    if eo_match:
                        found_number = eo_match.group(1)
                        logger.info(f"✅ Found EO number in title: {found_number}")
                        return found_number
            
            # Method 3: Check document_number for clues
            doc_number = doc.get('document_number', '') or ''
            logger.debug(f"🔍 Document number: {doc_number}")
            
            # Method 4: Last resort - use document_number as identifier
            if doc_number:
                # Use document number but make it clear it's not a real EO number
                logger.warning(f"⚠️ No EO number found, using document number: {doc_number}")
                return f"DOC-{doc_number}"
            
            # Final fallback
            logger.warning(f"⚠️ Could not find EO number for document: {title[:50]}...")
            return "UNKNOWN-EO"
                
        except Exception as e:
            logger.error(f"❌ Error extracting EO number: {e}")
            return "ERROR-EO"
    
    def extract_summary_from_doc(self, doc: Dict) -> str:
        """
        Extract or generate a summary from the document with better fallbacks
        """
        try:
            # Check disposition notes first (often contains summary-like content)
            disposition = doc.get('disposition_notes', '') or ''
            if disposition and len(disposition.strip()) > 20:
                return disposition.strip()
            
            # Check if there's any abstract or summary field
            for field in ['abstract', 'summary', 'description']:
                content = doc.get(field, '') or ''
                if content and len(content.strip()) > 20:
                    return content.strip()
            
            # Generate basic summary from title
            title = doc.get('title', '') or ''
            if title:
                # Clean up the title for summary
                clean_title = title.strip()
                if not clean_title.lower().startswith('executive order'):
                    return f"Executive Order: {clean_title}"
                return clean_title
            
            return "Executive Order summary not available."
            
        except Exception as e:
            logger.error(f"❌ Error extracting summary: {e}")
            return "Executive Order summary not available."

    def categorize_executive_order(self, doc: Dict) -> str:
        """
        Categorize executive order based on title and available content with improved keywords
        """
        try:
            title = (doc.get('title', '') or '').lower()
            disposition = (doc.get('disposition_notes', '') or '').lower()
            content = f"{title} {disposition}".strip()
            
            if not content:
                return 'civic'  # Default fallback
            
            # Define improved category keywords
            categories = {
                'healthcare': [
                    'health', 'medical', 'healthcare', 'mental health', 'medicare', 
                    'medicaid', 'hospital', 'doctor', 'pandemic', 'disease', 'public health',
                    'pharmaceutical', 'drug', 'wellness', 'clinic', 'patient'
                ],
                'education': [
                    'education', 'school', 'student', 'university', 'college', 
                    'learning', 'academic', 'teacher', 'educational', 'scholarship',
                    'curriculum', 'literacy', 'training', 'classroom'
                ],
                'engineering': [
                    'infrastructure', 'transportation', 'bridge', 'road', 'construction',
                    'engineering', 'technical', 'technology', 'innovation', 'research',
                    'broadband', 'telecommunications', 'manufacturing', 'automation',
                    'artificial intelligence', 'ai', 'software', 'digital'
                ],
                'civic': [
                    'government', 'federal', 'agency', 'administration', 'policy',
                    'public', 'citizen', 'civil', 'democratic', 'election', 'voting',
                    'transparency', 'accountability', 'reform', 'regulation', 'national',
                    'veterans', 'military', 'security', 'emergency', 'commission', 
                    'task force', 'border', 'immigration', 'energy', 'climate',
                    'trade', 'foreign', 'defense', 'homeland', 'justice'
                ]
            }
            
            # Score each category based on keyword matches
            category_scores = {}
            for category, keywords in categories.items():
                score = sum(1 for keyword in keywords if keyword in content)
                if score > 0:
                    category_scores[category] = score
            
            # Return the category with the highest score
            if category_scores:
                best_category = max(category_scores.keys(), key=lambda k: category_scores[k])
                logger.debug(f"📊 Categorized as '{best_category}' (score: {category_scores[best_category]})")
                return best_category
            
            # Default to civic for government documents
            return 'civic'
            
        except Exception as e:
            logger.error(f"❌ Error categorizing executive order: {e}")
            return 'civic'

    def format_date(self, date_str: str) -> str:
        """Format date for display with improved error handling"""
        if not date_str or not isinstance(date_str, str):
            return ""
        
        date_str = date_str.strip()
        if not date_str:
            return ""
        
        try:
            # Handle different date formats
            if '/' in date_str:
                # MM/DD/YYYY format
                dt = datetime.strptime(date_str, '%m/%d/%Y')
            elif '-' in date_str:
                # YYYY-MM-DD format
                dt = datetime.strptime(date_str, '%Y-%m-%d')
            else:
                # Return as-is if unrecognized format
                return date_str
            
            return dt.strftime('%m/%d/%Y')
        except Exception as e:
            logger.warning(f"⚠️ Could not format date '{date_str}': {e}")
            return date_str

# ===============================
# DATABASE FUNCTIONS FOR dbo.executive_orders TABLE
# ===============================

def get_db_connection():
    """Get database connection using your credentials from .env"""
    try:
        server = os.getenv('AZURE_SQL_SERVER')
        database = os.getenv('AZURE_SQL_DATABASE') 
        username = os.getenv('AZURE_SQL_USERNAME')
        password = os.getenv('AZURE_SQL_PASSWORD')
        
        if not all([server, database, username, password]):
            raise Exception("Missing required database environment variables")
        
        driver = 'ODBC Driver 18 for SQL Server'
        
        connection_string = (
            f"Driver={{{driver}}};"
            f"Server={server};"
            f"Database={database};"
            f"UID={username};"
            f"PWD={password};"
            f"Encrypt=yes;"
            f"TrustServerCertificate=yes;"
            f"Connection Timeout=30;"
            f"Command Timeout=30;"
            f"MultipleActiveResultSets=True;"
        )
        
        conn = pyodbc.connect(connection_string)
        return conn
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")
        raise

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

def executive_order_exists_in_db(eo_number: str) -> bool:
    """Check if an executive order already exists in the dbo.executive_orders table"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check in the executive_orders table using the EO number
        cursor.execute("""
            SELECT COUNT(*) FROM dbo.executive_orders 
            WHERE eo_number = ? OR document_number = ?
        """, (eo_number, eo_number))
        
        count = cursor.fetchone()[0]
        
        cursor.close()
        conn.close()
        
        exists = count > 0
        logger.debug(f"📋 EO {eo_number} exists in database: {exists}")
        return exists
        
    except Exception as e:
        logger.error(f"❌ Error checking if EO {eo_number} exists: {e}")
        return False

def get_executive_order_from_db(eo_number: str) -> Optional[Dict]:
    """Get an existing executive order from the dbo.executive_orders table"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get the executive order from executive_orders table
        cursor.execute("""
            SELECT * FROM dbo.executive_orders 
            WHERE eo_number = ? OR document_number = ?
        """, (eo_number, eo_number))
        
        row = cursor.fetchone()
        
        if row:
            # Get column names
            columns = [column[0] for column in cursor.description]
            
            # Create dictionary from row data
            result = dict(zip(columns, row))
            
            cursor.close()
            conn.close()
            
            logger.debug(f"📋 Retrieved EO {eo_number} from database")
            return result
        else:
            cursor.close()
            conn.close()
            return None
        
    except Exception as e:
        logger.error(f"❌ Error getting EO {eo_number} from database: {e}")
        return None

def save_single_executive_order_to_db(order: Dict) -> bool:
    """Save a single executive order to the dbo.executive_orders table"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        eo_number = order.get('eo_number', 'unknown')
        
        # Map the order data to your database structure
        field_mapping = {
            'document_number': order.get('document_number', ''),
            'eo_number': order.get('eo_number', ''),
            'title': order.get('title', ''),
            'summary': order.get('summary', ''),
            'signing_date': process_date_for_db(order.get('signing_date', '')),
            'publication_date': process_date_for_db(order.get('publication_date', '')),
            'citation': order.get('citation', ''),
            'presidential_document_type': 'executive_order',
            'category': order.get('category', 'civic'),
            'html_url': order.get('html_url', ''),
            'pdf_url': order.get('pdf_url', ''),
            'trump_2025_url': order.get('html_url', ''),
            'ai_summary': order.get('ai_summary', ''),
            'ai_executive_summary': order.get('ai_executive_summary', ''),
            'ai_key_points': order.get('ai_key_points', ''),
            'ai_talking_points': order.get('ai_talking_points', ''),
            'ai_business_impact': order.get('ai_business_impact', ''),
            'ai_potential_impact': order.get('ai_potential_impact', ''),
            'ai_version': order.get('ai_version', ''),
            'source': order.get('source', 'Federal Register API'),
            'raw_data_available': True,
            'processing_status': 'processed',
            'error_message': '',
            'content': json.dumps(order),
            'tags': '',
            'ai_analysis': order.get('ai_analysis', ''),
            'created_at': datetime.now(),
            'last_updated': datetime.now(),
            'last_scraped_at': datetime.now()
        }
        
        # Build dynamic INSERT query
        field_names = list(field_mapping.keys())
        placeholders = ', '.join(['?' for _ in field_names])
        field_list = ', '.join(field_names)
        
        insert_query = f"""
            INSERT INTO dbo.executive_orders ({field_list})
            VALUES ({placeholders})
        """
        
        values = tuple(field_mapping[field] for field in field_names)
        
        logger.debug(f"💾 Inserting EO {eo_number}")
        
        cursor.execute(insert_query, values)
        conn.commit()
        
        cursor.close()
        conn.close()
        
        logger.info(f"💾 Successfully saved EO {eo_number} to dbo.executive_orders")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error saving EO {order.get('eo_number')} to database: {e}")
        return False

def process_date_for_db(date_str: str) -> Optional[str]:
    """Process date for database storage (YYYY-MM-DD format)"""
    if not date_str:
        return None
    
    try:
        if '/' in date_str:
            dt = datetime.strptime(date_str, '%m/%d/%Y')
        elif '-' in date_str:
            dt = datetime.strptime(date_str, '%Y-%m-%d')
        else:
            return None
        
        return dt.strftime('%Y-%m-%d')
    except:
        return None

# ===============================
# MAIN INTEGRATION FUNCTION (for main.py compatibility)
# ===============================

async def fetch_executive_orders_simple_integration(
    start_date: str = None,
    end_date: str = None,
    with_ai: bool = False,
    limit: int = None,
    period: str = None,
    save_to_db: bool = True
) -> Dict:
    """
    Main integration function for compatibility with main.py
    """
    # Handle period-based date selection
    if period:
        start_date, end_date = get_date_range_for_period(period)
        logger.info(f"🗓️ Using period '{period}': {start_date} to {end_date}")
    elif not start_date:
        start_date = "01/20/2025"  # Default to inauguration
    
    if not end_date:
        end_date = datetime.now().strftime('%m/%d/%Y')
    
    logger.info(f"🚀 Starting Executive Orders fetch using Federal Register API")
    logger.info(f"📅 Date range: {start_date} to {end_date}")
    logger.info(f"🤖 AI Analysis: {'ENABLED' if with_ai else 'DISABLED'}")
    logger.info(f"💾 Save to DB: {'ENABLED' if save_to_db else 'DISABLED'}")
    if limit:
        logger.info(f"📊 Limit: {limit}")
    
    successful_ai = 0
    failed_ai = 0
    orders_saved = 0
    orders_skipped = 0
    processed_orders = []
    
    try:
        # Check database schema first if saving
        if save_to_db:
            schema_ok, columns = check_executive_orders_table()
            if not schema_ok:
                logger.warning("⚠️ Database schema check failed, disabling save to DB")
                save_to_db = False
        
        # Use the direct Federal Register API fetcher to get raw data
        simple_eo = SimpleExecutiveOrders()
        result = simple_eo.fetch_executive_orders_direct(start_date, end_date, limit)
        
        if not result.get('success'):
            logger.error(f"❌ Federal Register API fetch failed: {result.get('error')}")
            return result
        
        raw_orders = result.get('results', [])
        logger.info(f"✅ Federal Register API found {len(raw_orders)} Executive Orders")
        
        if not raw_orders:
            return {
                'success': True,
                'results': [],
                'count': 0,
                'message': 'No executive orders found in the specified date range',
                'date_range_used': f"{start_date} to {end_date}",
                'api_response': result
            }
        
        # Process each executive order individually
        for i, order in enumerate(raw_orders):
            try:
                eo_num = order.get('eo_number', 'Unknown')
                title = order.get('title', 'No title')[:60]
                
                logger.info(f"📋 Checking EO {i+1}/{len(raw_orders)}: #{eo_num} - {title}...")
                
                # Step 0: Check if executive order already exists in database
                if save_to_db and executive_order_exists_in_db(eo_num):
                    logger.info(f"⏭️ EO {eo_num} already exists in database, skipping...")
                    orders_skipped += 1
                    # Still add to processed orders list from database
                    try:
                        existing_order = get_executive_order_from_db(eo_num)
                        if existing_order:
                            processed_orders.append(existing_order)
                        else:
                            processed_orders.append(order)  # Fallback to API data
                    except:
                        processed_orders.append(order)  # Fallback to API data
                    continue
                
                logger.info(f"🆕 EO {eo_num} not in database, processing...")
                
                # Step 1: AI Analysis (if enabled)
                if with_ai:
                    try:
                        logger.info(f"🤖 AI analysis for EO {eo_num}")
                        
                        # Import AI function if available
                        try:
                            from ai import analyze_executive_order
                            ai_result = await analyze_executive_order(
                                title=order.get('title', ''),
                                abstract=order.get('summary', ''),
                                order_number=eo_num
                            )
                            
                            if ai_result and isinstance(ai_result, dict):
                                # Update order with AI results
                                order.update({
                                    'ai_summary': ai_result.get('ai_summary', ''),
                                    'ai_executive_summary': ai_result.get('ai_executive_summary', ''),
                                    'ai_key_points': ai_result.get('ai_key_points', ''),
                                    'ai_talking_points': ai_result.get('ai_talking_points', ''),
                                    'ai_business_impact': ai_result.get('ai_business_impact', ''),
                                    'ai_potential_impact': ai_result.get('ai_potential_impact', ''),
                                    'ai_version': ai_result.get('ai_version', 'azure_openai_enhanced_v1'),
                                    'ai_processed': True
                                })
                                successful_ai += 1
                                logger.info(f"✅ AI analysis completed for EO {eo_num}")
                            else:
                                failed_ai += 1
                                logger.warning(f"⚠️ AI analysis returned no data for EO {eo_num}")
                        except ImportError:
                            logger.warning(f"⚠️ AI module not available, skipping AI analysis")
                            failed_ai += 1
                            
                    except Exception as ai_error:
                        failed_ai += 1
                        logger.warning(f"⚠️ AI analysis error for EO {eo_num}: {ai_error}")
                        # Continue without AI data
                
                # Step 2: Save to Database (if enabled)
                if save_to_db:
                    try:
                        saved_success = save_single_executive_order_to_db(order)
                        if saved_success:
                            orders_saved += 1
                            logger.info(f"💾 Saved EO {eo_num} to database")
                        else:
                            logger.warning(f"⚠️ Failed to save EO {eo_num} to database")
                    except Exception as db_error:
                        logger.warning(f"⚠️ Database save error for EO {eo_num}: {db_error}")
                
                # Step 3: Add to processed orders list
                processed_orders.append(order)
                
                # Step 4: Rate limiting between orders
                if i < len(raw_orders) - 1:  # Don't delay after the last one
                    delay = 1.0 if not with_ai else 2.0  # Shorter delay if no AI
                    logger.debug(f"⏱️ Waiting {delay}s before next order...")
                    await asyncio.sleep(delay)
                
                # Progress update every 10 orders
                if (i + 1) % 10 == 0:
                    logger.info(f"📊 Progress: {i+1}/{len(raw_orders)} orders processed, {orders_saved} saved, {orders_skipped} skipped")
                
                # Apply limit if specified
                if limit and len(processed_orders) >= limit:
                    logger.info(f"🛑 Reached specified limit of {limit} orders")
                    break
                    
            except Exception as order_error:
                logger.error(f"❌ Error processing EO {i+1}: {order_error}")
                continue
        
        # Final summary
        logger.info(f"🎯 Processing completed!")
        logger.info(f"   📋 Total orders processed: {len(processed_orders)}")
        logger.info(f"   💾 Orders saved to database: {orders_saved}")
        logger.info(f"   ⏭️ Orders skipped (duplicates): {orders_skipped}")
        logger.info(f"   🤖 AI analysis successful: {successful_ai}")
        logger.info(f"   ❌ AI analysis failed: {failed_ai}")
        
        return {
            'success': True,
            'results': processed_orders,
            'count': len(processed_orders),
            'orders_saved': orders_saved,
            'orders_skipped': orders_skipped,
            'total_found': result.get('total_found', len(processed_orders)),
            'ai_analysis_enabled': with_ai,
            'ai_successful': successful_ai,
            'ai_failed': failed_ai,
            'period_used': period,
            'date_range_used': f"{start_date} to {end_date}",
            'pages_fetched': result.get('pages_fetched', 1),
            'message': f'Successfully processed {len(processed_orders)} Executive Orders, saved {orders_saved} to database, skipped {orders_skipped} duplicates',
            'api_url': result.get('api_url', 'Federal Register API'),
            'search_params': result.get('search_params', {}),
            'api_response_count': result.get('api_response_count', 0)
        }
        
    except Exception as e:
        logger.error(f"❌ Error in Federal Register integration: {e}")
        return {
            'success': False,
            'error': str(e),
            'results': processed_orders,
            'count': len(processed_orders),
            'orders_saved': orders_saved,
            'orders_skipped': orders_skipped,
            'date_range_used': f"{start_date} to {end_date}" if start_date and end_date else "Unknown"
        }

# ===============================
# HELPER FUNCTIONS
# ===============================

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

# ALTERNATIVE SIMPLER FIX: If the above is too complex, use this simpler version
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

async def check_executive_orders_count_integration():
    """
    Integration function for count checking
    """
    try:
        simple_eo = SimpleExecutiveOrders()
        
        # Get Federal Register count (lightweight)
        federal_count = await get_federal_register_count_lightweight(simple_eo)
        
        # Get database count
        database_count = await get_database_count_existing()
        
        new_orders_available = max(0, federal_count - database_count)
        needs_fetch = new_orders_available > 0
        
        logger.info(f"📊 Count Check - Federal: {federal_count}, Database: {database_count}, New: {new_orders_available}")
        
        return {
            "success": True,
            "federal_register_count": federal_count,
            "database_count": database_count,
            "new_orders_available": new_orders_available,
            "needs_fetch": needs_fetch,
            "last_checked": datetime.now().isoformat(),
            "message": f"Found {new_orders_available} new executive orders available" if needs_fetch else "Database is up to date"
        }
        
    except Exception as e:
        logger.error(f"❌ Error in count check: {e}")
        return {
            "success": False,
            "error": str(e),
            "federal_register_count": 0,
            "database_count": 0,
            "new_orders_available": 0,
            "needs_fetch": False,
            "message": "Error checking for updates"
        }

async def get_federal_register_count_lightweight(simple_eo_instance):
    """Lightweight count check"""
    try:
        base_params = {
            'conditions[correction]': '0',
            'conditions[president]': 'donald-trump',
            'conditions[presidential_document_type]': 'executive_order',
            'conditions[publication_date][gte]': "2025-01-20",
            'conditions[publication_date][lte]': datetime.now().strftime('%Y-%m-%d'),
            'conditions[type][]': 'PRESDOCU',
            'per_page': '1',
            'fields[]': ['document_number']
        }
        
        url = f"{simple_eo_instance.base_url}/documents.json"
        response = simple_eo_instance.session.get(url, params=base_params, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            count = data.get('count', 0)
            logger.info(f"📊 Federal Register lightweight check: {count} total orders")
            return count
        else:
            logger.error(f"❌ Federal Register API error: {response.status_code}")
            return 0
            
    except Exception as e:
        logger.error(f"❌ Error in lightweight check: {e}")
        return 0

async def get_database_count_existing():
    """Get accurate database count of existing executive orders"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Count actual Trump executive orders in database
        # Use the most reliable identifier available
        cursor.execute("""
            SELECT COUNT(*) 
            FROM dbo.executive_orders 
            WHERE president = 'donald-trump'
            AND (
                (eo_number IS NOT NULL AND eo_number != '' AND eo_number != 'Unknown' AND eo_number NOT LIKE 'DOC-%' AND eo_number NOT LIKE 'ERROR-%')
                OR (document_number IS NOT NULL AND document_number != '')
                OR (executive_order_number IS NOT NULL AND executive_order_number != '')
            )
        """)
        
        count = cursor.fetchone()[0]
        cursor.close()
        conn.close()
        
        logger.info(f"📊 Database count: {count} valid executive orders")
        return count
        
    except Exception as e:
        logger.error(f"❌ Error getting database count: {e}")
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