# ai.py - Enhanced version with distinct AI content generation
import os
import re
import asyncio
import time
import json
from datetime import datetime
from openai import AsyncAzureOpenAI
from enum import Enum
from typing import Optional, Dict, Any, List
import requests
import traceback

# Safe imports with fallbacks
try:
    from utils import format_text_as_html, parse_ai_response, PromptType, Category
except ImportError:
    print("Warning: utils module not found. Using fallback definitions.")
    
    class PromptType(Enum):
        EXECUTIVE_SUMMARY = "executive_summary"
        KEY_TALKING_POINTS = "key_talking_points"
        BUSINESS_IMPACT = "business_impact"
    
    class Category(Enum):
        HEALTHCARE = "healthcare"
        EDUCATION = "education"
        CIVIC = "civic"
        NOT_APPLICABLE = "not_applicable"
    
    def format_text_as_html(text: str, prompt_type: PromptType) -> str:
        """Fallback HTML formatter"""
        if not text:
            return "<p>No content available</p>"
        
        lines = text.strip().split('\n')
        formatted_lines = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            if re.match(r'^\d+\.', line):
                formatted_lines.append(f"<li>{line[line.find('.')+1:].strip()}</li>")
            elif line.startswith('•') or line.startswith('-'):
                formatted_lines.append(f"<li>{line[1:].strip()}</li>")
            else:
                formatted_lines.append(f"<p>{line}</p>")
        
        result = []
        in_list = False
        
        for line in formatted_lines:
            if line.startswith('<li>'):
                if not in_list:
                    result.append('<ol>')
                    in_list = True
                result.append(line)
            else:
                if in_list:
                    result.append('</ol>')
                    in_list = False
                result.append(line)
        
        if in_list:
            result.append('</ol>')
        
        return '\n'.join(result)
    
    def parse_ai_response(text: str) -> Dict:
        """Fallback response parser"""
        return {
            "ai_summary": text,
            "ai_key_points": "",
            "ai_potential_impact": ""
        }

try:
    from config import get_config
except ImportError:
    print("Warning: config module not found. Using environment variables directly.")
    def get_config():
        return {}

# Configuration
LEGISCAN_API_KEY = os.getenv('LEGISCAN_API_KEY')
LEGISCAN_BASE_URL = "https://api.legiscan.com/?key={0}&op={1}&{2}"

AZURE_ENDPOINT = os.getenv("AZURE_ENDPOINT", "https://david-mabholqy-swedencentral.openai.azure.com/")
AZURE_KEY = os.getenv("AZURE_KEY", "8bFP5NQ6KL7jSV74M3ZJ77vh9uYrtR7c3sOkAmM3Gs7tirc5mOWAJQQJ99BEACfhMk5XJ3w3AAAAACOGGlXN")
MODEL_NAME = os.getenv("AZURE_MODEL_NAME", "summarize-gpt-4.1")

# Debug logging
print(f"Debug: Using AI configuration - Endpoint: {AZURE_ENDPOINT}")
print(f"Debug: AZURE_KEY value type: {type(AZURE_KEY)}")
if AZURE_KEY:
    print(f"Debug: AZURE_KEY value (first 5 chars): {str(AZURE_KEY)[:5]}...")
else:
    print("Debug: AZURE_KEY is not set")
print(f"Debug: LegiScan API Key: {'✅ Set' if LEGISCAN_API_KEY else '❌ Not Set'}")

# Initialize Azure OpenAI client
client = AsyncAzureOpenAI(
    azure_endpoint=AZURE_ENDPOINT,
    api_key=AZURE_KEY,
    api_version="2024-12-01-preview"
)

