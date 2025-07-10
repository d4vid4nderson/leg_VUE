# COMPLETE main.py - ALL FUNCTIONALITY PRESERVED + UNLIMITED FETCHING
import asyncio
import json
import logging
import math
import os
import re
import time
import traceback
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional

import aiohttp
import pyodbc
import requests
from status_endpoints import router as status_router
from ai_status import check_azure_ai_configuration
from database_azure_fixed import save_legislation_to_azure_sql, test_azure_sql_connection
from database_connection import execute_query, get_database_connection, get_db_cursor, test_database_connection, get_db_connection
from dotenv import load_dotenv
from executive_orders_db import (
    add_highlight_direct, create_highlights_table, get_executive_order_by_number,
    get_executive_orders_from_db, get_user_highlights_direct, remove_highlight_direct,
    save_executive_orders_to_db, update_executive_order_category_in_db
)
from fastapi import BackgroundTasks, FastAPI, HTTPException, Path, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from legiscan_api import LegiScanAPI
from openai import AsyncAzureOpenAI


load_dotenv(override=True)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Wait for environment variables to be resolved
def wait_for_env_vars(var_names, max_attempts=30, delay_seconds=2):
    """Wait for critical environment variables to be available"""
    logger.info(f"Waiting for environment variables to be resolved: {', '.join(var_names)}")
    
    missing_vars = set(var_names)
    attempt = 0
    
    while missing_vars and attempt < max_attempts:
        attempt += 1
        still_missing = set()
        
        for var in missing_vars:
            if os.getenv(var):
                logger.info(f"✅ Environment variable resolved: {var}")
            else:
                still_missing.add(var)
                
        missing_vars = still_missing
        
        if missing_vars:
            logger.info(f"⏳ Waiting for variables ({attempt}/{max_attempts}): {', '.join(missing_vars)}")
            time.sleep(delay_seconds)
    
    if missing_vars:
        logger.warning(f"⚠️ Some environment variables never resolved: {', '.join(missing_vars)}")
    else:
        logger.info("✅ All environment variables successfully resolved")
    
    return len(missing_vars) == 0

# Wait for critical variables before proceeding
critical_vars = [
    "LEGISCAN_API_KEY", 
    "AZURE_ENDPOINT",
    "AZURE_KEY",
    "AZURE_MODEL_NAME",
    "AZURE_SQL_DATABASE",
    "AZURE_SQL_PASSWORD",
    "AZURE_SQL_SERVER",
    "AZURE_SQL_USERNAME",
    "FRONTEND_URL"
]

logger.info("🔄 Starting application - waiting for environment variables to be resolved...")
wait_for_env_vars(critical_vars)
logger.info("✅ Environment variables resolved - proceeding with application initialization")


# ===============================
# ENHANCED AI INTEGRATION
# ===============================
#try:
#    OPENAI_AVAILABLE = True
#    logger.info("✅ OpenAI library available")
#except ImportError:
#    logger.warning("❌ OpenAI library not available - install with: pip install openai")
#    OPENAI_AVAILABLE = False
OPENAI_AVAILABLE = True


# Configuration
AZURE_ENDPOINT = os.getenv("AZURE_ENDPOINT", "https://david-mabholqy-swedencentral.openai.azure.com/")
AZURE_KEY = os.getenv("AZURE_KEY")
MODEL_NAME = os.getenv("AZURE_MODEL_NAME", "summarize-gpt-4.1")
LEGISCAN_API_KEY = os.getenv('LEGISCAN_API_KEY')

# Initialize Enhanced Azure OpenAI client
enhanced_ai_client = None
try:
    enhanced_ai_client = AsyncAzureOpenAI(
        azure_endpoint=AZURE_ENDPOINT,
        api_key=AZURE_KEY,
        api_version="2024-12-01-preview"
    )
    logger.info("✅ Enhanced AI client initialized successfully")
except Exception as e:
    logger.warning(f"❌ Enhanced AI client initialization failed: {e}")

# Enhanced Enums
class PromptType(Enum):
    EXECUTIVE_SUMMARY = "executive_summary"
    KEY_TALKING_POINTS = "key_talking_points"
    BUSINESS_IMPACT = "business_impact"

class BillCategory(Enum):
    HEALTHCARE = "healthcare"
    EDUCATION = "education"
    ENGINEERING = "engineering"
    CIVIC = "civic"
    NOT_APPLICABLE = "not_applicable"
    ALL_PRACTICE_AREAS = "all_practice_areas"

# Enhanced prompt templates
ENHANCED_PROMPTS = {
    PromptType.EXECUTIVE_SUMMARY: """
    Write a concise executive summary of this legislative content in 2-4 sentences. 
    Focus on:
    - What the legislation does (main purpose)
    - Who it affects (target audience/stakeholders)
    - Key changes or requirements it establishes
    
    Use clear, professional language suitable for executives and decision-makers.
    Do NOT use bullet points or lists - write in paragraph form.
    
    Legislative Content: {text}
    """,
    
    PromptType.KEY_TALKING_POINTS: """
    Create exactly 5 distinct talking points for stakeholder discussions about this legislation.
    Each point should be ONE complete sentence and focus on different aspects:

    1. [Main purpose/goal of the legislation]
    2. [Key stakeholders or groups affected]  
    3. [Most significant change or requirement]
    4. [Implementation timeline or process]
    5. [Expected outcomes or benefits]

    Format as numbered list exactly as shown above.
    Make each point actionable for conversations with colleagues, clients, or stakeholders.
    Use bold formatting for important terms: **term**
    
    Legislative Content: {text}
    """,
    
    PromptType.BUSINESS_IMPACT: """
    Analyze the business impact of this legislation using clear, professional language:

    Risk Assessment:
    Regulatory and Market Uncertainty
    • [Describe the main regulatory risk in one clear sentence]
    • [Describe the market uncertainty risk in one clear sentence]

    Market Opportunity:
    Increased Investment and Demand
    • [Describe the main business opportunity in one clear sentence]  
    • [Describe specific benefits available in one clear sentence]

    Summary:
    [Provide a balanced 1-2 sentence summary of the overall business impact]

    Use simple bullet points with • character only. 
    Avoid asterisks (**) and dashes (---) in your response.
    Focus on concrete business implications.

    Legislative Content: {text}
    """
}

# Enhanced system messages
ENHANCED_SYSTEM_MESSAGES = {
    PromptType.EXECUTIVE_SUMMARY: "You are a senior policy analyst who writes clear, concise executive summaries for C-level executives. Focus on the big picture and strategic implications.",
    PromptType.KEY_TALKING_POINTS: "You are a communications strategist helping leaders discuss policy changes. Create talking points that are memorable, accurate, and useful for stakeholder conversations.",
    PromptType.BUSINESS_IMPACT: "You are a business strategy consultant analyzing regulatory impact. Focus on concrete business implications, compliance requirements, and strategic opportunities.",
}

# Supported states
SUPPORTED_STATES = {
    "California": "CA",
    "Colorado": "CO", 
    "Kentucky": "KY",
    "Nevada": "NV",
    "South Carolina": "SC",
    "Texas": "TX",
}

# ===============================
# REQUEST MODELS
# ===============================
class CategoryUpdateRequest(BaseModel):
    category: str

class ReviewUpdateRequest(BaseModel):
    reviewed: bool

class ExecutiveOrderFetchRequest(BaseModel):
    start_date: Optional[str] = "2025-01-20"
    end_date: Optional[str] = None
    per_page: Optional[int] = 10000  # UNLIMITED: Use maximum
    save_to_db: Optional[bool] = True
    with_ai: Optional[bool] = True

class ExecutiveOrderSearchRequest(BaseModel):
    category: Optional[str] = None
    search: Optional[str] = None
    page: int = 1
    per_page: int = 1000
    sort_by: str = "signing_date"
    sort_order: str = "desc"
    user_id: Optional[str] = None

class HighlightCreateRequest(BaseModel):
    user_id: int
    order_id: str
    order_type: str  # 'executive_order' or 'state_legislation'
    notes: Optional[str] = None
    priority_level: Optional[int] = 1
    tags: Optional[str] = None
    is_archived: Optional[bool] = False

class HighlightUpdateRequest(BaseModel):
    user_id: int
    notes: Optional[str] = None
    priority_level: Optional[int] = None
    tags: Optional[str] = None
    is_archived: Optional[bool] = None

class StateLegislationFetchRequest(BaseModel):
    states: List[str]
    save_to_db: bool = True
    bills_per_state: int = 25

class LegiScanSearchRequest(BaseModel):
    query: str
    state: str
    limit: int = 20
    save_to_db: bool = True
    process_one_by_one: bool = False
    with_ai_analysis: bool = True
    enhanced_ai: bool = True

# ===============================
# DATABASE SETUP
# ===============================
AZURE_SQL_AVAILABLE = True
HIGHLIGHTS_DB_AVAILABLE = True
EXECUTIVE_ORDERS_AVAILABLE = True

# Simple Executive Orders integration
try:
    from simple_executive_orders import fetch_executive_orders_simple_integration
    SIMPLE_EO_AVAILABLE = True
    logger.info("✅ Simple Executive Orders API available")
except ImportError as e:
    logger.warning(f"⚠️ Simple Executive Orders API not available: {e}")
    SIMPLE_EO_AVAILABLE = False

# LegiScan API integration - FIXED with better error handling
#try:
#    from legiscan_api import LegiScanAPI
#
#    # Environment detection
#    raw_env = os.getenv("ENVIRONMENT", "development")
#    environment = "production" if raw_env == "production" or bool(os.getenv("CONTAINER_APP_NAME") or os.getenv("MSI_ENDPOINT")) else "development"
#
#    
#    # First check if API key is in environment
#    LEGISCAN_API_KEY = os.getenv('LEGISCAN_API_KEY')
#    if not LEGISCAN_API_KEY:
#        logger.warning("⚠️ LEGISCAN_API_KEY not found in environment variables")
#        
#        # For testing, check common variations
#        for var_name in ['LEGISCAN_API_KEY', 'legiscan_api_key', 'LEGISCAN_KEY']:
#            value = os.getenv(var_name)
#            if value:
#                LEGISCAN_API_KEY = value
#                logger.info(f"✅ Found LegiScan API key in alternate variable: {var_name}")
#                break
#                
#        # Last resort - hardcode for testing only (remove in production)
#        if not LEGISCAN_API_KEY and environment != "production":
#            LEGISCAN_API_KEY = 'e3bd77ddffa618452dbe7e9bd3ea3a35'  # Testing only
#            logger.warning("⚠️ Using hardcoded LegiScan API key for testing")
#    
#    # Set in environment for LegiScanAPI class to use
#    os.environ['LEGISCAN_API_KEY'] = LEGISCAN_API_KEY
#    
#    LEGISCAN_AVAILABLE = True
#    logger.info("✅ LegiScan API imported successfully")
#    
#    # Test initialization - but handle errors more gracefully
#    try:
#        test_legiscan = LegiScanAPI()
#        LEGISCAN_INITIALIZED = True
#        logger.info("✅ LegiScan API initialized successfully")
#    except Exception as e:
#        logger.warning(f"⚠️ LegiScan API initialization failed: {e}")
#        LEGISCAN_INITIALIZED = False
#        
#except ImportError as e:
#    logger.warning(f"❌ LegiScan API import failed: {e}")
#    LEGISCAN_AVAILABLE = False
#    LEGISCAN_INITIALIZED = False


LEGISCAN_AVAILABLE = False
LEGISCAN_INITIALIZED = False

if LEGISCAN_API_KEY:
    LEGISCAN_AVAILABLE = True
    LEGISCAN_INITIALIZED = True



