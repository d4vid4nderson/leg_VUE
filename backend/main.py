# COMPLETE Enhanced main.py with ai.py Integration
import os
import re
import asyncio
import time
import json
import math
import logging
import pyodbc
import traceback
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional, Dict, Any, List
from contextlib import asynccontextmanager

from fastapi import FastAPI

from fastapi import APIRouter, HTTPException
import requests
import logging

app = FastAPI()

# Environment variables loading
from dotenv import load_dotenv
load_dotenv(override=True)

print("🔍 ENVIRONMENT VARIABLE DEBUG:")
print(f"   LEGISCAN_API_KEY raw: {repr(os.getenv('LEGISCAN_API_KEY'))}")
print(f"   LEGISCAN_API_KEY exists: {bool(os.getenv('LEGISCAN_API_KEY'))}")
print(f"   LEGISCAN_API_KEY length: {len(os.getenv('LEGISCAN_API_KEY', ''))}")

# Also check for common variations
for var_name in ['LEGISCAN_API_KEY', 'legiscan_api_key', 'LEGISCAN_KEY']:
    value = os.getenv(var_name)
    if value:
        print(f"   Found {var_name}: {value[:8]}{'*' * max(0, len(value) - 8)}")

# TEMPORARY FIX: Set the API key directly for testing if not found
if not os.getenv('LEGISCAN_API_KEY'):
    print("⚠️ Setting LEGISCAN_API_KEY directly for testing...")
    os.environ['LEGISCAN_API_KEY'] = 'e3bd77ddffa618452dbe7e9bd3ea3a35'
    print(f"✅ LEGISCAN_API_KEY now set: {bool(os.getenv('LEGISCAN_API_KEY'))}")

# FastAPI imports
from fastapi import FastAPI, HTTPException, Query, Path, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import aiohttp

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Supported states
SUPPORTED_STATES = {
    "California": "CA",
    "Colorado": "CO", 
    "Kentucky": "KY",
    "Nevada": "NV",
    "South Carolina": "SC",
    "Texas": "TX",
}

# ================================
# EXCUTIVE ORDER COUNT CHECK
# ================================

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/api/executive-orders/check-count")
async def check_executive_orders_count():
    """
    Check Federal Register for total count and compare with database count
    Returns status indicating if fetch is needed
    """
    try:
        # 1. Get count from Federal Register API
        federal_register_count = await get_federal_register_count()
        
        # 2. Get count from your database
        database_count = await get_database_count()
        
        # 3. Calculate difference
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

async def get_federal_register_count():
    """Get total count from Federal Register API without fetching all data"""
    try:
        # Use the same API endpoint but with minimal data to get count
        base_url = "https://www.federalregister.gov/api/v1"
        
        # Convert date to API format
        start_date = "2025-01-20"  # Trump inauguration
        end_date = datetime.now().strftime('%Y-%m-%d')
        
        params = {
            'conditions[correction]': '0',
            'conditions[president]': 'donald-trump',
            'conditions[presidential_document_type]': 'executive_order',
            'conditions[publication_date][gte]': start_date,
            'conditions[publication_date][lte]': end_date,
            'conditions[type][]': 'PRESDOCU',
            'per_page': '1',  # Minimal data - we just want the count
            'fields[]': ['document_number']  # Minimal fields
        }
        
        response = requests.get(f"{base_url}/documents.json", params=params, timeout=30)
        
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