# ENHANCED prompt templates for distinct content generation
PROMPTS = {
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

# Enhanced system messages for each type
SYSTEM_MESSAGES = {
    PromptType.EXECUTIVE_SUMMARY: "You are a senior policy analyst who writes clear, concise executive summaries for C-level executives. Focus on the big picture and strategic implications.",
    PromptType.KEY_TALKING_POINTS: "You are a communications strategist helping leaders discuss policy changes. Create talking points that are memorable, accurate, and useful for stakeholder conversations.",
    PromptType.BUSINESS_IMPACT: "You are a business strategy consultant analyzing regulatory impact. Focus on concrete business implications, compliance requirements, and strategic opportunities.",
}

# Enums and classes
class LegiScanAPIError(Exception):
    """Custom exception for LegiScan API errors"""
    pass

class BillCategory(Enum):
    """Enhanced bill categories for better classification"""
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

# Enhanced formatting functions for distinct content types
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
    """Format business impact with clean, professional structure - FIXED VERSION"""
    if not text:
        return "<p>No business impact analysis available</p>"
    
    # Clean up the text first - remove extra dashes and asterisks
    text = re.sub(r'^---+\s*$', '', text, flags=re.MULTILINE)  # Remove dash separators
    text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', text)  # Convert **bold** to <strong>
    text = re.sub(r'^\*\*([^*]+):\*\*', r'<strong>\1:</strong>', text, flags=re.MULTILINE)  # Headers
    
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
            # If the line has content after the header, add it
            if ':' in line and line.split(':', 1)[1].strip():
                content = line.split(':', 1)[1].strip()
                if content:
                    sections[current_section].append(content)
            continue
        elif any(keyword in line_lower for keyword in ['opportunity', 'increased investment', 'market opportunity']):
            current_section = 'opportunity'
            # If the line has content after the header, add it
            if ':' in line and line.split(':', 1)[1].strip():
                content = line.split(':', 1)[1].strip()
                if content:
                    sections[current_section].append(content)
            continue
        elif any(keyword in line_lower for keyword in ['summary']):
            current_section = 'summary'
            # If the line has content after the header, add it
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
        elif line.startswith('<strong>') and current_section:
            # Handle specific impact bullets that are already formatted
            sections[current_section].append(line)
        elif current_section and line and not line.startswith('**'):
            # Regular content
            sections[current_section].append(line)
    
    # Build clean HTML output
    html_parts = []
    
    # Risk Assessment Section
    if sections['risk']:
        html_parts.append('<div class="business-impact-section risk-section">')
        html_parts.append('<h4>Risk Assessment</h4>')
        html_parts.append('<div class="risk-content">')
        
        # Group risk items
        for item in sections['risk'][:3]:  # Max 3 risk items
            # Clean up the item
            clean_item = re.sub(r'^[•\-*]\s*', '', item).strip()
            clean_item = re.sub(r'^\*\*([^*]+):\*\*\s*', r'<strong>\1:</strong> ', clean_item)
            
            if clean_item:
                html_parts.append(f'<p>• {clean_item}</p>')
        
        html_parts.append('</div>')
        html_parts.append('</div>')
    
    # Opportunity Section
    if sections['opportunity']:
        html_parts.append('<div class="business-impact-section opportunity-section">')
        html_parts.append('<h4>Market Opportunity</h4>')
        html_parts.append('<div class="opportunity-content">')
        
        # Group opportunity items
        for item in sections['opportunity'][:3]:  # Max 3 opportunity items
            # Clean up the item
            clean_item = re.sub(r'^[•\-*]\s*', '', item).strip()
            clean_item = re.sub(r'^\*\*([^*]+):\*\*\s*', r'<strong>\1:</strong> ', clean_item)
            
            if clean_item:
                html_parts.append(f'<p>• {clean_item}</p>')
        
        html_parts.append('</div>')
        html_parts.append('</div>')
    
    # Summary Section
    if sections['summary']:
        html_parts.append('<div class="business-impact-section summary-section">')
        html_parts.append('<h4>Summary</h4>')
        html_parts.append('<div class="summary-content">')
        
        for item in sections['summary'][:2]:  # Max 2 summary items
            # Clean up the item
            clean_item = re.sub(r'^[•\-*]\s*', '', item).strip()
            clean_item = re.sub(r'^\*\*([^*]+):\*\*\s*', r'<strong>\1:</strong> ', clean_item)
            
            if clean_item:
                html_parts.append(f'<p>{clean_item}</p>')
        
        html_parts.append('</div>')
        html_parts.append('</div>')
    
    # Fallback if no sections were found
    if not any(sections.values()):
        # Just clean up the raw text and present it nicely
        cleaned_text = re.sub(r'^[•\-*]\s*', '', text, flags=re.MULTILINE)
        cleaned_text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', cleaned_text)
        paragraphs = [p.strip() for p in cleaned_text.split('\n') if p.strip()]
        
        if paragraphs:
            html_parts.append('<div class="business-impact-section">')
            html_parts.append('<h4>Business Impact Analysis</h4>')
            for para in paragraphs[:4]:  # Max 4 paragraphs
                if para:
                    html_parts.append(f'<p>{para}</p>')
            html_parts.append('</div>')
    
    return ''.join(html_parts) if html_parts else '<p>Business impact analysis processing...</p>'

class LegiScanClient:
    """Enhanced LegiScan API client with caching and error handling"""
    
    def __init__(self, api_key: str = None, rate_limit_delay: float = 0.5):
        self.api_key = api_key or LEGISCAN_API_KEY
        self.rate_limit_delay = rate_limit_delay
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'LegislationVue/3.0-AI-Enhanced',
            'Accept': 'application/json'
        })
        
        if not self.api_key:
            raise LegiScanAPIError("LegiScan API key is required")
        
        print(f"✅ LegiScan client initialized with key: {self.api_key[:4]}***")
    
    def _build_url(self, operation: str, params: Optional[Dict] = None) -> str:
        """Build LegiScan API URL"""
        if params is None:
            params = {}
        
        param_str = '&'.join([f"{k}={v}" for k, v in params.items()])
        return LEGISCAN_BASE_URL.format(self.api_key, operation, param_str)
    
    def _api_request(self, url: str) -> Dict[str, Any]:
        """Make API request with error handling"""
        try:
            print("🔍 Making LegiScan API request...")
            
            response = self.session.get(url)
            response.raise_for_status()
            
            data = response.json()
            
            if data.get('status') == "ERROR":
                error_msg = data.get('alert', {}).get('message', 'Unknown API error')
                raise LegiScanAPIError(f"LegiScan API Error: {error_msg}")
            
            time.sleep(self.rate_limit_delay)
            return data
            
        except Exception as e:
            print(f"❌ LegiScan API request failed: {e}")
            raise LegiScanAPIError(f"API request failed: {str(e)}")
    
    def get_session_list(self, state: str) -> List[Dict]:
        """Get available sessions for a state"""
        try:
            url = self._build_url('getSessionList', {'state': state})
            data = self._api_request(url)
            sessions = data.get('sessions', [])
            print(f"📋 Found {len(sessions)} sessions for {state}")
            return sessions
        except Exception as e:
            print(f"❌ Error fetching sessions for {state}: {e}")
            return []
    
    def get_master_list(self, state: str, session_id: Optional[int] = None) -> Dict:
        """Get master list of bills for a state"""
        try:
            params = {'state': state}
            if session_id:
                params['session_id'] = session_id
            
            url = self._build_url('getMasterList', params)
            data = self._api_request(url)
            
            master_list = data.get('masterlist', {})
            if master_list:
                bill_count = len(master_list.get('bill', {}))
                session_name = master_list.get('session', {}).get('session_name', 'Current')
                print(f"📋 Found {bill_count} bills for {state} in session: {session_name}")
            
            return master_list
        except Exception as e:
            print(f"❌ Error fetching master list for {state}: {e}")
            return {}
    
    def get_bill(self, bill_id: Optional[int] = None, 
                state: Optional[str] = None, 
                bill_number: Optional[str] = None) -> Dict:
        """Get detailed bill information"""
        try:
            if bill_id:
                params = {'id': bill_id}
                identifier = f"bill ID {bill_id}"
            elif state and bill_number:
                params = {'state': state, 'bill': bill_number}
                identifier = f"bill {state} {bill_number}"
            else:
                raise ValueError("Either bill_id OR (state AND bill_number) must be provided")
            
            url = self._build_url('getBill', params)
            data = self._api_request(url)
            
            bill = data.get('bill', {})
            if bill:
                print(f"✅ Successfully fetched {identifier}")
            
            return bill
        except Exception as e:
            print(f"❌ Error fetching bill: {e}")
            return {}
    
    def search_bills(self, 
                    state: Optional[str] = None,
                    query: Optional[str] = None,
                    year: int = 2,
                    page: int = 1) -> Dict:
        """Search for bills"""
        try:
            if not query:
                raise ValueError("Query is required for search")
            
            params = {'query': query, 'year': year, 'page': page}
            if state:
                params['state'] = state
            
            url = self._build_url('search', params)
            data = self._api_request(url).get('searchresult', {})
            
            summary = data.pop('summary', {})
            results = [data[key] for key in data if key != 'summary']
            
            print(f"🔍 Search found {summary.get('count', 0)} results")
            
            return {
                'summary': summary,
                'results': results
            }
        except Exception as e:
            print(f"❌ Error searching bills: {e}")
            return {'summary': {}, 'results': []}

