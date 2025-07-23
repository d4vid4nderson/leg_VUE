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
        # State Bill specific prompts
        STATE_BILL_SUMMARY = "state_bill_summary"
        STATE_BILL_TALKING_POINTS = "state_bill_talking_points"
        STATE_BILL_IMPACT = "state_bill_impact"
    
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

AZURE_ENDPOINT = os.getenv("AZURE_ENDPOINT", "val here")
AZURE_KEY = os.getenv("AZURE_KEY", "key here")
MODEL_NAME = os.getenv("AZURE_MODEL_NAME", "summarize-gpt-4.1")

# Debug logging
print(f"Debug: Using AI configuration - Endpoint: {AZURE_ENDPOINT}")
print(f"Debug: AZURE_KEY value type: {type(AZURE_KEY)}")
if AZURE_KEY:
    print(f"Debug: AZURE_KEY value (first 5 chars): {str(AZURE_KEY)[:5]}...")
else:
    print("Debug: AZURE_KEY is not set")
print(f"Debug: LegiScan API Key: {'✅ Set' if LEGISCAN_API_KEY else '❌ Not Set'}")

def convert_status_to_text(bill_data: Dict[str, Any]) -> str:
    """Convert LegiScan status codes to readable text"""
    # First try to get status_text if available
    status_text = bill_data.get('status_text', '')
    if status_text and status_text.strip():
        return status_text.strip()
    
    # If no status_text, convert numeric status code
    status_code = bill_data.get('status', '')
    
    # LegiScan status code mapping
    status_mapping = {
        '1': 'Introduced',
        '2': 'Engrossed', 
        '3': 'Enrolled',
        '4': 'Passed',
        '5': 'Vetoed',
        '6': 'Failed/Dead',
        '7': 'Indefinitely Postponed',
        '8': 'Signed by Governor',
        '9': 'Effective',
        1: 'Introduced',
        2: 'Engrossed',
        3: 'Enrolled', 
        4: 'Passed',
        5: 'Vetoed',
        6: 'Failed/Dead',
        7: 'Indefinitely Postponed',
        8: 'Signed by Governor',
        9: 'Effective'
    }
    
    # Convert status code to text
    if status_code in status_mapping:
        return status_mapping[status_code]
    elif str(status_code) in status_mapping:
        return status_mapping[str(status_code)]
    
    # If we have some status but can't map it, return as-is
    if status_code:
        return str(status_code)
    
    # Default fallback
    return 'Unknown'

# Initialize Azure OpenAI client
client = AsyncAzureOpenAI(
    azure_endpoint=AZURE_ENDPOINT,
    api_key=AZURE_KEY,
    api_version="2024-02-15-preview"
)