async def get_database_count():
    """Get total count from your database"""
    try:
        # Replace this with your actual database query
        # Example using your existing database connection:
        
        from your_database_module import get_db_connection  # Import your DB connection
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT COUNT(*) 
            FROM dbo.executive_orders 
            WHERE president = 'donald-trump' 
            AND eo_number IS NOT NULL 
            AND eo_number != ''
        """)
        
        count = cursor.fetchone()[0]
        
        cursor.close()
        conn.close()
        
        logger.info(f"📊 Database has {count} executive orders")
        return count
        
    except Exception as e:
        logger.error(f"❌ Error getting database count: {e}")
        return 0

# ===============================
# ENHANCED AI INTEGRATION FROM ai.py
# ===============================

# Enhanced AI imports
try:
    from openai import AsyncAzureOpenAI
    OPENAI_AVAILABLE = True
    print("✅ OpenAI library available")
except ImportError:
    print("❌ OpenAI library not available - install with: pip install openai")
    OPENAI_AVAILABLE = False

# Configuration from ai.py
AZURE_ENDPOINT = os.getenv("AZURE_ENDPOINT", "https://david-mabholqy-swedencentral.openai.azure.com/")
AZURE_KEY = os.getenv("AZURE_KEY", "8bFP5NQ6KL7jSV74M3ZJ77vh9uYrtR7c3sOkAmM3Gs7tirc5mOWAJQQJ99BEACfhMk5XJ3w3AAAAACOGGlXN")
MODEL_NAME = os.getenv("AZURE_MODEL_NAME", "summarize-gpt-4.1")
LEGISCAN_API_KEY = os.getenv('LEGISCAN_API_KEY')

print(f"🤖 AI Configuration:")
print(f"   Endpoint: {AZURE_ENDPOINT}")
print(f"   Model: {MODEL_NAME}")
print(f"   API Key: {'✅ Set' if AZURE_KEY else '❌ Not Set'}")

# Initialize Enhanced Azure OpenAI client
enhanced_ai_client = None
if OPENAI_AVAILABLE and AZURE_KEY:
    try:
        enhanced_ai_client = AsyncAzureOpenAI(
            azure_endpoint=AZURE_ENDPOINT,
            api_key=AZURE_KEY,
            api_version="2024-12-01-preview"
        )
        print("✅ Enhanced AI client initialized successfully")
    except Exception as e:
        print(f"❌ Enhanced AI client initialization failed: {e}")

# Enhanced Enums from ai.py
class PromptType(Enum):
    EXECUTIVE_SUMMARY = "executive_summary"
    KEY_TALKING_POINTS = "key_talking_points"
    BUSINESS_IMPACT = "business_impact"

class BillCategory(Enum):
    HEALTHCARE = "healthcare"
    EDUCATION = "education"
    ENGINEERING = "engineering"
    CIVIC = "civic"
    BUSINESS = "business"
    ENVIRONMENT = "environment"
    TRANSPORTATION = "transportation"
    AGRICULTURE = "agriculture"
    CRIMINAL_JUSTICE = "criminal_justice"
    FINANCE = "finance"
    LABOR = "labor"
    NOT_APPLICABLE = "not_applicable"

# Enhanced prompt templates from ai.py
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

# Enhanced system messages from ai.py
ENHANCED_SYSTEM_MESSAGES = {
    PromptType.EXECUTIVE_SUMMARY: "You are a senior policy analyst who writes clear, concise executive summaries for C-level executives. Focus on the big picture and strategic implications.",
    PromptType.KEY_TALKING_POINTS: "You are a communications strategist helping leaders discuss policy changes. Create talking points that are memorable, accurate, and useful for stakeholder conversations.",
    PromptType.BUSINESS_IMPACT: "You are a business strategy consultant analyzing regulatory impact. Focus on concrete business implications, compliance requirements, and strategic opportunities.",
}

# ===============================
# ENHANCED AI PROCESSING FUNCTIONS FROM ai.py
# ===============================

def clean_summary_format(text: str) -> str:
    """Clean and format executive summary"""
    if not text:
        return "<p>No summary available</p>"
    
    # Remove any bullet points or numbering that might have crept in
    text = re.sub(r'^\s*[•\-\*]\s*', '', text, flags=re.MULTILINE)
    text = re.sub(r'^\s*\d+\.\s*', '', text, flags=re.MULTILINE)
    
    # Split into sentences and rejoin as paragraphs
    sentences = text.strip().split('. ')
    
    # Group sentences into 1-2 paragraphs
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
    
    # Extract numbered points
    lines = text.strip().split('\n')
    points = []
    
    for line in lines:
        line = line.strip()
        if re.match(r'^\d+\.', line):
            # Extract content after number
            content = re.sub(r'^\d+\.\s*', '', line)
            if content:
                points.append(content)
    
    # Ensure we have exactly 5 points
    if len(points) < 5:
        # Add generic points if needed
        while len(points) < 5:
            points.append("Additional analysis point to be determined based on further review.")
    
    # Take only first 5
    points = points[:5]
    
    # Format as HTML list
    html_points = []
    for i, point in enumerate(points, 1):
        # Add bold formatting for key terms
        point = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', point)
        html_points.append(f"<li><strong>{i}.</strong> {point}</li>")
    
    return f"<ol class='talking-points'>{' '.join(html_points)}</ol>"

def format_business_impact(text: str) -> str:
    """Format business impact with clean, professional structure"""
    if not text:
        return "<p>No business impact analysis available</p>"
    
    # Clean up the text first - remove extra dashes and asterisks
    text = re.sub(r'^---+\s*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'^\*\*([^*]+):\*\*', r'<strong>\1:</strong>', text, flags=re.MULTILINE)
    
    # Look for the main sections
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
            
        # Detect section headers (case insensitive)
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
        
        # Extract bullet points and regular content
        if line.startswith('•') or line.startswith('-') or line.startswith('*'):
            bullet_content = re.sub(r'^[•\-*]\s*', '', line).strip()
            if bullet_content and current_section:
                sections[current_section].append(bullet_content)
        elif current_section and line and not line.startswith('**'):
            sections[current_section].append(line)
    
    # Build clean HTML output
    html_parts = []
    
    # Risk Assessment Section
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
    
    # Opportunity Section
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
    
    # Summary Section
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
    
    if any(word in content for word in ['health', 'medical', 'healthcare', 'medicine', 'hospital', 'patient', 'medicare', 'medicaid']):
        return BillCategory.HEALTHCARE
    elif any(word in content for word in ['education', 'school', 'student', 'university', 'college', 'learning', 'teacher']):
        return BillCategory.EDUCATION
    elif any(word in content for word in ['infrastructure', 'engineering', 'construction', 'bridge', 'road', 'technology', 'broadband']):
        return BillCategory.ENGINEERING
    elif any(word in content for word in ['business', 'commerce', 'trade', 'economic', 'startup', 'entrepreneur']):
        return BillCategory.BUSINESS
    elif any(word in content for word in ['finance', 'tax', 'budget', 'revenue', 'fiscal', 'banking', 'investment']):
        return BillCategory.FINANCE
    elif any(word in content for word in ['environment', 'climate', 'pollution', 'conservation', 'renewable', 'energy', 'carbon']):
        return BillCategory.ENVIRONMENT
    elif any(word in content for word in ['transport', 'traffic', 'vehicle', 'highway', 'aviation', 'transit', 'rail']):
        return BillCategory.TRANSPORTATION
    elif any(word in content for word in ['agriculture', 'farming', 'farm', 'crop', 'livestock', 'rural', 'food']):
        return BillCategory.AGRICULTURE
    elif any(word in content for word in ['criminal', 'justice', 'police', 'court', 'prison', 'crime', 'law enforcement']):
        return BillCategory.CRIMINAL_JUSTICE
    elif any(word in content for word in ['labor', 'employment', 'worker', 'wage', 'union', 'workplace', 'job']):
        return BillCategory.LABOR
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
            print(f"📝 Truncated input text to {max_input_length} characters.")
        
        if context:
            text = f"Context: {context}\n\n{text}"
        
        prompt = ENHANCED_PROMPTS[prompt_type].format(text=text)
        
        messages = [
            {
                "role": "system",
                "content": ENHANCED_SYSTEM_MESSAGES[prompt_type]
            },
            {
                "role": "user",
                "content": prompt
            }
        ]

        print(f"🤖 Enhanced AI call for: {prompt_type.value} (with context: {context})")
        
        # Adjust parameters based on content type for more distinct outputs
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
        print(f"📝 Raw AI response ({prompt_type.value}):\n---\n{raw_response[:200]}...\n---")

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
        print(f"❌ Error during enhanced AI {prompt_type.value} call: {e}")
        return f"<p>Error generating {prompt_type.value.replace('_', ' ')}: {str(e)}</p>"

async def enhanced_bill_analysis(bill_data: Dict, context: str = "") -> Dict[str, str]:
    """Comprehensive AI analysis of a bill with enhanced distinct content"""
    try:
        # Extract bill information
        title = bill_data.get('title', '')
        description = bill_data.get('description', '')
        bill_number = bill_data.get('bill_number', '')
        state = bill_data.get('state', '')
        session = bill_data.get('session', {})
        session_name = session.get('session_name', '') if isinstance(session, dict) else ''
        sponsors = bill_data.get('sponsors', [])
        
        # Build enhanced context for each analysis type
        base_context = f"{state} {bill_number}" if state and bill_number else "State Legislation"
        
        # Build comprehensive content for analysis
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
        
        print(f"🔍 Enhanced analysis for: {bill_number} - {title[:50]}...")
        
        # Categorize the bill
        category = categorize_bill_enhanced(title, description)
        
        # Run AI analysis tasks with different contexts for each type
        try:
            summary_task = enhanced_ai_analysis(content, PromptType.EXECUTIVE_SUMMARY, context=f"Executive Summary - {base_context}")
            talking_points_task = enhanced_ai_analysis(content, PromptType.KEY_TALKING_POINTS, context=f"Stakeholder Discussion - {base_context}")
            business_impact_task = enhanced_ai_analysis(content, PromptType.BUSINESS_IMPACT, context=f"Business Analysis - {base_context}")
            
            summary_result, talking_points_result, business_impact_result = await asyncio.gather(
                summary_task, talking_points_task, business_impact_task, return_exceptions=True
            )
            
            # Handle potential exceptions
            if isinstance(summary_result, Exception):
                summary_result = f"<p>Error generating summary: {str(summary_result)}</p>"
            if isinstance(talking_points_result, Exception):
                talking_points_result = f"<p>Error generating talking points: {str(talking_points_result)}</p>"
            if isinstance(business_impact_result, Exception):
                business_impact_result = f"<p>Error generating business impact: {str(business_impact_result)}</p>"
                
        except Exception as e:
            print(f"❌ Error in enhanced AI analysis tasks: {e}")
            summary_result = f"<p>Error generating summary: {str(e)}</p>"
            talking_points_result = f"<p>Error generating talking points: {str(e)}</p>"
            business_impact_result = f"<p>Error generating business impact: {str(e)}</p>"
        
        # Return results with both old and new field names for compatibility
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
        print(f"❌ Error in enhanced bill analysis: {e}")
        traceback.print_exc()
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
        
        print(f"✅ Enhanced LegiScan client initialized with key: {self.api_key[:4]}***")
    
    def _build_url(self, operation: str, params: Optional[Dict] = None) -> str:
        """Build LegiScan API URL"""
        if params is None:
            params = {}
        
        param_str = '&'.join([f"{k}={v}" for k, v in params.items()])
        return f"{self.base_url}/?key={self.api_key}&op={operation}&{param_str}"
    
    async def _api_request(self, url: str) -> Dict[str, Any]:
        """Make async API request with error handling"""
        try:
            print("🔍 Making enhanced LegiScan API request...")
            
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
            print(f"❌ Enhanced LegiScan API request failed: {e}")
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
            
            print(f"🔍 Enhanced search found {summary.get('count', 0)} results")
            
            # Limit results
            if limit and len(results) > limit:
                results = results[:limit]
            
            return {
                'success': True,
                'summary': summary,
                'results': results,
                'bills_found': len(results)
            }
            
        except Exception as e:
            print(f"❌ Error in enhanced search: {e}")
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
            if bill:
                print(f"✅ Successfully fetched detailed bill {bill_id}")
            
            return bill
            
        except Exception as e:
            print(f"❌ Error fetching detailed bill {bill_id}: {e}")
            return {}
    
    async def enhanced_search_and_analyze(self, state: str, query: str, limit: int = 20, 
                                        with_ai: bool = True, db_manager = None) -> Dict:
        """Enhanced search and analyze workflow with one-by-one processing"""
        try:
            print(f"🚀 Enhanced search and analyze: {query} in {state}")
            
            # Step 1: Search for bills
            search_result = await self.search_bills_enhanced(state, query, limit)
            
            if not search_result.get('success') or not search_result.get('results'):
                return {
                    'success': False,
                    'error': 'No bills found for search query',
                    'bills': []
                }
            
            search_results = search_result['results']
            analyzed_bills = []
            
            # Step 2: Process each bill one by one
            for i, bill_summary in enumerate(search_results, 1):
                try:
                    bill_id = bill_summary.get('bill_id')
                    if not bill_id:
                        continue
                    
                    print(f"📋 Processing bill {i}/{len(search_results)}: {bill_id}")
                    
                    # Step 2a: Get detailed bill data
                    detailed_bill = await self.get_bill_detailed(int(bill_id))
                    if not detailed_bill:
                        print(f"⚠️ No detailed data for bill {bill_id}, skipping")
                        continue
                    
                    # Step 2b: Enhanced AI analysis if requested
                    ai_analysis = {}
                    if with_ai and enhanced_ai_client:
                        try:
                            ai_analysis = await enhanced_bill_analysis(detailed_bill, f"Search: {query}")
                            print(f"✅ Enhanced AI analysis completed for bill {bill_id}")
                        except Exception as e:
                            print(f"❌ Enhanced AI analysis failed for bill {bill_id}: {e}")
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
                        'reviewed': False  # ✅ ADD THIS LINE
                    }
                    
                    # Step 2d: Add AI analysis results
                    complete_bill.update(ai_analysis)
                    
                    # Step 2e: Save to database if manager provided
                    if db_manager:
                        try:
                            success = db_manager.save_bill(complete_bill)
                            if success:
                                print(f"✅ Saved bill {bill_id} to database")
                            else:
                                print(f"❌ Failed to save bill {bill_id} to database")
                        except Exception as e:
                            print(f"❌ Database save error for bill {bill_id}: {e}")
                    
                    analyzed_bills.append(complete_bill)
                    print(f"✅ Completed processing bill {bill_id}")
                    
                except Exception as e:
                    print(f"❌ Error processing bill {i}: {e}")
                    continue
            
            print(f"✅ Enhanced analysis completed: {len(analyzed_bills)} bills processed")
            
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
            print(f"❌ Error in enhanced search and analyze: {e}")
            traceback.print_exc()
            return {
                'success': False,
                'error': str(e),
                'bills': []
            }

# ===============================
# ORIGINAL AI CLIENT SETUP
# ===============================

def get_ai_client():
    """Get AI client for bill analysis (adjust based on your setup)"""
    try:
        # Check if you're using OpenAI or Azure OpenAI
        if os.getenv('AZURE_ENDPOINT') and os.getenv('AZURE_KEY'):
            # Azure OpenAI setup
            import openai
            client = openai.AzureOpenAI(
                api_key=os.getenv('AZURE_KEY'),
                api_version="2024-02-15-preview",
                azure_endpoint=os.getenv('AZURE_ENDPOINT'),
                azure_deployment=os.getenv('AZURE_MODEL_NAME', 'gpt-4')
            )
            print("✅ Azure OpenAI client initialized")
            return client
        elif os.getenv('OPENAI_API_KEY'):
            # Regular OpenAI setup
            import openai
            client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
            print("✅ OpenAI client initialized")
            return client
        else:
            print("⚠️ No AI client configured - set AZURE_ENDPOINT+AZURE_KEY or OPENAI_API_KEY")
            return None
    except Exception as e:
        print(f"❌ AI client setup failed: {e}")
        return None

# ===============================
# DATABASE SETUP
# ===============================

class StateLegislationDatabaseManager:
    """Database manager for one-by-one bill processing"""
    
    def __init__(self, connection):
        self.connection = connection
    
    def save_bill(self, bill_data: dict):
        """Save a single bill to the database - FIXES the session parameter issue"""
        try:
            cursor = self.connection.cursor()
            
            # Check if bill already exists
            check_query = "SELECT id FROM dbo.state_legislation WHERE bill_id = ?"
            cursor.execute(check_query, bill_data.get('bill_id'))
            existing = cursor.fetchone()
            
            if existing:
                # Update existing bill
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
                
                # Around line 285, add reviewed to the values tuple:
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
                    bill_data.get('reviewed', False),  # ✅ ADD THIS LINE
                    bill_data.get('bill_id')
)
                
                cursor.execute(update_query, values)
                print(f"✅ Updated existing bill: {bill_data.get('bill_id')}")
                
            else:
                # Insert new bill
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
                    bill_data.get('reviewed', False)  # ✅ ADD THIS LINE
                )
                
                cursor.execute(insert_query, values)
                print(f"✅ Inserted new bill: {bill_data.get('bill_id')}")
            
            self.connection.commit()
            return True
            
        except Exception as e:
            print(f"❌ Error saving bill {bill_data.get('bill_id', 'unknown')}: {e}")
            self.connection.rollback()
            return False

# ===============================
# PYDANTIC REQUEST MODELS
# ===============================

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
    enhanced_ai: bool = True  # NEW: Use enhanced AI processing

class ExecutiveOrderFetchRequest(BaseModel):
    start_date: Optional[str] = "2025-01-20"
    end_date: Optional[str] = None
    per_page: Optional[int] = 1000
    save_to_db: Optional[bool] = True
    with_ai: Optional[bool] = True

class ExecutiveOrderSearchRequest(BaseModel):
    category: Optional[str] = None
    search: Optional[str] = None
    page: int = 1
    per_page: int = 25
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

    

# ===============================
# DATABASE CONNECTION CLASS
# ===============================

class DatabaseConnection:
    def __init__(self):
        self.connection_string = self._build_connection_string()
        self.connection = None
    
    def _build_connection_string(self):
        """Build database connection string from environment variables"""
        server = os.getenv('AZURE_SQL_SERVER')
        database = os.getenv('AZURE_SQL_DATABASE') 
        username = os.getenv('AZURE_SQL_USERNAME')
        password = os.getenv('AZURE_SQL_PASSWORD')
        driver = 'ODBC Driver 18 for SQL Server'
        
        # Check that all required credentials are provided
        if not all([server, database, username, password]):
            missing = []
            if not server: missing.append('AZURE_SQL_SERVER')
            if not database: missing.append('AZURE_SQL_DATABASE')
            if not username: missing.append('AZURE_SQL_USERNAME')
            if not password: missing.append('AZURE_SQL_PASSWORD')
            
            print(f"❌ Missing required environment variables: {', '.join(missing)}")
            raise ValueError(f"Missing required database environment variables: {', '.join(missing)}")
        
        print(f"🔗 Database connection details:")
        print(f"   Server: {server}")
        print(f"   Database: {database}")
        print(f"   Username: {username}")
        print(f"   Password: {'*' * len(password)}")
        
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
        
        return connection_string
    
    def test_connection(self):
        """Test database connection"""
        try:
            print(f"🔍 Testing connection to Azure SQL...")
            with pyodbc.connect(self.connection_string) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT 1 as test_value")
                result = cursor.fetchone()
                if result and result[0] == 1:
                    logger.info("✅ Database connection successful")
                    return True
                else:
                    logger.error("❌ Database test query failed")
                    return False
        except pyodbc.Error as e:
            logger.error(f"❌ Database connection failed: {e}")
            return False
        except Exception as e:
            logger.error(f"❌ Unexpected database error: {e}")
            return False
    
    def get_connection(self):
        """Get a database connection"""
        try:
            return pyodbc.connect(self.connection_string)
        except pyodbc.Error as e:
            logger.error(f"Failed to get database connection: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error getting database connection: {e}")
            raise

def get_azure_sql_connection():
    """Get Azure SQL connection using our DatabaseConnection class"""
    try:
        db_conn = DatabaseConnection()
        return db_conn.get_connection()
    except Exception as e:
        logger.error(f"❌ Azure SQL connection failed: {e}")
        return None

# ===============================
# DATABASE IMPORTS AND SETUP
# ===============================

# Import Azure SQL database functions
try:
    from database_azure_fixed import (
        test_azure_sql_connection,
        init_databases,
        LegislationSession,
        StateLegislationDB,
        save_legislation_to_azure_sql as save_legislation_to_db,
        get_legislation_from_azure_sql as get_legislation_from_db,
        get_legislation_stats_azure_sql as get_legislation_stats,
        test_azure_sql_full
    )
    AZURE_SQL_AVAILABLE = True
    print("✅ Azure SQL database available")
except ImportError as e:
    print(f"❌ Database import failed: {e}")
    AZURE_SQL_AVAILABLE = False

# Import Simple Executive Orders API
try:
    from simple_executive_orders import fetch_executive_orders_simple_integration
    SIMPLE_EO_AVAILABLE = True
    print("✅ Simple Executive Orders API available")
except ImportError as e:
    print(f"⚠️ Simple Executive Orders API not available: {e}")
    SIMPLE_EO_AVAILABLE = False

# Set availability flags
HIGHLIGHTS_DB_AVAILABLE = AZURE_SQL_AVAILABLE

# Check if executive orders functions are available
try:
    if AZURE_SQL_AVAILABLE:
        EXECUTIVE_ORDERS_AVAILABLE = True
        print("✅ Executive orders functions created successfully")
    else:
        EXECUTIVE_ORDERS_AVAILABLE = False
        print("❌ Executive orders not available (Azure SQL not available)")
except Exception as e:
    print(f"❌ Executive orders integration failed: {e}")
    EXECUTIVE_ORDERS_AVAILABLE = False

 # ===============================
# REVIEW STATUS API ENDPOINTS  
# ===============================

@app.patch("/api/state-legislation/{id}/review")
async def update_state_legislation_review_status(
    id: str,
    request: dict
):
    """Update review status for state legislation"""
    try:
        reviewed = request.get('reviewed', False)
        
        print(f"🔍 BACKEND: Received ID: {id}")
        print(f"🔍 BACKEND: Setting reviewed to: {reviewed}")
        
        conn = get_azure_sql_connection()
        if not conn:
            raise HTTPException(status_code=503, detail="Database connection failed")
        
        cursor = conn.cursor()
        
        # First, let's see what's actually in the database
        cursor.execute("SELECT TOP 3 id, bill_id, title FROM dbo.state_legislation ORDER BY last_updated DESC")
        sample_records = cursor.fetchall()
        print(f"🔍 BACKEND: Sample records in database:")
        for record in sample_records:
            print(f"   id: {record[0]}, bill_id: {record[1]}, title: {record[2][:30]}...")
        
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
                print(f"🔍 BACKEND: Trying {attempt_name} with param: {param}")
                cursor.execute(query, param)
                result = cursor.fetchone()
                if result:
                    found_record_id = result[0]
                    print(f"✅ BACKEND: Found record with {attempt_name}, database ID: {found_record_id}")
                    break
                else:
                    print(f"❌ BACKEND: No match with {attempt_name}")
            except Exception as e:
                print(f"❌ BACKEND: Error with {attempt_name}: {e}")
        
        if not found_record_id:
            print(f"❌ BACKEND: Could not find any record for ID: {id}")
            conn.close()
            raise HTTPException(status_code=404, detail=f"State legislation not found for ID: {id}")
        
        # Update the record
        update_query = "UPDATE dbo.state_legislation SET reviewed = ? WHERE id = ?"
        cursor.execute(update_query, reviewed, found_record_id)
        rows_affected = cursor.rowcount
        
        print(f"🔍 BACKEND: Updated {rows_affected} rows")
        
        if rows_affected == 0:
            conn.close()
            raise HTTPException(status_code=404, detail="No rows were updated")
        
        conn.commit()
        conn.close()
        
        print(f"✅ BACKEND: Successfully updated record {found_record_id}")
        
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
    
@app.patch("/api/test-patch/{id}")
async def test_patch(id: str):
    return {"test": "patch works", "id": id}

# ===============================
# EXECUTIVE ORDERS DATABASE FUNCTIONS
# ===============================

def get_executive_orders_from_db(limit=1000, offset=0, filters=None):
    """Get executive orders using EXACT column names from your table"""
    try:
        print(f"🔍 DEBUG: Function called with limit={limit}, offset={offset}")
        
        # Build SQL query using YOUR EXACT column names
        base_query = """
                SELECT 
                    id,
                    document_number,
                    eo_number,
                    title,
                    summary,
                    signing_date,
                    publication_date,
                    citation,
                    presidential_document_type,
                    category,
                    html_url,
                    pdf_url,
                    trump_2025_url,
                    ai_summary,
                    ai_executive_summary,
                    ai_key_points,
                    ai_talking_points,
                    ai_business_impact,
                    ai_potential_impact,
                    ai_version,
                    source,
                    raw_data_available,
                    processing_status,
                    error_message,
                    created_at,
                    last_updated,
                    last_scraped_at,
                    content,
                    tags,
                    ai_analysis,
                    reviewed
                FROM dbo.executive_orders
                """
        
        # Add WHERE clause if filters exist
        where_conditions = []
        params = []
        
        if filters:
            if filters.get('search'):
                where_conditions.append("(title LIKE ? OR summary LIKE ? OR ai_summary LIKE ?)")
                search_term = f"%{filters['search']}%"
                params.extend([search_term, search_term, search_term])
                print(f"🔍 DEBUG: Added search filter: {search_term}")
            
            if filters.get('category'):
                where_conditions.append("category = ?")
                params.append(filters['category'])
                print(f"🔍 DEBUG: Added category filter: {filters['category']}")
        
        if where_conditions:
            base_query += " WHERE " + " AND ".join(where_conditions)
        
        # Add ORDER BY and pagination
        base_query += " ORDER BY publication_date DESC, eo_number DESC"
        base_query += f" OFFSET {offset} ROWS FETCH NEXT {limit} ROWS ONLY"
        
        print(f"🔍 DEBUG: Final SQL Query:")
        print(f"    {base_query}")
        
        # Execute query
        conn = get_azure_sql_connection()
        if not conn:
            return {'success': False, 'message': 'No database connection', 'results': [], 'count': 0}
        
        cursor = conn.cursor()
        
        # Get total count
        count_query = "SELECT COUNT(*) FROM dbo.executive_orders"
        if where_conditions:
            count_query += " WHERE " + " AND ".join(where_conditions)
        
        cursor.execute(count_query, params if where_conditions else [])
        total_count = cursor.fetchone()[0]
        print(f"🔍 DEBUG: Total count from database: {total_count}")
        
        # Execute main query
        cursor.execute(base_query, params)
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()
        print(f"🔍 DEBUG: Raw rows fetched: {len(rows)}")
        
        # Convert to API format
        results = []
        for i, row in enumerate(rows):
            db_record = dict(zip(columns, row))
            
            if i < 3:
                print(f"🔍 DEBUG: Row {i+1}: eo_number={db_record.get('eo_number')}, title={db_record.get('title', '')[:30]}...")
            
            # Map your database columns to API format
            api_record = {
                # Core identification
                'id': db_record.get('id'),
                'bill_id': db_record.get('id'),
                'eo_number': db_record.get('eo_number'),
                'executive_order_number': db_record.get('eo_number'),
                'bill_number': db_record.get('eo_number'),
                'document_number': db_record.get('document_number'),
                
                # Content
                'title': db_record.get('title', 'Untitled Executive Order'),
                'summary': db_record.get('summary', ''),
                'description': db_record.get('summary', ''),
                'content': db_record.get('content', ''),
                
                # Dates
                'signing_date': db_record.get('signing_date'),
                'publication_date': db_record.get('publication_date'),
                'introduced_date': db_record.get('signing_date'),
                'last_action_date': db_record.get('publication_date'),
                
                # URLs
                'html_url': db_record.get('html_url', ''),
                'pdf_url': db_record.get('pdf_url', ''),
                'trump_2025_url': db_record.get('trump_2025_url', ''),
                'legiscan_url': db_record.get('html_url', ''),
                
                # Metadata
                'citation': db_record.get('citation', ''),
                'presidential_document_type': db_record.get('presidential_document_type', ''),
                'category': db_record.get('category', 'civic'),
                'source': db_record.get('source', 'Federal Register'),
                'tags': db_record.get('tags', ''),
                
                # AI Analysis
                'ai_summary': db_record.get('ai_summary', ''),
                'ai_executive_summary': db_record.get('ai_executive_summary', ''),
                'ai_key_points': db_record.get('ai_key_points', ''),
                'ai_talking_points': db_record.get('ai_talking_points', ''),
                'ai_business_impact': db_record.get('ai_business_impact', ''),
                'ai_potential_impact': db_record.get('ai_potential_impact', ''),
                'ai_version': db_record.get('ai_version', ''),
                'ai_analysis': db_record.get('ai_analysis', ''),
                'ai_processed': bool(
                    db_record.get('ai_summary') or 
                    db_record.get('ai_executive_summary') or 
                    db_record.get('ai_analysis')
                ),
                
                # Processing Status
                'processing_status': db_record.get('processing_status', ''),
                'raw_data_available': db_record.get('raw_data_available', False),
                'error_message': db_record.get('error_message', ''),
                
                # Timestamps
                'created_at': db_record.get('created_at'),
                'last_updated': db_record.get('last_updated'),
                'last_scraped_at': db_record.get('last_scraped_at'),
                
                # API-specific fields
                'bill_type': 'executive_order',
                'state': 'Federal',
                'president': 'Donald Trump'
            }
            
            # Format dates
            for date_field in ['signing_date', 'publication_date']:
                if api_record.get(date_field):
                    try:
                        if hasattr(api_record[date_field], 'strftime'):
                            api_record[f'formatted_{date_field}'] = api_record[date_field].strftime('%Y-%m-%d')
                        else:
                            api_record[f'formatted_{date_field}'] = str(api_record[date_field])
                    except:
                        api_record[f'formatted_{date_field}'] = str(api_record[date_field])
            
            results.append(api_record)
        
        cursor.close()
        conn.close()
        
        print(f"🔍 DEBUG: Successfully processed {len(results)} executive orders")
        
        return {
            'success': True,
            'results': results,
            'count': len(results),
            'total': total_count
        }
        
    except Exception as e:
        print(f"❌ DEBUG: Error in get_executive_orders_from_db: {e}")
        import traceback
        traceback.print_exc()
        return {
            'success': False,
            'message': str(e),
            'results': [],
            'count': 0
        }

def save_executive_orders_to_db(orders):
    """Save executive orders using existing save_legislation_to_db"""
    try:
        if not AZURE_SQL_AVAILABLE:
            print("❌ Azure SQL not available for saving")
            return 0
            
        # Clean the orders data to match StateLegislationDB schema
        cleaned_orders = []
        
        for order in orders:
            cleaned_order = {
                'bill_id': order.get('bill_id', f"eo-{order.get('bill_number', 'unknown')}"),
                'bill_number': order.get('bill_number', ''),
                'title': order.get('title', ''),
                'description': order.get('description', ''),
                'state': order.get('state', 'Federal'),
                'state_abbr': order.get('state_abbr', 'US'),
                'status': order.get('status', 'Signed'),
                'category': order.get('category', 'civic'),
                'introduced_date': order.get('introduced_date', ''),
                'last_action_date': order.get('last_action_date', ''),
                'session_id': order.get('session_id', '2025-trump-admin'),
                'session_name': order.get('session_name', 'Trump 2025 Administration'),
                'bill_type': order.get('bill_type', 'executive_order'),
                'body': order.get('body', 'executive'),
                'legiscan_url': order.get('legiscan_url', ''),
                'pdf_url': order.get('pdf_url', ''),
                'ai_summary': order.get('ai_summary', ''),
                'ai_executive_summary': order.get('ai_executive_summary', ''),
                'ai_talking_points': order.get('ai_talking_points', ''),
                'ai_key_points': order.get('ai_key_points', ''),
                'ai_business_impact': order.get('ai_business_impact', ''),
                'ai_potential_impact': order.get('ai_potential_impact', ''),
                'ai_version': order.get('ai_version', 'simple_eo_v1'),
                'created_at': order.get('created_at', datetime.now().strftime('%Y-%m-%d %H:%M:%S')),
                'last_updated': order.get('last_updated', datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
            }
            
            cleaned_orders.append(cleaned_order)
        
        print(f"🔍 Saving {len(cleaned_orders)} executive orders (cleaned data)")
        return save_legislation_to_db(cleaned_orders)
        
    except Exception as e:
        print(f"❌ Error saving executive orders: {e}")
        import traceback
        traceback.print_exc()
        return 0

# ===============================
# HIGHLIGHTS DATABASE FUNCTIONS
# ===============================

def create_highlights_table():
    """Create the user highlights table"""
    try:
        conn = get_azure_sql_connection()
        if not conn:
            return False
            
        cursor = conn.cursor()
        
        create_table_sql = """
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='user_highlights' AND xtype='U')
        CREATE TABLE user_highlights (
            id INT IDENTITY(1,1) PRIMARY KEY,
            user_id NVARCHAR(50) NOT NULL,
            order_id NVARCHAR(100) NOT NULL,
            order_type NVARCHAR(50) NOT NULL,
            title NVARCHAR(MAX),
            description NVARCHAR(MAX),
            ai_summary NVARCHAR(MAX),
            category NVARCHAR(50),
            state NVARCHAR(50),
            signing_date NVARCHAR(50),
            html_url NVARCHAR(500),
            pdf_url NVARCHAR(500),
            legiscan_url NVARCHAR(500),
            highlighted_at DATETIME2 DEFAULT GETUTCDATE(),
            notes NVARCHAR(MAX),
            priority_level INT DEFAULT 1,
            tags NVARCHAR(MAX),
            is_archived BIT DEFAULT 0,
            CONSTRAINT UQ_user_highlight UNIQUE (user_id, order_id, order_type)
        );
        """
        
        cursor.execute(create_table_sql)
        conn.commit()
        conn.close()
        
        print("✅ User highlights table created successfully")
        return True
        
    except Exception as e:
        print(f"❌ Error creating highlights table: {e}")
        return False

def add_highlight_direct(user_id: str, order_id: str, order_type: str, item_data: dict = None) -> bool:
    """Add a highlight with full item data"""
    try:
        conn = get_azure_sql_connection()
        if not conn:
            print("❌ No database connection available")
            return False
            
        cursor = conn.cursor()
        
        # Check if highlight already exists
        check_query = """
        SELECT id FROM user_highlights 
        WHERE user_id = ? AND order_id = ? AND order_type = ? AND is_archived = 0
        """
        cursor.execute(check_query, user_id, order_id, order_type)
        existing = cursor.fetchone()
        
        if existing:
            print(f"ℹ️ Highlight already exists for {order_id}")
            conn.close()
            return True
        
        # Insert new highlight with item data
        insert_query = """
        INSERT INTO user_highlights (
            user_id, order_id, order_type, title, description, ai_summary, 
            category, state, signing_date, html_url, pdf_url, legiscan_url,
            notes, priority_level, tags, is_archived
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        
        # Prepare values with proper defaults
        values = (
            user_id, 
            order_id, 
            order_type,
            item_data.get('title', '') if item_data else '',
            item_data.get('description', '') if item_data else '',
            item_data.get('ai_summary', '') if item_data else '',
            item_data.get('category', '') if item_data else '',
            item_data.get('state', '') if item_data else '',
            item_data.get('signing_date', '') if item_data else '',
            item_data.get('html_url', '') if item_data else '',
            item_data.get('pdf_url', '') if item_data else '',
            item_data.get('legiscan_url', '') if item_data else '',
            None,  # notes
            1,     # priority_level
            None,  # tags
            0      # is_archived
        )
        
        cursor.execute(insert_query, values)
        rows_affected = cursor.rowcount
        
        conn.commit()
        conn.close()
        
        success = rows_affected > 0
        print(f"{'✅' if success else '❌'} Add highlight result: {success} (rows affected: {rows_affected})")
        return success
        
    except Exception as e:
        print(f"❌ Error adding highlight: {e}")
        import traceback
        traceback.print_exc()
        return False

def remove_highlight_direct(user_id: str, order_id: str, order_type: str = None) -> bool:
    """Remove a highlight"""
    try:
        conn = get_azure_sql_connection()
        if not conn:
            print("❌ No database connection available")
            return False
            
        cursor = conn.cursor()
        
        if order_type:
            delete_query = """
            DELETE FROM user_highlights 
            WHERE user_id = ? AND order_id = ? AND order_type = ?
            """
            cursor.execute(delete_query, user_id, order_id, order_type)
        else:
            delete_query = """
            DELETE FROM user_highlights 
            WHERE user_id = ? AND order_id = ?
            """
            cursor.execute(delete_query, user_id, order_id)
        
        rows_affected = cursor.rowcount
        conn.commit()
        conn.close()
        
        success = rows_affected > 0
        print(f"{'✅' if success else 'ℹ️'} Remove highlight result: {success} (rows affected: {rows_affected})")
        return success
        
    except Exception as e:
        print(f"❌ Error removing highlight: {e}")
        import traceback
        traceback.print_exc()
        return False

def get_user_highlights_direct(user_id: str) -> List[Dict]:
    """Get all highlights for a user"""
    try:
        conn = get_azure_sql_connection()
        if not conn:
            return []
            
        cursor = conn.cursor()
        
        query = """
        SELECT order_id, order_type, title, description, ai_summary, category, 
               state, signing_date, html_url, pdf_url, legiscan_url, 
               highlighted_at, notes, priority_level
        FROM user_highlights 
        WHERE user_id = ? AND is_archived = 0
        ORDER BY highlighted_at DESC
        """
        
        cursor.execute(query, user_id)
        highlights = cursor.fetchall()
        
        results = []
        for highlight in highlights:
            (order_id, order_type, title, description, ai_summary, category, 
             state, signing_date, html_url, pdf_url, legiscan_url, 
             highlighted_at, notes, priority_level) = highlight
            
            result = {
                'order_id': order_id,
                'order_type': order_type,
                'title': title or f'{order_type.replace("_", " ").title()} {order_id}',
                'description': description or '',
                'ai_summary': ai_summary or '',
                'category': category or '',
                'state': state or '',
                'signing_date': signing_date or '',
                'html_url': html_url or '',
                'pdf_url': pdf_url or '',
                'legiscan_url': legiscan_url or '',
                'highlighted_at': highlighted_at.isoformat() if highlighted_at else None,
                'notes': notes or '',
                'priority_level': priority_level or 1
            }
            results.append(result)
        
        conn.close()
        return results
        
    except Exception as e:
        print(f"❌ Error getting user highlights: {e}")
        return []

# ===============================
# LEGISCAN API IMPORT AND SETUP
# ===============================

# Import LegiScan API - with fallback handling
try:
    from legiscan_api import LegiScanAPI
    LEGISCAN_AVAILABLE = True
    print("✅ LegiScan API imported successfully")
    
    # Test initialization
    try:
        # Create a test instance to verify it works
        test_legiscan = LegiScanAPI()
        print("✅ LegiScan API can be initialized")
        LEGISCAN_INITIALIZED = True
    except Exception as e:
        print(f"⚠️ LegiScan API import successful but initialization failed: {e}")
        print("   (This is usually due to missing LEGISCAN_API_KEY in .env)")
        LEGISCAN_INITIALIZED = False
        
except ImportError as e:
    print(f"❌ LegiScan API import failed: {e}")
    print("   Make sure legiscan_api.py is in the same directory as main.py")
    LEGISCAN_AVAILABLE = False
    LEGISCAN_INITIALIZED = False
except Exception as e:
    print(f"❌ Unexpected error importing LegiScan API: {e}")
    LEGISCAN_AVAILABLE = False
    LEGISCAN_INITIALIZED = False

# ===============================
# STATE LEGISLATION DATABASE FUNCTIONS
# ===============================

def get_state_legislation_from_db(limit=100, offset=0, filters=None):
    """Get state legislation from Azure SQL database"""
    try:
        print(f"🔍 DEBUG: Getting state legislation - limit={limit}, offset={offset}, filters={filters}")
        
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
                # Handle both state abbreviations and full names
                state_value = filters['state']
                where_conditions.append("(state = ? OR state_abbr = ? OR state LIKE ?)")
                params.extend([state_value, state_value, f"%{state_value}%"])
                print(f"🔍 DEBUG: Added state filter: {state_value}")
            
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
        base_query += " ORDER BY last_updated DESC, created_at DESC"
        base_query += f" OFFSET {offset} ROWS FETCH NEXT {limit} ROWS ONLY"
        
        print(f"🔍 DEBUG: Final SQL Query: \n        {base_query}")
        
        # Execute query
        conn = get_azure_sql_connection()
        if not conn:
            return {'success': False, 'message': 'No database connection', 'results': [], 'count': 0}
        
        cursor = conn.cursor()
        
        # Get total count
        count_query = "SELECT COUNT(*) FROM dbo.state_legislation"
        if where_conditions:
            count_query += " WHERE " + " AND ".join(where_conditions)
        
        cursor.execute(count_query, params if where_conditions else [])
        total_count = cursor.fetchone()[0]
        print(f"🔍 DEBUG: Total count from database: {total_count}")
        
        # Execute main query
        cursor.execute(base_query, params)
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()
        print(f"🔍 DEBUG: Raw rows fetched: {len(rows)}")
        
        # Convert to API format
        results = []
        for i, row in enumerate(rows):
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
                'summary': db_record.get('ai_summary', ''),  # Use ai_summary as summary
                
                # Location
                'state': db_record.get('state', ''),
                'state_abbr': db_record.get('state_abbr', ''),
                
                # Status and metadata
                'status': db_record.get('status', ''),
                'category': db_record.get('category', 'not-applicable'),
                'session': db_record.get('session_name', ''),
                'bill_type': db_record.get('bill_type', 'bill'),
                'body': db_record.get('body', ''),
                
                # Dates
                'introduced_date': db_record.get('introduced_date'),
                'last_action_date': db_record.get('last_action_date'),
                'status_date': db_record.get('last_action_date'),  # Alias
                
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
                'reviewed': db_record.get('reviewed', False)
            }
            
            # Format dates
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
        print(f"❌ DEBUG: Error in get_state_legislation_from_db: {e}")
        import traceback
        traceback.print_exc()
        return {
            'success': False,
            'message': str(e),
            'results': [],
            'count': 0
        }