# Helper functions
def categorize_bill(title: str, description: str) -> BillCategory:
    """Enhanced bill categorization with more categories"""
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

# Core AI processing functions - ENHANCED with distinct content generation
async def process_with_ai(text: str, prompt_type: PromptType, temperature: float = 0.1, context: str = "") -> str:
    """Enhanced AI processing with distinct prompts and formatting"""
    try:
        max_input_length = 4000
        if len(text) > max_input_length:
            text = text[:max_input_length] + "..."
            print(f"Truncated input text to {max_input_length} characters.")
        
        if context:
            text = f"Context: {context}\n\n{text}"
        
        prompt = PROMPTS[prompt_type].format(text=text)
        
        messages = [
            {
                "role": "system",
                "content": SYSTEM_MESSAGES[prompt_type]
            },
            {
                "role": "user",
                "content": prompt
            }
        ]

        print(f"🤖 Calling AI for: {prompt_type.value} (with context: {context})")
        
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
        
        response = await client.chat.completions.create(
            model=MODEL_NAME,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            top_p=0.95,
            frequency_penalty=0.3,
            presence_penalty=0.2,
            stop=["6.", "7.", "8.", "9."] if prompt_type == PromptType.KEY_TALKING_POINTS else None
        )

        raw_response = response.choices[0].message.content
        print(f"Raw AI response ({prompt_type.value}):\n---\n{raw_response[:200]}...\n---")

        # Enhanced formatting for each type
        if prompt_type == PromptType.EXECUTIVE_SUMMARY:
            # Keep as paragraph, clean up any unwanted formatting
            formatted_response = clean_summary_format(raw_response)
        elif prompt_type == PromptType.KEY_TALKING_POINTS:
            # Ensure proper numbered list format
            formatted_response = format_talking_points(raw_response)
        elif prompt_type == PromptType.BUSINESS_IMPACT:
            # Ensure proper business impact structure
            formatted_response = format_business_impact(raw_response)
        else:
            formatted_response = format_text_as_html(raw_response, prompt_type)

        return formatted_response

    except Exception as e:
        print(f"❌ Error during AI {prompt_type.value} call: {e}")
        return f"<p>Error generating {prompt_type.value.replace('_', ' ')}: {str(e)}</p>"