# ENHANCED prompt templates for distinct content generation
PROMPTS = {
    PromptType.EXECUTIVE_SUMMARY: """
    As a senior policy analyst, write a comprehensive executive summary of this executive order. Your analysis should be strategic and actionable for C-level executives and senior decision-makers.

    CRITICAL: Write naturally and vary your approach. DO NOT use formulaic openings. Instead of template phrases, analyze the specific executive order and craft a unique opening that directly addresses its content. Avoid these overused phrases:
    - Do NOT use "A landmark decision"
    - Do NOT use "establishes the [Commission/Office/Agency]" 
    - Do NOT use "signaling a renewed federal commitment"
    - Do NOT use formulaic language
    
    Instead, lead with the specific policy change, its target, or its immediate effect on specific sectors. Make each summary distinct based on the order's actual content.

    Structure your response in 3-4 sentences covering these critical elements:
    1. **Strategic Intent**: What is the core policy objective and strategic rationale behind this directive?
    2. **Operational Impact**: How will this change current operations, processes, or regulatory frameworks?
    3. **Stakeholder Effects**: Which sectors, industries, or groups face the most significant impacts?
    4. **Implementation Scope**: What is the expected timeline, scale, and enforcement mechanisms?

    Focus on actionable intelligence that enables strategic decision-making. Consider second and third-order effects, not just immediate impacts. Use precise, executive-level language that demonstrates deep policy understanding.

    Context: This is an executive order from the current administration that requires strategic assessment for organizational planning and risk management.
    
    Executive Order Content: {text}
    """,
        
    PromptType.KEY_TALKING_POINTS: """
    As a strategic communications expert, develop exactly 5 sophisticated talking points for high-level stakeholder discussions about this executive order. Each point should be a complete, compelling sentence that demonstrates deep policy insight.

    CRITICAL: Create talking points that are specific to this executive order's actual content. Avoid generic phrases and template language. Each point should address unique aspects of this particular order, not generic policy concepts.

    Your talking points must address these strategic dimensions:

    1. **Policy Objective & Rationale**: Articulate the underlying policy problem this order solves and why this approach was chosen over alternatives.

    2. **Multi-Stakeholder Impact Analysis**: Identify the primary and secondary stakeholder groups affected, including their specific concerns, opportunities, and adaptation requirements.

    3. **Regulatory & Compliance Implications**: Explain the most significant regulatory changes, new compliance requirements, or enforcement mechanisms that organizations must navigate.

    4. **Implementation Strategy & Timeline**: Describe the phased rollout approach, critical milestones, and coordination mechanisms between federal agencies and other entities.

    5. **Strategic Risks & Opportunities**: Highlight both potential challenges (legal, operational, political) and strategic opportunities that stakeholders should monitor and leverage.

    Each point should be substantive enough for board-level discussions while remaining concise and actionable. Use **bold formatting** for critical terms and concepts that stakeholders need to remember.
    
    Executive Order Content: {text}
    """,
    
PromptType.BUSINESS_IMPACT: """
As a senior business strategy consultant specializing in regulatory impact analysis, provide a comprehensive assessment of how this executive order will affect business operations, strategy, and competitive positioning.

CRITICAL: Write naturally based on the specific executive order content. Avoid template phrases and formulaic language. Focus on the unique business implications of this particular order rather than generic regulatory language.

**Strategic Impact Assessment:**

**Immediate Regulatory Effects:**
• Identify specific compliance obligations, reporting requirements, or operational changes that businesses must implement
• Analyze potential enforcement mechanisms, penalties, or regulatory oversight that could affect business operations

**Market and Competitive Implications:**
• Evaluate how this order might shift market dynamics, create competitive advantages/disadvantages, or alter industry structures  
• Assess impacts on supply chains, customer relationships, or business model viability

**Financial and Operational Considerations:**
• Estimate potential costs (compliance, operational changes, legal review) and revenue impacts (market access, demand changes)
• Identify required investments in systems, processes, or personnel to achieve compliance

**Strategic Opportunities and Risk Mitigation:**
• Highlight emerging business opportunities, new market segments, or competitive advantages that forward-thinking companies can capture
• Recommend proactive strategies for risk management and regulatory compliance that can provide competitive differentiation

**Executive Recommendation:**
Provide a balanced assessment of whether businesses should view this as primarily a challenge to manage or an opportunity to leverage, with specific next steps for strategic planning.

Focus on actionable insights that inform board-level decision making and strategic planning processes.

Executive Order Content: {text}
""",

    # State Bill specific prompts
    PromptType.STATE_BILL_SUMMARY: """
    Write a simple, clear overview of this state bill in 1-2 sentences.
    Focus only on:
    - What the bill does (main purpose in plain language)
    - Who or what it affects (in basic terms)
    
    Keep it very simple and accessible. Avoid technical details, legislative jargon, or complex explanations.
    Write as if explaining to someone who just wants a quick understanding of what this bill is about.
    
    State Bill Content: {text}
    """,
        
    PromptType.STATE_BILL_TALKING_POINTS: """
    Create exactly 5 distinct talking points for discussing this state bill with constituents and stakeholders.
    Each point should be ONE complete sentence and focus on different aspects:

    1. [What problem this bill aims to solve or address]
    2. [Who would be most directly affected by this legislation]  
    3. [The most significant change or new requirement it creates]
    4. [How and when this would be implemented if passed]
    5. [Potential benefits or concerns for the average citizen]

    Format as numbered list exactly as shown above.
    Make each point suitable for town halls, community meetings, or constituent communications.
    Use bold formatting for important terms: **term**
    Avoid legislative jargon - use plain language.
    
    State Bill Content: {text}
    """,
    
    PromptType.STATE_BILL_IMPACT: """
Analyze the potential impact of this state bill using clear, accessible language:

Community Impact:
Local Effects and Considerations
• [Describe how this bill would affect local communities and residents in one clear sentence]
• [Describe any economic or social impacts on the state in one clear sentence]

Implementation Considerations:
Practical Effects and Requirements
• [Describe what would need to change or be established for implementation in one clear sentence]
• [Describe any costs, benefits, or administrative changes in one clear sentence]

Summary:
[Provide a balanced 1-2 sentence summary of what this bill would mean for the state and its residents]

Use simple bullet points with • character only. 
Avoid asterisks (**) and dashes (---) in your response.
Focus on practical, real-world implications for constituents.

State Bill Content: {text}
"""
}