# ===============================
# UNLIMITED FEDERAL REGISTER FETCH
# ===============================
async def get_federal_register_count():
    """Get total count from Federal Register API without fetching all data"""
    try:
        base_url = "https://www.federalregister.gov/api/v1"
        
        start_date = "01/20/2025"
        end_date = datetime.now().strftime('%m/%d/%Y')
        
        base_params = {
            'conditions[correction]': '0',
            'conditions[president]': 'donald-trump',
            'conditions[presidential_document_type]': 'executive_order',
            'conditions[signing_date][gte]': start_date,
            'conditions[signing_date][lte]': end_date,
            'conditions[type][]': 'PRESDOCU',
            'fields[]': ['document_number'],
            'include_pre_1994_docs': 'true',
            'maximum_per_page': '10000',  # UNLIMITED
            'order': 'executive_order',
            'per_page': '1'
        }
        
        response = requests.get(f"{base_url}/documents.json", params=base_params, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            total_count = data.get('count', 0)
            logger.info(f"📊 Federal Register reports {total_count} total executive orders")
            return total_count
        else:
            logger.error(f"❌ Federal Register API error: {response.status_code}")
            return 0
            
    except Exception as e:
        logger.error(f"❌ Error getting Federal Register count: {e}")
        return 0

def get_database_count():
    """Get the count of executive orders in the database"""
    try:
        conn = get_database_connection()
        if not conn:
            logger.error("❌ Cannot get database connection for count check")
            return 0
            
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM dbo.executive_orders")
        count = cursor.fetchone()[0]
        
        cursor.close()
        conn.close()
        
        return count
    except Exception as e:
        logger.error(f"❌ Error getting database count: {e}")
        return 0

async def fetch_all_executive_orders_unlimited() -> Dict:
    """
    UNLIMITED: Fetch ALL executive orders from Federal Register API with NO LIMITS
    """
    try:
        logger.info("🚀 Fetching ALL Executive Orders from Federal Register (UNLIMITED)")
        
        base_url = "https://www.federalregister.gov/api/v1/documents.json"
        
        # UNLIMITED parameters - use maximum allowed by API
        base_params = {
            'conditions[correction]': '0',
            'conditions[president]': 'donald-trump',
            'conditions[presidential_document_type]': 'executive_order',
            'conditions[signing_date][gte]': '01/20/2025',
            'conditions[signing_date][lte]': datetime.now().strftime('%m/%d/%Y'),
            'conditions[type][]': 'PRESDOCU',
            'fields[]': [
                'citation', 'document_number', 'html_url', 'pdf_url', 'type',
                'subtype', 'publication_date', 'signing_date', 'title',
                'executive_order_number', 'full_text_xml_url', 'body_html_url',
                'json_url', 'abstract'
            ],
            'include_pre_1994_docs': 'true',
            'maximum_per_page': '10000',  # UNLIMITED: Maximum allowed
            'per_page': '10000',          # UNLIMITED: Maximum allowed
            'order': 'executive_order'
        }
        
        all_orders = []
        page = 1
        
        # UNLIMITED: Keep fetching until we have ALL orders
        while True:
            params = base_params.copy()
            params['page'] = page
            
            logger.info(f"🔄 Fetching page {page} from Federal Register API...")
            
            async with aiohttp.ClientSession() as session:
                async with session.get(base_url, params=params, timeout=60) as response:
                    response.raise_for_status()
                    data = await response.json()
                    
                    results = data.get('results', [])
                    count = data.get('count', 0)
                    total_pages = data.get('total_pages', 1)
                    
                    logger.info(f"📄 Page {page}: Got {len(results)} orders, Total available: {count}")
                    
                    if not results:
                        logger.info("🔚 No more results, breaking pagination loop")
                        break
                    
                    # Process and add orders
                    for order in results:
                        processed_order = {
                            'document_number': order.get('document_number', ''),
                            'eo_number': order.get('executive_order_number', ''),
                            'executive_order_number': order.get('executive_order_number', ''),
                            'title': order.get('title', ''),
                            'summary': order.get('abstract', ''),
                            'description': order.get('abstract', ''),
                            'signing_date': order.get('signing_date', ''),
                            'publication_date': order.get('publication_date', ''),
                            'citation': order.get('citation', ''),
                            'presidential_document_type': order.get('type', 'executive_order'),
                            'html_url': order.get('html_url', ''),
                            'pdf_url': order.get('pdf_url', ''),
                            'trump_2025_url': order.get('html_url', ''),
                            'full_text_xml_url': order.get('full_text_xml_url', ''),
                            'body_html_url': order.get('body_html_url', ''),
                            'json_url': order.get('json_url', ''),
                            'category': 'civic',
                            'source': 'Federal Register API',
                            'president': 'donald-trump',
                            'raw_data_available': True,
                            'processing_status': 'fetched',
                            'created_at': datetime.now().isoformat(),
                            'last_updated': datetime.now().isoformat()
                        }
                        all_orders.append(processed_order)
                    
                    # Check if we've reached the end
                    if page >= total_pages:
                        logger.info(f"🔚 Reached final page {page} of {total_pages}")
                        break
                    
                    page += 1
                    await asyncio.sleep(0.5)
        
        logger.info(f"✅ UNLIMITED FETCH COMPLETE: Retrieved {len(all_orders)} total executive orders")
        
        return {
            'success': True,
            'results': all_orders,
            'count': len(all_orders),
            'total_found': len(all_orders),
            'pages_fetched': page - 1,
            'method': 'unlimited_federal_register_fetch',
            'date_range_used': f"01/20/2025 to {datetime.now().strftime('%m/%d/%Y')}",
            'message': f"Successfully fetched all {len(all_orders)} executive orders with no limits"
        }
        
    except Exception as e:
        logger.error(f"❌ Error in unlimited fetch: {e}")
        return {
            'success': False,
            'error': str(e),
            'results': [],
            'count': 0
        }

# ===============================
# ENHANCED AI PROCESSING
# ===============================
def clean_summary_format(text: str) -> str:
    """Clean and format executive summary"""
    if not text:
        return "<p>No summary available</p>"
    
    text = re.sub(r'^\s*[•\-\*]\s*', '', text, flags=re.MULTILINE)
    text = re.sub(r'^\s*\d+\.\s*', '', text, flags=re.MULTILINE)
    
    sentences = text.strip().split('. ')
    
    if len(sentences) <= 3:
        return f"<p>{'. '.join(sentences)}</p>"
    else:
        mid = len(sentences) // 2
        para1 = '. '.join(sentences[:mid]) + '.'
        para2 = '. '.join(sentences[mid:])
        return f"<p>{para1}</p><p>{para2}</p>"

def format_talking_points(text: str) -> str:
    """Format talking points as proper numbered list"""
    if not text:
        return "<p>No talking points available</p>"
    
    lines = text.strip().split('\n')
    points = []
    
    for line in lines:
        line = line.strip()
        if re.match(r'^\d+\.', line):
            content = re.sub(r'^\d+\.\s*', '', line)
            if content:
                points.append(content)
    
    if len(points) < 5:
        while len(points) < 5:
            points.append("Additional analysis point to be determined based on further review.")
    
    points = points[:5]
    
    html_points = []
    for i, point in enumerate(points, 1):
        point = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', point)
        html_points.append(f"<li><strong>{i}.</strong> {point}</li>")
    
    return f"<ol class='talking-points'>{' '.join(html_points)}</ol>"

def format_business_impact(text: str) -> str:
    """Format business impact with clean, professional structure"""
    if not text:
        return "<p>No business impact analysis available</p>"
    
    text = re.sub(r'^---+\s*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'^\*\*([^*]+):\*\*', r'<strong>\1:</strong>', text, flags=re.MULTILINE)
    
    sections = {
        'risk': [],
        'opportunity': [],
        'summary': []
    }
    
    current_section = None
    lines = text.strip().split('\n')
    
    for line in lines:
        line = line.strip()
        if not line or line == '---':
            continue
            
        line_lower = line.lower()
        if any(keyword in line_lower for keyword in ['risk', 'regulatory and market uncertainty']):
            current_section = 'risk'
            if ':' in line and line.split(':', 1)[1].strip():
                content = line.split(':', 1)[1].strip()
                if content:
                    sections[current_section].append(content)
            continue
        elif any(keyword in line_lower for keyword in ['opportunity', 'increased investment', 'market opportunity']):
            current_section = 'opportunity'
            if ':' in line and line.split(':', 1)[1].strip():
                content = line.split(':', 1)[1].strip()
                if content:
                    sections[current_section].append(content)
            continue
        elif any(keyword in line_lower for keyword in ['summary']):
            current_section = 'summary'
            if ':' in line and line.split(':', 1)[1].strip():
                content = line.split(':', 1)[1].strip()
                if content:
                    sections[current_section].append(content)
            continue
        
        if line.startswith('•') or line.startswith('-') or line.startswith('*'):
            bullet_content = re.sub(r'^[•\-*]\s*', '', line).strip()
            if bullet_content and current_section:
                sections[current_section].append(bullet_content)
        elif current_section and line and not line.startswith('**'):
            sections[current_section].append(line)
    
    html_parts = []
    
    if sections['risk']:
        html_parts.append('<div class="business-impact-section risk-section">')
        html_parts.append('<h4>Risk Assessment</h4>')
        html_parts.append('<div class="risk-content">')
        
        for item in sections['risk'][:3]:
            clean_item = re.sub(r'^[•\-*]\s*', '', item).strip()
            clean_item = re.sub(r'^\*\*([^*]+):\*\*\s*', r'<strong>\1:</strong> ', clean_item)
            
            if clean_item:
                html_parts.append(f'<p>• {clean_item}</p>')
        
        html_parts.append('</div></div>')
    
    if sections['opportunity']:
        html_parts.append('<div class="business-impact-section opportunity-section">')
        html_parts.append('<h4>Market Opportunity</h4>')
        html_parts.append('<div class="opportunity-content">')
        
        for item in sections['opportunity'][:3]:
            clean_item = re.sub(r'^[•\-*]\s*', '', item).strip()
            clean_item = re.sub(r'^\*\*([^*]+):\*\*\s*', r'<strong>\1:</strong> ', clean_item)
            
            if clean_item:
                html_parts.append(f'<p>• {clean_item}</p>')
        
        html_parts.append('</div></div>')
    
    if sections['summary']:
        html_parts.append('<div class="business-impact-section summary-section">')
        html_parts.append('<h4>Summary</h4>')
        html_parts.append('<div class="summary-content">')
        
        for item in sections['summary'][:2]:
            clean_item = re.sub(r'^[•\-*]\s*', '', item).strip()
            clean_item = re.sub(r'^\*\*([^*]+):\*\*\s*', r'<strong>\1:</strong> ', clean_item)
            
            if clean_item:
                html_parts.append(f'<p>{clean_item}</p>')
        
        html_parts.append('</div></div>')
    
    return ''.join(html_parts) if html_parts else '<p>Business impact analysis processing...</p>'

def categorize_bill_enhanced(title: str, description: str) -> BillCategory:
    """Enhanced bill categorization"""
    content = f"{title} {description}".lower().strip()
    
    if not content:
        return BillCategory.NOT_APPLICABLE
    
    # Check for "all practice areas" keywords
    if any(word in content for word in ['all practice', 'multiple area', 'cross-disciplinary', 'interdisciplinary']):
        return BillCategory.ALL_PRACTICE_AREAS
    elif any(word in content for word in ['health', 'medical', 'healthcare', 'medicine', 'hospital', 'patient', 'medicare', 'medicaid']):
        return BillCategory.HEALTHCARE
    elif any(word in content for word in ['education', 'school', 'student', 'university', 'college', 'learning', 'teacher']):
        return BillCategory.EDUCATION
    elif any(word in content for word in ['infrastructure', 'engineering', 'construction', 'bridge', 'road', 'technology', 'broadband']):
        return BillCategory.ENGINEERING
    elif any(word in content for word in ['government', 'federal', 'agency', 'department', 'administration', 'policy', 'regulation', 'civic']):
        return BillCategory.CIVIC
    else:
        return BillCategory.NOT_APPLICABLE

async def enhanced_ai_analysis(text: str, prompt_type: PromptType, temperature: float = 0.1, context: str = "") -> str:
    """Enhanced AI processing with distinct prompts and formatting"""
    try:
        if not enhanced_ai_client:
            return f"<p>AI client not available for {prompt_type.value}</p>"
        
        max_input_length = 4000
        if len(text) > max_input_length:
            text = text[:max_input_length] + "..."
        
        if context:
            text = f"Context: {context}\n\n{text}"
        
        prompt = ENHANCED_PROMPTS[prompt_type].format(text=text)
        
        messages = [
            {"role": "system", "content": ENHANCED_SYSTEM_MESSAGES[prompt_type]},
            {"role": "user", "content": prompt}
        ]

        if prompt_type == PromptType.EXECUTIVE_SUMMARY:
            max_tokens = 300
            temperature = 0.1
        elif prompt_type == PromptType.KEY_TALKING_POINTS:
            max_tokens = 400
            temperature = 0.2
        elif prompt_type == PromptType.BUSINESS_IMPACT:
            max_tokens = 500
            temperature = 0.15
        
        response = await enhanced_ai_client.chat.completions.create(
            model=MODEL_NAME,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=30,
            top_p=0.95,
            frequency_penalty=0.3,
            presence_penalty=0.2,
            stop=["6.", "7.", "8.", "9."] if prompt_type == PromptType.KEY_TALKING_POINTS else None
        )

        raw_response = response.choices[0].message.content

        # Enhanced formatting for each type
        if prompt_type == PromptType.EXECUTIVE_SUMMARY:
            formatted_response = clean_summary_format(raw_response)
        elif prompt_type == PromptType.KEY_TALKING_POINTS:
            formatted_response = format_talking_points(raw_response)
        elif prompt_type == PromptType.BUSINESS_IMPACT:
            formatted_response = format_business_impact(raw_response)
        else:
            formatted_response = f"<p>{raw_response}</p>"

        return formatted_response

    except Exception as e:
        logger.error(f"❌ Error during enhanced AI {prompt_type.value} call: {e}")
        return f"<p>Error generating {prompt_type.value.replace('_', ' ')}: {str(e)}</p>"

async def enhanced_bill_analysis(bill_data: Dict, context: str = "") -> Dict[str, str]:
    """Comprehensive AI analysis of a bill with enhanced distinct content"""
    try:
        title = bill_data.get('title', '')
        description = bill_data.get('description', '')
        bill_number = bill_data.get('bill_number', '')
        state = bill_data.get('state', '')
        session = bill_data.get('session', {})
        session_name = session.get('session_name', '') if isinstance(session, dict) else ''
        sponsors = bill_data.get('sponsors', [])
        
        base_context = f"{state} {bill_number}" if state and bill_number else "State Legislation"
        
        content_parts = []
        if title:
            content_parts.append(f"Title: {title}")
        if state:
            content_parts.append(f"State: {state}")
        if bill_number:
            content_parts.append(f"Bill Number: {bill_number}")
        if description:
            content_parts.append(f"Description: {description}")
        if session_name:
            content_parts.append(f"Legislative Session: {session_name}")
        if sponsors and len(sponsors) > 0:
            sponsor_names = []
            for sponsor in sponsors[:3]:
                if isinstance(sponsor, dict):
                    name = sponsor.get('name', '')
                    if name:
                        sponsor_names.append(name)
            if sponsor_names:
                content_parts.append(f"Primary Sponsors: {', '.join(sponsor_names)}")
        
        content = "\n\n".join(content_parts)
        
        category = categorize_bill_enhanced(title, description)
        
        try:
            summary_task = enhanced_ai_analysis(content, PromptType.EXECUTIVE_SUMMARY, context=f"Executive Summary - {base_context}")
            talking_points_task = enhanced_ai_analysis(content, PromptType.KEY_TALKING_POINTS, context=f"Stakeholder Discussion - {base_context}")
            business_impact_task = enhanced_ai_analysis(content, PromptType.BUSINESS_IMPACT, context=f"Business Analysis - {base_context}")
            
            summary_result, talking_points_result, business_impact_result = await asyncio.gather(
                summary_task, talking_points_task, business_impact_task, return_exceptions=True
            )
            
            if isinstance(summary_result, Exception):
                summary_result = f"<p>Error generating summary: {str(summary_result)}</p>"
            if isinstance(talking_points_result, Exception):
                talking_points_result = f"<p>Error generating talking points: {str(talking_points_result)}</p>"
            if isinstance(business_impact_result, Exception):
                business_impact_result = f"<p>Error generating business impact: {str(business_impact_result)}</p>"
                
        except Exception as e:
            logger.error(f"❌ Error in enhanced AI analysis tasks: {e}")
            summary_result = f"<p>Error generating summary: {str(e)}</p>"
            talking_points_result = f"<p>Error generating talking points: {str(e)}</p>"
            business_impact_result = f"<p>Error generating business impact: {str(e)}</p>"
        
        return {
            'ai_summary': summary_result,
            'ai_executive_summary': summary_result,
            'ai_talking_points': talking_points_result,
            'ai_key_points': talking_points_result,
            'ai_business_impact': business_impact_result,
            'ai_potential_impact': business_impact_result,
            'category': category.value,
            'ai_version': 'enhanced_azure_openai_v2',
            'analysis_timestamp': datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Error in enhanced bill analysis: {e}")
        error_msg = f"<p>Enhanced AI analysis failed: {str(e)}</p>"
        return {
            'ai_summary': error_msg,
            'ai_executive_summary': error_msg,
            'ai_talking_points': error_msg,
            'ai_key_points': error_msg,
            'ai_business_impact': error_msg,
            'ai_potential_impact': error_msg,
            'category': BillCategory.NOT_APPLICABLE.value,
            'ai_version': 'error',
            'analysis_timestamp': datetime.now().isoformat()
        }

# ===============================
# ENHANCED LEGISCAN CLIENT
# ===============================
class EnhancedLegiScanClient:
    """Enhanced LegiScan client with comprehensive AI integration"""
    
    def __init__(self, api_key: str = None, rate_limit_delay: float = 0.5):
        self.api_key = api_key or LEGISCAN_API_KEY
        self.rate_limit_delay = rate_limit_delay
        self.base_url = "https://api.legiscan.com"
        
        if not self.api_key:
            raise ValueError("LegiScan API key is required")
    
    def _build_url(self, operation: str, params: Optional[Dict] = None) -> str:
        """Build LegiScan API URL"""
        if params is None:
            params = {}
        
        param_str = '&'.join([f"{k}={v}" for k, v in params.items()])
        return f"{self.base_url}/?key={self.api_key}&op={operation}&{param_str}"
    
    async def _api_request(self, url: str) -> Dict[str, Any]:
        """Make async API request with error handling"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    response.raise_for_status()
                    data = await response.json()
                    
                    if data.get('status') == "ERROR":
                        error_msg = data.get('alert', {}).get('message', 'Unknown API error')
                        raise Exception(f"LegiScan API Error: {error_msg}")
                    
                    await asyncio.sleep(self.rate_limit_delay)
                    return data
                    
        except Exception as e:
            logger.error(f"❌ Enhanced LegiScan API request failed: {e}")
            raise
    
    async def search_bills_enhanced(self, state: str, query: str, limit: int = 20) -> Dict:
        """Enhanced bill search with comprehensive data"""
        try:
            params = {'query': query, 'year': 2, 'page': 1}
            if state:
                params['state'] = state
            
            url = self._build_url('search', params)
            data = await self._api_request(url)
            search_result = data.get('searchresult', {})
            
            summary = search_result.pop('summary', {})
            results = [search_result[key] for key in search_result if key != 'summary']
            
            if limit and len(results) > limit:
                results = results[:limit]
            
            return {
                'success': True,
                'summary': summary,
                'results': results,
                'bills_found': len(results)
            }
            
        except Exception as e:
            logger.error(f"❌ Error in enhanced search: {e}")
            return {
                'success': False,
                'error': str(e),
                'results': []
            }
    
    async def get_bill_detailed(self, bill_id: int) -> Dict:
        """Get detailed bill information"""
        try:
            url = self._build_url('getBill', {'id': bill_id})
            data = await self._api_request(url)
            
            bill = data.get('bill', {})
            return bill
            
        except Exception as e:
            logger.error(f"❌ Error fetching detailed bill {bill_id}: {e}")
            return {}
    
    async def enhanced_search_and_analyze(self, state: str, query: str, limit: int = 20, 
                                        with_ai: bool = True, db_manager = None) -> Dict:
        """Enhanced search and analyze workflow with one-by-one processing"""
        try:
            search_result = await self.search_bills_enhanced(state, query, limit)
            
            if not search_result.get('success') or not search_result.get('results'):
                return {
                    'success': False,
                    'error': 'No bills found for search query',
                    'bills': []
                }
            
            search_results = search_result['results']
            analyzed_bills = []
            
            for i, bill_summary in enumerate(search_results, 1):
                try:
                    bill_id = bill_summary.get('bill_id')
                    if not bill_id:
                        continue
                    
                    detailed_bill = await self.get_bill_detailed(int(bill_id))
                    if not detailed_bill:
                        continue
                    
                    ai_analysis = {}
                    if with_ai and enhanced_ai_client:
                        try:
                            ai_analysis = await enhanced_bill_analysis(detailed_bill, f"Search: {query}")
                        except Exception as e:
                            logger.warning(f"❌ Enhanced AI analysis failed for bill {bill_id}: {e}")
                            ai_analysis = {
                                'ai_summary': f'<p>AI analysis failed: {str(e)}</p>',
                                'ai_talking_points': '<p>AI analysis not available</p>',
                                'ai_business_impact': '<p>AI analysis not available</p>',
                                'category': 'not_applicable',
                                'ai_version': 'error'
                            }
                    
                    complete_bill = {
                        'bill_id': bill_id,
                        'bill_number': detailed_bill.get('bill_number', ''),
                        'title': detailed_bill.get('title', ''),
                        'description': detailed_bill.get('description', ''),
                        'state': state,
                        'state_abbr': state,
                        'status': detailed_bill.get('status', ''),
                        'session_id': detailed_bill.get('session', {}).get('session_id', ''),
                        'session_name': detailed_bill.get('session', {}).get('session_name', ''),
                        'bill_type': detailed_bill.get('bill_type', 'bill'),
                        'body': detailed_bill.get('body', ''),
                        'introduced_date': detailed_bill.get('status_date', ''),
                        'last_action_date': detailed_bill.get('status_date', ''),
                        'legiscan_url': detailed_bill.get('state_link', ''),
                        'pdf_url': '',
                        'sponsors': detailed_bill.get('sponsors', []),
                        'committee': detailed_bill.get('committee', []),
                        'history': detailed_bill.get('history', []),
                        'texts': detailed_bill.get('texts', []),
                        'search_query': query,
                        'search_relevance': bill_summary.get('relevance', 0),
                        'source': 'Enhanced LegiScan API',
                        'created_at': datetime.now().isoformat(),
                        'last_updated': datetime.now().isoformat(),
                        'reviewed': False
                    }
                    
                    complete_bill.update(ai_analysis)
                    
                    if db_manager:
                        try:
                            success = db_manager.save_bill(complete_bill)
                            if success:
                                logger.info(f"✅ Saved bill {bill_id} to database")
                        except Exception as e:
                            logger.warning(f"❌ Database save error for bill {bill_id}: {e}")
                    
                    analyzed_bills.append(complete_bill)
                    
                except Exception as e:
                    logger.warning(f"❌ Error processing bill {i}: {e}")
                    continue
            
            return {
                'success': True,
                'bills': analyzed_bills,
                'bills_found': len(search_results),
                'bills_processed': len(analyzed_bills),
                'query': query,
                'state': state,
                'timestamp': datetime.now().isoformat(),
                'processing_results': {
                    'total_fetched': len(search_results),
                    'total_processed': len(analyzed_bills),
                    'total_saved': len(analyzed_bills) if db_manager else 0,
                    'errors': []
                }
            }
            
        except Exception as e:
            logger.error(f"❌ Error in enhanced search and analyze: {e}")
            return {
                'success': False,
                'error': str(e),
                'bills': []
            }

# ===============================
# DATABASE HELPERS
# ===============================
class StateLegislationDatabaseManager:
    """Database manager for one-by-one bill processing"""
    
    def __init__(self, connection):
        self.connection = connection
    
    def save_bill(self, bill_data: dict):
        """Save a single bill to the database"""
        try:
            cursor = self.connection.cursor()
            
            check_query = "SELECT id FROM dbo.state_legislation WHERE bill_id = ?"
            cursor.execute(check_query, bill_data.get('bill_id'))
            existing = cursor.fetchone()
            
            if existing:
                update_query = """
                UPDATE dbo.state_legislation SET
                    bill_number = ?, title = ?, description = ?, state = ?, state_abbr = ?,
                    status = ?, category = ?, introduced_date = ?, last_action_date = ?,
                    session_id = ?, session_name = ?, bill_type = ?, body = ?,
                    legiscan_url = ?, pdf_url = ?, ai_summary = ?, ai_executive_summary = ?,
                    ai_talking_points = ?, ai_key_points = ?, ai_business_impact = ?,
                    ai_potential_impact = ?, ai_version = ?, last_updated = ?, reviewed = ?
                WHERE bill_id = ?
                """
                
                values = (
                    bill_data.get('bill_number', ''),
                    bill_data.get('title', ''),
                    bill_data.get('description', ''),
                    bill_data.get('state', ''),
                    bill_data.get('state_abbr', ''),
                    bill_data.get('status', ''),
                    bill_data.get('category', ''),
                    bill_data.get('introduced_date'),
                    bill_data.get('last_action_date'),
                    bill_data.get('session_id', ''),
                    bill_data.get('session_name', ''),
                    bill_data.get('bill_type', ''),
                    bill_data.get('body', ''),
                    bill_data.get('legiscan_url', ''),
                    bill_data.get('pdf_url', ''),
                    bill_data.get('ai_summary', ''),
                    bill_data.get('ai_executive_summary', ''),
                    bill_data.get('ai_talking_points', ''),
                    bill_data.get('ai_key_points', ''),
                    bill_data.get('ai_business_impact', ''),
                    bill_data.get('ai_potential_impact', ''),
                    bill_data.get('ai_version', '1.0'),
                    datetime.utcnow(),
                    bill_data.get('reviewed', False),
                    bill_data.get('bill_id')
                )
                
                cursor.execute(update_query, values)
                
            else:
                insert_query = """
                INSERT INTO dbo.state_legislation (
                    bill_id, bill_number, title, description, state, state_abbr,
                    status, category, introduced_date, last_action_date,
                    session_id, session_name, bill_type, body,
                    legiscan_url, pdf_url, ai_summary, ai_executive_summary,
                    ai_talking_points, ai_key_points, ai_business_impact,
                    ai_potential_impact, ai_version, created_at, last_updated, reviewed
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """
                
                values = (
                    bill_data.get('bill_id', ''),
                    bill_data.get('bill_number', ''),
                    bill_data.get('title', ''),
                    bill_data.get('description', ''),
                    bill_data.get('state', ''),
                    bill_data.get('state_abbr', ''),
                    bill_data.get('status', ''),
                    bill_data.get('category', ''),
                    bill_data.get('introduced_date'),
                    bill_data.get('last_action_date'),
                    bill_data.get('session_id', ''),
                    bill_data.get('session_name', ''),
                    bill_data.get('bill_type', ''),
                    bill_data.get('body', ''),
                    bill_data.get('legiscan_url', ''),
                    bill_data.get('pdf_url', ''),
                    bill_data.get('ai_summary', ''),
                    bill_data.get('ai_executive_summary', ''),
                    bill_data.get('ai_talking_points', ''),
                    bill_data.get('ai_key_points', ''),
                    bill_data.get('ai_business_impact', ''),
                    bill_data.get('ai_potential_impact', ''),
                    bill_data.get('ai_version', '1.0'),
                    datetime.utcnow(),
                    datetime.utcnow(),
                    bill_data.get('reviewed', False)
                )
                
                cursor.execute(insert_query, values)
            
            self.connection.commit()
            return True
            
        except Exception as e:
            logger.error(f"❌ Error saving bill {bill_data.get('bill_id', 'unknown')}: {e}")
            self.connection.rollback()
            return False

def get_azure_sql_connection():
    """Get Azure SQL connection"""
    try:
        return get_database_connection()
    except Exception as e:
        logger.error(f"❌ Azure SQL connection failed: {e}")
        return None

def get_ai_client():
    """Get AI client for bill analysis"""
    try:
        if os.getenv('AZURE_ENDPOINT') and os.getenv('AZURE_KEY'):
            import openai
            client = openai.AzureOpenAI(
                api_key=os.getenv('AZURE_KEY'),
                api_version="2024-02-15-preview",
                azure_endpoint=os.getenv('AZURE_ENDPOINT'),
                azure_deployment=os.getenv('AZURE_MODEL_NAME', 'gpt-4')
            )
            return client
        elif os.getenv('OPENAI_API_KEY'):
            import openai
            client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
            return client
        else:
            return None
    except Exception as e:
        logger.error(f"❌ AI client setup failed: {e}")
        return None

# ===============================
# STATE LEGISLATION DATABASE FUNCTIONS
# ===============================
def get_state_legislation_from_db(limit=1000, offset=0, filters=None):
    """Get state legislation from Azure SQL database - FIXED with proper state mapping"""
    try:
        print(f"🔍 DEBUG: Getting state legislation - limit={limit}, offset={offset}, filters={filters}")
        
        # State name to abbreviation mapping
        STATE_NAME_TO_ABBR = {
            'california': 'CA',
            'texas': 'TX',
            'florida': 'FL',
            'new york': 'NY',
            'pennsylvania': 'PA',
            'illinois': 'IL',
            'ohio': 'OH',
            'georgia': 'GA',
            'north carolina': 'NC',
            'michigan': 'MI',
            'new jersey': 'NJ',
            'virginia': 'VA',
            'washington': 'WA',
            'arizona': 'AZ',
            'massachusetts': 'MA',
            'tennessee': 'TN',
            'indiana': 'IN',
            'maryland': 'MD',
            'missouri': 'MO',
            'wisconsin': 'WI',
            'colorado': 'CO',
            'minnesota': 'MN',
            'south carolina': 'SC',
            'alabama': 'AL',
            'louisiana': 'LA',
            'kentucky': 'KY',
            'oregon': 'OR',
            'oklahoma': 'OK',
            'connecticut': 'CT',
            'utah': 'UT',
            'iowa': 'IA',
            'nevada': 'NV',
            'arkansas': 'AR',
            'mississippi': 'MS',
            'kansas': 'KS',
            'new mexico': 'NM',
            'nebraska': 'NE',
            'west virginia': 'WV',
            'idaho': 'ID',
            'hawaii': 'HI',
            'new hampshire': 'NH',
            'maine': 'ME',
            'montana': 'MT',
            'rhode island': 'RI',
            'delaware': 'DE',
            'south dakota': 'SD',
            'north dakota': 'ND',
            'alaska': 'AK',
            'vermont': 'VT',
            'wyoming': 'WY'
        }
        
        # Build SQL query for state legislation
        base_query = """
        SELECT 
            id, bill_id, bill_number, title, description, state, state_abbr,
            status, category, introduced_date, last_action_date, session_id,
            session_name, bill_type, body, legiscan_url, pdf_url,
            ai_summary, ai_executive_summary, ai_talking_points, ai_key_points,
            ai_business_impact, ai_potential_impact, ai_version,
            created_at, last_updated, reviewed
        FROM dbo.state_legislation
        """
        
        # Add WHERE clause if filters exist
        where_conditions = []
        params = []
        
        if filters:
            if filters.get('state'):
                state_value = filters['state'].lower().strip()
                print(f"🔍 DEBUG: Filtering by state: '{state_value}'")
                
                # Convert full state name to abbreviation if needed
                if state_value in STATE_NAME_TO_ABBR:
                    state_abbr = STATE_NAME_TO_ABBR[state_value]
                    print(f"🔍 DEBUG: Converted '{state_value}' to abbreviation '{state_abbr}'")
                    state_value = state_abbr
                
                # Now search using both state and state_abbr columns
                # Since your data has TX in both columns, we'll search both
                where_conditions.append("(state = ? OR state_abbr = ? OR UPPER(state) = ? OR UPPER(state_abbr) = ?)")
                params.extend([state_value.upper(), state_value.upper(), state_value.upper(), state_value.upper()])
                print(f"🔍 DEBUG: Searching for state: {state_value.upper()}")
            
            if filters.get('category'):
                where_conditions.append("category = ?")
                params.append(filters['category'])
                print(f"🔍 DEBUG: Added category filter: {filters['category']}")
            
            if filters.get('search'):
                where_conditions.append("(title LIKE ? OR description LIKE ? OR ai_summary LIKE ?)")
                search_term = f"%{filters['search']}%"
                params.extend([search_term, search_term, search_term])
                print(f"🔍 DEBUG: Added search filter: {search_term}")
        
        if where_conditions:
            base_query += " WHERE " + " AND ".join(where_conditions)
        
        # Add ORDER BY and pagination
        base_query += " ORDER BY last_action_date DESC, introduced_date DESC"
        base_query += f" OFFSET {offset} ROWS FETCH NEXT {limit} ROWS ONLY"
        
        print(f"🔍 DEBUG: Final SQL Query: \n        {base_query}")
        print(f"🔍 DEBUG: Query parameters: {params}")
        
        # Execute query
        conn = get_azure_sql_connection()
        if not conn:
            return {'success': False, 'message': 'No database connection', 'results': [], 'count': 0}
        
        cursor = conn.cursor()
        
        # Get total count first
        count_query = "SELECT COUNT(*) FROM dbo.state_legislation"
        if where_conditions:
            count_query += " WHERE " + " AND ".join(where_conditions)
        
        try:
            cursor.execute(count_query, params if where_conditions else [])
            total_count = cursor.fetchone()[0]
            print(f"🔍 DEBUG: Total count from database: {total_count}")
        except Exception as e:
            print(f"❌ DEBUG: Error getting count: {e}")
            total_count = 0
        
        # Execute main query
        try:
            cursor.execute(base_query, params)
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            print(f"🔍 DEBUG: Raw rows fetched: {len(rows)}")
        except Exception as e:
            print(f"❌ DEBUG: Error executing main query: {e}")
            cursor.close()
            conn.close()
            return {'success': False, 'message': f'Query error: {str(e)}', 'results': [], 'count': 0}
        
        # Convert to API format
        results = []
        for i, row in enumerate(rows):
            try:
                db_record = dict(zip(columns, row))
                
                if i < 3:
                    print(f"🔍 DEBUG: Row {i+1}: bill_id={db_record.get('bill_id')}, title={db_record.get('title', '')[:30]}...")
                
                # Map database columns to API format
                api_record = {
                    # Core identification
                    'id': db_record.get('id'),
                    'bill_id': db_record.get('bill_id'),
                    'bill_number': db_record.get('bill_number'),
                    
                    # Content
                    'title': db_record.get('title', 'Untitled Bill'),
                    'description': db_record.get('description', ''),
                    'summary': db_record.get('ai_summary', ''),
                    
                    # Location - Convert TX back to full name for display
                    'state': db_record.get('state', ''),
                    'state_abbr': db_record.get('state_abbr', ''),
                    
                    # Status and metadata
                    'status': db_record.get('status', ''),
                    'category': db_record.get('category', 'civic'),
                    'session_id': db_record.get('session_id', ''),
                    'session_name': db_record.get('session_name', ''),
                    'bill_type': db_record.get('bill_type', 'bill'),
                    'body': db_record.get('body', ''),
                    
                    # Dates
                    'introduced_date': db_record.get('introduced_date'),
                    'last_action_date': db_record.get('last_action_date'),
                    'status_date': db_record.get('last_action_date'),
                    
                    # URLs
                    'legiscan_url': db_record.get('legiscan_url', ''),
                    'pdf_url': db_record.get('pdf_url', ''),
                    
                    # AI Analysis
                    'ai_summary': db_record.get('ai_summary', ''),
                    'ai_executive_summary': db_record.get('ai_executive_summary', ''),
                    'ai_talking_points': db_record.get('ai_talking_points', ''),
                    'ai_key_points': db_record.get('ai_key_points', ''),
                    'ai_business_impact': db_record.get('ai_business_impact', ''),
                    'ai_potential_impact': db_record.get('ai_potential_impact', ''),
                    'ai_version': db_record.get('ai_version', ''),
                    
                    # Timestamps
                    'created_at': db_record.get('created_at'),
                    'last_updated': db_record.get('last_updated'),
                    
                    # Source
                    'source': 'Database',

                    # Reviewed status
                    'reviewed': bool(db_record.get('reviewed', False))
                }
                
                # Format dates properly
                for date_field in ['introduced_date', 'last_action_date']:
                    if api_record.get(date_field):
                        try:
                            if hasattr(api_record[date_field], 'isoformat'):
                                api_record[date_field] = api_record[date_field].isoformat()
                            else:
                                api_record[date_field] = str(api_record[date_field])
                        except:
                            api_record[date_field] = str(api_record[date_field])
                
                results.append(api_record)
                
            except Exception as e:
                print(f"❌ DEBUG: Error processing row {i+1}: {e}")
                continue
        
        cursor.close()
        conn.close()
        
        print(f"🔍 DEBUG: Successfully processed {len(results)} state legislation records")
        
        return {
            'success': True,
            'results': results,
            'count': len(results),
            'total': total_count
        }
        
    except Exception as e:
        print(f"❌ Error in get_state_legislation_from_db: {e}")
        import traceback
        traceback.print_exc()
        return {
            'success': False,
            'message': f'Database error: {str(e)}',
            'results': [],
            'count': 0
        }

def save_state_legislation_to_db(bills):
    """Save state legislation to database"""
    try:
        if not AZURE_SQL_AVAILABLE:
            return 0
        
        cleaned_bills = []
        for bill in bills:
            cleaned_bill = dict(bill)
            if 'session' in cleaned_bill:
                del cleaned_bill['session']
            cleaned_bills.append(cleaned_bill)
        
        return save_legislation_to_azure_sql(cleaned_bills)
        
    except Exception as e:
        logger.error(f"❌ Error saving state legislation: {e}")
        return 0

def transform_orders_for_save(orders):
    """Transform executive orders for database save with proper field mapping"""
    
    transformed_orders = []
    
    for order in orders:
        # Get the best dates available
        signing_date = order.get('signing_date', '')
        publication_date = order.get('publication_date', '')
        
        # If no signing date, try to use publication date
        if not signing_date and publication_date:
            signing_date = publication_date
        
        # Create clean database record
        transformed_order = {
            'bill_id': f"eo-{order.get('eo_number', 'unknown')}",
            'bill_number': order.get('eo_number', ''),
            'title': order.get('title', ''),
            'description': order.get('summary', ''),
            'state': 'Federal',
            'state_abbr': 'US',
            'status': 'Signed',
            'category': order.get('category', 'civic'),
            'introduced_date': signing_date,  # Use signing_date as introduced_date
            'last_action_date': publication_date or signing_date,  # Use publication_date as last_action
            'session_id': '2025-trump-administration',
            'session_name': 'Trump 2025 Administration',
            'bill_type': 'executive_order',
            'body': 'executive',
            'legiscan_url': order.get('html_url', ''),
            'pdf_url': order.get('pdf_url', ''),
            'ai_summary': order.get('ai_summary', ''),
            'ai_executive_summary': order.get('ai_executive_summary', ''),
            'ai_talking_points': order.get('ai_talking_points', ''),
            'ai_key_points': order.get('ai_key_points', ''),
            'ai_business_impact': order.get('ai_business_impact', ''),
            'ai_potential_impact': order.get('ai_potential_impact', ''),
            'ai_version': order.get('ai_version', 'enhanced_v1'),
            'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'last_updated': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        transformed_orders.append(transformed_order)
    
    return transformed_orders

# ===============================
# FASTAPI APP SETUP
# ===============================


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown"""
    logger.info("🔄 Starting Complete LegislationVue API...")
    yield

app = FastAPI(
    title="Complete LegislationVue API - All Features",
    description="API with All Functionality Preserved + Unlimited Fetching",
    version="16.0.0-Complete",
    lifespan=lifespan
)

# Environment detection
raw_env = os.getenv("ENVIRONMENT", "development")
environment = "production" if raw_env == "production" or bool(os.getenv("CONTAINER_APP_NAME") or os.getenv("MSI_ENDPOINT")) else "development"

## CORS setup
#if environment == "production":
#    cors_origins = [
#        "https://legis-vue-frontend.jollyocean-a8149425.centralus.azurecontainerapps.io",
#        "http://legis-vue-frontend.jollyocean-a8149425.centralus.azurecontainerapps.io",
#    ]
#    logger.info(f"✅ CORS configured for production: {cors_origins}")
#else:
#    cors_origins = ["*"]  # Development allows all origins
#    logger.info(f"✅ CORS configured for development: all origins allowed")
cors_origins = ["*"]  # Development allows all origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=86400  # Cache preflight requests for 24 hours
)

# Import your routers
from status_endpoints import router as status_router
# Import any other routers you have

# Include the routers in the main app
app.include_router(status_router)
# Include any other routers

@app.options("/{path:path}")
async def options_handler(path: str):
    return {}



# ===============================
# CORE API ENDPOINTS
# ===============================
@app.get("/")
async def root():
    """Root endpoint with system status"""
    db_working = False
    try:
        db_working = test_database_connection()
    except:
        pass
    
    return {
        "message": "Complete LegislationVue API - All Features Preserved",
        "status": "healthy",
        "version": "16.0.0-Complete",
        "timestamp": datetime.now().isoformat(),
        "database": {
            "status": "connected" if db_working else "issues",
            "type": "Azure SQL"
        },
        "features": {
            "unlimited_federal_register_fetch": "✅ Active - No 20 order limit",
            "executive_orders_pipeline": "✅ Complete with AI",
            "state_legislation_pipeline": "✅ Complete with Enhanced AI",
            "legiscan_integration": "✅ Traditional + Enhanced",
            "enhanced_ai_processing": "✅ Multi-format analysis",
            "highlights_system": "✅ Full CRUD operations",
            "category_updates": "✅ PATCH endpoints",
            "review_status": "✅ PATCH endpoints",
            "count_checking": "✅ Federal Register vs Database",
            "debug_endpoints": "❌ Removed for production"
        },
        "environment": environment,
        "all_functionality_preserved": True
    }

@app.get("/api/status")
async def get_status():
    """Enhanced system status endpoint"""
    try:
        db_working = test_database_connection()
    except:
        db_working = False
    
    azure_sql_working = False
    if AZURE_SQL_AVAILABLE:
        try:
            azure_sql_working = test_azure_sql_connection()
        except:
            pass
    
    return {
        "environment": environment,
        "app_version": "16.0.0-Complete-All-Features",
        "database": {
            "status": "connected" if (db_working or azure_sql_working) else "connection_issues",
            "type": "Azure SQL Database" if AZURE_SQL_AVAILABLE else "Fallback",
            "connection": db_working,
            "azure_sql_connection": azure_sql_working,
            "highlights_enabled": HIGHLIGHTS_DB_AVAILABLE
        },
        "integrations": {
            "simple_executive_orders": "available" if SIMPLE_EO_AVAILABLE else "not_available",
            "azure_sql": "connected" if azure_sql_working else "not_configured",
            "highlights": "available" if HIGHLIGHTS_DB_AVAILABLE else "table_needed",
            "executive_orders_integration": "azure_sql_based" if EXECUTIVE_ORDERS_AVAILABLE else "not_available",
            "legiscan": "connected" if LEGISCAN_INITIALIZED else "not_configured",
            "enhanced_ai_analysis": "connected" if enhanced_ai_client else "not_configured",
            "one_by_one_processing": "available"
        },
        "enhanced_ai_features": {
            "client_available": enhanced_ai_client is not None,
            "model": MODEL_NAME,
            "endpoint": AZURE_ENDPOINT,
            "prompts": list(ENHANCED_PROMPTS.keys()),
            "categories": [cat.value for cat in BillCategory],
            "formatting": ["executive_summary", "talking_points", "business_impact"]
        },
        "features": {
            "unlimited_federal_register": "✅ No 20 order limit - fetch ALL orders",
            "executive_orders_full_pipeline": "✅ Fetch → AI → Database",
            "state_legislation_enhanced": "✅ LegiScan → Enhanced AI → Database",
            "persistent_highlights": "✅ Full CRUD with Azure SQL",
            "category_management": "✅ PATCH endpoints for updates",
            "review_status_tracking": "✅ PATCH endpoints for review updates",
            "count_checking": "✅ Federal Register vs Database comparison",
            "enhanced_one_by_one_processing": "✅ Bill-by-bill AI analysis and saving"
        },
        "supported_states": list(SUPPORTED_STATES.keys()),
        "api_keys_configured": {
            "azure_sql": AZURE_SQL_AVAILABLE,
            "legiscan": LEGISCAN_INITIALIZED,
            "enhanced_azure_ai": enhanced_ai_client is not None
        },
        "timestamp": datetime.now().isoformat()
    }

# ===============================
# EXECUTIVE ORDERS ENDPOINTS
# ===============================
@app.get("/api/executive-orders")
async def get_executive_orders(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(25, ge=1, le=1000, description="Items per page"),
    search: Optional[str] = Query(None, description="Search term"),
    category: Optional[str] = Query(None, description="Filter by category")
):
    """Get executive orders with pagination and filtering - INCLUDES reviewed field"""
    try:
        print(f"🔍 API: Getting executive orders page {page}, per_page {per_page}")
        
        # Calculate offset
        offset = (page - 1) * per_page
        
        # Build filters
        filters = {}
        if search:
            filters['search'] = search
        if category:
            filters['category'] = category
        
        # Get data from database - THIS WILL NOW INCLUDE reviewed field
        result = get_executive_orders_from_db(
            limit=per_page,
            offset=offset,
            filters=filters
        )
        
        if not result.get('success'):
            raise HTTPException(status_code=500, detail=result.get('message', 'Database error'))
        
        orders = result.get('results', [])
        total_count = result.get('total', 0)
        
        print(f"✅ API: Retrieved {len(orders)} orders (total: {total_count})")
        
        # Log a sample to verify reviewed field is included
        if orders:
            sample_order = orders[0]
            print(f"🔍 API: Sample order fields: {list(sample_order.keys())}")
            if 'reviewed' in sample_order:
                print(f"✅ API: reviewed field found: {sample_order['reviewed']}")
            else:
                print(f"❌ API: reviewed field MISSING from sample order")
        
        return {
            "results": orders,
            "page": page,
            "per_page": per_page,
            "total": total_count,
            "total_pages": max(1, (total_count + per_page - 1) // per_page),
            "has_next": offset + per_page < total_count,
            "has_prev": page > 1
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting executive orders: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/api/executive-orders/{id}/review-status")
async def update_executive_order_review_status_endpoint(
    id: str,
    request: dict
):
    """Update review status for an executive order"""
    try:
        reviewed = request.get('reviewed')
        if reviewed is None:
            raise HTTPException(status_code=400, detail="reviewed field is required")
        
        print(f"🔍 API: Updating review status for EO {id} to {reviewed}")
        
        # Import and update in database
        from executive_orders_db import update_executive_order_review_status
        result = update_executive_order_review_status(id, reviewed)
        
        if result.get('success'):
            print(f"✅ API: Successfully updated EO {id} review status to {reviewed}")
            return result
        else:
            print(f"❌ API: Failed to update EO {id}: {result.get('message')}")
            raise HTTPException(status_code=404, detail=result.get('message'))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating executive order review status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update review status: {str(e)}")

@app.post("/api/executive-orders/fetch")
async def fetch_executive_orders_unlimited(request: ExecutiveOrderFetchRequest):
    """
    UNLIMITED: Fetch ALL executive orders with NO LIMITS
    """
    try:
        logger.info("🚀 Starting UNLIMITED Executive Orders fetch")
        
        # Use our unlimited fetch function
        result = await fetch_all_executive_orders_unlimited()
        
        if not result.get('success'):
            raise HTTPException(
                status_code=500,
                detail=result.get('error', 'Unlimited fetch failed')
            )
        
        orders = result.get('results', [])
        logger.info(f"📥 Unlimited fetch retrieved {len(orders)} executive orders")
        
        # Enhanced AI processing if requested
        ai_successful = 0
        ai_failed = 0
        
        if request.with_ai and enhanced_ai_client:
            logger.info("🤖 Processing with enhanced AI...")
            
            for i, order in enumerate(orders, 1):
                try:
                    if i % 10 == 0:
                        logger.info(f"🤖 AI processing: {i}/{len(orders)}")
                    
                    title = order.get('title', '')
                    summary = order.get('summary', '')
                    content = f"Title: {title}\nSummary: {summary}"
                    
                    # Run AI analysis
                    executive_summary = await enhanced_ai_analysis(content, PromptType.EXECUTIVE_SUMMARY)
                    talking_points = await enhanced_ai_analysis(content, PromptType.KEY_TALKING_POINTS)
                    business_impact = await enhanced_ai_analysis(content, PromptType.BUSINESS_IMPACT)
                    
                    # Add AI results to order
                    order['ai_summary'] = executive_summary
                    order['ai_executive_summary'] = executive_summary
                    order['ai_talking_points'] = talking_points
                    order['ai_key_points'] = talking_points
                    order['ai_business_impact'] = business_impact
                    order['ai_potential_impact'] = business_impact
                    order['ai_version'] = 'enhanced_azure_openai_v3'
                    
                    ai_successful += 1
                    
                except Exception as e:
                    logger.warning(f"⚠️ AI processing failed for order {i}: {e}")
                    ai_failed += 1
                    continue
        
        # Save to database if requested
        saved_count = 0
        if request.save_to_db and EXECUTIVE_ORDERS_AVAILABLE:
            try:
                logger.info(f"💾 Saving {len(orders)} orders to database...")
                saved_count = save_executive_orders_to_db(orders)
                logger.info(f"✅ Successfully saved {saved_count} orders to database")
            except Exception as save_error:
                logger.error(f"❌ Error saving to database: {save_error}")
        
        return {
            "success": True,
            "message": f"UNLIMITED FETCH: Retrieved all {len(orders)} executive orders",
            "orders_fetched": len(orders),
            "orders_saved": saved_count,
            "total_found": result.get('total_found', len(orders)),
            "ai_successful": ai_successful,
            "ai_failed": ai_failed,
            "ai_analysis_enabled": request.with_ai and enhanced_ai_client is not None,
            "method": "unlimited_federal_register_api",
            "no_limits_applied": True,
            "pages_fetched": result.get('pages_fetched', 1),
            "date_range": result.get('date_range_used', 'Inauguration to today')
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error in unlimited fetch endpoint: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Unlimited fetch failed: {str(e)}"
        )

@app.post("/api/fetch-executive-orders-simple")
async def fetch_executive_orders_simple_endpoint(request: ExecutiveOrderFetchRequest):
    """Legacy endpoint for backward compatibility"""
    try:
        logger.info("🔄 Legacy fetch executive orders endpoint - calling unlimited fetch")
        result = await fetch_executive_orders_unlimited(request)
        return result
    except Exception as e:
        logger.error(f"❌ Error in legacy fetch: {e}")
        return {
            "success": False,
            "message": str(e)
        }

@app.post("/api/executive-orders/run-pipeline")
async def run_unlimited_executive_orders_pipeline(request: dict = None):
    """Run the complete executive orders pipeline with database checking - ENHANCED"""
    try:
        logger.info("🚀 Starting Enhanced Executive Orders Pipeline with Database Check")
        
        if not SIMPLE_EO_AVAILABLE:
            return {
                "success": False,
                "message": "Simple Executive Orders API not available"
            }
        
        # Parse request parameters with enhanced options
        force_fetch = False
        fetch_only_new = True
        
        if request:
            force_fetch = request.get('force_fetch', False)
            fetch_only_new = request.get('fetch_only_new', True)
        
        logger.info(f"📋 Enhanced Pipeline parameters:")
        logger.info(f"   - force_fetch: {force_fetch}")
        logger.info(f"   - fetch_only_new: {fetch_only_new}")
        
        # Use the enhanced integration with database checking
        result = await fetch_executive_orders_simple_integration(
            start_date="2025-01-20",
            end_date=None,
            with_ai=True,
            limit=None,
            period=None,
            save_to_db=True,
            force_fetch=force_fetch  # Pass the force_fetch parameter
        )
        
        if not result.get('success'):
            error_msg = result.get('error', 'Unknown error')
            logger.warning(f"⚠️ Enhanced pipeline failed: {error_msg}")
            return {
                "success": False,
                "message": error_msg,
                "orders_fetched": 0,
                "orders_saved": 0
            }
        
        orders = result.get('results', [])
        total_found = result.get('total_found', len(orders))
        fetch_performed = result.get('fetch_performed', False)
        database_was_current = result.get('database_was_current', False)
        
        logger.info(f"📥 Enhanced pipeline processed {len(orders)} executive orders")
        logger.info(f"📊 Total found: {total_found}")
        logger.info(f"🔄 Fetch performed: {fetch_performed}")
        logger.info(f"💾 Database was current: {database_was_current}")
        
        return {
            "success": True,
            "message": result.get('message', f"Enhanced pipeline completed - processed {len(orders)} orders"),
            "orders_fetched": len(orders),
            "orders_saved": result.get('orders_saved', 0),
            "total_found": total_found,
            "ai_analysis_enabled": result.get('ai_analysis_enabled', False),
            "ai_successful": result.get('ai_successful', 0),
            "ai_failed": result.get('ai_failed', 0),
            "date_range_used": result.get('date_range_used'),
            "method": "enhanced_federal_register_with_database_check",
            
            # Enhanced database check info
            "fetch_performed": fetch_performed,
            "fetch_reason": result.get('fetch_reason', 'unknown'),
            "database_was_current": database_was_current,
            "new_orders_fetched": result.get('new_orders_fetched', 0),
            "database_count_before": result.get('database_count_before', 0),
            "federal_count": result.get('federal_count', 0),
            "processing_method": result.get('processing_method', 'enhanced'),
            
            # Backward compatibility
            "pipeline_type": "enhanced_with_database_check",
            "database_integration": "azure_sql_with_checking"
        }
            
    except Exception as e:
        logger.error(f"❌ Error in enhanced executive orders pipeline: {e}")
        return {
            "success": False,
            "message": f"Enhanced pipeline error: {str(e)}",
            "orders_fetched": 0,
            "orders_saved": 0,
            "error_type": type(e).__name__
        }
    else:
        logger.warning("⚠️ No orders to save or database not available")
        return {
            "success": len(orders) > 0,
            "message": f"Pipeline completed - found {len(orders)} orders but database not available" if orders else "No orders found",
            "orders_fetched": len(orders),
            "orders_saved": 0,
            "database_available": EXECUTIVE_ORDERS_AVAILABLE
        }
    
# Also add this new endpoint for explicit database checking
@app.get("/api/executive-orders/check-database-status")
async def check_database_status():
    """Check database status and compare with Federal Register"""
    try:
        logger.info("🔍 Checking database status and Federal Register comparison")
        
        if not SIMPLE_EO_AVAILABLE:
            return {
                "success": False,
                "message": "Simple Executive Orders API not available"
            }
        
        from simple_executive_orders import SimpleExecutiveOrders
        
        simple_eo = SimpleExecutiveOrders()
        
        # Get comprehensive fetch decision
        fetch_decision = simple_eo.should_fetch_orders(force_fetch=False)
        
        # Also get database details
        db_check = simple_eo.check_database_for_existing_orders()
        
        return {
            "success": True,
            "database_status": {
                "table_exists": db_check.get('table_exists', False),
                "count": db_check.get('count', 0),
                "latest_date": db_check.get('latest_date'),
                "latest_eo_number": db_check.get('latest_eo_number'),
                "latest_title": db_check.get('latest_title')
            },
            "federal_register_status": {
                "count": fetch_decision.get('federal_count', 0),
                "api_accessible": fetch_decision.get('federal_count') is not None
            },
            "comparison": {
                "needs_fetch": fetch_decision.get('should_fetch', False),
                "reason": fetch_decision.get('reason', 'unknown'),
                "new_orders_available": fetch_decision.get('new_orders_available', 0),
                "database_up_to_date": not fetch_decision.get('should_fetch', True)
            },
            "recommendations": {
                "should_run_pipeline": fetch_decision.get('should_fetch', False),
                "force_fetch_available": True,
                "message": fetch_decision.get('message', 'Status check completed')
            },
            "last_checked": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Error checking database status: {e}")
        return {
            "success": False,
            "error": str(e),
            "message": f"Database status check failed: {str(e)}"
        }

@app.get("/api/executive-orders/check-count")
async def check_executive_orders_count():
    """Check Federal Register for total count and compare with database count"""
    try:
        # Get count from Federal Register API
        federal_register_count = await get_federal_register_count()
        
        # Get count from database - FIXED: removed await since not async
        database_count = get_database_count()
        
        # Calculate difference
        new_orders_available = max(0, federal_register_count - database_count)
        needs_fetch = new_orders_available > 0
        
        logger.info(f"📊 Count Check - Federal Register: {federal_register_count}, Database: {database_count}, New: {new_orders_available}")
        
        return {
            "success": True,
            "federal_register_count": federal_register_count,
            "database_count": database_count,
            "new_orders_available": new_orders_available,
            "needs_fetch": needs_fetch,
            "last_checked": datetime.now().isoformat(),
            "message": f"Found {new_orders_available} new executive orders available" if needs_fetch else "Database is up to date"
        }
        
    except Exception as e:
        logger.error(f"❌ Error checking counts: {e}")
        return {
            "success": False,
            "error": str(e),
            "federal_register_count": 0,
            "database_count": 0,
            "new_orders_available": 0,
            "needs_fetch": False,
            "message": "Error checking for updates"
        }


def log_detailed_error(message, error=None):
    """Log detailed error information including stack trace"""
    logger.error(f"❌ {message}")
    if error:
        logger.error(f"  Error type: {type(error).__name__}")
        logger.error(f"  Error message: {str(error)}")
        import traceback
        error_traceback = traceback.format_exc()
        logger.error(f"  Traceback:\n{error_traceback}")

# ===============================
# CATEGORY & REVIEW UPDATE ENDPOINTS
# ===============================
# Replace your category update endpoint in main.py with this corrected version:

@app.patch("/api/executive-orders/{order_id}/category")
async def update_executive_order_category(order_id: str, request: dict):
    """Update the category of an executive order"""
    try:
        logger.info(f"🔄 Updating category for executive order: {order_id}")
        
        # Get the new category from the request
        new_category = request.get('category')
        if not new_category:
            raise HTTPException(
                status_code=400,
                detail="Category is required"
            )
        
        # UPDATED: Add "all_practice_areas" to valid categories
        valid_categories = [
            'civic', 'healthcare', 'education', 'engineering', 'business',
            'environment', 'finance', 'labor', 'transportation', 'agriculture', 
            'criminal_justice', 'not_applicable', 'all_practice_areas'  # <-- ADDED THIS
        ]
        
        if new_category not in valid_categories:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid category. Must be one of: {', '.join(valid_categories)}"
            )
        
        # Clean up the order_id (remove 'eo-' prefix if present)
        clean_order_id = order_id.replace('eo-', '') if order_id.startswith('eo-') else order_id
        logger.info(f"📝 Cleaned order ID: {clean_order_id}, new category: {new_category}")
        
        # Call the database function
        try:
            from executive_orders_db import update_executive_order_category_in_db
            
            update_success = update_executive_order_category_in_db(clean_order_id, new_category)
            
            if update_success:
                logger.info(f"✅ Successfully updated category for order {clean_order_id} to {new_category}")
                return {
                    "success": True,
                    "message": f"Category updated to {new_category}",
                    "order_id": order_id,
                    "new_category": new_category
                }
            else:
                logger.warning(f"⚠️ Failed to update category for order {clean_order_id}")
                raise HTTPException(
                    status_code=404,
                    detail=f"Executive order not found or update failed: {order_id}"
                )
                
        except ImportError:
            logger.error("❌ Could not import update_executive_order_category_in_db function")
            raise HTTPException(
                status_code=500,
                detail="Database function not available"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error updating category for order {order_id}: {e}")
        import traceback
        traceback.print_exc()
        
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update category: {str(e)}"
        )


#@app.patch("/api/executive-orders/{id}/review-v2")
#async def update_executive_order_review_v2(id: str, request: dict):
#    """Super simple version - copy exact pattern from working endpoints"""
#    try:
#        reviewed = request.get('reviewed')
#        if reviewed is None:
#            raise HTTPException(status_code=400, detail="reviewed field is required")
#        
#        print(f"🔍 BACKEND: Quick update for '{id}' to reviewed={reviewed}")
#        
#        # Import exactly what your working endpoints use
#        from database_connection import get_database_connection
#        
#        conn = get_database_connection()
#        cursor = conn.cursor()
#        
#        # Simple update query that tries all possible ID fields
#        cursor.execute("""
#            UPDATE dbo.executive_orders 
#            SET reviewed = ?, last_updated = GETUTCDATE() 
#            WHERE document_number = ? OR eo_number = ?
#        """, reviewed, id, id)
#        
#        rows_affected = cursor.rowcount
#        conn.commit()
#        cursor.close()
#        conn.close()
#        
#        if rows_affected > 0:
#            print(f"✅ BACKEND: Updated {rows_affected} rows for '{id}'")
#            return {
#                "success": True,
#                "message": f"Review status updated to {reviewed}",
#                "id": id,
#                "reviewed": reviewed
#            }
#        else:
#            raise HTTPException(status_code=404, detail=f"Executive order not found: {id}")
#        
#    except HTTPException:
#        raise
#    except Exception as e:
#        logger.error(f"Error updating executive order review status: {str(e)}")
#        raise HTTPException(status_code=500, detail=f"Failed to update review status: {str(e)}")


# Alternative approach - use the existing database function that already works
@app.patch("/api/executive-orders/{id}/review-alt")
async def update_executive_order_review_alternative(id: str, request: dict):
    """Alternative approach using existing database functions"""
    try:
        reviewed = request.get('reviewed')
        if reviewed is None:
            raise HTTPException(status_code=400, detail="reviewed field is required")
        
        print(f"🔍 BACKEND: Received executive order ID: '{id}'")
        print(f"🔍 BACKEND: Setting reviewed to: {reviewed}")
        
        # Use the existing update function that already works
        result = update_executive_order_category_in_db(id, None)  # This function already exists and works
        
        # Since that function is for category, let's create a specific review function
        # Or we can use execute_query which you already have imported
        
        # Try using execute_query directly
        update_query = """
            UPDATE dbo.executive_orders 
            SET reviewed = ?, last_updated = GETUTCDATE()
            WHERE document_number = ? OR eo_number = ? OR id = TRY_CAST(? AS INT)
        """
        
        result = execute_query(update_query, [reviewed, id, id, id])
        
        if result:
            print(f"✅ BACKEND: Successfully updated executive order {id} review status to {reviewed}")
            return {
                "success": True,
                "message": f"Review status updated to {reviewed}",
                "id": id,
                "reviewed": reviewed
            }
        else:
            raise HTTPException(status_code=404, detail=f"Executive order not found: {id}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating executive order review status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update review status: {str(e)}")

# Add the missing /api/executive-orders/{id}/review endpoint
@app.patch("/api/executive-orders/{id}/review")
async def update_executive_order_review(id: str, request: dict):
    """Update review status for an executive order"""
    try:
        reviewed = request.get('reviewed')
        if reviewed is None:
            raise HTTPException(status_code=400, detail="reviewed field is required")
        
        print(f"🔍 BACKEND: Received executive order ID: '{id}'")
        print(f"🔍 BACKEND: Setting reviewed to: {reviewed}")
        print(f"🧹 BACKEND: Cleaned ID for database search: '{id}'")
        
        # Use direct database connection to avoid context manager issues
        from database_connection import get_database_connection
        
        conn = None
        cursor = None
        try:
            conn = get_database_connection()
            cursor = conn.cursor()
            
            # Update the review status (fixed to avoid type conversion error)
            update_query = """
                UPDATE dbo.executive_orders 
                SET reviewed = ?, last_updated = GETUTCDATE() 
                WHERE eo_number = ? OR document_number = ?
            """
            
            cursor.execute(update_query, [reviewed, id, id])
            rows_affected = cursor.rowcount
            conn.commit()
            
            if rows_affected > 0:
                print(f"✅ BACKEND: Updated {rows_affected} rows for EO {id}")
                return {
                    "success": True,
                    "message": f"Review status updated to {reviewed}",
                    "id": id,
                    "reviewed": reviewed
                }
            else:
                print(f"⚠️ BACKEND: No rows updated for EO {id}")
                raise HTTPException(status_code=404, detail=f"Executive order not found: {id}")
        
        except HTTPException:
            raise
        except Exception as e:
            print(f"❌ BACKEND: Database error: {e}")
            if conn:
                conn.rollback()
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating executive order review status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update review status: {str(e)}")
    
# ===============================
# STATE LEGISLATION ENDPOINTS
# ===============================
@app.get("/api/state-legislation")
async def get_state_legislation_endpoint(
    state: Optional[str] = Query(None, description="State abbreviation or full name"),
    category: Optional[str] = Query(None, description="Filter by category"),
    limit: int = Query(100, description="Maximum number of results"),
    offset: int = Query(0, description="Number of results to skip"),
    search: Optional[str] = Query(None, description="Search in title and description")
):
    """
    THIS IS THE ENDPOINT YOUR STATEPAGE.JSX IS CALLING
    Get existing state legislation from the database
    """
    try:
        logger.info(f"🔍 BACKEND: get_state_legislation called:")
        logger.info(f"   - state: '{state}', category: '{category}', limit: {limit}, search: '{search}'")
        
        if not AZURE_SQL_AVAILABLE:
            return {
                "results": [],
                "count": 0,
                "total_count": 0,
                "success": False,
                "error": "Database not available"
            }
        
        # Build filters
        filters = {}
        if state:
            filters['state'] = state
        if category and category != 'all':
            filters['category'] = category
        if search:
            filters['search'] = search
        
        # Get data from database
        result = get_state_legislation_from_db(
            limit=limit,
            offset=offset,
            filters=filters
        )
        
        if not result.get('success'):
            error_msg = result.get('message', 'Failed to retrieve state legislation')
            
            return {
                "results": [],
                "count": 0,
                "total_count": 0,
                "state": state,
                "category": category,
                "search": search,
                "offset": offset,
                "limit": limit,
                "success": False,
                "error": error_msg
            }
        
        bills = result.get('results', [])
        total_count = result.get('total', 0)
        
        logger.info(f"✅ BACKEND: Successfully returning {len(bills)} bills")
        
        return {
            "results": bills,
            "count": len(bills),
            "total_count": total_count,
            "state": state,
            "category": category,
            "search": search,
            "offset": offset,
            "limit": limit,
            "success": True,
            "has_more": (offset + len(bills)) < total_count
        }
        
    except Exception as e:
        logger.error(f"❌ BACKEND: Error in get_state_legislation: {e}")
        
        return {
            "results": [],
            "count": 0,
            "total_count": 0,
            "success": False,
            "error": f"Error fetching state legislation: {str(e)}"
        }


@app.post("/api/legiscan/search-and-analyze")
async def search_and_analyze_bills_endpoint(request: LegiScanSearchRequest):
    """
    Search and analyze bills using LegiScan API with enhanced AI and one-by-one processing
    """
    try:
        logger.info(f"🔍 BACKEND: search-and-analyze called:")
        logger.info(f"   - state: {request.state}, query: '{request.query}', limit: {request.limit}")
        
        # Check if LegiScan API is available
        if not LEGISCAN_AVAILABLE:
            logger.error("LegiScan API not imported correctly")
            raise HTTPException(
                status_code=503, 
                detail="LegiScan API not available - check if legiscan_api.py file exists"
            )
        
        if not LEGISCAN_INITIALIZED:
            logger.error("LegiScan API not initialized - possible API key issue")
            # Print environment var for debugging (masked)
            api_key = os.getenv('LEGISCAN_API_KEY', '')
            masked_key = f"{api_key[:4]}..." if len(api_key) > 4 else "not set"
            logger.error(f"API key status: {masked_key}")
            
            raise HTTPException(
                status_code=503, 
                detail="LegiScan API not initialized - check LEGISCAN_API_KEY in .env file"
            )
        
        # Use enhanced AI if available, otherwise traditional processing
        use_enhanced_ai = getattr(request, 'enhanced_ai', True) and enhanced_ai_client
        
        if use_enhanced_ai:
            logger.info("🚀 BACKEND: Using ENHANCED AI processing")
            
            try:
                enhanced_legiscan = EnhancedLegiScanClient()
                logger.info("✅ BACKEND: Enhanced LegiScan client initialized")
            except Exception as e:
                logger.error(f"Enhanced LegiScan initialization failed: {e}")
                raise HTTPException(
                    status_code=503, 
                    detail=f"Enhanced LegiScan initialization failed: {str(e)}"
                )
            
            # Get database manager if saving to database
            db_manager = None
            if request.save_to_db and AZURE_SQL_AVAILABLE:
                try:
                    # FIXED: Get direct connection without context manager
                    conn = get_db_connection()
                    if conn:
                        db_manager = StateLegislationDatabaseManager(conn)
                        logger.info("✅ BACKEND: Enhanced database manager created")
                    else:
                        logger.warning("⚠️ BACKEND: Database connection failed, proceeding without saving")
                except Exception as e:
                    logger.warning(f"⚠️ BACKEND: Database manager creation failed: {e}")
            
            # Use enhanced search and analyze
            result = await enhanced_legiscan.enhanced_search_and_analyze(
                state=request.state,
                query=request.query,
                limit=request.limit,
                with_ai=request.with_ai_analysis,
                db_manager=db_manager
            )
            
            # Close database connection if it was opened
            if db_manager and hasattr(db_manager, 'connection'):
                try:
                    db_manager.connection.close()
                except:
                    pass
            
            bills_saved = result.get('processing_results', {}).get('total_saved', 0)
            
            return {
                "success": True,
                "enhanced_ai_used": True,
                "bills_analyzed": len(result.get('bills', [])),
                "bills_saved": bills_saved,
                "workflow_used": "enhanced_one_by_one",
                "message": f"Enhanced analysis of {len(result.get('bills', []))} bills for '{request.query}' in {request.state}",
                "legiscan_result": {
                    "success": result.get('success'),
                    "query": request.query,
                    "state": request.state,
                    "total_found": result.get('bills_found', 0),
                    "timestamp": result.get('timestamp')
                },
                "processing_details": result.get('processing_results', {}),
                "ai_features": {
                    "executive_summary": "Enhanced multi-paragraph summaries",
                    "talking_points": "Exactly 5 formatted stakeholder discussion points",
                    "business_impact": "Structured risk/opportunity analysis",
                    "categorization": "Advanced 5-category classification"
                }
            }
        
        else:
            logger.info("📊 BACKEND: Using traditional LegiScan processing")
            
            # Initialize traditional LegiScan API
            try:
                legiscan_api = LegiScanAPI()
                logger.info("✅ BACKEND: Traditional LegiScan API initialized successfully")
            except Exception as e:
                logger.error(f"Traditional LegiScan API initialization failed: {e}")
                raise HTTPException(
                    status_code=503, 
                    detail=f"LegiScan API initialization failed: {str(e)}"
                )
            
            bills_saved = 0
            result = {}
            
            # Traditional processing workflow
            if request.process_one_by_one and request.save_to_db and AZURE_SQL_AVAILABLE:
                
                # Get AI client if AI analysis is requested
                ai_client = None
                if request.with_ai_analysis:
                    ai_client = get_ai_client()
                
                # Get database connection and create manager
                try:
                    # FIXED: Get direct connection without context manager
                    conn = get_db_connection()
                    if not conn:
                        raise HTTPException(status_code=503, detail="Database connection failed")
                    
                    db_manager = StateLegislationDatabaseManager(conn)
                    
                    # Use the traditional one-by-one processing workflow
                    result = legiscan_api.search_and_analyze_bills(
                        state=request.state,
                        query=request.query,
                        limit=request.limit,
                        ai_client=ai_client,
                        db_manager=db_manager,
                        process_one_by_one=True
                    )
                    
                    conn.close()
                    
                    # Extract processing results
                    if result.get('processing_results'):
                        processing = result['processing_results']
                        bills_saved = processing.get('total_saved', 0)
                
                except Exception as e:
                    logger.error(f"One-by-one processing failed: {e}")
                    raise HTTPException(status_code=500, detail=f"One-by-one processing failed: {str(e)}")
                    
            else:
                # Use traditional search_and_analyze_bills method (batch way)
                result = legiscan_api.search_and_analyze_bills(
                    state=request.state,
                    query=request.query,
                    limit=request.limit
                )
                
                # Save to database if requested and bills were returned (traditional batch save)
                if request.save_to_db and result.get('bills') and AZURE_SQL_AVAILABLE:
                    bills = result['bills']
                    
                    try:
                        bills_saved = save_state_legislation_to_db(bills)
                        logger.info(f"✅ BACKEND: Successfully saved {bills_saved} bills to database")
                    except Exception as e:
                        logger.warning(f"❌ BACKEND: Database save failed: {e}")
            
            # Prepare traditional response
            response_data = {
                "success": True,
                "enhanced_ai_used": False,
                "bills_analyzed": len(result.get('bills', [])),
                "bills_saved": bills_saved,
                "workflow_used": "one_by_one" if request.process_one_by_one else "batch",
                "message": f"Successfully analyzed {len(result.get('bills', []))} bills for '{request.query}' in {request.state}",
                "legiscan_result": {
                    "success": result.get('success'),
                    "query": request.query,
                    "state": request.state,
                    "total_found": result.get('bills_found', 0),
                    "timestamp": result.get('timestamp')
                }
            }
            
            # Add one-by-one processing details if used
            if request.process_one_by_one and result.get('processing_results'):
                processing = result['processing_results']
                response_data["processing_details"] = {
                    "total_fetched": processing.get('total_fetched', 0),
                    "total_processed": processing.get('total_processed', 0),
                    "total_saved": processing.get('total_saved', 0),
                    "errors": processing.get('errors', []),
                    "ai_analysis_used": request.with_ai_analysis and bool(get_ai_client())
                }
            
            return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in search-and-analyze endpoint: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Search and analyze failed: {str(e)}")


@app.post("/api/legiscan/enhanced-search-and-analyze")
async def enhanced_search_and_analyze_endpoint(request: LegiScanSearchRequest):
    """
    NEW: Enhanced search and analyze using ai.py integration
    """
    try:
        logger.info(f"🚀 ENHANCED: search-and-analyze called:")
        logger.info(f"   - state: {request.state}, query: '{request.query}', enhanced_ai: {getattr(request, 'enhanced_ai', True)}")
        
        # Check if enhanced AI is available
        if not enhanced_ai_client:
            raise HTTPException(
                status_code=503, 
                detail="Enhanced AI client not available - check Azure OpenAI configuration"
            )
        
        # Initialize enhanced LegiScan client
        try:
            enhanced_legiscan = EnhancedLegiScanClient()
        except Exception as e:
            raise HTTPException(
                status_code=503, 
                detail=f"Enhanced LegiScan initialization failed: {str(e)}"
            )
        
        # Get database manager if saving to database
        db_manager = None
        if request.save_to_db:
            try:
                conn = get_azure_sql_connection()
                if conn:
                    db_manager = StateLegislationDatabaseManager(conn)
            except Exception as e:
                logger.warning(f"⚠️ ENHANCED: Database manager creation failed: {e}")
        
        # Use enhanced search and analyze
        result = await enhanced_legiscan.enhanced_search_and_analyze(
            state=request.state,
            query=request.query,
            limit=request.limit,
            with_ai=getattr(request, 'enhanced_ai', True),
            db_manager=db_manager
        )
        
        # Close database connection if it was opened
        if db_manager and hasattr(db_manager, 'connection'):
            try:
                db_manager.connection.close()
            except:
                pass
        
        if not result.get('success'):
            raise HTTPException(
                status_code=500,
                detail=result.get('error', 'Enhanced search and analysis failed')
            )
        
        # Prepare enhanced response
        response_data = {
            "success": True,
            "enhanced_ai_used": True,
            "bills_analyzed": len(result.get('bills', [])),
            "bills_saved": result.get('processing_results', {}).get('total_saved', 0),
            "workflow_used": "enhanced_one_by_one",
            "message": f"Enhanced analysis of {len(result.get('bills', []))} bills for '{request.query}' in {request.state}",
            "enhanced_legiscan_result": {
                "success": result.get('success'),
                "query": request.query,
                "state": request.state,
                "total_found": result.get('bills_found', 0),
                "timestamp": result.get('timestamp')
            },
            "processing_details": result.get('processing_results', {}),
            "ai_features": {
                "executive_summary": "Enhanced multi-paragraph summaries",
                "talking_points": "Exactly 5 formatted stakeholder discussion points",
                "business_impact": "Structured risk/opportunity analysis",
                "categorization": "Advanced 5-category classification"
            }
        }
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ ENHANCED: Error in enhanced search-and-analyze: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Enhanced search and analyze failed: {str(e)}"
        )

@app.post("/api/state-legislation/fetch")
async def fetch_state_legislation_endpoint(request: StateLegislationFetchRequest):
    """Bulk fetch state legislation using LegiScan API"""
    try:
        logger.info(f"🔍 BACKEND: fetch_state_legislation called:")
        logger.info(f"   - states: {request.states}, bills_per_state: {request.bills_per_state}")
        
        # Check if LegiScan API is available
        if not LEGISCAN_AVAILABLE:
            raise HTTPException(
                status_code=503, 
                detail="LegiScan API not available - check if legiscan_api.py file exists"
            )
        
        if not LEGISCAN_INITIALIZED:
            raise HTTPException(
                status_code=503, 
                detail="LegiScan API not initialized - check LEGISCAN_API_KEY in .env file"
            )
        
        # Initialize LegiScan API
        try:
            legiscan_api = LegiScanAPI()
        except Exception as e:
            raise HTTPException(
                status_code=503, 
                detail=f"LegiScan API initialization failed: {str(e)}"
            )
        
        total_fetched = 0
        total_saved = 0
        state_results = {}
        
        for state in request.states:
            try:
                # Use your existing optimized bulk fetch method
                result = legiscan_api.optimized_bulk_fetch(
                    state=state,
                    limit=request.bills_per_state,
                    recent_only=True
                )
                
                state_fetched = 0
                state_saved = 0
                
                if result.get('success') and result.get('bills'):
                    bills = result['bills']
                    state_fetched = len(bills)
                    total_fetched += state_fetched
                    
                    if request.save_to_db and AZURE_SQL_AVAILABLE:
                        try:
                            state_saved = save_state_legislation_to_db(bills)
                            total_saved += state_saved
                        except Exception as e:
                            logger.warning(f"❌ BACKEND: Error saving {state} bills: {e}")
                            state_saved = 0
                
                state_results[state] = {
                    "success": result.get('success', False),
                    "bills_fetched": state_fetched,
                    "bills_saved": state_saved,
                    "error": result.get('error')
                }
                
            except Exception as e:
                logger.warning(f"❌ BACKEND: Error processing state {state}: {e}")
                state_results[state] = {
                    "success": False,
                    "bills_fetched": 0,
                    "bills_saved": 0,
                    "error": str(e)
                }
                continue
        
        return {
            "success": True,
            "total_bills_fetched": total_fetched,
            "total_bills_saved": total_saved,
            "states_processed": len(request.states),
            "state_results": state_results,
            "message": f"Successfully processed {len(request.states)} states, fetched {total_fetched} bills, saved {total_saved} bills"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ BACKEND: Error in fetch endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Bulk fetch failed: {str(e)}")

@app.patch("/api/state-legislation/{id}/category")
async def update_state_legislation_category(id: str, request: dict):
    """Update category for state legislation"""
    try:
        category = request.get('category')
        
        if not category:
            raise HTTPException(status_code=400, detail="Category is required")
        
        # UPDATED: Add "all_practice_areas" to valid categories
        valid_categories = [
            'civic', 'healthcare', 'education', 'engineering', 'business', 
            'environment', 'finance', 'labor', 'transportation', 'agriculture', 
            'criminal_justice', 'not_applicable', 'all_practice_areas'  # <-- ADDED THIS
        ]
        
        if category not in valid_categories:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid category. Must be one of: {', '.join(valid_categories)}"
            )
        
        conn = get_azure_sql_connection()
        if not conn:
            raise HTTPException(status_code=503, detail="Database connection failed")
        
        cursor = conn.cursor()
        
        # Try to find the record multiple ways
        search_attempts = [
            ("Direct ID match", "SELECT id FROM dbo.state_legislation WHERE id = ?", id),
            ("Direct bill_id match", "SELECT id FROM dbo.state_legislation WHERE bill_id = ?", id),
            ("String ID match", "SELECT id FROM dbo.state_legislation WHERE CAST(id AS VARCHAR) = ?", str(id)),
            ("String bill_id match", "SELECT id FROM dbo.state_legislation WHERE CAST(bill_id AS VARCHAR) = ?", str(id))
        ]
        
        found_record_id = None
        for attempt_name, query, param in search_attempts:
            try:
                cursor.execute(query, param)
                result = cursor.fetchone()
                if result:
                    found_record_id = result[0]
                    break
            except Exception as e:
                continue
        
        if not found_record_id:
            conn.close()
            raise HTTPException(status_code=404, detail=f"State legislation not found for ID: {id}")
        
        # Update the record
        update_query = "UPDATE dbo.state_legislation SET category = ?, last_updated = GETDATE() WHERE id = ?"
        cursor.execute(update_query, category, found_record_id)
        rows_affected = cursor.rowcount
        
        if rows_affected == 0:
            conn.close()
            raise HTTPException(status_code=404, detail="No rows were updated")
        
        conn.commit()
        conn.close()
        
        return {
            "success": True,
            "message": f"Category updated to {category}",
            "id": id,
            "database_id": found_record_id,
            "category": category
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating state legislation category: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update category: {str(e)}")

@app.patch("/api/state-legislation/{id}/review")
async def update_state_legislation_review_status(id: str, request: dict):
    """Update review status for state legislation"""
    try:
        reviewed = request.get('reviewed', False)
        
        conn = get_azure_sql_connection()
        if not conn:
            raise HTTPException(status_code=503, detail="Database connection failed")
        
        cursor = conn.cursor()
        
        # Try to find the record multiple ways (same logic as category update)
        search_attempts = [
            ("Direct ID match", "SELECT id FROM dbo.state_legislation WHERE id = ?", id),
            ("Direct bill_id match", "SELECT id FROM dbo.state_legislation WHERE bill_id = ?", id),
            ("String ID match", "SELECT id FROM dbo.state_legislation WHERE CAST(id AS VARCHAR) = ?", str(id)),
            ("String bill_id match", "SELECT id FROM dbo.state_legislation WHERE CAST(bill_id AS VARCHAR) = ?", str(id))
        ]
        
        found_record_id = None
        for attempt_name, query, param in search_attempts:
            try:
                cursor.execute(query, param)
                result = cursor.fetchone()
                if result:
                    found_record_id = result[0]
                    break
            except Exception:
                continue
        
        if not found_record_id:
            conn.close()
            raise HTTPException(status_code=404, detail=f"State legislation not found for ID: {id}")
        
        # Update the record
        update_query = "UPDATE dbo.state_legislation SET reviewed = ?, last_updated = GETDATE() WHERE id = ?"
        cursor.execute(update_query, reviewed, found_record_id)
        rows_affected = cursor.rowcount
        
        if rows_affected == 0:
            conn.close()
            raise HTTPException(status_code=404, detail="No rows were updated")
        
        conn.commit()
        conn.close()
        
        return {
            "success": True,
            "message": f"Review status updated to {reviewed}",
            "id": id,
            "database_id": found_record_id,
            "reviewed": reviewed
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating state legislation review status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update review status: {str(e)}")

# ===============================
# UTILITY ENDPOINTS FOR STATE LEGISLATION
# ===============================
@app.get("/api/state-legislation/states")
async def get_available_states():
    """Get list of states that have data in the database"""
    try:
        if not AZURE_SQL_AVAILABLE:
            return {
                "success": False,
                "message": "Database not available",
                "states": {},
                "total_states": 0
            }
        
        conn = get_azure_sql_connection()
        if not conn:
            return {
                "success": False,
                "message": "Database connection failed",
                "states": {},
                "total_states": 0
            }
        
        cursor = conn.cursor()
        
        # Get distinct states from database
        query = """
        SELECT state, state_abbr, COUNT(*) as bill_count
        FROM dbo.state_legislation
        WHERE state IS NOT NULL AND state != ''
        GROUP BY state, state_abbr
        ORDER BY state
        """
        
        cursor.execute(query)
        states_data = {}
        
        for row in cursor.fetchall():
            state, state_abbr, count = row
            if state:
                states_data[state] = {
                    "full_name": state,
                    "abbreviation": state_abbr,
                    "bill_count": count
                }
        
        cursor.close()
        conn.close()
        
        return {
            "success": True,
            "states": states_data,
            "total_states": len(states_data)
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "states": {},
            "total_states": 0
        }

@app.get("/api/state-legislation/stats")
async def get_state_legislation_stats():
    """Get overall statistics about the state legislation database"""
    try:
        if not AZURE_SQL_AVAILABLE:
            return {
                "success": False,
                "message": "Database not available",
                "total_bills": 0
            }
        
        conn = get_azure_sql_connection()
        if not conn:
            return {
                "success": False,
                "message": "Database connection failed",
                "total_bills": 0
            }
        
        cursor = conn.cursor()
        
        # Get total bills
        cursor.execute("SELECT COUNT(*) FROM dbo.state_legislation")
        total_bills = cursor.fetchone()[0]
        
        # Count by state
        cursor.execute("""
            SELECT state, COUNT(*) as count
            FROM dbo.state_legislation
            WHERE state IS NOT NULL AND state != ''
            GROUP BY state
            ORDER BY count DESC
        """)
        state_counts = {}
        for row in cursor.fetchall():
            state, count = row
            state_counts[state] = count
        
        # Count by category
        cursor.execute("""
            SELECT category, COUNT(*) as count
            FROM dbo.state_legislation
            WHERE category IS NOT NULL AND category != ''
            GROUP BY category
            ORDER BY count DESC
        """)
        category_counts = {}
        for row in cursor.fetchall():
            category, count = row
            category_counts[category] = count
        
        # Get most recent update
        cursor.execute("""
            SELECT TOP 1 last_updated
            FROM dbo.state_legislation
            ORDER BY last_updated DESC
        """)
        latest_row = cursor.fetchone()
        last_updated = latest_row[0].isoformat() if latest_row and latest_row[0] else None
        
        cursor.close()
        conn.close()
        
        return {
            "success": True,
            "total_bills": total_bills,
            "total_states": len(state_counts),
            "total_categories": len(category_counts),
            "state_counts": state_counts,
            "category_counts": category_counts,
            "last_updated": last_updated
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "total_bills": 0
        }

# ===============================
# HIGHLIGHTS ENDPOINTS
# ===============================
@app.get("/api/highlights")
async def get_user_highlights(user_id: str = Query("1", description="User identifier")):
    """Get all highlights for a user"""
    try:
        create_highlights_table()
        highlights = get_user_highlights_direct(user_id)
        
        return {
            "success": True,
            "user_id": user_id,
            "highlights": highlights,
            "results": highlights,
            "count": len(highlights),
            "database_type": "Azure SQL",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting user highlights: {e}")
        return {
            "success": False,
            "error": str(e),
            "highlights": [],
            "results": []
        }

@app.post("/api/highlights")
async def add_highlight_endpoint(request: HighlightCreateRequest):
    """Add a highlight"""
    if not HIGHLIGHTS_DB_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Highlights database not available. Please ensure Azure SQL is configured."
        )
    
    try:
        create_highlights_table()
        
        # Get the item data if it's an executive order
        item_data = {}
        if request.order_type == 'executive_order' and EXECUTIVE_ORDERS_AVAILABLE:
            try:
                db_result = get_executive_orders_from_db(limit=1000, offset=0, filters={})
                if db_result.get('success'):
                    for order in db_result.get('results', []):
                        if order.get('bill_number') == request.order_id:
                            item_data = {
                                'title': order.get('title', ''),
                                'summary': order.get('summary', ''),
                                'ai_summary': order.get('ai_summary', ''),
                                'category': order.get('category', ''),
                                'state': order.get('state', ''),
                                'signing_date': order.get('introduced_date', ''),
                                'html_url': order.get('legiscan_url', ''),
                                'pdf_url': order.get('pdf_url', ''),
                                'legiscan_url': order.get('legiscan_url', '')
                            }
                            break
            except Exception as e:
                logger.warning(f"Could not get item data for highlight: {e}")
        
        success = add_highlight_direct(
            user_id=str(request.user_id), 
            order_id=request.order_id, 
            order_type=request.order_type,
            item_data=item_data
        )
        
        if success:
            return {
                "success": True,
                "message": "Highlight added successfully",
                "user_id": request.user_id,
                "order_id": request.order_id,
                "order_type": request.order_type
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to add highlight")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding highlight: {e}")
        raise HTTPException(status_code=500, detail=f"Error adding highlight: {str(e)}")

@app.delete("/api/highlights/{order_id}")
async def remove_highlight_endpoint(
    order_id: str,
    user_id: str = Query("1", description="User identifier"),
    order_type: Optional[str] = Query(None, description="Order type for more specific removal")
):
    """Remove a highlight"""
    if not HIGHLIGHTS_DB_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Highlights database not available. Please ensure Azure SQL is configured."
        )
    
    try:
        success = remove_highlight_direct(user_id, order_id, order_type)
        
        if success:
            return {
                "success": True,
                "message": "Highlight removed successfully",
                "user_id": user_id,
                "order_id": order_id
            }
        else:
            raise HTTPException(status_code=404, detail="Highlight not found")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing highlight: {e}")
        raise HTTPException(status_code=500, detail=f"Error removing highlight: {str(e)}")

# ===============================
# MAIN STARTUP
# ===============================
if __name__ == "__main__":
    import uvicorn
    logger.info("🌐 Starting Complete LegislationVue API v16.0.0")
    logger.info("=" * 80)
    
    logger.info("🚀 ALL FUNCTIONALITY PRESERVED:")
    logger.info("   ✅ UNLIMITED Federal Register fetching (no 20 order limit)")
    logger.info("   ✅ Executive Orders: Full pipeline with AI")
    logger.info("   ✅ State Legislation: Enhanced AI + Traditional workflows")
    logger.info("   ✅ LegiScan Integration: Both enhanced and traditional")
    logger.info("   ✅ Highlights System: Full CRUD operations")
    logger.info("   ✅ Category Updates: PATCH endpoints")
    logger.info("   ✅ Review Status: PATCH endpoints")
    logger.info("   ✅ Count Checking: Federal Register vs Database")
    logger.info("   ✅ Enhanced AI: Multi-format analysis")
    logger.info("   ✅ One-by-one Processing: Bill-by-bill workflows")
    logger.info("   ✅ Database Integration: Azure SQL")
    logger.info("   ✅ All Original Endpoints: Preserved and working")
    
    logger.info("\n📋 COMPLETE ENDPOINT LIST:")
    logger.info("   • GET  / - Root status")
    logger.info("   • GET  /api/status - System status")
    logger.info("   • GET  /api/executive-orders - Get executive orders")
    logger.info("   • POST /api/executive-orders/fetch - Unlimited fetch")
    logger.info("   • POST /api/fetch-executive-orders-simple - Legacy endpoint")
    logger.info("   • POST /api/executive-orders/run-pipeline - Full pipeline")
    logger.info("   • GET  /api/executive-orders/check-count - Count comparison")
    logger.info("   • PATCH /api/executive-orders/{id}/category - Update category")
    logger.info("   • PATCH /api/executive-orders/{id}/review - Update review")
    logger.info("   • GET  /api/state-legislation - Get state bills")
    logger.info("   • POST /api/legiscan/search-and-analyze - Search & analyze")
    logger.info("   • POST /api/legiscan/enhanced-search-and-analyze - Enhanced AI")
    logger.info("   • POST /api/state-legislation/fetch - Bulk fetch")
    logger.info("   • PATCH /api/state-legislation/{id}/category - Update category")
    logger.info("   • PATCH /api/state-legislation/{id}/review - Update review")
    logger.info("   • GET  /api/state-legislation/states - Available states")
    logger.info("   • GET  /api/state-legislation/stats - Statistics")
    logger.info("   • GET  /api/highlights - Get highlights")
    logger.info("   • POST /api/highlights - Add highlight")
    logger.info("   • DELETE /api/highlights/{id} - Remove highlight")
    
    # Test database connection
    try:
        if test_database_connection():
            logger.info("✅ Database connection successful!")
            if create_highlights_table():
                logger.info("✅ Highlights table ready!")
        else:
            logger.warning("❌ Database connection failed")
    except Exception as e:
        logger.error(f"❌ Database connection test error: {e}")
    
    # Test Enhanced AI
    if enhanced_ai_client:
        logger.info("✅ Enhanced AI client ready!")
    else:
        logger.warning("⚠️ Enhanced AI client not available")
    
    logger.info("🎯 Starting server with ALL functionality preserved...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