async def get_executive_summary(text: str, context: str = "") -> str:
    return await process_with_ai(text, PromptType.EXECUTIVE_SUMMARY, context=context)

async def get_key_talking_points(text: str, context: str = "") -> str:
    return await process_with_ai(text, PromptType.KEY_TALKING_POINTS, context=context)

async def get_business_impact(text: str, context: str = "") -> str:
    return await process_with_ai(text, PromptType.BUSINESS_IMPACT, context=context)

# Main analysis functions - ENHANCED
async def analyze_legiscan_bill(bill_data: Dict, enhanced_context: bool = True) -> Dict[str, str]:
    """Comprehensive AI analysis of a LegiScan bill with distinct content for each section"""
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
        
        print(f"🔍 Analyzing LegiScan bill: {bill_number} - {title[:50]}...")
        
        # Categorize the bill
        category = categorize_bill(title, description)
        
        # Run AI analysis tasks with different contexts for each type
        try:
            summary_task = get_executive_summary(content, f"Executive Summary - {base_context}")
            talking_points_task = get_key_talking_points(content, f"Stakeholder Discussion - {base_context}")
            business_impact_task = get_business_impact(content, f"Business Analysis - {base_context}")
            
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
            print(f"❌ Error in AI analysis tasks: {e}")
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
            'ai_version': 'azure_openai_enhanced_v1',
            'analysis_timestamp': datetime.now().isoformat()
        }
        
    except Exception as e:
        print(f"❌ Error analyzing LegiScan bill: {e}")
        traceback.print_exc()
        error_msg = f"<p>AI analysis failed: {str(e)}</p>"
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