# Enhanced system messages for each type
SYSTEM_MESSAGES = {
    PromptType.EXECUTIVE_SUMMARY: "You are a distinguished senior policy analyst with 15+ years of experience advising Fortune 500 CEOs and government leaders. You possess deep expertise in regulatory analysis, strategic policy assessment, and executive communication. Your role is to distill complex policy initiatives into strategic intelligence that enables high-level decision-making. You understand both immediate operational impacts and long-term strategic implications across multiple sectors and stakeholder groups.",
    
    PromptType.KEY_TALKING_POINTS: "You are an elite strategic communications consultant who has advised presidents, CEOs, and world leaders on complex policy communications. You excel at creating sophisticated talking points that demonstrate policy expertise while remaining accessible to diverse stakeholder audiences. Your talking points are used in congressional hearings, board meetings, and high-stakes negotiations. You understand the nuanced interests of different stakeholder groups and can articulate complex policy positions with precision and authority.",
    
    PromptType.BUSINESS_IMPACT: "You are a premier management consultant specializing in regulatory strategy and business impact analysis, with extensive experience at McKinsey, BCG, and Bain. You advise Fortune 100 companies on navigating complex regulatory environments and capitalizing on policy changes. Your analysis combines deep regulatory knowledge with practical business acumen, helping companies transform regulatory challenges into competitive advantages. You understand market dynamics, competitive positioning, operational implications, and strategic opportunities that emerge from policy changes.",
    PromptType.STATE_BILL_SUMMARY: "You are a legislative analyst who creates simple, clear overviews of state bills for the general public. Focus on the basic purpose and impact in plain language that anyone can understand quickly.",
    PromptType.STATE_BILL_TALKING_POINTS: "You are a community engagement specialist helping elected officials communicate with constituents. Create talking points that are accessible, relevant, and useful for public discussions.",
    PromptType.STATE_BILL_IMPACT: "You are a civic policy analyst who evaluates how state legislation affects communities and residents. Focus on practical, real-world implications for everyday citizens.",
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
                    year: int = 1,  # Changed default to 1 (all years)
                    page: int = 1) -> Dict:
        """Search for bills - defaults to all years instead of current year only"""
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
        
        # Enhanced parameters for sophisticated analysis with higher token limits
        if prompt_type == PromptType.EXECUTIVE_SUMMARY:
            max_tokens = 600  # Increased for comprehensive executive analysis
            temperature = 0.2  # Slightly higher for more sophisticated language
        elif prompt_type == PromptType.STATE_BILL_SUMMARY:
            max_tokens = 150  # Keep shorter for simple overview
            temperature = 0.1
        elif prompt_type in [PromptType.KEY_TALKING_POINTS, PromptType.STATE_BILL_TALKING_POINTS]:
            max_tokens = 800  # Significantly increased for detailed talking points
            temperature = 0.3  # Higher for more nuanced communications
        elif prompt_type in [PromptType.BUSINESS_IMPACT, PromptType.STATE_BILL_IMPACT]:
            max_tokens = 1000  # Doubled for comprehensive business analysis
            temperature = 0.25  # Balanced for analytical depth
        
        response = await client.chat.completions.create(
            model=MODEL_NAME,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=30,
            top_p=0.95,
            frequency_penalty=0.3,
            presence_penalty=0.2,
            stop=["6.", "7.", "8.", "9."] if prompt_type in [PromptType.KEY_TALKING_POINTS, PromptType.STATE_BILL_TALKING_POINTS] else None
        )

        raw_response = response.choices[0].message.content
        print(f"Raw AI response ({prompt_type.value}):\n---\n{raw_response[:200]}...\n---")

        # Enhanced formatting for each type
        if prompt_type in [PromptType.EXECUTIVE_SUMMARY, PromptType.STATE_BILL_SUMMARY]:
            # Keep as paragraph, clean up any unwanted formatting
            formatted_response = clean_summary_format(raw_response)
        elif prompt_type in [PromptType.KEY_TALKING_POINTS, PromptType.STATE_BILL_TALKING_POINTS]:
            # Ensure proper numbered list format
            formatted_response = format_talking_points(raw_response)
        elif prompt_type in [PromptType.BUSINESS_IMPACT, PromptType.STATE_BILL_IMPACT]:
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