def save_state_legislation_to_db(bills):
    """Save state legislation to database using existing save_legislation_to_db"""
    try:
        if not AZURE_SQL_AVAILABLE:
            print("❌ Azure SQL not available for saving")
            return 0
        
        print(f"🔍 BACKEND: Attempting to save {len(bills)} bills to database")
        
        # Clean bills data to ensure compatibility (remove 'session' field if present)
        cleaned_bills = []
        for bill in bills:
            cleaned_bill = dict(bill)  # Make a copy
            # Remove the problematic 'session' field if it exists
            if 'session' in cleaned_bill:
                del cleaned_bill['session']
            cleaned_bills.append(cleaned_bill)
        
        print(f"🔍 Saving {len(cleaned_bills)} state bills to database")
        return save_legislation_to_db(cleaned_bills)
        
    except Exception as e:
        print(f"❌ Error saving state legislation: {e}")
        import traceback
        traceback.print_exc()
        return 0

# ===============================
# FASTAPI APP SETUP
# ===============================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown"""
    print("🔄 Starting Enhanced LegislationVue API with ai.py Integration...")
    yield

app = FastAPI(
    title="Enhanced LegislationVue API - ai.py Integration",
    description="API with Enhanced AI Processing from ai.py",
    version="14.0.0-Enhanced-AI-Integration",
    lifespan=lifespan
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===============================
# MAIN ENDPOINTS
# ===============================

@app.get("/api/executive-orders/debug-count")
async def debug_database_count():
    """Debug endpoint to check database counts"""
    try:
        from simple_executive_orders import get_db_connection
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get various counts
        debug_info = {}
        
        # Total count
        cursor.execute("SELECT COUNT(*) FROM dbo.executive_orders")
        debug_info['total_rows'] = cursor.fetchone()[0]
        
        # By president
        cursor.execute("SELECT president, COUNT(*) FROM dbo.executive_orders GROUP BY president")
        president_counts = cursor.fetchall()
        debug_info['by_president'] = {p[0]: p[1] for p in president_counts}
        
        # Trump orders with different criteria
        cursor.execute("SELECT COUNT(*) FROM dbo.executive_orders WHERE president = 'donald-trump'")
        debug_info['trump_total'] = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM dbo.executive_orders WHERE president = 'Donald Trump'")
        debug_info['trump_capitalized'] = cursor.fetchone()[0]
        
        # Check field availability
        cursor.execute("SELECT TOP 5 eo_number, document_number, executive_order_number, title FROM dbo.executive_orders")
        samples = cursor.fetchall()
        debug_info['sample_data'] = [
            {
                'eo_number': s[0],
                'document_number': s[1], 
                'executive_order_number': s[2],
                'title': s[3][:50] if s[3] else None
            } for s in samples
        ]
        
        # Check column names
        cursor.execute("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'executive_orders'")
        columns = cursor.fetchall()
        debug_info['table_columns'] = [c[0] for c in columns]
        
        cursor.close()
        conn.close()
        
        return {
            "success": True,
            "debug_info": debug_info
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.get("/api/executive-orders/check-count")
async def api_check_executive_orders_count():
    """
    FIXED: API endpoint for checking executive orders count with accurate comparison
    """
    try:
        logger.info("🔍 API: Starting executive orders count check...")
        
        # Import the fixed function from simple_executive_orders
        from simple_executive_orders import check_executive_orders_count_integration
        
        result = await check_executive_orders_count_integration()
        
        # Add additional validation
        if result.get('success'):
            federal_count = result.get('federal_register_count', 0)
            database_count = result.get('database_count', 0)
            new_orders = result.get('new_orders_available', 0)
            
            logger.info(f"✅ Count check completed:")
            logger.info(f"   Federal Register: {federal_count}")
            logger.info(f"   Database: {database_count}")
            logger.info(f"   New orders available: {new_orders}")
            
            # Only show notification if there are actually new orders
            if new_orders > 0:
                logger.info(f"🔔 {new_orders} new executive orders need to be fetched")
            else:
                logger.info(f"✅ Database is synchronized with Federal Register")
                
        else:
            logger.error(f"❌ Count check failed: {result.get('error', 'Unknown error')}")
        
        return result
        
    except Exception as e:
        logger.error(f"❌ API: Error in count check endpoint: {e}")
        return {
            "success": False,
            "error": str(e),
            "federal_register_count": 0,
            "database_count": 0,
            "new_orders_available": 0,
            "needs_fetch": False,
            "last_checked": datetime.now().isoformat(),
            "message": f"Count check failed: {str(e)}"
        }

# Debug endpoint to help troubleshoot count issues
@app.get("/api/executive-orders/debug-counts")
async def debug_executive_orders_counts():
    """Debug endpoint to investigate count discrepancies"""
    try:
        from simple_executive_orders import debug_count_discrepancy, SimpleExecutiveOrders
        
        # Get detailed database debug info
        db_debug = await debug_count_discrepancy()
        
        # Get Federal Register info
        simple_eo = SimpleExecutiveOrders()
        
        # Test Federal Register API call
        try:
            test_result = simple_eo.fetch_executive_orders_direct(
                start_date="01/20/2025", 
                end_date=None, 
                limit=1  # Just get 1 for testing
            )
            api_working = test_result.get('success', False)
            api_total_found = test_result.get('total_found', 0)
        except Exception as api_error:
            api_working = False
            api_total_found = 0
            logger.error(f"Federal Register API test failed: {api_error}")
        
        return {
            "success": True,
            "database_debug": db_debug,
            "federal_register_debug": {
                "api_working": api_working,
                "total_reported": api_total_found,
                "test_query_success": api_working
            },
            "recommendations": [
                "Check if there are duplicate entries in database",
                "Verify that Federal Register API is returning consistent counts",
                "Consider running a database cleanup if there are invalid entries",
                "Check if database contains test data or invalid EO numbers"
            ]
        }
        
    except Exception as e:
        logger.error(f"❌ Error in debug counts endpoint: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.get("/")
async def root():
    """Enhanced health check endpoint"""
    
    # Test database connections
    if AZURE_SQL_AVAILABLE:
        try:
            db_working = test_azure_sql_connection()
        except:
            db_working = False
        db_type = "Azure SQL Database"
    else:
        db_working = False
        db_type = "Not Available"
    
    return {
        "message": "Enhanced LegislationVue API with ai.py Integration",
        "status": "healthy",
        "version": "14.0.0-Enhanced-AI-Integration",
        "timestamp": datetime.now().isoformat(),
        "database": {
            "status": "connected" if db_working else "issues",
            "type": db_type,
            "azure_sql_available": AZURE_SQL_AVAILABLE
        },
        "ai_enhancements": {
            "enhanced_client_available": enhanced_ai_client is not None,
            "azure_openai_model": MODEL_NAME,
            "enhanced_prompts": list(ENHANCED_PROMPTS.keys()),
            "bill_categories": len(BillCategory),
            "ai_version": "enhanced_azure_openai_v2"
        },
        "integrations": {
            "simple_executive_orders": "available" if SIMPLE_EO_AVAILABLE else "not_available",
            "executive_orders_integration": "azure_sql_based" if EXECUTIVE_ORDERS_AVAILABLE else "not_available",
            "enhanced_ai_processing": "available" if enhanced_ai_client else "not_available",
            "one_by_one_processing": "available"
        },
        "new_endpoints": {
            "enhanced_search": "/api/legiscan/enhanced-search-and-analyze",
            "test_enhanced_ai": "/api/test-enhanced-ai"
        },
        "features": {
            "executive_summaries": "Multi-paragraph professional analysis",
            "talking_points": "Exactly 5 numbered stakeholder discussion points",
            "business_impact": "Structured risk/opportunity analysis with sections",
            "categorization": "12-category enhanced classification system",
            "one_by_one_processing": "Enhanced fetch→analyze→save workflow"
        },
        "supported_states": list(SUPPORTED_STATES.keys())
    }

@app.get("/api/status")
async def get_status():
    """Enhanced system status endpoint"""
    
    # Test database connection
    try:
        db_conn = DatabaseConnection()
        db_working = db_conn.test_connection()
    except:
        db_working = False
    
    # Test Azure SQL connection if available
    azure_sql_working = False
    if AZURE_SQL_AVAILABLE:
        try:
            azure_sql_working = test_azure_sql_connection()
        except Exception:
            azure_sql_working = False
    
    # Test LegiScan API connection
    legiscan_status = await check_legiscan_connection()
    
    # Test Enhanced Azure AI connection
    enhanced_ai_status = await check_enhanced_ai_connection()
    
    return {
        "environment": os.getenv("ENVIRONMENT", "development"),
        "app_version": "14.0.0-Enhanced-AI-Integration - Executive Orders & State Legislation",
        "database": {
            "status": "connected" if (db_working or azure_sql_working) else "connection_issues",
            "type": "Azure SQL Database" if AZURE_SQL_AVAILABLE else "Fallback",
            "connection": db_working,
            "azure_sql_connection": azure_sql_working,
            "highlights_enabled": HIGHLIGHTS_DB_AVAILABLE
        },
        "integrations": {
            # Your existing integrations
            "simple_executive_orders": "available" if SIMPLE_EO_AVAILABLE else "not_available",
            "azure_sql": "connected" if azure_sql_working else "not_configured",
            "highlights": "available" if HIGHLIGHTS_DB_AVAILABLE else "table_needed",
            "executive_orders_integration": "azure_sql_based" if EXECUTIVE_ORDERS_AVAILABLE else "not_available",
            
            # Enhanced AI integrations
            "legiscan": legiscan_status,
            "enhanced_ai_analysis": enhanced_ai_status,
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
            "simple_executive_orders": "Simple Federal Register API that works",
            "executive_orders": "Azure SQL Integration",
            "persistent_highlights": "Available" if HIGHLIGHTS_DB_AVAILABLE else "Database Setup Required",
            "enhanced_ai_processing": "Multi-format AI analysis with professional formatting",
            "one_by_one_bill_processing": "Available - Enhanced Fetch→AI→Database→Repeat"
        },
        "supported_states": list(SUPPORTED_STATES.keys()),
        "api_keys_configured": {
            "azure_sql": AZURE_SQL_AVAILABLE,
            "legiscan": legiscan_status == "connected",
            "enhanced_azure_ai": enhanced_ai_status == "connected"
        },
        "timestamp": datetime.now().isoformat()
    }

# Helper functions for status checks

async def check_legiscan_connection():
    """Check if LegiScan API is properly configured and working"""
    
    # Check if API key is configured using YOUR environment variable name
    api_key = os.getenv('LEGISCAN_API_KEY')
    
    if not api_key:
        print("❌ LEGISCAN_API_KEY not found in environment")
        return "not configured"
    
    try:
        import httpx
        
        # Test with a simple LegiScan API call
        url = f"https://api.legiscan.com/?key={api_key}&op=getSessionList&state=CA"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=10.0)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'OK':
                    print("✅ LegiScan API connection successful")
                    return "connected"
                else:
                    print(f"❌ LegiScan API error: {data.get('alert', 'Unknown error')}")
                    return "error"
            else:
                print(f"❌ LegiScan API HTTP error: {response.status_code}")
                return "error"
                
    except ImportError:
        print("❌ httpx not installed - install with: pip install httpx")
        return "error"
    except Exception as e:
        print(f"❌ LegiScan API test failed: {e}")
        return "error"

async def check_enhanced_ai_connection():
    """Check if Enhanced Azure OpenAI is properly configured and working"""
    
    if not enhanced_ai_client:
        return "not configured"
    
    try:
        # Test simple AI call
        test_response = await enhanced_ai_analysis(
            text="Test legislation about education technology", 
            prompt_type=PromptType.EXECUTIVE_SUMMARY,
            context="Test"
        )
        
        if "Error generating" not in test_response:
            print("✅ Enhanced Azure OpenAI connection successful")
            return "connected"
        else:
            print("❌ Enhanced Azure OpenAI test failed")
            return "error"
            
    except Exception as e:
        print(f"❌ Enhanced Azure OpenAI test failed: {e}")
        return "error"

@app.get("/api/debug/env")
async def debug_environment():
    """Debug endpoint to verify environment variables"""
    return {
        "legiscan_key_configured": bool(os.getenv('LEGISCAN_API_KEY')),
        "azure_endpoint_configured": bool(os.getenv('AZURE_ENDPOINT')),
        "azure_key_configured": bool(os.getenv('AZURE_KEY')),
        "azure_model_configured": bool(os.getenv('AZURE_MODEL_NAME')),
        
        # Show partial values for verification (security safe)
        "legiscan_key_preview": os.getenv('LEGISCAN_API_KEY', '')[:8] + "..." if os.getenv('LEGISCAN_API_KEY') else None,
        "azure_key_preview": os.getenv('AZURE_KEY', '')[:8] + "..." if os.getenv('AZURE_KEY') else None,
        "azure_endpoint": os.getenv('AZURE_ENDPOINT'),
        "azure_model": os.getenv('AZURE_MODEL_NAME'),
        
        # Enhanced AI status
        "enhanced_ai_client_available": enhanced_ai_client is not None,
        "enhanced_prompts_loaded": len(ENHANCED_PROMPTS),
        "enhanced_categories": len(BillCategory)
    }

# ===============================
# ENHANCED LEGISCAN ENDPOINTS
# ===============================

@app.post("/api/legiscan/enhanced-search-and-analyze")
async def enhanced_search_and_analyze_endpoint(request: LegiScanSearchRequest):
    """
    *** NEW: Enhanced search and analyze using ai.py integration ***
    """
    try:
        print(f"🚀 ENHANCED: search-and-analyze called:")
        print(f"   - state: {request.state}")
        print(f"   - query: '{request.query}'")
        print(f"   - limit: {request.limit}")
        print(f"   - enhanced_ai: {getattr(request, 'enhanced_ai', True)}")
        print(f"   - process_one_by_one: {request.process_one_by_one}")
        
        # Check if enhanced AI is available
        if not enhanced_ai_client:
            print("❌ ENHANCED: Enhanced AI client not available")
            raise HTTPException(
                status_code=503, 
                detail="Enhanced AI client not available - check Azure OpenAI configuration"
            )
        
        # Initialize enhanced LegiScan client
        try:
            enhanced_legiscan = EnhancedLegiScanClient()
            print("✅ ENHANCED: Enhanced LegiScan client initialized")
        except Exception as e:
            print(f"❌ ENHANCED: Enhanced LegiScan initialization failed: {e}")
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
                    print("✅ ENHANCED: Database manager created")
                else:
                    print("⚠️ ENHANCED: Database connection failed, proceeding without saving")
            except Exception as e:
                print(f"⚠️ ENHANCED: Database manager creation failed: {e}")
        
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
                "categorization": "Advanced 12-category classification"
            }
        }
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ ENHANCED: Error in enhanced search-and-analyze: {e}")
        traceback.print_exc()
        raise HTTPException(
            status_code=500, 
            detail=f"Enhanced search and analyze failed: {str(e)}"
        )