async def process_bills_for_state(state: str, limit: int = 50, session_id: Optional[int] = None) -> Dict:
    """Complete pipeline: Fetch bills from LegiScan and analyze with AI"""
    try:
        print(f"🚀 Starting complete pipeline for {state} (limit: {limit})")
        
        legiscan = LegiScanClient()
        
        print(f"📥 Fetching master list for {state}...")
        master_list = legiscan.get_master_list(state, session_id)
        
        if not master_list:
            return {
                "error": f"No bills found for {state}",
                "bills_processed": 0,
                "state": state
            }
        
        bills = master_list.get('bill', {})
        total_bills = len(bills)
        
        if limit > 0 and limit < total_bills:
            bill_items = list(bills.items())[:limit]
        else:
            bill_items = list(bills.items())
        
        print(f"📋 Processing {len(bill_items)} bills from {total_bills} total bills")
        
        processed_bills = []
        
        for i, (bill_id, bill_info) in enumerate(bill_items):
            try:
                bill_number = bill_info.get('bill_number', 'Unknown')
                print(f"📄 Processing bill {i+1}/{len(bill_items)}: {bill_number}")
                
                detailed_bill = legiscan.get_bill(bill_id=int(bill_id))
                
                if not detailed_bill:
                    print(f"⚠️ No detailed data found for bill {bill_number}, skipping")
                    continue
                
                detailed_bill['state'] = state
                detailed_bill['bill_id'] = bill_id
                
                ai_analysis = await analyze_legiscan_bill(detailed_bill)
                
                processed_bill = {
                    'bill_id': bill_id,
                    'bill_number': bill_number,
                    'title': detailed_bill.get('title', ''),
                    'description': detailed_bill.get('description', ''),
                    'state': state,
                    'session': detailed_bill.get('session', {}).get('session_name', 'Unknown'),
                    'status': detailed_bill.get('status', 0),
                    'status_date': detailed_bill.get('status_date', ''),
                    'url': detailed_bill.get('state_link', ''),
                    'sponsors': detailed_bill.get('sponsors', []),
                    'committee': detailed_bill.get('committee', []),
                    'history': detailed_bill.get('history', []),
                    'texts': detailed_bill.get('texts', []),
                    'source': 'LegiScan API with AI Enhancement',
                    'created_at': datetime.now().isoformat(),
                    'last_updated': datetime.now().isoformat()
                }
                
                processed_bill.update(ai_analysis)
                processed_bills.append(processed_bill)
                print(f"✅ Successfully processed bill {bill_number}")
                
            except Exception as e:
                print(f"❌ Error processing bill {bill_id}: {e}")
                continue
        
        print(f"🎉 Processed {len(processed_bills)} bills for {state}")
        
        return {
            "state": state,
            "bills_processed": len(processed_bills),
            "total_bills": total_bills,
            "bills": processed_bills,
            "session_info": master_list.get('session', {}),
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        print(f"❌ Error in complete pipeline for {state}: {e}")
        traceback.print_exc()
        return {
            "error": str(e),
            "state": state,
            "bills_processed": 0,
            "timestamp": datetime.now().isoformat()
        }

# Legacy compatibility functions with enhanced AI
async def analyze_executive_order(title: str, abstract: str = "", order_number: str = "") -> Dict[str, str]:
    """Comprehensive analysis for executive orders with distinct content"""
    try:
        context = f"Executive Order {order_number}" if order_number else "Executive Order"
        content = f"Title: {title}"
        if abstract:
            content += f"\n\nContent: {abstract}"
        
        print(f"🔍 Analyzing executive order: {title[:50]}...")
        
        # Run enhanced AI analysis with different contexts
        summary_result, talking_points_result, business_impact_result = await asyncio.gather(
            get_executive_summary(content, f"Executive Summary - {context}"),
            get_key_talking_points(content, f"Policy Discussion - {context}"),
            get_business_impact(content, f"Regulatory Impact - {context}"),
            return_exceptions=True
        )
        
        if isinstance(summary_result, Exception):
            summary_result = f"<p>Error generating summary: {str(summary_result)}</p>"
        if isinstance(talking_points_result, Exception):
            talking_points_result = f"<p>Error generating talking points: {str(talking_points_result)}</p>"
        if isinstance(business_impact_result, Exception):
            business_impact_result = f"<p>Error generating business impact: {str(business_impact_result)}</p>"
        
        return {
            'ai_summary': summary_result,
            'ai_executive_summary': summary_result,
            'ai_talking_points': talking_points_result,
            'ai_key_points': talking_points_result,
            'ai_business_impact': business_impact_result,
            'ai_potential_impact': business_impact_result,
            'ai_version': 'azure_openai_enhanced_v1'
        }
        
    except Exception as e:
        print(f"❌ Error analyzing executive order: {e}")
        error_msg = f"<p>AI analysis failed: {str(e)}</p>"
        return {
            'ai_summary': error_msg,
            'ai_executive_summary': error_msg,
            'ai_talking_points': error_msg,
            'ai_key_points': error_msg,
            'ai_business_impact': error_msg,
            'ai_potential_impact': error_msg,
            'ai_version': 'error'
        }

async def analyze_state_legislation(title: str, description: str = "", state: str = "", bill_number: str = "") -> Dict[str, str]:
    """Comprehensive analysis for state legislation with distinct content"""
    try:
        context = f"{state} {bill_number}" if state and bill_number else f"{state} Legislation" if state else "State Legislation"
        content = f"Title: {title}"
        if state:
            content += f"\nState: {state}"
        if bill_number:
            content += f"\nBill Number: {bill_number}"
        if description:
            content += f"\n\nDescription: {description}"
        
        print(f"🔍 Analyzing {state} legislation: {title[:50]}...")
        
        # Run enhanced AI analysis with different contexts
        summary_result, talking_points_result, business_impact_result = await asyncio.gather(
            get_executive_summary(content, f"Legislative Summary - {context}"),
            get_key_talking_points(content, f"Legislative Discussion - {context}"),
            get_business_impact(content, f"Legislative Impact - {context}"),
            return_exceptions=True
        )
        
        if isinstance(summary_result, Exception):
            summary_result = f"<p>Error generating summary: {str(summary_result)}</p>"
        if isinstance(talking_points_result, Exception):
            talking_points_result = f"<p>Error generating talking points: {str(talking_points_result)}</p>"
        if isinstance(business_impact_result, Exception):
            business_impact_result = f"<p>Error generating business impact: {str(business_impact_result)}</p>"
        
        return {
            'ai_summary': summary_result,
            'ai_executive_summary': summary_result,
            'ai_talking_points': talking_points_result,
            'ai_key_points': talking_points_result,
            'ai_business_impact': business_impact_result,
            'ai_potential_impact': business_impact_result,
            'ai_version': 'azure_openai_enhanced_v1'
        }
        
    except Exception as e:
        print(f"❌ Error analyzing legislation: {e}")
        error_msg = f"<p>AI analysis failed: {str(e)}</p>"
        return {
            'ai_summary': error_msg,
            'ai_executive_summary': error_msg,
            'ai_talking_points': error_msg,
            'ai_key_points': error_msg,
            'ai_business_impact': error_msg,
            'ai_potential_impact': error_msg,
            'ai_version': 'error'
        }

async def bulk_process_states(states: List[str], bills_per_state: int = 50) -> Dict:
    """Process multiple states with LegiScan + AI analysis"""
    try:
        print(f"🚀 Starting bulk processing for {len(states)} states")
        
        results = {}
        total_processed = 0
        
        for state in states:
            print(f"\n📍 Processing state: {state}")
            
            state_result = await process_bills_for_state(
                state=state,
                limit=bills_per_state
            )
            
            results[state] = state_result
            total_processed += state_result.get('bills_processed', 0)
            
            print(f"✅ Completed {state}: {state_result.get('bills_processed', 0)} bills")
            
            if state != states[-1]:
                print("⏱️ Brief delay between states...")
                await asyncio.sleep(1)
        
        print(f"\n🎉 Bulk processing completed!")
        print(f"   States processed: {len(states)}")
        print(f"   Total bills processed: {total_processed}")
        
        return {
            'status': 'success',
            'states_processed': len(states),
            'total_bills_processed': total_processed,
            'results': results,
            'timestamp': datetime.now().isoformat()
        }
        
    except Exception as e:
        print(f"❌ Error in bulk processing: {e}")
        traceback.print_exc()
        return {
            'status': 'error',
            'error': str(e),
            'states_processed': len(results) if 'results' in locals() else 0,
            'results': results if 'results' in locals() else {},
            'timestamp': datetime.now().isoformat()
        }

async def run_state_pipeline(state: str, bills_limit: int = 50) -> Dict:
    """Main function to run the complete pipeline for a single state"""
    try:
        print(f"🚀 Running complete pipeline for {state}")
        
        result = await process_bills_for_state(
            state=state,
            limit=bills_limit
        )
        
        if result.get('error'):
            print(f"❌ Pipeline failed for {state}: {result['error']}")
            return result
        
        print(f"✅ Pipeline completed for {state}")
        print(f"   Bills processed: {result.get('bills_processed', 0)}")
        
        return result
        
    except Exception as e:
        print(f"❌ Error in state pipeline for {state}: {e}")
        return {
            'error': str(e),
            'state': state,
            'bills_processed': 0,
            'timestamp': datetime.now().isoformat()
        }

async def run_multi_state_pipeline(states: List[str], bills_per_state: int = 50) -> Dict:
    """Main function to run the complete pipeline for multiple states"""
    try:
        print(f"🚀 Running multi-state pipeline for: {', '.join(states)}")
        
        result = await bulk_process_states(
            states=states,
            bills_per_state=bills_per_state
        )
        
        if result.get('status') == 'error':
            print(f"❌ Multi-state pipeline failed: {result.get('error')}")
            return result
        
        print(f"✅ Multi-state pipeline completed")
        print(f"   States processed: {result.get('states_processed', 0)}")
        print(f"   Total bills processed: {result.get('total_bills_processed', 0)}")
        
        return result
        
    except Exception as e:
        print(f"❌ Error in multi-state pipeline: {e}")
        return {
            'status': 'error',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }

async def search_and_analyze_bills(query: str, state: str = None, limit: int = 20) -> Dict:
    """Search for bills using LegiScan and analyze them with AI"""
    try:
        print(f"🔍 Searching and analyzing bills for query: '{query}' in state: {state or 'All states'}")
        
        legiscan = LegiScanClient()
        
        search_results = legiscan.search_bills(
            state=state,
            query=query,
            year=2
        )
        
        if not search_results.get('results'):
            return {
                'query': query,
                'state': state,
                'bills_found': 0,
                'bills_analyzed': 0,
                'bills': [],
                'message': 'No bills found for the search query'
            }
        
        bills_to_analyze = search_results['results'][:limit]
        analyzed_bills = []
        
        for bill_summary in bills_to_analyze:
            try:
                bill_id = bill_summary.get('bill_id')
                if not bill_id:
                    continue
                
                detailed_bill = legiscan.get_bill(bill_id=int(bill_id))
                if not detailed_bill:
                    continue
                
                detailed_bill['search_query'] = query
                detailed_bill['search_relevance'] = bill_summary.get('relevance', 0)
                
                ai_analysis = await analyze_legiscan_bill(detailed_bill)
                
                analyzed_bill = {
                    'bill_id': bill_id,
                    'bill_number': detailed_bill.get('bill_number', ''),
                    'title': detailed_bill.get('title', ''),
                    'description': detailed_bill.get('description', ''),
                    'state': detailed_bill.get('state_id', state),
                    'url': detailed_bill.get('state_link', ''),
                    'search_relevance': bill_summary.get('relevance', 0)
                }
                
                analyzed_bill.update(ai_analysis)
                analyzed_bills.append(analyzed_bill)
                print(f"✅ Analyzed bill: {analyzed_bill['bill_number']}")
                
            except Exception as e:
                print(f"❌ Error analyzing search result: {e}")
                continue
        
        print(f"✅ Search and analysis completed")
        print(f"   Bills found: {len(search_results['results'])}")
        print(f"   Bills analyzed: {len(analyzed_bills)}")
        
        return {
            'query': query,
            'state': state,
            'bills_found': len(search_results['results']),
            'bills_analyzed': len(analyzed_bills),
            'bills': analyzed_bills,
            'search_summary': search_results.get('summary', {}),
            'timestamp': datetime.now().isoformat()
        }
        
    except Exception as e:
        print(f"❌ Error in search and analyze: {e}")
        return {
            'error': str(e),
            'query': query,
            'state': state,
            'bills_found': 0,
            'bills_analyzed': 0,
            'bills': [],
            'timestamp': datetime.now().isoformat()
        }

async def test_legiscan_integration() -> bool:
    """Test the LegiScan integration"""
    try:
        print("🧪 Testing LegiScan integration...")
        
        if not os.getenv('LEGISCAN_API_KEY'):
            print("❌ LegiScan API key not configured")
            return False
        
        legiscan = LegiScanClient()
        sessions = legiscan.get_session_list('CA')
        
        if sessions and len(sessions) > 0:
            print("✅ LegiScan integration test successful!")
            print(f"   Found {len(sessions)} sessions for CA")
            return True
        else:
            print("❌ LegiScan integration test failed - no sessions found")
            return False
            
    except Exception as e:
        print(f"❌ LegiScan integration test failed: {e}")
        return False