# State Bill specific AI functions
async def get_state_bill_summary(text: str, context: str = "") -> str:
    return await process_with_ai(text, PromptType.STATE_BILL_SUMMARY, context=context)

async def get_state_bill_talking_points(text: str, context: str = "") -> str:
    return await process_with_ai(text, PromptType.STATE_BILL_TALKING_POINTS, context=context)

async def get_state_bill_impact(text: str, context: str = "") -> str:
    return await process_with_ai(text, PromptType.STATE_BILL_IMPACT, context=context)

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
        
        # Run AI analysis tasks with state bill specific prompts
        try:
            summary_task = get_state_bill_summary(content, f"State Bill Summary - {base_context}")
            talking_points_task = get_state_bill_talking_points(content, f"Constituent Discussion - {base_context}")
            business_impact_task = get_state_bill_impact(content, f"Community Impact - {base_context}")
            
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
            'summary': summary_result,  # New simple overview for summary column
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
            'summary': error_msg,  # New simple overview for summary column
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
                    'status': convert_status_to_text(detailed_bill),
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
        
        # Run enhanced AI analysis with state bill specific prompts
        summary_result, talking_points_result, business_impact_result = await asyncio.gather(
            get_state_bill_summary(content, f"State Bill Summary - {context}"),
            get_state_bill_talking_points(content, f"Constituent Discussion - {context}"),
            get_state_bill_impact(content, f"Community Impact - {context}"),
            return_exceptions=True
        )
        
        if isinstance(summary_result, Exception):
            summary_result = f"<p>Error generating summary: {str(summary_result)}</p>"
        if isinstance(talking_points_result, Exception):
            talking_points_result = f"<p>Error generating talking points: {str(talking_points_result)}</p>"
        if isinstance(business_impact_result, Exception):
            business_impact_result = f"<p>Error generating business impact: {str(business_impact_result)}</p>"
        
        return {
            'summary': summary_result,  # New simple overview for summary column
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
            'summary': error_msg,  # New simple overview for summary column
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
            year=1  # Changed to 1 (all years) instead of 2 (current year only)
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