@app.get("/api/test-enhanced-ai")
async def test_enhanced_ai():
    """Test endpoint for enhanced AI integration"""
    try:
        if not enhanced_ai_client:
            return {
                "success": False,
                "error": "Enhanced AI client not available",
                "azure_endpoint": AZURE_ENDPOINT,
                "model_name": MODEL_NAME,
                "api_key_configured": bool(AZURE_KEY)
            }
        
        # Test sample bill analysis
        test_bill = {
            "title": "Education Technology Advancement Act",
            "description": "A bill to improve educational technology infrastructure in public schools and provide digital literacy training for teachers.",
            "bill_number": "TEST-2025",
            "state": "Test State"
        }
        
        # Run enhanced analysis
        result = await enhanced_bill_analysis(test_bill, "Test Context")
        
        return {
            "success": True,
            "enhanced_ai_working": True,
            "test_analysis": {
                "category": result.get('category'),
                "ai_version": result.get('ai_version'),
                "executive_summary_length": len(result.get('ai_executive_summary', '')),
                "talking_points_generated": "talking-points" in result.get('ai_talking_points', ''),
                "business_impact_structured": "business-impact-section" in result.get('ai_business_impact', '')
            },
            "ai_features": {
                "executive_summary": "✅ Multi-paragraph professional summaries",
                "talking_points": "✅ Exactly 5 numbered stakeholder points",
                "business_impact": "✅ Structured risk/opportunity analysis",
                "categorization": "✅ 12-category enhanced classification",
                "formatting": "✅ Professional HTML output"
            }
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": f"Enhanced AI test failed: {str(e)}",
            "enhanced_ai_working": False
        }

# ===============================
# EXECUTIVE ORDERS API ENDPOINTS
# ===============================

@app.get("/api/executive-orders")
async def get_executive_orders_with_highlights(
    category: Optional[str] = Query(None, description="Executive order category filter"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(25, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search term"),
    sort_by: str = Query("signing_date", description="Sort field"),
    sort_order: str = Query("desc", description="Sort order (asc, desc)"),
    user_id: Optional[str] = Query(None, description="User ID to show highlight status")
):
    """Get executive orders with highlighting, pagination, and validation"""
    
    try:
        logger.info(f"🔍 Getting executive orders - page: {page}, per_page: {per_page}")
        
        if not EXECUTIVE_ORDERS_AVAILABLE:
            logger.warning("Executive orders functionality not available")
            return {
                "results": [],
                "count": 0,
                "total_pages": 1,
                "page": page,
                "per_page": per_page,
                "message": "Executive orders functionality not available"
            }
        
        # Build filters for the Azure SQL integration
        filters = {}
        if category:
            filters['category'] = category
        if search:
            filters['search'] = search
        
        logger.info(f"📊 Calling get_executive_orders_from_db with filters: {filters}")
        
        result = get_executive_orders_from_db(
            limit=per_page,
            offset=(page - 1) * per_page,
            filters=filters
        )
        
        logger.info(f"📥 Database result: success={result.get('success')}, count={result.get('count', 0)}")
        
        if not result.get('success'):
            error_msg = result.get('message', 'Failed to retrieve executive orders')
            logger.error(f"❌ Database query failed: {error_msg}")
            
            return {
                "results": [],
                "count": 0,
                "total_pages": 1,
                "page": page,
                "per_page": per_page,
                "error": error_msg
            }
        
        orders = result.get('results', [])
        logger.info(f"📋 Got {len(orders)} orders from database")
        
        # Apply validation and formatting
        validated_orders = []
        for i, order in enumerate(orders):
            try:
                eo_number = order.get('bill_number', '')
                logger.info(f"📝 Processing order {i+1}: bill_number={eo_number}, title={order.get('title', 'No title')[:50]}...")
                
                # Map Azure SQL fields to expected EO fields
                formatted_order = {
                    'eo_number': eo_number,
                    'executive_order_number': eo_number,
                    'title': order.get('title', ''),
                    'summary': order.get('description', ''),
                    'signing_date': order.get('introduced_date', ''),
                    'publication_date': order.get('last_action_date', ''),
                    'category': order.get('category', 'not-applicable'),
                    'html_url': order.get('legiscan_url', ''),
                    'pdf_url': order.get('pdf_url', ''),
                    'ai_summary': order.get('ai_summary', ''),
                    'ai_executive_summary': order.get('ai_executive_summary', ''),
                    'ai_key_points': order.get('ai_talking_points', ''),
                    'ai_talking_points': order.get('ai_talking_points', ''),
                    'ai_business_impact': order.get('ai_business_impact', ''),
                    'ai_potential_impact': order.get('ai_potential_impact', ''),
                    'source': 'Azure SQL Database'
                }
                
                validated_orders.append(formatted_order)
                logger.info(f"✅ Processed order: {eo_number}")
            except Exception as e:
                logger.error(f"❌ Error processing order {i+1}: {e}")
                continue
        
        logger.info(f"✅ Returning {len(validated_orders)} validated orders")
        
        # Calculate proper pagination
        total_count = result.get('total', len(validated_orders))
        total_pages = math.ceil(total_count / per_page) if total_count > 0 else 1
        
        return {
            "results": validated_orders,
            "count": len(validated_orders),
            "total_pages": total_pages,
            "page": page,
            "per_page": per_page,
            "total": total_count,
            "database_type": "Azure SQL"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Unexpected error in get_executive_orders_with_highlights: {e}")
        import traceback
        traceback.print_exc()
        
        return {
            "results": [],
            "count": 0,
            "total_pages": 1,
            "page": page,
            "per_page": per_page,
            "error": f"Unexpected error: {str(e)}"
        }

@app.post("/api/fetch-executive-orders-simple")
async def fetch_executive_orders_simple_endpoint(request: ExecutiveOrderFetchRequest):
    """Fetch executive orders from Federal Register API with AI processing"""
    try:
        logger.info(f"🚀 Starting executive orders fetch via Federal Register API")
        logger.info(f"📋 Request: {request.model_dump()}")
        
        if not SIMPLE_EO_AVAILABLE:
            raise HTTPException(
                status_code=503,
                detail="Simple Executive Orders API not available"
            )
        
        # Call your integration function
        result = await fetch_executive_orders_simple_integration(
            start_date=request.start_date,
            end_date=request.end_date,
            with_ai=request.with_ai,
            limit=None,  # No limit to get all orders
            save_to_db=request.save_to_db
        )
        
        logger.info(f"📊 Fetch result: {result.get('count', 0)} orders")
        
        if result.get('success'):
            return {
                "success": True,
                "results": result.get('results', []),
                "count": result.get('count', 0),
                "orders_saved": result.get('orders_saved', 0),
                "total_found": result.get('total_found', 0),
                "ai_successful": result.get('ai_successful', 0),
                "ai_failed": result.get('ai_failed', 0),
                "message": result.get('message', 'Executive orders fetched successfully'),
                "date_range_used": result.get('date_range_used'),
                "method": "federal_register_api_direct"
            }
        else:
            raise HTTPException(
                status_code=500,
                detail=result.get('error', 'Unknown error occurred')
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error in executive orders fetch endpoint: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch executive orders: {str(e)}"
        )

# ===============================
# HIGHLIGHTS API ENDPOINTS
# ===============================

@app.get("/api/highlights")
async def get_user_highlights_endpoint(
    user_id: str = Query("1", description="User identifier")
):
    """Get all highlights for a user"""
    
    if not HIGHLIGHTS_DB_AVAILABLE:
        return {
            "success": False,
            "message": "Highlights database not available. Please ensure Azure SQL is configured.",
            "highlights": []
        }
    
    try:
        # Create table if it doesn't exist
        create_highlights_table()
        
        highlights = get_user_highlights_direct(user_id)
        
        return {
            "success": True,
            "user_id": user_id,
            "highlights": highlights,
            "results": highlights,  # Also provide as 'results' for compatibility
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
        # Create table if it doesn't exist
        create_highlights_table()
        
        # Get the item data if it's an executive order
        item_data = {}
        if request.order_type == 'executive_order' and EXECUTIVE_ORDERS_AVAILABLE:
            try:
                # Try to get the executive order data
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

@app.get("/api/test-highlights")
async def test_highlights():
    """Test highlights functionality"""
    try:
        # Test database connection
        conn = get_azure_sql_connection()
        if not conn:
            return {"success": False, "message": "Could not connect to Azure SQL"}
        
        # Create table if needed
        table_created = create_highlights_table()
        
        # Test basic operations
        test_user = "test_user_123"
        test_order_id = "test_order_456"
        test_order_type = "executive_order"
        
        # Add test highlight
        add_result = add_highlight_direct(
            test_user, 
            test_order_id, 
            test_order_type,
            {
                'title': 'Test Executive Order',
                'description': 'Test description',
                'ai_summary': 'Test AI summary'
            }
        )
        
        # Get highlights
        highlights = get_user_highlights_direct(test_user)
        
        # Remove test highlight
        remove_result = remove_highlight_direct(test_user, test_order_id, test_order_type)
        
        conn.close()
        
        return {
            "success": True,
            "database_connection": "OK",
            "table_created": table_created,
            "add_highlight": add_result,
            "highlights_count": len(highlights),
            "remove_highlight": remove_result,
            "database_type": "Azure SQL",
            "integration_type": "Direct Azure SQL Connection"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "database_type": "Azure SQL"
        }

# ===============================
# STATE LEGISLATION API ENDPOINTS - UPDATED WITH ENHANCED AI
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
    *** THIS IS THE ENDPOINT YOUR STATEPAGE.JSX IS CALLING ***
    Get existing state legislation from the database
    """
    try:
        print(f"🔍 BACKEND: get_state_legislation called:")
        print(f"   - state: '{state}'")
        print(f"   - category: '{category}'")
        print(f"   - limit: {limit}")
        print(f"   - search: '{search}'")
        
        if not AZURE_SQL_AVAILABLE:
            print("❌ Azure SQL not available")
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
            print(f"❌ Database query failed: {error_msg}")
            
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
        
        print(f"✅ BACKEND: Successfully returning {len(bills)} bills")
        
        # Return response in format expected by your React frontend
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
        print(f"❌ BACKEND: Error in get_state_legislation: {e}")
        import traceback
        traceback.print_exc()
        
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
    *** UPDATED: Search and analyze bills using LegiScan API with enhanced AI and one-by-one processing ***
    """
    try:
        print(f"🔍 BACKEND: search-and-analyze called:")
        print(f"   - state: {request.state}")
        print(f"   - query: '{request.query}'")
        print(f"   - limit: {request.limit}")
        print(f"   - save_to_db: {request.save_to_db}")
        print(f"   - process_one_by_one: {request.process_one_by_one}")
        print(f"   - with_ai_analysis: {request.with_ai_analysis}")
        print(f"   - enhanced_ai: {getattr(request, 'enhanced_ai', True)}")
        
        # Check if we should use enhanced AI processing
        use_enhanced_ai = getattr(request, 'enhanced_ai', True) and enhanced_ai_client
        
        if use_enhanced_ai:
            print("🚀 BACKEND: Using ENHANCED AI processing")
            
            # Use enhanced LegiScan client
            try:
                enhanced_legiscan = EnhancedLegiScanClient()
                print("✅ BACKEND: Enhanced LegiScan client initialized")
            except Exception as e:
                print(f"❌ BACKEND: Enhanced LegiScan initialization failed: {e}")
                raise HTTPException(
                    status_code=503, 
                    detail=f"Enhanced LegiScan initialization failed: {str(e)}"
                )
            
            # Get database manager if saving to database
            db_manager = None
            if request.save_to_db and AZURE_SQL_AVAILABLE:
                try:
                    conn = get_azure_sql_connection()
                    if conn:
                        db_manager = StateLegislationDatabaseManager(conn)
                        print("✅ BACKEND: Enhanced database manager created")
                    else:
                        print("⚠️ BACKEND: Database connection failed, proceeding without saving")
                except Exception as e:
                    print(f"⚠️ BACKEND: Database manager creation failed: {e}")
            
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
                    "categorization": "Advanced 12-category classification"
                }
            }
        
        else:
            print("📊 BACKEND: Using traditional LegiScan processing")
            
            # Check if traditional LegiScan API is available
            if not LEGISCAN_AVAILABLE:
                print("❌ BACKEND: LegiScan API not imported")
                raise HTTPException(
                    status_code=503, 
                    detail="LegiScan API not available - check if legiscan_api.py file exists"
                )
            
            if not LEGISCAN_INITIALIZED:
                print("❌ BACKEND: LegiScan API not initialized")
                raise HTTPException(
                    status_code=503, 
                    detail="LegiScan API not initialized - check LEGISCAN_API_KEY in .env file"
                )
            
            # Initialize traditional LegiScan API
            try:
                legiscan_api = LegiScanAPI()
                print("✅ BACKEND: Traditional LegiScan API initialized successfully")
            except Exception as e:
                print(f"❌ BACKEND: Traditional LegiScan API initialization failed: {e}")
                raise HTTPException(
                    status_code=503, 
                    detail=f"LegiScan API initialization failed: {str(e)}"
                )
            
            bills_saved = 0
            result = {}
            
            # Traditional processing workflow
            if request.process_one_by_one and request.save_to_db and AZURE_SQL_AVAILABLE:
                print("🔄 BACKEND: Using traditional one-by-one processing workflow")
                
                # Get AI client if AI analysis is requested
                ai_client = None
                if request.with_ai_analysis:
                    ai_client = get_ai_client()
                    if not ai_client:
                        print("⚠️ BACKEND: AI client not available, proceeding without AI analysis")
                
                # Get database connection and create manager
                try:
                    conn = get_azure_sql_connection()
                    if not conn:
                        raise HTTPException(status_code=503, detail="Database connection failed")
                    
                    db_manager = StateLegislationDatabaseManager(conn)
                    print("✅ BACKEND: Traditional database manager created")
                    
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
                        
                        print(f"🔄 BACKEND: Traditional one-by-one processing completed:")
                        print(f"   - Bills fetched: {processing.get('total_fetched', 0)}")
                        print(f"   - Bills processed: {processing.get('total_processed', 0)}")
                        print(f"   - Bills saved: {bills_saved}")
                        print(f"   - Errors: {len(processing.get('errors', []))}")
                
                except Exception as e:
                    print(f"❌ BACKEND: Traditional one-by-one processing failed: {e}")
                    raise HTTPException(status_code=500, detail=f"One-by-one processing failed: {str(e)}")
                    
            else:
                print("📊 BACKEND: Using traditional batch processing")
                
                # Use traditional search_and_analyze_bills method (batch way)
                result = legiscan_api.search_and_analyze_bills(
                    state=request.state,
                    query=request.query,
                    limit=request.limit
                )
                
                print(f"🔍 BACKEND: Traditional LegiScan returned:")
                print(f"   - success: {result.get('success')}")
                print(f"   - bills found: {len(result.get('bills', []))}")
                
                # Save to database if requested and bills were returned (traditional batch save)
                if request.save_to_db and result.get('bills') and AZURE_SQL_AVAILABLE:
                    bills = result['bills']
                    print(f"🔍 BACKEND: Attempting to save {len(bills)} bills to database (batch)")
                    
                    try:
                        bills_saved = save_state_legislation_to_db(bills)
                        print(f"✅ BACKEND: Successfully saved {bills_saved} bills to database")
                    except Exception as e:
                        print(f"❌ BACKEND: Database save failed: {e}")
                        # Don't fail the request if save fails, just log it
            
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
        print(f"❌ BACKEND: Error in search-and-analyze: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Search and analyze failed: {str(e)}")

@app.post("/api/state-legislation/fetch")
async def fetch_state_legislation_endpoint(request: StateLegislationFetchRequest):
    """Bulk fetch state legislation using LegiScan API"""
    try:
        print(f"🔍 BACKEND: fetch_state_legislation called:")
        print(f"   - states: {request.states}")
        print(f"   - bills_per_state: {request.bills_per_state}")
        print(f"   - save_to_db: {request.save_to_db}")
        
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
            print(f"\n🔍 BACKEND: Processing state: {state}")
            
            try:
                # Use your existing optimized bulk fetch method
                result = legiscan_api.optimized_bulk_fetch(
                    state=state,
                    limit=request.bills_per_state,
                    recent_only=True
                )
                
                print(f"🔍 BACKEND: Bulk fetch result for {state}:")
                print(f"   - success: {result.get('success')}")
                print(f"   - bills_processed: {result.get('bills_processed', 0)}")
                
                state_fetched = 0
                state_saved = 0
                
                if result.get('success') and result.get('bills'):
                    bills = result['bills']
                    state_fetched = len(bills)
                    total_fetched += state_fetched
                    
                    print(f"🔍 BACKEND: Got {len(bills)} bills from LegiScan for {state}")
                    
                    if request.save_to_db and AZURE_SQL_AVAILABLE:
                        print(f"🔍 BACKEND: Saving {len(bills)} bills to database for {state}")
                        
                        try:
                            state_saved = save_state_legislation_to_db(bills)
                            total_saved += state_saved
                            print(f"✅ BACKEND: Successfully saved {state_saved} bills for {state}")
                        except Exception as e:
                            print(f"❌ BACKEND: Error saving {state} bills: {e}")
                            state_saved = 0
                
                state_results[state] = {
                    "success": result.get('success', False),
                    "bills_fetched": state_fetched,
                    "bills_saved": state_saved,
                    "error": result.get('error')
                }
                
            except Exception as e:
                print(f"❌ BACKEND: Error processing state {state}: {e}")
                state_results[state] = {
                    "success": False,
                    "bills_fetched": 0,
                    "bills_saved": 0,
                    "error": str(e)
                }
                continue
        
        print(f"✅ BACKEND: Bulk fetch completed:")
        print(f"   - Total fetched: {total_fetched}")
        print(f"   - Total saved: {total_saved}")
        
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
        print(f"❌ BACKEND: Error in fetch endpoint: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Bulk fetch failed: {str(e)}")

# ===============================
# ONE-BY-ONE PROCESSING TEST ENDPOINT
# ===============================

@app.post("/api/legiscan/test-one-by-one")
async def test_one_by_one_processing(
    state: str = Query("CO", description="State to test"),
    query: str = Query("education", description="Search query"),
    limit: int = Query(3, description="Number of bills to test"),
    enhanced_ai: bool = Query(True, description="Use enhanced AI processing")
):
    """Test endpoint for both traditional and enhanced one-by-one processing workflows"""
    try:
        print(f"🧪 BACKEND: Testing one-by-one processing:")
        print(f"   - state: {state}")
        print(f"   - query: '{query}'")
        print(f"   - limit: {limit}")
        print(f"   - enhanced_ai: {enhanced_ai}")
        
        if enhanced_ai and enhanced_ai_client:
            print("🚀 TESTING: Enhanced one-by-one processing")
            
            # Test enhanced workflow
            try:
                enhanced_legiscan = EnhancedLegiScanClient()
                
                conn = get_azure_sql_connection()
                if not conn:
                    return {
                        "success": False,
                        "error": "Could not connect to database for enhanced test"
                    }
                
                db_manager = StateLegislationDatabaseManager(conn)
                
                # Test enhanced search and analyze
                result = await enhanced_legiscan.enhanced_search_and_analyze(
                    state=state,
                    query=query,
                    limit=limit,
                    with_ai=True,
                    db_manager=db_manager
                )
                
                conn.close()
                
                # Extract test results
                processing = result.get('processing_results', {})
                
                return {
                    "success": True,
                    "test_completed": True,
                    "workflow": "enhanced_one_by_one",
                    "results": {
                        "bills_fetched": processing.get('total_fetched', 0),
                        "bills_processed": processing.get('total_processed', 0),
                        "bills_saved": processing.get('total_saved', 0),
                        "errors": processing.get('errors', []),
                        "enhanced_ai_client_available": True,
                        "database_manager_created": True
                    },
                    "enhanced_features": {
                        "executive_summary": "Multi-paragraph professional analysis",
                        "talking_points": "Exactly 5 numbered stakeholder points",
                        "business_impact": "Structured risk/opportunity sections",
                        "categorization": "12-category enhanced classification"
                    },
                    "legiscan_result": {
                        "success": result.get('success'),
                        "query": query,
                        "state": state
                    },
                    "message": f"Enhanced one-by-one test completed: {processing.get('total_saved', 0)} bills saved"
                }
                
            except Exception as e:
                print(f"❌ BACKEND: Enhanced one-by-one test failed: {e}")
                return {
                    "success": False,
                    "error": f"Enhanced test failed: {str(e)}",
                    "workflow": "enhanced_one_by_one"
                }
        
        else:
            print("📊 TESTING: Traditional one-by-one processing")
            
            # Check prerequisites for traditional workflow
            if not LEGISCAN_AVAILABLE or not LEGISCAN_INITIALIZED:
                return {
                    "success": False,
                    "error": "Traditional LegiScan API not available or initialized",
                    "legiscan_available": LEGISCAN_AVAILABLE,
                    "legiscan_initialized": LEGISCAN_INITIALIZED
                }
            
            if not AZURE_SQL_AVAILABLE:
                return {
                    "success": False,
                    "error": "Azure SQL not available",
                    "azure_sql_available": AZURE_SQL_AVAILABLE
                }
            
            # Initialize traditional components
            legiscan_api = LegiScanAPI()
            ai_client = get_ai_client()
            
            conn = get_azure_sql_connection()
            if not conn:
                return {
                    "success": False,
                    "error": "Could not connect to database for traditional test"
                }
            
            db_manager = StateLegislationDatabaseManager(conn)
            
            # Test the traditional one-by-one workflow
            result = legiscan_api.search_and_analyze_bills(
                state=state,
                query=query,
                limit=limit,
                ai_client=ai_client,
                db_manager=db_manager,
                process_one_by_one=True
            )
            
            conn.close()
            
            # Extract test results
            processing = result.get('processing_results', {})
            
            return {
                "success": True,
                "test_completed": True,
                "workflow": "traditional_one_by_one",
                "results": {
                    "bills_fetched": processing.get('total_fetched', 0),
                    "bills_processed": processing.get('total_processed', 0),
                    "bills_saved": processing.get('total_saved', 0),
                    "errors": processing.get('errors', []),
                    "ai_client_available": ai_client is not None,
                    "database_manager_created": True
                },
                "traditional_features": {
                    "basic_ai_analysis": "Standard AI processing",
                    "simple_categorization": "Basic category classification",
                    "standard_formatting": "Plain text output"
                },
                "legiscan_result": {
                    "success": result.get('success'),
                    "query": query,
                    "state": state
                },
                "message": f"Traditional one-by-one test completed: {processing.get('total_saved', 0)} bills saved"
            }
        
    except Exception as e:
        print(f"❌ BACKEND: Error in one-by-one test: {e}")
        import traceback
        traceback.print_exc()
        
        return {
            "success": False,
            "error": f"Test failed: {str(e)}",
            "workflow": "enhanced_one_by_one" if enhanced_ai else "traditional_one_by_one"
        }

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
        print(f"❌ BACKEND: Error getting available states: {e}")
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
        print(f"❌ BACKEND: Error getting stats: {e}")
        return {
            "success": False,
            "error": str(e),
            "total_bills": 0
        }

# ===============================
# DEBUG ENDPOINTS FOR STATE LEGISLATION
# ===============================

@app.get("/api/debug/state-legislation")
async def debug_state_legislation(
    state: str = Query(..., description="State to debug")
):
    """Debug endpoint to check what's in the database for a specific state"""
    try:
        print(f"🔍 BACKEND: Debugging state legislation for: {state}")
        
        if not AZURE_SQL_AVAILABLE:
            return {
                "success": False,
                "message": "Database not available",
                "requested_state": state
            }
        
        conn = get_azure_sql_connection()
        if not conn:
            return {
                "success": False,
                "message": "Database connection failed",
                "requested_state": state
            }
        
        cursor = conn.cursor()
        
        # Try different state queries
        queries = [
            ("exact_state", "SELECT COUNT(*) FROM dbo.state_legislation WHERE state = ?"),
            ("exact_abbr", "SELECT COUNT(*) FROM dbo.state_legislation WHERE state_abbr = ?"),
            ("ilike_state", "SELECT COUNT(*) FROM dbo.state_legislation WHERE state LIKE ?"),
        ]
        
        results = {}
        for query_name, query_sql in queries:
            try:
                if query_name == "ilike_state":
                    cursor.execute(query_sql, f"%{state}%")
                else:
                    cursor.execute(query_sql, state)
                
                count = cursor.fetchone()[0]
                
                # Get sample records
                sample_query = query_sql.replace("COUNT(*)", "TOP 3 bill_id, title, state, state_abbr")
                if query_name == "ilike_state":
                    cursor.execute(sample_query, f"%{state}%")
                else:
                    cursor.execute(sample_query, state)
                
                sample_records = cursor.fetchall()
                sample = []
                for record in sample_records:
                    bill_id, title, record_state, record_abbr = record
                    sample.append({
                        "bill_id": bill_id,
                        "title": title[:50] + "..." if title and len(title) > 50 else title,
                        "state": record_state,
                        "state_abbr": record_abbr
                    })
                
                results[query_name] = {
                    "count": count,
                    "sample": sample
                }
            except Exception as e:
                results[query_name] = {"error": str(e)}
        
        # Get all distinct states in database
        cursor.execute("SELECT DISTINCT state FROM dbo.state_legislation WHERE state IS NOT NULL")
        all_states = [row[0] for row in cursor.fetchall()]
        
        cursor.execute("SELECT DISTINCT state_abbr FROM dbo.state_legislation WHERE state_abbr IS NOT NULL")
        all_abbrs = [row[0] for row in cursor.fetchall()]
        
        cursor.close()
        conn.close()
        
        return {
            "success": True,
            "requested_state": state,
            "query_results": results,
            "all_states_in_db": all_states,
            "all_abbrs_in_db": all_abbrs
        }
        
    except Exception as e:
        print(f"❌ BACKEND: Error in debug endpoint: {e}")
        return {
            "success": False,
            "error": str(e),
            "requested_state": state
        }

@app.get("/api/test-legiscan")
async def test_legiscan():
    """Test endpoint to verify LegiScan API is working"""
    try:
        # Check if LegiScan API is available
        if not LEGISCAN_AVAILABLE:
            return {
                "success": False,
                "error": "LegiScan API not imported - check if legiscan_api.py file exists",
                "api_initialized": False,
                "file_check": "legiscan_api.py not found in current directory"
            }
        
        if not LEGISCAN_INITIALIZED:
            return {
                "success": False,
                "error": "LegiScan API not initialized - check LEGISCAN_API_KEY in .env file",
                "api_initialized": False,
                "env_check": f"LEGISCAN_API_KEY = {'SET' if os.getenv('LEGISCAN_API_KEY') else 'NOT SET'}"
            }
        
        # Try to initialize and test
        try:
            legiscan_api = LegiScanAPI()
            
            # Test with a simple search
            result = legiscan_api.search_and_analyze_bills(
                state="CA",
                query="test",
                limit=1
            )
            
            return {
                "success": result.get('success', False),
                "bills_found": len(result.get('bills', [])),
                "message": "LegiScan API test completed successfully",
                "api_initialized": True,
                "test_query": "CA test query",
                "api_key_configured": bool(os.getenv('LEGISCAN_API_KEY')),
                "one_by_one_available": True,
                "enhanced_ai_available": enhanced_ai_client is not None
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"LegiScan API test failed: {str(e)}",
                "api_initialized": True,
                "api_key_configured": bool(os.getenv('LEGISCAN_API_KEY')),
                "one_by_one_available": True,
                "enhanced_ai_available": enhanced_ai_client is not None
            }
        
    except Exception as e:
        return {
            "success": False,
            "error": f"Unexpected error in LegiScan test: {str(e)}",
            "api_initialized": False
        }

@app.get("/api/test-database")
async def test_database():
    """Test endpoint to verify database connection"""
    try:
        if not AZURE_SQL_AVAILABLE:
            return {
                "success": False,
                "error": "Azure SQL not available",
                "database_type": "None"
            }
        
        conn = get_azure_sql_connection()
        if not conn:
            return {
                "success": False,
                "error": "Database connection failed",
                "database_type": "Azure SQL"
            }
        
        cursor = conn.cursor()
        
        # Count total bills
        cursor.execute("SELECT COUNT(*) FROM dbo.state_legislation")
        total_bills = cursor.fetchone()[0]
        
        cursor.close()
        conn.close()
        
        return {
            "success": True,
            "message": "Database connection working correctly",
            "total_bills_in_db": total_bills,
            "database_type": "Azure SQL",
            "one_by_one_processing_available": True,
            "enhanced_ai_available": enhanced_ai_client is not None
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": f"Database test failed: {str(e)}",
            "database_type": "Azure SQL"
        }

# ===============================
# MAIN STARTUP SECTION
# ===============================

if __name__ == "__main__":
    import uvicorn
    print("🌐 Starting Enhanced LegislationVue API v14.0.0 with ai.py Integration")
    print("=" * 80)
    
    print(f"🔥 ENHANCED AI FEATURES:")
    print(f"   • Executive Summaries: Multi-paragraph professional analysis")
    print(f"   • Talking Points: Exactly 5 numbered stakeholder points")
    print(f"   • Business Impact: Structured risk/opportunity sections")
    print(f"   • Categories: 12-category enhanced classification")
    print(f"   • Processing: Enhanced one-by-one fetch→analyze→save")
    print("")
    
    print(f"🎯 KEY ENDPOINTS:")
    print(f"   • GET  /api/state-legislation              ✅ (FIXES YOUR 404)")
    print(f"   • POST /api/legiscan/search-and-analyze    ✅ (Enhanced + Traditional)")
    print(f"   • POST /api/legiscan/enhanced-search-and-analyze ✅ (Pure Enhanced)")
    print(f"   • POST /api/state-legislation/fetch        ✅ (Bulk fetch)")
    print(f"   • POST /api/fetch-executive-orders-simple  ✅ (Executive orders)")
    print(f"   • GET  /api/highlights?user_id=1           ✅ (Highlights page)")
    print("")
    
    print(f"🚀 NEW ENHANCED ENDPOINTS:")
    print(f"   • POST /api/legiscan/enhanced-search-and-analyze")
    print(f"   • GET  /api/test-enhanced-ai")
    print(f"   • POST /api/legiscan/test-one-by-one")
    print("")
    
    print(f"📋 State Legislation endpoints:")
    print(f"   • GET  /api/state-legislation")
    print(f"   • POST /api/legiscan/search-and-analyze")
    print(f"   • POST /api/state-legislation/fetch")
    print(f"   • GET  /api/state-legislation/states")
    print(f"   • GET  /api/state-legislation/stats")
    print("")
    
    print(f"📋 Executive Orders endpoints:")
    print(f"   • GET  /api/executive-orders")
    print(f"   • POST /api/fetch-executive-orders-simple")
    print("")
    
    print(f"⭐ Highlights endpoints:")
    print(f"   • GET  /api/highlights?user_id=1")
    print(f"   • POST /api/highlights")
    print(f"   • DELETE /api/highlights/{{order_id}}?user_id=1")
    print("")
    
    print(f"🔧 Testing endpoints:")
    print(f"   • GET  /api/status")
    print(f"   • GET  /api/test-legiscan")
    print(f"   • GET  /api/test-database")
    print(f"   • GET  /api/test-enhanced-ai")
    print(f"   • POST /api/legiscan/test-one-by-one")
    print(f"   • GET  /api/debug/state-legislation?state=CA")
    print("")
    
    # Configuration status checks
    print(f"🎯 Configuration Status:")
    print(f"   • AZURE_SQL: {'✅ Configured' if AZURE_SQL_AVAILABLE else '❌ Missing'}")
    print(f"   • STATE_LEGISLATION: {'✅ Available' if AZURE_SQL_AVAILABLE else '❌ Azure SQL Required'}")
    print(f"   • HIGHLIGHTS_DB: {'✅ Available' if HIGHLIGHTS_DB_AVAILABLE else '❌ Azure SQL Required'}")
    print(f"   • SIMPLE_EXECUTIVE_ORDERS: {'✅ Available' if SIMPLE_EO_AVAILABLE else '❌ Missing'}")
    print(f"   • EXECUTIVE_ORDERS_INTEGRATION: {'✅ Available' if EXECUTIVE_ORDERS_AVAILABLE else '❌ Missing'}")
    print(f"   • LEGISCAN_API: {'✅ Available' if LEGISCAN_INITIALIZED else '❌ Check API Key'}")
    print(f"   • ENHANCED_AI_CLIENT: {'✅ Available' if enhanced_ai_client else '❌ Not Configured'}")
    print("")
    
    print(f"🤖 Enhanced AI Status:")
    print(f"   • Client: {'✅ Ready' if enhanced_ai_client else '❌ Not Available'}")
    print(f"   • Model: {MODEL_NAME}")
    print(f"   • Endpoint: {AZURE_ENDPOINT}")
    print(f"   • Prompts: {len(ENHANCED_PROMPTS)} enhanced prompts")
    print(f"   • Categories: {len(BillCategory)} enhanced categories")
    print(f"   • Formatters: 3 distinct output formatters")
    print("")
    
    if AZURE_SQL_AVAILABLE and enhanced_ai_client:
        print(f"🚀 FULL ENHANCED INTEGRATION READY!")
        print(f"   • Enhanced AI Processing ✅")
        print(f"   • State Legislation API integration ✅")
        print(f"   • Federal Register API integration ✅")
        print(f"   • Azure SQL database integration ✅") 
        print(f"   • Highlights system working ✅")
        print(f"   • Frontend endpoint /api/state-legislation ✅")
        print(f"   • Enhanced one-by-one processing workflow ✅")
        print(f"   • 12-category bill classification ✅")
        print(f"   • Professional HTML formatting ✅")
    elif AZURE_SQL_AVAILABLE:
        print(f"🔶 PARTIAL INTEGRATION READY!")
        print(f"   • Basic functionality available")
        print(f"   • Enhanced AI not configured")
    else:
        print(f"⚠️  Some integrations not available")
    
    print("")
    
    # Test database connection on startup
    print("🔍 Testing database connection...")
    try:
        db_conn = DatabaseConnection()
        if db_conn.test_connection():
            print("✅ Database connection successful!")
            
            # Test highlights table creation
            if create_highlights_table():
                print("✅ Highlights table ready!")
        else:
            print("❌ Database connection failed")
    except Exception as e:
        print(f"❌ Database connection test error: {e}")
    
    # Test Enhanced AI client on startup
    print("🔍 Testing Enhanced AI client...")
    if enhanced_ai_client:
        print("✅ Enhanced AI client initialized!")
        print(f"   • Model: {MODEL_NAME}")
        print(f"   • Prompts: {list(ENHANCED_PROMPTS.keys())}")
        print(f"   • Categories: {[cat.value for cat in BillCategory]}")
    else:
        print("⚠️ Enhanced AI client not available")
        print("   • Check AZURE_ENDPOINT and AZURE_KEY environment variables")
    
    print("🎯 Starting server...")
    uvicorn.run(app, host="0.0.0.0", port=8000)