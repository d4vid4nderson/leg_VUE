# COMPLETE Enhanced main.py with ai.py Integration
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
from functools import lru_cache
import hashlib

import aiohttp
import pyodbc
import requests
from ai_status import check_azure_ai_configuration
from ai import PromptType, process_with_ai
from ai import convert_status_to_text
from progress_tracker import progress_tracker
# Azure SDK imports for Managed Identity
from azure.identity import DefaultAzureCredential
from azure.mgmt.app import ContainerAppsAPIClient
from azure.core.exceptions import AzureError
# Import our new fixed modules  
from database_config import test_database_connection, get_db_connection, get_database_config
# Import LegiScan service
from legiscan_service import (
    EnhancedLegiScanClient, 
    StateLegislationDatabaseManager,
    LegiScanConfigRequest,
    LegiScanSearchRequest,
    StateLegislationFetchRequest,
    SessionStatusRequest,
    check_legiscan_connection,
    get_legiscan_status,
    LEGISCAN_AVAILABLE,
    LEGISCAN_INITIALIZED,
    LegiScanAPI
)
# Environment variables loading
from dotenv import load_dotenv
from executive_orders_db import (add_highlight_direct, create_highlights_table,
                                 get_executive_order_by_number,
                                 get_executive_orders_from_db,
                                 get_user_highlights_direct,
                                 get_user_highlights_with_content,
                                 remove_highlight_direct)
# FastAPI imports
from fastapi import (BackgroundTasks, FastAPI, HTTPException, Path, Query, UploadFile, File, Form,
                     Request, Response, Depends)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import jwt
import requests
from upload_endpoints import upload_data_file, get_upload_status, list_upload_jobs

load_dotenv(override=True)

# Security
security = HTTPBearer(auto_error=False)

# Function to extract user info from Azure AD token
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Extract user information from Azure AD token if provided"""
    if not credentials:
        return None
    
    try:
        # For Azure AD tokens, we can decode without verification to get user info
        # In production, you should verify the token with Azure AD public keys
        token = credentials.credentials
        
        # Decode token without verification (for user info extraction)
        # Note: In production, verify with Azure AD keys
        decoded = jwt.decode(token, options={"verify_signature": False})
        
        user_info = {
            "user_id": decoded.get("oid") or decoded.get("sub"),  # Object ID or Subject
            "email": decoded.get("unique_name") or decoded.get("upn") or decoded.get("email") or decoded.get("preferred_username"),
            "name": decoded.get("name"),
            "given_name": decoded.get("given_name"),
            "family_name": decoded.get("family_name") or decoded.get("surname"),
            "upn": decoded.get("upn"),  # User Principal Name
        }
        
        return user_info
    except Exception as e:
        print(f"Could not extract user from token: {e}")
        return None

# Note: Token test endpoint moved to after app definition

# User ID mapping function for database compatibility
def normalize_user_id(user_id_input):
    """Convert email addresses to unique user IDs for database compatibility"""
    if not user_id_input:
        return "1"  # Default fallback
    
    # If it's already numeric, return as-is 
    if str(user_id_input).isdigit():
        return str(user_id_input)
    
    user_id_str = str(user_id_input).lower().strip()
    
    # Special case for the main admin user
    if user_id_str == "david.anderson@moregroup-inc.com":
        return "1"
    
    # For other email addresses, create a unique numeric ID based on email hash
    # This ensures each email gets a consistent, unique ID
    import hashlib
    email_hash = hashlib.md5(user_id_str.encode()).hexdigest()
    # Convert first 8 characters of hash to a number, ensuring it's not "1"
    numeric_id = str(int(email_hash[:8], 16) % 999999999 + 2)  # +2 ensures it's never 1
    
    return numeric_id

print("🔍 ENVIRONMENT VARIABLE DEBUG:")
print(f"   LEGISCAN_API_KEY raw: {repr(os.getenv('LEGISCAN_API_KEY'))}")
print(f"   LEGISCAN_API_KEY exists: {bool(os.getenv('LEGISCAN_API_KEY'))}")
print(f"   LEGISCAN_API_KEY length: {len(os.getenv('LEGISCAN_API_KEY', ''))}")

# Also check for common variations
for var_name in ['LEGISCAN_API_KEY', 'legiscan_api_key', 'LEGISCAN_KEY']:
    value = os.getenv(var_name)
    if value:
        print(f"   Found {var_name}: {value[:8]}{'*' * max(0, len(value) - 8)}")

if not os.getenv('LEGISCAN_API_KEY'):
    print("⚠️ Setting LEGISCAN_API_KEY directly for testing...")
    os.environ['LEGISCAN_API_KEY'] = 'e3bd77ddffa618452dbe7e9bd3ea3a35'
    print(f"✅ LEGISCAN_API_KEY now set: {bool(os.getenv('LEGISCAN_API_KEY'))}")

# =====================================
# DATABASE HELPER FUNCTIONS (Non-SQLAlchemy)
# =====================================

def test_azure_sql_connection():
    """Test Azure SQL connection using direct pyodbc connection"""
    print("🔍 Testing Azure SQL connection using direct connection...")
    return test_database_connection()

def save_legislation_to_azure_sql(bills: List[Dict]) -> int:
    """Save legislation bills using direct database connection (works with both PostgreSQL and Azure SQL)"""
    if not bills:
        print("⚠️ No bills to save")
        return 0
    
    try:
        from database_config import get_database_config
        config = get_database_config()
        is_postgresql = config['type'] == 'postgresql'
        param_placeholder = '%s' if is_postgresql else '?'
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            saved_count = 0
            
            # Create table if it doesn't exist - different syntax for each DB
            if is_postgresql:
                create_table_sql = """
                CREATE TABLE IF NOT EXISTS legislation (
                    id SERIAL PRIMARY KEY,
                    bill_id VARCHAR(50) UNIQUE,
                    bill_number VARCHAR(100),
                    title TEXT,
                    description TEXT,
                    status VARCHAR(200),
                    last_action TEXT,
                    last_action_date TIMESTAMP,
                    state_id INTEGER,
                    state_name VARCHAR(100),
                    session_id INTEGER,
                    session_name VARCHAR(200),
                    url VARCHAR(500),
                    state_link VARCHAR(500),
                    completed INTEGER DEFAULT 0,
                    status_date TIMESTAMP,
                    progress TEXT,
                    subjects TEXT,
                    sponsors TEXT,
                    committee TEXT,
                    pending_committee_id INTEGER,
                    history TEXT,
                    calendar TEXT,
                    texts TEXT,
                    votes TEXT,
                    amendments TEXT,
                    supplements TEXT,
                    change_hash VARCHAR(100),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            else:
                create_table_sql = """
                IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='legislation' AND xtype='U')
                CREATE TABLE legislation (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    bill_id NVARCHAR(50) UNIQUE,
                    bill_number NVARCHAR(100),
                    title NVARCHAR(MAX),
                    description NVARCHAR(MAX),
                    status NVARCHAR(200),
                    last_action NVARCHAR(MAX),
                    last_action_date DATETIME,
                    state_id INT,
                    state_name NVARCHAR(100),
                    session_id INT,
                    session_name NVARCHAR(200),
                    url NVARCHAR(500),
                    state_link NVARCHAR(500),
                    completed INT DEFAULT 0,
                    status_date DATETIME,
                    progress NVARCHAR(MAX),
                    subjects NVARCHAR(MAX),
                    sponsors NVARCHAR(MAX),
                    committee NVARCHAR(MAX),
                    pending_committee_id INT,
                    history NVARCHAR(MAX),
                    calendar NVARCHAR(MAX),
                    texts NVARCHAR(MAX),
                    votes NVARCHAR(MAX),
                    amendments NVARCHAR(MAX),
                    supplements NVARCHAR(MAX),
                    change_hash NVARCHAR(100),
                    created_at DATETIME DEFAULT GETDATE(),
                    updated_at DATETIME DEFAULT GETDATE()
                )
                """
            cursor.execute(create_table_sql)
            
            # Insert bills - use UPSERT logic for both database types
            for bill in bills:
                try:
                    # Use different SQL for PostgreSQL vs SQL Server
                    if is_postgresql:
                        # PostgreSQL uses ON CONFLICT
                        insert_sql = f"""
                        INSERT INTO legislation (
                            bill_id, bill_number, title, description, status, last_action, last_action_date,
                            state_id, state_name, session_id, session_name, url, state_link, completed,
                            status_date, progress, subjects, sponsors, committee, pending_committee_id,
                            history, calendar, texts, votes, amendments, supplements, change_hash
                        ) VALUES (
                            {param_placeholder}, {param_placeholder}, {param_placeholder}, {param_placeholder}, 
                            {param_placeholder}, {param_placeholder}, {param_placeholder}, {param_placeholder}, 
                            {param_placeholder}, {param_placeholder}, {param_placeholder}, {param_placeholder}, 
                            {param_placeholder}, {param_placeholder}, {param_placeholder}, {param_placeholder}, 
                            {param_placeholder}, {param_placeholder}, {param_placeholder}, {param_placeholder}, 
                            {param_placeholder}, {param_placeholder}, {param_placeholder}, {param_placeholder}, 
                            {param_placeholder}, {param_placeholder}, {param_placeholder}
                        ) ON CONFLICT (bill_id) DO UPDATE SET
                            bill_number = EXCLUDED.bill_number,
                            title = EXCLUDED.title,
                            description = EXCLUDED.description,
                            status = EXCLUDED.status,
                            last_action = EXCLUDED.last_action,
                            last_action_date = EXCLUDED.last_action_date,
                            state_id = EXCLUDED.state_id,
                            state_name = EXCLUDED.state_name,
                            session_id = EXCLUDED.session_id,
                            session_name = EXCLUDED.session_name,
                            url = EXCLUDED.url,
                            state_link = EXCLUDED.state_link,
                            completed = EXCLUDED.completed,
                            status_date = EXCLUDED.status_date,
                            progress = EXCLUDED.progress,
                            subjects = EXCLUDED.subjects,
                            sponsors = EXCLUDED.sponsors,
                            committee = EXCLUDED.committee,
                            pending_committee_id = EXCLUDED.pending_committee_id,
                            history = EXCLUDED.history,
                            calendar = EXCLUDED.calendar,
                            texts = EXCLUDED.texts,
                            votes = EXCLUDED.votes,
                            amendments = EXCLUDED.amendments,
                            supplements = EXCLUDED.supplements,
                            change_hash = EXCLUDED.change_hash,
                            updated_at = CURRENT_TIMESTAMP
                        """
                    else:
                        # SQL Server uses MERGE
                        insert_sql = f"""
                        MERGE legislation AS target
                        USING (SELECT {param_placeholder} AS bill_id) AS source
                        ON target.bill_id = source.bill_id
                        WHEN MATCHED THEN
                            UPDATE SET
                                bill_number = {param_placeholder},
                                title = {param_placeholder},
                                description = {param_placeholder},
                                status = {param_placeholder},
                                last_action = {param_placeholder},
                                last_action_date = {param_placeholder},
                                state_id = {param_placeholder},
                                state_name = {param_placeholder},
                                session_id = {param_placeholder},
                                session_name = {param_placeholder},
                                url = {param_placeholder},
                                state_link = {param_placeholder},
                                completed = {param_placeholder},
                                status_date = {param_placeholder},
                                progress = {param_placeholder},
                                subjects = {param_placeholder},
                                sponsors = {param_placeholder},
                                committee = {param_placeholder},
                                pending_committee_id = {param_placeholder},
                                history = {param_placeholder},
                                calendar = {param_placeholder},
                                texts = {param_placeholder},
                                votes = {param_placeholder},
                                amendments = {param_placeholder},
                                supplements = {param_placeholder},
                                change_hash = {param_placeholder},
                                updated_at = GETDATE()
                        WHEN NOT MATCHED THEN
                            INSERT (bill_id, bill_number, title, description, status, last_action, last_action_date,
                                   state_id, state_name, session_id, session_name, url, state_link, completed,
                                   status_date, progress, subjects, sponsors, committee, pending_committee_id,
                                   history, calendar, texts, votes, amendments, supplements, change_hash)
                            VALUES ({param_placeholder}, {param_placeholder}, {param_placeholder}, {param_placeholder}, 
                                   {param_placeholder}, {param_placeholder}, {param_placeholder}, {param_placeholder}, 
                                   {param_placeholder}, {param_placeholder}, {param_placeholder}, {param_placeholder}, 
                                   {param_placeholder}, {param_placeholder}, {param_placeholder}, {param_placeholder}, 
                                   {param_placeholder}, {param_placeholder}, {param_placeholder}, {param_placeholder}, 
                                   {param_placeholder}, {param_placeholder}, {param_placeholder}, {param_placeholder}, 
                                   {param_placeholder}, {param_placeholder}, {param_placeholder});
                        """
                    
                    # Prepare parameters - single set for PostgreSQL, double for SQL Server MERGE
                    base_params = [
                        bill.get('bill_id', ''),
                        bill.get('bill_number', ''),
                        bill.get('title', ''),
                        bill.get('description', ''),
                        bill.get('status', ''),
                        bill.get('last_action', ''),
                        bill.get('last_action_date'),
                        bill.get('state_id', 0),
                        bill.get('state', ''),
                        bill.get('session_id', 0),
                        bill.get('session_name', ''),
                        bill.get('url', ''),
                        bill.get('state_link', ''),
                        bill.get('completed', 0),
                        bill.get('status_date'),
                        str(bill.get('progress', [])),
                        str(bill.get('subjects', [])),
                        str(bill.get('sponsors', [])),
                        bill.get('committee', ''),
                        bill.get('pending_committee_id', 0),
                        str(bill.get('history', [])),
                        str(bill.get('calendar', [])),
                        str(bill.get('texts', [])),
                        str(bill.get('votes', [])),
                        str(bill.get('amendments', [])),
                        str(bill.get('supplements', [])),
                        bill.get('change_hash', '')
                    ]
                    
                    if is_postgresql:
                        params = base_params
                    else:
                        # SQL Server MERGE needs: 1 for USING, then 26 for UPDATE, then 27 for INSERT = 54 total
                        # USING clause: 1 parameter (bill_id)
                        # UPDATE clause: 26 parameters (all fields except bill_id) 
                        # INSERT clause: 27 parameters (all fields including bill_id)
                        params = [
                            bill.get('bill_id', ''),  # USING clause
                            *base_params[1:],         # UPDATE clause (skip bill_id)
                            *base_params              # INSERT clause (all fields)
                        ]
                    
                    cursor.execute(insert_sql, params)
                    saved_count += 1
                    
                except Exception as e:
                    print(f"❌ Failed to save bill {bill.get('bill_id', 'unknown')}: {e}")
                    print(f"   Database type: {config['type']}")
                    print(f"   Parameter placeholder: {param_placeholder}")
                    continue
            
            cursor.close()
            print(f"✅ Saved {saved_count} bills to Azure SQL")
            return saved_count
            
    except Exception as e:
        print(f"❌ Failed to save legislation to Azure SQL: {e}")
        return 0

def get_most_recent_bill_date(state_abbr: str = None) -> Optional[str]:
    """Get the most recent bill date from database for incremental fetching"""
    try:
        from database_config import get_database_config
        config = get_database_config()
        is_postgresql = config['type'] == 'postgresql'
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Build query to find most recent bill
            if state_abbr:
                if is_postgresql:
                    query = """
                    SELECT MAX(last_action_date) as most_recent_date
                    FROM legislation 
                    WHERE state_name = %s OR state_id = (
                        SELECT id FROM states WHERE abbreviation = %s LIMIT 1
                    )
                    """
                    cursor.execute(query, (state_abbr, state_abbr))
                else:
                    query = """
                    SELECT MAX(last_action_date) as most_recent_date
                    FROM legislation 
                    WHERE state_name = ? OR state_id IN (
                        SELECT TOP 1 id FROM states WHERE abbreviation = ?
                    )
                    """
                    cursor.execute(query, (state_abbr, state_abbr))
            else:
                # Get most recent across all states
                query = "SELECT MAX(last_action_date) as most_recent_date FROM legislation"
                cursor.execute(query)
            
            result = cursor.fetchone()
            if result and result[0]:
                most_recent_date = result[0]
                # Convert to ISO format string for API use
                if hasattr(most_recent_date, 'isoformat'):
                    return most_recent_date.isoformat()
                else:
                    return str(most_recent_date)
            
            return None
            
    except Exception as e:
        print(f"❌ Error getting most recent bill date: {e}")
        return None


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Simple in-memory cache for API responses
class APICache:
    def __init__(self):
        self.cache = {}
        self.timestamps = {}
        self.default_ttl = 300  # 5 minutes default
    
    def get_key(self, endpoint: str, params: dict) -> str:
        """Generate a unique cache key from endpoint and params"""
        param_str = json.dumps(params, sort_keys=True)
        return hashlib.md5(f"{endpoint}:{param_str}".encode()).hexdigest()
    
    def get(self, endpoint: str, params: dict) -> Optional[Any]:
        """Get cached value if not expired"""
        key = self.get_key(endpoint, params)
        if key in self.cache:
            timestamp = self.timestamps.get(key, 0)
            if time.time() - timestamp < self.default_ttl:
                logger.info(f"📦 Cache hit for {endpoint}")
                return self.cache[key]
            else:
                # Expired
                del self.cache[key]
                del self.timestamps[key]
        return None
    
    def set(self, endpoint: str, params: dict, value: Any, ttl: int = None) -> None:
        """Cache a value with TTL"""
        key = self.get_key(endpoint, params)
        self.cache[key] = value
        self.timestamps[key] = time.time()
        logger.info(f"📦 Cached response for {endpoint}")
    
    def clear(self) -> None:
        """Clear all cache"""
        self.cache.clear()
        self.timestamps.clear()

# Initialize cache
api_cache = APICache()

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

async def get_federal_register_count():
    """Get total count from Federal Register API without fetching all data"""
    try:
        # Use the same API endpoint but with minimal data to get count
        base_url = "https://www.federalregister.gov/api/v1"
        
        # Convert date to API format (MM/DD/YYYY)
        start_date = "01/20/2025"  # Trump inauguration
        end_date = datetime.now().strftime('%m/%d/%Y')
        
        params = {
            'conditions[correction]': '0',
            'conditions[president]': 'donald-trump',
            'conditions[presidential_document_type]': 'executive_order',
            'conditions[signing_date][gte]': start_date,
            'conditions[signing_date][lte]': end_date,
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
        # Use the cursor context manager for cleaner code
        from executive_orders_db import get_db_cursor

        with get_db_cursor() as cursor:
            # Count all executive orders (no president column exists)
            cursor.execute("SELECT COUNT(*) FROM executive_orders")
            count = cursor.fetchone()[0]
            logger.info(f"📊 Database has {count} executive orders")
            return count
        
    except Exception as e:
        logger.error(f"❌ Error getting database count: {e}")
        return 0

async def validate_database_schema():
    """Validate database schema for executive orders table"""
    try:
        from executive_orders_db import get_db_cursor
        
        logger.info("🔍 Validating database schema...")
        
        with get_db_cursor() as cursor:
            # Check if table exists
            cursor.execute("""
                SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_NAME = 'executive_orders' AND TABLE_SCHEMA = 'dbo'
            """)
            table_exists = cursor.fetchone()[0] > 0
            
            if not table_exists:
                logger.error("❌ executive_orders table does not exist")
                return {"valid": False, "error": "Table does not exist"}
            
            # Get column information
            cursor.execute("""
                SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = 'executive_orders' AND TABLE_SCHEMA = 'dbo'
                ORDER BY ORDINAL_POSITION
            """)
            
            columns = cursor.fetchall()
            column_names = [col[0].lower() for col in columns]
            
            # Required columns
            required_columns = ['id', 'eo_number', 'title', 'signing_date']
            missing_columns = [col for col in required_columns if col not in column_names]
            
            # Problematic columns that should not exist
            problematic_columns = ['president']
            found_problematic = [col for col in problematic_columns if col in column_names]
            
            validation_result = {
                "valid": len(missing_columns) == 0 and len(found_problematic) == 0,
                "table_exists": table_exists,
                "total_columns": len(columns),
                "column_names": column_names,
                "missing_required": missing_columns,
                "problematic_found": found_problematic
            }
            
            if validation_result["valid"]:
                logger.info(f"✅ Database schema validation passed - {len(columns)} columns found")
            else:
                if missing_columns:
                    logger.error(f"❌ Missing required columns: {missing_columns}")
                if found_problematic:
                    logger.error(f"❌ Found problematic columns: {found_problematic}")
                    
            return validation_result
            
    except Exception as e:
        logger.error(f"❌ Error validating database schema: {e}")
        return {"valid": False, "error": str(e)}

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

# Import PromptType from ai.py to ensure consistency
from ai import PromptType

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
    """Enhanced AI analysis for bills using concise prompts from ai.py"""
    try:
        print(f"🔍 DEBUG: enhanced_bill_analysis (main.py) called for bill: {bill_data.get('bill_id', 'unknown')}")
        
        # Import the proper AI analysis function from ai.py
        from ai import analyze_legiscan_bill
        print(f"🔍 DEBUG: Successfully imported analyze_legiscan_bill from ai.py")
        
        # Use the proper AI analysis with our improved concise prompts
        analysis_result = await analyze_legiscan_bill(bill_data, enhanced_context=True)
        print(f"🔍 DEBUG: AI analysis result keys: {list(analysis_result.keys())}")
        print(f"🔍 DEBUG: AI summary preview: {analysis_result.get('ai_summary', 'No summary')[:150]}...")
        
        return analysis_result
        
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
# ENHANCED LEGISCAN CLIENT - Now imported from legiscan_service.py
# ===============================

# class EnhancedLegiScanClient: # MOVED to legiscan_service.py
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
    
    async def search_bills_enhanced(self, state: str, query: str, limit: int = 100, year_filter: str = 'all', max_pages: int = 5, session_id: Optional[int] = None) -> Dict:
        """Enhanced bill search with comprehensive data and pagination"""
        try:
            all_results = []
            total_found = 0
            pages_fetched = 0
            
            # Set year parameter based on filter
            # LegiScan year parameter: 1=All years, 2=Current year, 4=Recent years
            year_param = 1  # Default to all years to get maximum results
            if year_filter == 'current':
                year_param = 2  # Current year only
            elif year_filter == 'recent':
                year_param = 4  # Recent years (current + prior)
            
            print(f"🔍 Enhanced search for {state} with year filter '{year_filter}' (param: {year_param})")
            
            # Fetch multiple pages
            for page in range(1, max_pages + 1):
                params = {
                    'query': query, 
                    'year': year_param, 
                    'page': page
                }
                if state:
                    params['state'] = state
                if session_id:
                    params['id'] = session_id  # LegiScan uses 'id' parameter for session_id
                
                url = self._build_url('search', params)
                data = await self._api_request(url)
                search_result = data.get('searchresult', {})
                
                # Extract summary from first page
                if page == 1:
                    summary = search_result.get('summary', {})
                    total_found = summary.get('count', 0)
                    print(f"📊 Total bills available: {total_found}")
                
                # Extract results from current page
                page_results = [search_result[key] for key in search_result if key != 'summary' and isinstance(search_result[key], dict)]
                
                if not page_results:
                    print(f"📄 No more results on page {page}")
                    break
                
                all_results.extend(page_results)
                pages_fetched = page
                
                print(f"📄 Page {page}: Found {len(page_results)} bills (Total so far: {len(all_results)})")
                
                # Check if we have enough results or if this was the last page
                if len(all_results) >= limit or len(page_results) < 50:  # LegiScan typically returns 50 per page
                    break
                
                # Rate limiting between page requests
                await asyncio.sleep(self.rate_limit_delay)
            
            # Apply final limit
            if limit and len(all_results) > limit:
                all_results = all_results[:limit]
            
            print(f"✅ Enhanced search completed: {len(all_results)} bills returned from {pages_fetched} pages")
            
            return {
                'success': True,
                'summary': {
                    'count': total_found,
                    'pages_fetched': pages_fetched,
                    'year_filter': year_filter,
                    'returned_count': len(all_results)
                },
                'results': all_results,
                'bills_found': len(all_results)
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
    
    async def enhanced_search_and_analyze(self, state: str, query: str, limit: int = 100, 
                                        year_filter: str = 'current', max_pages: int = 10,
                                        session_id: Optional[int] = None,
                                        with_ai: bool = True, db_manager = None) -> Dict:
        """Enhanced search and analyze workflow with one-by-one processing"""
        try:
            if session_id:
                print(f"🏛️ Enhanced search and analyze: {query} in {state} for session {session_id}")
            else:
                print(f"🚀 Enhanced search and analyze: {query} in {state}")
            
            # Step 1: Search for bills
            search_result = await self.search_bills_enhanced(state, query, limit, year_filter, max_pages, session_id)
            
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
                        'status': convert_status_to_text(detailed_bill),
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

# StateLegislationDatabaseManager class removed - using the complete version from legiscan_service.py

# ===============================
# PYDANTIC REQUEST MODELS
# ===============================

class StateLegislationFetchRequest(BaseModel):
    states: List[str]
    save_to_db: bool = True
    bills_per_state: int = 50  # Increased default
    year_filter: str = 'all'  # NEW: Year filtering
    max_pages: int = 3  # NEW: Pagination control

class LegiScanConfigRequest(BaseModel):
    """Configuration for LegiScan API requests"""
    default_limit: int = 100
    default_year_filter: str = 'all'  # 'all', 'current', 'recent'
    default_max_pages: int = 5
    enable_pagination: bool = True
    rate_limit_delay: float = 1.1

class LegiScanSearchRequest(BaseModel):
    query: str
    state: str
    limit: int = 100  # Increased default limit
    session_id: Optional[int] = None  # NEW: Optional session ID for session-based fetching
    save_to_db: bool = True
    process_one_by_one: bool = False


class ExecutiveOrderFetchRequest(BaseModel):
    start_date: Optional[str] = "2025-01-20"
    end_date: Optional[str] = None
    per_page: Optional[int] = 1000
    save_to_db: Optional[bool] = True
    with_ai: Optional[bool] = True

class ProclamationFetchRequest(BaseModel):
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
    user_id: str  # Changed to str to support email-based IDs
    order_id: str
    order_type: str  # 'executive_order' or 'state_legislation'
    notes: Optional[str] = None
    priority_level: Optional[int] = 1
    tags: Optional[str] = None
    is_archived: Optional[bool] = False

class HighlightUpdateRequest(BaseModel):
    user_id: str  # Changed to str to support email-based IDs
    notes: Optional[str] = None
    priority_level: Optional[int] = None
    tags: Optional[str] = None
    is_archived: Optional[bool] = None

class ReviewStatusRequest(BaseModel):
    reviewed: bool


# ===============================
# DATABASE CONNECTION CLASS
# ===============================

class DatabaseConnection:
    def __init__(self):
        self.connection = None
    
    def _build_connection_string(self):
        """Build database connection string based on environment"""
        raw_env = os.getenv("ENVIRONMENT", "development")
        environment = "production" if raw_env == "production" or bool(os.getenv("CONTAINER_APP_NAME") or os.getenv("MSI_ENDPOINT")) else "development"

        server = os.getenv('AZURE_SQL_SERVER', 'sql-legislation-tracker.database.windows.net')
        database = os.getenv('AZURE_SQL_DATABASE', 'db-executiveorders')
        
        if environment == "production":
            # For production, use system-assigned MSI
            print("🔐 Using system-assigned managed identity for database connection")
            connection_string = (
                "Driver={ODBC Driver 18 for SQL Server};"
                f"Server=tcp:{server},1433;"
                f"Database={database};"
                "Authentication=ActiveDirectoryMSI;"
                "Encrypt=yes;"
                "TrustServerCertificate=no;"
                "Connection Timeout=30;"
            )
            return connection_string
        else:
            # Development - use SQL auth
            username = os.getenv('AZURE_SQL_USERNAME')
            password = os.getenv('AZURE_SQL_PASSWORD')
            
            # Check that all required credentials are provided
            if all([server, database, username, password]):
                # Direct pyodbc connection string
                connection_string = (
                    "Driver={ODBC Driver 18 for SQL Server};"
                    f"Server=tcp:{server},1433;"
                    f"Database={database};"
                    f"UID={username};"
                    f"PWD={password};"
                    "Encrypt=yes;"
                    "TrustServerCertificate=no;"
                    "Connection Timeout=30;"
                )
                print(f"🔑 Using SQL authentication for development")
                return connection_string
            else:
                print("❌ Database connection failed - missing credentials")
                return None

    
    def get_connection(self):
        """Get a database connection"""
        try:
            return get_database_connection()
        except Exception as e:
            print(f"Failed to get database connection: {e}")
            raise
    
    def test_connection(self):
        """Test database connection"""
        return test_database_connection()


# ===============================
# DATABASE IMPORTS AND SETUP
# ===============================

AZURE_SQL_AVAILABLE = False
HIGHLIGHTS_DB_AVAILABLE = AZURE_SQL_AVAILABLE



from database_config import get_db_connection as get_database_connection, test_database_connection
from executive_orders_db import get_db_cursor
# 2. Add proper imports for executive orders and highlights
from executive_orders_db import (add_highlight_direct, create_highlights_table,
                                 get_executive_order_by_number,
                                 get_executive_orders_from_db,
                                 get_user_highlights_direct,
                                 remove_highlight_direct,
                                 save_executive_orders_to_db)

# 3. Update database availability checks
# Replace:
# AZURE_SQL_AVAILABLE = ...
# With:
AZURE_SQL_AVAILABLE = True  # We're using direct connection now
HIGHLIGHTS_DB_AVAILABLE = True
EXECUTIVE_ORDERS_AVAILABLE = True

# 4. LAZY LOADING: Don't import executive orders at startup - only when needed
# This prevents executive orders logic from running when state legislation is fetched
SIMPLE_EO_AVAILABLE = False
fetch_executive_orders_simple_integration = None
SimpleProclamations = None  
SimpleExecutiveOrders = None

def load_executive_orders_module():
    """Lazy load executive orders module only when explicitly needed"""
    global SIMPLE_EO_AVAILABLE, fetch_executive_orders_simple_integration, SimpleProclamations, SimpleExecutiveOrders
    
    if SIMPLE_EO_AVAILABLE:
        return True  # Already loaded
        
    try:
        from simple_executive_orders import \
            fetch_executive_orders_simple_integration as _fetch, \
            SimpleProclamations as _proc, \
            SimpleExecutiveOrders as _eo
        
        fetch_executive_orders_simple_integration = _fetch
        SimpleProclamations = _proc
        SimpleExecutiveOrders = _eo
        SIMPLE_EO_AVAILABLE = True
        print("✅ Executive Orders module loaded on demand")
        return True
    except ImportError as e:
        print(f"⚠️ Simple Executive Orders API not available: {e}")
        return False


# Import Azure SQL database functions
#try:
#    from database_azure_fixed import (
#        test_azure_sql_connection,
#        init_databases,
#        LegislationSession,
#        StateLegislationDB,
#        save_legislation_to_azure_sql as save_legislation_to_db,
#        get_legislation_from_azure_sql as get_legislation_from_db,
#        get_legislation_stats_azure_sql as get_legislation_stats,
#        test_azure_sql_full
#    )
#    AZURE_SQL_AVAILABLE = True
#    print("✅ Azure SQL database available")
#except ImportError as e:
#    print(f"❌ Database import failed: {e}")
#    AZURE_SQL_AVAILABLE = False
#
## Import Simple Executive Orders API
#try:
#    from simple_executive_orders import fetch_executive_orders_simple_integration
#    SIMPLE_EO_AVAILABLE = True
#    print("✅ Simple Executive Orders API available")
#except ImportError as e:
#    print(f"⚠️ Simple Executive Orders API not available: {e}")
#    SIMPLE_EO_AVAILABLE = False
#
#
#EXECUTIVE_ORDERS_AVAILABLE = False
## Check if executive orders functions are available
#try:
#    if AZURE_SQL_AVAILABLE:
#        EXECUTIVE_ORDERS_AVAILABLE = True
#        print("✅ Executive orders functions created successfully")
#    else:
#        EXECUTIVE_ORDERS_AVAILABLE = False
#        print("❌ Executive orders not available (Azure SQL not available)")
#except Exception as e:
#    print(f"❌ Executive orders integration failed: {e}")
#    EXECUTIVE_ORDERS_AVAILABLE = False


#        def get_executive_orders_from_db(limit=100, offset=0, filters=None):
#            """Get executive orders using existing get_legislation_from_db - FIXED VERSION"""
#            try:
#                # Calculate page from offset
#                page = (offset // limit) + 1
#                
#                # Try calling with correct parameters
#                result = get_legislation_from_db(
#                    page=page,
#                    per_page=limit
#                )
#                
#                # Filter for executive orders in the results if needed
#                if result and 'results' in result:
#                    all_orders = result['results']
#                    
#                    # Filter by document_type if we're looking for executive orders
#                    filtered_orders = []
#                    for order in all_orders:
#                        # Check if this looks like an executive order
#                        bill_number = order.get('bill_number', '')
#                        bill_type = order.get('bill_type', '')
#                        state = order.get('state', '')
#                        
#                        # Include if it looks like an executive order
#                        if (bill_type == 'executive_order' or 
#                            state in ['Federal', 'US'] or
#                            bill_number.startswith('TEMP_') or 
#                            bill_number.startswith('14') or 
#                            bill_number.startswith('15') or
#                            'eo-' in order.get('bill_id', '')):
#                            filtered_orders.append(order)
#                    
#                    return {
#                        'success': True,
#                        'results': filtered_orders,
#                        'count': len(filtered_orders)
#                    }
#                else:
#                    return {
#                        'success': True,
#                        'results': [],
#                        'count': 0
#                    }
#                
#            except Exception as e:
#                print(f"❌ Error getting executive orders: {e}")
#                import traceback
#                traceback.print_exc()
#                return {
#                    'success': False,
#                    'message': str(e),
#                    'results': [],
#                    'count': 0
#                }






#def get_executive_orders_from_db(limit=100, offset=0, filters=None):
#    """Get executive orders using EXACT column names from your table"""
#    try:
#        print(f"🔍 DEBUG: Function called with limit={limit}, offset={offset}")
#        
#        # Build SQL query using YOUR EXACT column names
#        base_query = """
#        SELECT 
#            id,
#            document_number,
#            eo_number,
#            title,
#            summary,
#            signing_date,
#            publication_date,
#            citation,
#            presidential_document_type,
#            category,
#            html_url,
#            pdf_url,
#            trump_2025_url,
#            ai_summary,
#            ai_executive_summary,
#            ai_key_points,
#            ai_talking_points,
#            ai_business_impact,
#            ai_potential_impact,
#            ai_version,
#            source,
#            raw_data_available,
#            processing_status,
#            error_message,
#            created_at,
#            last_updated,
#            last_scraped_at,
#            content,
#            tags,
#            ai_analysis
#        FROM executive_orders
#        """
#        
#        # Add WHERE clause if filters exist
#        where_conditions = []
#        params = []
#        
#        if filters:
#            if filters.get('search'):
#                where_conditions.append("(title LIKE %s OR summary LIKE %s OR ai_summary LIKE %s)")
#                search_term = f"%{filters['search']}%"
#                params.extend([search_term, search_term, search_term])
#                print(f"🔍 DEBUG: Added search filter: {search_term}")
#            
#            if filters.get('category'):
#                where_conditions.append("category = %s")
#                params.append(filters['category'])
#                print(f"🔍 DEBUG: Added category filter: {filters['category']}")
#        
#        if where_conditions:
#            base_query += " WHERE " + " AND ".join(where_conditions)
#        
#        # Add ORDER BY and pagination
#        base_query += " ORDER BY publication_date DESC, eo_number DESC"
#        base_query += f" OFFSET {offset} ROWS FETCH NEXT {limit} ROWS ONLY"
#        
#        print(f"🔍 DEBUG: Final SQL Query:")
#        print(f"    {base_query}")
#        
#        # Execute query
#        conn = get_azure_sql_connection()
#        if not conn:
#            return {'success': False, 'message': 'No database connection', 'results': [], 'count': 0}
#        
#        cursor = conn.cursor()
#        
#        # Get total count
#        count_query = "SELECT COUNT(*) FROM executive_orders"
#        if where_conditions:
#            count_query += " WHERE " + " AND ".join(where_conditions)
#        
#        cursor.execute(count_query, params if where_conditions else [])
#        total_count = cursor.fetchone()[0]
#        print(f"🔍 DEBUG: Total count from database: {total_count}")
#        
#        # Execute main query
#        cursor.execute(base_query, params)
#        columns = [desc[0] for desc in cursor.description]
#        rows = cursor.fetchall()
#        print(f"🔍 DEBUG: Raw rows fetched: {len(rows)}")
#        
#        # Convert to API format
#        results = []
#        for i, row in enumerate(rows):
#            db_record = dict(zip(columns, row))
#            
#            if i < 3:
#                print(f"🔍 DEBUG: Row {i+1}: eo_number={db_record.get('eo_number')}, title={db_record.get('title', '')[:30]}...")
#            
#            # Map your database columns to API format
#            api_record = {
#                # Core identification
#                'id': db_record.get('id'),
#                'bill_id': db_record.get('id'),
#                'eo_number': db_record.get('eo_number'),
#                'executive_order_number': db_record.get('eo_number'),
#                'bill_number': db_record.get('eo_number'),
#                'document_number': db_record.get('document_number'),
#                
#                # Content
#                'title': db_record.get('title', 'Untitled Executive Order'),
#                'summary': db_record.get('summary', ''),
#                'description': db_record.get('summary', ''),
#                'content': db_record.get('content', ''),
#                
#                # Dates
#                'signing_date': db_record.get('signing_date'),
#                'publication_date': db_record.get('publication_date'),
#                'introduced_date': db_record.get('signing_date'),
#                'last_action_date': db_record.get('publication_date'),
#                
#                # URLs
#                'html_url': db_record.get('html_url', ''),
#                'pdf_url': db_record.get('pdf_url', ''),
#                'trump_2025_url': db_record.get('trump_2025_url', ''),
#                'legiscan_url': db_record.get('html_url', ''),
#                
#                # Metadata
#                'citation': db_record.get('citation', ''),
#                'presidential_document_type': db_record.get('presidential_document_type', ''),
#                'category': db_record.get('category', 'civic'),
#                'source': db_record.get('source', 'Federal Register'),
#                'tags': db_record.get('tags', ''),
#                
#                # AI Analysis
#                'ai_summary': db_record.get('ai_summary', ''),
#                'ai_executive_summary': db_record.get('ai_executive_summary', ''),
#                'ai_key_points': db_record.get('ai_key_points', ''),
#                'ai_talking_points': db_record.get('ai_talking_points', ''),
#                'ai_business_impact': db_record.get('ai_business_impact', ''),
#                'ai_potential_impact': db_record.get('ai_potential_impact', ''),
#                'ai_version': db_record.get('ai_version', ''),
#                'ai_analysis': db_record.get('ai_analysis', ''),
#                'ai_processed': bool(
#                    db_record.get('ai_summary') or 
#                    db_record.get('ai_executive_summary') or 
#                    db_record.get('ai_analysis')
#                ),
#                
#                # Processing Status
#                'processing_status': db_record.get('processing_status', ''),
#                'raw_data_available': db_record.get('raw_data_available', False),
#                'error_message': db_record.get('error_message', ''),
#                
#                # Timestamps
#                'created_at': db_record.get('created_at'),
#                'last_updated': db_record.get('last_updated'),
#                'last_scraped_at': db_record.get('last_scraped_at'),
#                
#                # API-specific fields
#                'bill_type': 'executive_order',
#                'state': 'Federal',
#                'president': 'Donald Trump'
#            }
#            
#            # Format dates
#            for date_field in ['signing_date', 'publication_date']:
#                if api_record.get(date_field):
#                    try:
#                        if hasattr(api_record[date_field], 'strftime'):
#                            api_record[f'formatted_{date_field}'] = api_record[date_field].strftime('%Y-%m-%d')
#                        else:
#                            api_record[f'formatted_{date_field}'] = str(api_record[date_field])
#                    except:
#                        api_record[f'formatted_{date_field}'] = str(api_record[date_field])
#            
#            results.append(api_record)
#        
#        cursor.close()
#        conn.close()
#        
#        print(f"🔍 DEBUG: Successfully processed {len(results)} executive orders")
#        
#        return {
#            'success': True,
#            'results': results,
#            'count': len(results),
#            'total': total_count
#        }
#        
#    except Exception as e:
#        print(f"❌ DEBUG: Error in get_executive_orders_from_db: {e}")
#        import traceback
#        traceback.print_exc()
#        return {
#            'success': False,
#            'message': str(e),
#            'results': [],
#            'count': 0
#        }


#        def get_executive_orders_from_db(limit=100, offset=0, filters=None):
#            """Get executive orders using existing get_legislation_from_db - FIXED VERSION"""
#            try:
#                # Calculate page from offset
#                page = (offset // limit) + 1
#                
#                # Try calling with correct parameters
#                result = get_legislation_from_db(
#                    page=page,
#                    per_page=limit
#                )
#                
#                # Filter for executive orders in the results if needed
#                if result and 'results' in result:
#                    all_orders = result['results']
#                    
#                    # Filter by document_type if we're looking for executive orders
#                    filtered_orders = []
#                    for order in all_orders:
#                        # Check if this looks like an executive order
#                        bill_number = order.get('bill_number', '')
#                        bill_type = order.get('bill_type', '')
#                        state = order.get('state', '')
#                        
#                        # Include if it looks like an executive order
#                        if (bill_type == 'executive_order' or 
#                            state in ['Federal', 'US'] or
#                            bill_number.startswith('TEMP_') or 
#                            bill_number.startswith('14') or 
#                            bill_number.startswith('15') or
#                            'eo-' in order.get('bill_id', '')):
#                            filtered_orders.append(order)
#                    
#                    return {
#                        'success': True,
#                        'results': filtered_orders,
#                        'count': len(filtered_orders)
#                    }
#                else:
#                    return {
#                        'success': True,
#                        'results': [],
#                        'count': 0
#                    }
#                
#            except Exception as e:
#                print(f"❌ Error getting executive orders: {e}")
#                import traceback
#                traceback.print_exc()
#                return {
#                    'success': False,
#                    'message': str(e),
#                    'results': [],
#                    'count': 0
#                }
#try:
#    if AZURE_SQL_AVAILABLE:
#
#        EXECUTIVE_ORDERS_AVAILABLE = True
#        print("✅ Executive orders functions created successfully (FIXED)")
#    else:
#        EXECUTIVE_ORDERS_AVAILABLE = False
#        print("❌ Executive orders not available (Azure SQL not available)")
#
#except Exception as e:
#    print(f"❌ Executive orders integration failed: {e}")
#    EXECUTIVE_ORDERS_AVAILABLE = False

# Import Simple Executive Orders API - FIXED
#try:
#    from simple_executive_orders import fetch_executive_orders_simple_integration
#    SIMPLE_EO_AVAILABLE = True
#    print("✅ Simple Executive Orders API available")
#except ImportError as e:
#    print(f"⚠️ Simple Executive Orders API not available: {e}")
#    SIMPLE_EO_AVAILABLE = False

# ===============================
# CRITICAL MISSING ENDPOINT - ADD THIS TO YOUR MAIN.PY
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

logger = logging.getLogger(__name__)

# Detect environment using container indicators as a fallback
raw_env = os.getenv("ENVIRONMENT", "development")
container_app_name = os.getenv("CONTAINER_APP_NAME")
msi_endpoint = os.getenv("MSI_ENDPOINT")
environment = "production" if raw_env == "production" or bool(container_app_name or msi_endpoint) else "development"

# Debug environment detection
print(f"🔍 Environment Detection Debug:")
print(f"   - ENVIRONMENT env var: {raw_env}")
print(f"   - CONTAINER_APP_NAME: {container_app_name}")
print(f"   - MSI_ENDPOINT: {msi_endpoint}")
print(f"   - Final environment: {environment}")


# Get the frontend URL from environment variable if set
frontend_url = os.getenv("FRONTEND_URL", "")

# CORS setup based solely on environment
if environment == "production":
    cors_origins = [
        "https://legis-vue-frontend.jollyocean-a8149425.centralus.azurecontainerapps.io",
        "http://legis-vue-frontend.jollyocean-a8149425.centralus.azurecontainerapps.io"
    ]
    allow_headers = ["Content-Type", "Authorization", "X-Requested-With"]
    print(f"✅ CORS configured for production with specific origins: {cors_origins}")
else:
    # Development CORS - be more permissive for local development
    cors_origins = ["*"]  # Allow all origins
    allow_headers = ["*"]  # Allow all headers in development
    print(f"✅ CORS configured for development/local with permissive settings")
    print(f"   - Environment: {environment}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=allow_headers,
    max_age=86400
)

# Add response compression middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Serve favicon to avoid 404 errors
@app.get("/favicon.ico")
async def favicon():
    """Return a simple redirect or empty response for favicon requests"""
    return Response(status_code=204)  # No Content

# Handle OPTIONS requests explicitly
# @app.options("/{path:path}")
# async def options_handler(path: str):
#     return {}

# Simple CORS test endpoint
@app.get("/api/cors-test")
async def cors_test():
    """Simple endpoint to test CORS configuration"""
    return {
        "success": True,
        "message": "CORS is working!",
        "timestamp": datetime.now().isoformat(),
        "cors_enabled": True
    }

# Test POST endpoint
@app.post("/api/test-post")
async def test_post():
    """Test POST endpoint"""
    return {"message": "Test POST works", "timestamp": datetime.now().isoformat()}

@app.get("/api/auth/test-token")
async def test_token(current_user: dict = Depends(get_current_user)):
    """Test endpoint to check if token parsing works"""
    if current_user:
        return {
            "success": True,
            "message": "Token parsed successfully",
            "user": current_user
        }
    else:
        return {
            "success": False,
            "message": "No token provided or token invalid"
        }

class ManualRefreshRequest(BaseModel):
    state_code: Optional[str] = None
    session_id: Optional[str] = None
    force_update: bool = False

@app.post("/api/updates/manual-refresh")
async def manual_refresh_endpoint(request: ManualRefreshRequest):
    """Manual refresh endpoint for updating bills"""
    try:
        logger.info(f"🔄 Manual refresh requested for state: {request.state_code}, session: {request.session_id}")
        
        return {
            "task_id": f"manual_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "message": "Manual refresh started",
            "estimated_duration": 300,
            "success": True
        }
    except Exception as e:
        logger.error(f"❌ Error in manual refresh: {e}")
        return {
            "success": False,
            "message": str(e)
        }



# ===============================
# ESSENTIAL ENDPOINT - THIS IS WHAT YOUR FRONTEND IS CALLING
# ===============================


@app.get("/api/executive-orders/check-count")
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
            "difference": new_orders_available,
            "new_orders_available": new_orders_available,
            "needs_fetch": needs_fetch,
            "has_updates": needs_fetch,  # Added for frontend compatibility
            "update_count": new_orders_available,  # Added for frontend compatibility
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



@app.post("/api/admin/load-legiscan-datasets")
async def load_legiscan_datasets_endpoint():
    """Load bills from LegiScan dataset directories"""
    import glob
    from load_legiscan_data import load_bill_from_json, insert_bills_batch
    
    try:
        data_dir = "/Users/david.anderson/Downloads/PoliticalVue/backend/data"
        results = {}
        total_inserted = 0
        
        # Process each state
        for state_dir in glob.glob(os.path.join(data_dir, "*")):
            if not os.path.isdir(state_dir):
                continue
                
            state_abbr = os.path.basename(state_dir).upper()
            if ' ' in state_abbr:
                state_abbr = state_abbr.split()[0]
            
            # Skip non-state directories
            if state_abbr in ['EXECUTIVE_ORDERS.DB', 'LEGISLATION.DB', '.DS_STORE']:
                continue
            
            print(f"Processing {state_abbr}...")
            
            # Find bill files
            bill_files = glob.glob(os.path.join(state_dir, "*/bill/*.json"))
            if not bill_files:
                bill_files = glob.glob(os.path.join(state_dir, "bill/*.json"))
            
            bills = []
            for bill_file in bill_files:
                bill = load_bill_from_json(bill_file, state_abbr)
                if bill:
                    bills.append(bill)
            
            if bills:
                inserted, skipped = insert_bills_batch(bills, state_abbr)
                total_inserted += inserted
                results[state_abbr] = {
                    "files_found": len(bill_files),
                    "bills_loaded": len(bills),
                    "inserted": inserted,
                    "skipped": skipped
                }
        
        return {
            "success": True,
            "total_inserted": total_inserted,
            "states_processed": results
        }
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return {"success": False, "error": str(e)}

@app.post("/api/admin/remove-duplicate-texas")
async def remove_duplicate_texas_endpoint():
    """Remove entries with state='Texas', keep only state='TX'"""
    try:
        print("🔧 Removing duplicate Texas entries...")
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Check current Texas distribution
            cursor.execute("SELECT state, COUNT(*) as count FROM dbo.state_legislation WHERE state IN ('Texas', 'TX') GROUP BY state")
            current_texas = cursor.fetchall()
            
            print("📊 Current Texas distribution:")
            for state, count in current_texas:
                print(f"   {state}: {count}")
            
            # Delete entries with state='Texas' (keep TX)
            delete_query = "DELETE FROM dbo.state_legislation WHERE state = 'Texas'"
            cursor.execute(delete_query)
            deleted_count = cursor.rowcount
            
            print(f"🗑️ Deleted {deleted_count} 'Texas' entries")
            
            conn.commit()
            
            # Check final distribution
            cursor.execute("SELECT state, COUNT(*) as count FROM dbo.state_legislation WHERE state IN ('Texas', 'TX') GROUP BY state")
            final_texas = cursor.fetchall()
            
            print("📊 Final Texas distribution:")
            for state, count in final_texas:
                print(f"   {state}: {count}")
            
            return {
                "success": True,
                "message": f"Successfully removed {deleted_count} duplicate 'Texas' entries",
                "before": dict(current_texas),
                "after": dict(final_texas),
                "deleted_count": deleted_count
            }
            
    except Exception as e:
        print(f"❌ Error removing duplicate Texas entries: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.get("/api/debug/database-msi")
async def debug_database_msi_connection():
    """Debug endpoint for testing MSI database connection (with caching)"""

    # Check cache first
    cache_key = "debug_msi"
    current_time = time.time()
    if cache_key not in _health_check_cache:
        _health_check_cache[cache_key] = {"result": None, "timestamp": 0}

    msi_cache = _health_check_cache[cache_key]
    if msi_cache["result"] is not None and (current_time - msi_cache["timestamp"]) < HEALTH_CHECK_CACHE_TTL:
        print("✅ Using cached MSI debug status")
        return msi_cache["result"]

    try:
        # Environment check
        raw_env = os.getenv("ENVIRONMENT", "development")
        environment = "production" if raw_env == "production" or bool(os.getenv("CONTAINER_APP_NAME") or os.getenv("MSI_ENDPOINT")) else "development"

        log_output = []

        log_output.append(f"🔍 Environment: {environment}")
        log_output.append(f"🔍 Testing Azure SQL connection via MSI authentication...")
        log_output.append(f"🔍 Container indicators: CONTAINER_APP_NAME={os.getenv('CONTAINER_APP_NAME', 'Not set')}")
        log_output.append(f"🔍 MSI indicator: MSI_ENDPOINT={os.getenv('MSI_ENDPOINT', 'Not set')}")
        
        # Connection parameters
        server = os.getenv('AZURE_SQL_SERVER', 'sql-legislation-tracker.database.windows.net')
        database = os.getenv('AZURE_SQL_DATABASE', 'db-executiveorders')
        
        log_output.append(f"📊 Connection details:")
        log_output.append(f"   Server: {server}")
        log_output.append(f"   Database: {database}")
        log_output.append(f"   Authentication: MSI (System-assigned)")
        
        # Build proper pyodbc connection string for MSI
        connection_string = (
            "Driver={ODBC Driver 18 for SQL Server};"
            f"Server=tcp:{server},1433;"
            f"Database={database};"
            "Authentication=ActiveDirectoryMSI;"
            "Encrypt=yes;"
            "TrustServerCertificate=no;"
            "Connection Timeout=30;"
        )
        
        log_output.append(f"🔗 Connection string: {connection_string}")
        
        # Try to connect
        log_output.append("🔄 Attempting to connect...")
        conn = pyodbc.connect(connection_string)
        
        # Test basic query
        cursor = conn.cursor()
        log_output.append("🔍 Executing test query: SELECT 1 as test_column")
        cursor.execute("SELECT 1 as test_column")
        row = cursor.fetchone()
        
        if row and row[0] == 1:
            log_output.append("✅ Connection successful! Query returned: 1")
            
            # Test table access
            try:
                log_output.append("🔍 Testing table access...")
                # Try accessing various tables to help debug
                tables_to_test = ['user_highlights', 'state_legislation', 'executive_orders', 'sys.tables']
                
                for table in tables_to_test:
                    try:
                        if table == 'sys.tables':
                            cursor.execute("SELECT TOP 5 name FROM sys.tables")
                        else:
                            cursor.execute(f"SELECT TOP 1 * FROM {table}")
                            
                        columns = [column[0] for column in cursor.description]
                        log_output.append(f"✅ Table '{table}' access successful! Found columns: {', '.join(columns)}")
                    except Exception as table_error:
                        log_output.append(f"⚠️ Table '{table}' access failed: {str(table_error)}")
            except Exception as table_error:
                log_output.append(f"⚠️ Table access test failed: {str(table_error)}")
                
            # Get MSI principal info if possible
            try:
                cursor.execute("SELECT SUSER_SNAME()")
                user = cursor.fetchone()
                log_output.append(f"👤 Connected as: {user[0] if user else 'Unknown'}")
            except:
                log_output.append("⚠️ Could not determine connected user")
                
            conn.close()
            success = True
        else:
            log_output.append("❌ Query didn't return expected result")
            success = False
            
    except Exception as e:
        log_output.append(f"❌ Connection failed: {str(e)}")
        log_output.append(f"Error type: {type(e).__name__}")
        
        # Additional debugging for connection errors
        if "ActiveDirectoryMSI" in str(e):
            log_output.append("🔍 MSI authentication error detected!")
            log_output.append("👉 Make sure system-assigned identity is enabled on your container app")
            log_output.append("👉 Make sure identity has access to SQL Database")
            log_output.append("👉 Double-check you've added the MSI as a user in SQL Database")
        
        success = False

    # Cache the result
    result = {
        "success": success,
        "logs": log_output,
        "timestamp": datetime.now().isoformat(),
        "environment": environment
    }
    _health_check_cache[cache_key] = {"result": result, "timestamp": current_time}

    return result


@app.get("/api/debug/connectivity")
async def debug_connectivity(request: Request):
    """Debug endpoint for testing frontend-backend connectivity"""
    try:
        # Gather system information
        environment = "production" if os.getenv("ENVIRONMENT") == "production" or bool(os.getenv("CONTAINER_APP_NAME")) else "development"
        
        # Database connection test
        db_connection_working = False
        try:
            db_connection_working = test_database_connection()
        except:
            pass
            
        return {
            "success": True,
            "backend_reachable": True,
            "timestamp": datetime.now().isoformat(),
            "environment": environment,
            "system_info": {
                "hostname": os.getenv("HOSTNAME", "Unknown"),
                "container_app_name": os.getenv("CONTAINER_APP_NAME", "Not running in container app"),
                "python_version": os.getenv("PYTHON_VERSION", "Unknown"),
                "database_connection": "Working" if db_connection_working else "Not working"
            },
            "request_info": {
                "headers": dict(request.headers),
                "client_host": request.client.host,
                "url": str(request.url)
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }



@app.post("/api/executive-orders/fetch")
async def fetch_executive_orders_endpoint(request: ExecutiveOrderFetchRequest):
    """
    Endpoint for executive orders fetch - redirects to the simple integration endpoint
    This endpoint is needed by the frontend
    """
    try:
        logger.info(f"🔄 Received request to /api/executive-orders/fetch - redirecting to simple integration")
        
        # Simply call the simple integration endpoint
        result = await fetch_executive_orders_simple_endpoint(request)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error in executive orders fetch endpoint: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch executive orders: {str(e)}"
        )


#@app.post("/api/fetch-executive-orders-simple")
#async def fetch_executive_orders_simple_endpoint(request: ExecutiveOrderFetchRequest):
#    """
#    ESSENTIAL ENDPOINT: Fetch executive orders from Federal Register API with AI processing
#    This is the endpoint your frontend is calling!
#    """
#    try:
#        logger.info(f"🚀 Starting executive orders fetch via Federal Register API")
#        logger.info(f"📋 Request: {request.dict()}")
#        
#        if not SIMPLE_EO_AVAILABLE:
#            raise HTTPException(
#                status_code=503,
#                detail="Simple Executive Orders API not available"
#            )
#        
#        # Call your integration function
#        result = await fetch_executive_orders_simple_integration(
#            start_date=request.start_date,
#            end_date=request.end_date,
#            with_ai=request.with_ai,
#            limit=None,  # No limit to get all orders
#            save_to_db=request.save_to_db
#        )
#        
#        logger.info(f"📊 Fetch result: {result.get('count', 0)} orders")
#        
#        if result.get('success'):
#            return {
#                "success": True,
#                "results": result.get('results', []),
#                "count": result.get('count', 0),
#                "orders_saved": result.get('orders_saved', 0),
#                "total_found": result.get('total_found', 0),
#                "ai_successful": result.get('ai_successful', 0),
#                "ai_failed": result.get('ai_failed', 0),
#                "message": result.get('message', 'Executive orders fetched successfully'),
#                "date_range_used": result.get('date_range_used'),
#                "method": "federal_register_api_direct"
#            }
#        else:
#            raise HTTPException(
#                status_code=500,
#                detail=result.get('error', 'Unknown error occurred')
#            )
#            
#    except HTTPException:
#        raise
#    except Exception as e:
#        logger.error(f"❌ Error in executive orders fetch endpoint: {e}")
#        raise HTTPException(
#            status_code=500,
#            detail=f"Failed to fetch executive orders: {str(e)}"
#        )
# Supported states
#SUPPORTED_STATES = {
#    "California": "CA",
#    "Colorado": "CO",
#    "Kentucky": "KY", 
#    "Nevada": "NV",
#    "South Carolina": "SC",
#    "Texas": "TX",
#}

#@app.get("/")
#async def root():
#    """Health check endpoint"""
#    
#    # Test database connections
#    if AZURE_SQL_AVAILABLE:
#        db_working = test_azure_sql_connection()
#        db_type = "Azure SQL Database"
#    else:
#        db_working = False
#        db_type = "Not Available"
#    
#    return {
#        "message": "LegislationVue API with Azure SQL Integration",
#        "status": "healthy",
#        "version": "13.0.0-Azure-SQL-Integration",
#        "timestamp": datetime.now().isoformat(),
#        "database": {
#            "status": "connected" if db_working else "issues",
#            "type": db_type,
#            "azure_sql_available": AZURE_SQL_AVAILABLE
#        },
#        "integrations": {
#            "simple_executive_orders": "available" if SIMPLE_EO_AVAILABLE else "not_available",
#            "executive_orders_integration": "azure_sql_based" if EXECUTIVE_ORDERS_AVAILABLE else "not_available"
#        },
#        "supported_states": list(SUPPORTED_STATES.keys())
#    }

 # ===============================
# REVIEW STATUS API ENDPOINTS  
# ===============================

@app.patch("/api/state-legislation/{id}/review")
async def update_state_legislation_review_status(
    id: str,
    request: ReviewStatusRequest
):
    """Update review status for state legislation"""
    try:
        reviewed = request.reviewed
        
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
                cursor.execute(query, (param,))
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
        update_query = "UPDATE state_legislation SET reviewed = %s WHERE id = %s"
        cursor.execute(update_query, (reviewed, found_record_id))
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

@app.patch("/api/state-legislation/{id}/category")
async def update_state_legislation_category(
    id: str,
    request: dict
):
    """Update category for state legislation"""
    try:
        logger.info(f"🔍 CATEGORY ENDPOINT CALLED: ID={id}, Request={request}")
        
        category = request.get('category', 'civic')
        
        # Validate category
        valid_categories = ['civic', 'education', 'engineering', 'healthcare', 'not-applicable', 'all', 'all_practice_areas']
        if category not in valid_categories:
            raise HTTPException(status_code=400, detail=f"Invalid category. Must be one of: {valid_categories}")
        
        logger.info(f"🔍 BACKEND: Updating state legislation category - ID: {id}, category: {category}")
        
        conn = get_azure_sql_connection()
        if not conn:
            raise HTTPException(status_code=503, detail="Database connection failed")
        
        cursor = conn.cursor()
        
        # Try to find the record multiple ways (similar to review status endpoint)
        search_attempts = [
            ("Direct ID match", "SELECT id FROM dbo.state_legislation WHERE id = ?", id),
            ("Direct bill_id match", "SELECT id FROM dbo.state_legislation WHERE bill_id = ?", id),
            ("String ID match", "SELECT id FROM dbo.state_legislation WHERE CAST(id AS VARCHAR) = ?", str(id)),
            ("String bill_id match", "SELECT id FROM dbo.state_legislation WHERE CAST(bill_id AS VARCHAR) = ?", str(id))
        ]
        
        found_record_id = None
        for attempt_name, query, param in search_attempts:
            try:
                logger.info(f"🔍 BACKEND: Trying {attempt_name} with param: {param}")
                logger.info(f"🔍 BACKEND: Query: {query}")
                cursor.execute(query, (param,))
                result = cursor.fetchone()
                if result:
                    found_record_id = result[0]
                    logger.info(f"✅ BACKEND: Found record with {attempt_name}, database ID: {found_record_id}")
                    break
                else:
                    logger.info(f"❌ BACKEND: No match with {attempt_name}")
            except Exception as e:
                logger.error(f"❌ BACKEND: Error with {attempt_name}: {e}")
        
        if not found_record_id:
            logger.error(f"❌ BACKEND: Could not find any record for ID: {id}")
            conn.close()
            raise HTTPException(status_code=404, detail=f"State legislation not found for ID: {id}")
        
        # Update the record
        update_query = "UPDATE dbo.state_legislation SET category = ? WHERE id = ?"
        cursor.execute(update_query, (category, found_record_id))
        rows_affected = cursor.rowcount
        
        logger.info(f"🔍 BACKEND: Updated {rows_affected} rows")
        
        if rows_affected == 0:
            conn.close()
            raise HTTPException(status_code=404, detail="No rows were updated")
        
        conn.commit()
        conn.close()
        
        logger.info(f"✅ BACKEND: Successfully updated record {found_record_id}")
        
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

@app.patch("/api/test-patch/{id}")
async def test_patch(id: str):
    return {"test": "patch works", "id": id}

# ===============================
# EXECUTIVE ORDERS DATABASE FUNCTIONS
# ===============================

def get_executive_orders_from_db(limit=1000, offset=0, filters=None):
    """Get executive orders - redirect to working version in executive_orders_db.py"""
    try:
        # Import the working version from executive_orders_db
        from executive_orders_db import get_executive_orders_from_db as working_version
        return working_version(limit=limit, offset=offset, filters=filters)
    except Exception as e:
        print(f"❌ DEBUG: Error redirecting to working version: {e}")
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
                'session_id': order.get('session_id', '2025'),
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
        # Executive orders should NOT use save_legislation_to_azure_sql as it saves to wrong table
        # They should use their own executive orders save function
        from executive_orders_db import save_executive_orders_to_db as eo_save_func
        return eo_save_func(cleaned_orders)
        
    except Exception as e:
        print(f"❌ Error saving executive orders: {e}")
        import traceback
        traceback.print_exc()
        return 0




#        def save_executive_orders_to_db(orders):
#            """Save executive orders using existing save_legislation_to_db - FIXED VERSION"""
#            try:
#                # Clean the orders data to match StateLegislationDB schema
#                cleaned_orders = []
#                
#                for order in orders:
#                    # Remove invalid fields and map to correct schema
#                    cleaned_order = {
#                        'bill_id': order.get('bill_id', f"eo-{order.get('bill_number', 'unknown')}"),
#                        'bill_number': order.get('bill_number', ''),
#                        'title': order.get('title', ''),
#                        'description': order.get('description', ''),
#                        'state': order.get('state', 'Federal'),
#                        'state_abbr': order.get('state_abbr', 'US'),
#                        'status': order.get('status', 'Signed'),
#                        'category': order.get('category', 'civic'),
#                        'introduced_date': order.get('introduced_date', ''),
#                        'last_action_date': order.get('last_action_date', ''),  # ✅ Use last_action_date, not last_action
#                        'session_id': order.get('session_id', '2025'),
#                        'session_name': order.get('session_name', 'Trump 2025 Administration'),
#                        'bill_type': order.get('bill_type', 'executive_order'),
#                        'body': order.get('body', 'executive'),
#                        'legiscan_url': order.get('legiscan_url', ''),
#                        'pdf_url': order.get('pdf_url', ''),
#                        'ai_summary': order.get('ai_summary', ''),
#                        'ai_executive_summary': order.get('ai_executive_summary', ''),
#                        'ai_talking_points': order.get('ai_talking_points', ''),
#                        'ai_key_points': order.get('ai_key_points', ''),
#                        'ai_business_impact': order.get('ai_business_impact', ''),
#                        'ai_potential_impact': order.get('ai_potential_impact', ''),
#                        'ai_version': order.get('ai_version', 'simple_eo_v1'),
#                        'created_at': order.get('created_at', datetime.now().strftime('%Y-%m-%d %H:%M:%S')),
#                        'last_updated': order.get('last_updated', datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
#                    }
#                    
#                    cleaned_orders.append(cleaned_order)
#                
#                print(f"🔍 Saving {len(cleaned_orders)} executive orders (cleaned data)")
#                return save_legislation_to_db(cleaned_orders)
#                
#            except Exception as e:
#                print(f"❌ Error saving executive orders: {e}")
#                import traceback
#                traceback.print_exc()
#                return 0
#



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
            'session_id': '2025',
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
# LEGISCAN CONFIGURATION ENDPOINTS
# ===============================

@app.get("/api/legiscan/config")
async def get_legiscan_config():
    """Get current LegiScan API configuration"""
    return {
        "success": True,
        "config": {
            "default_limit": 100,
            "default_year_filter": "all",
            "default_max_pages": 5,
            "enable_pagination": True,
            "rate_limit_delay": 1.1,
            "year_filter_options": [
                {"value": "all", "label": "All Years", "description": "Fetch bills from all available years (recommended)"},
                {"value": "current", "label": "Current Year", "description": "Only bills from current year (2025)"},
                {"value": "recent", "label": "Recent Years", "description": "Bills from recent years"}
            ],
            "description": "LegiScan API configuration for enhanced bill searching with pagination and year filtering"
        }
    }

@app.post("/api/legiscan/config")
async def update_legiscan_config(request: LegiScanConfigRequest):
    """Update LegiScan API configuration (for future enhancement)"""
    # For now, just return the requested configuration
    # In the future, this could save to a configuration file or database
    return {
        "success": True,
        "message": "Configuration updated successfully",
        "config": request.dict()
    }

@app.post("/api/legiscan/session-status")
async def get_session_status(request: Dict[str, Any]):
    """Get active legislative session status for specified states"""
    try:
        states = request.get("states", [])
        include_all_sessions = request.get("include_all_sessions", False)
        
        print(f"🔍 Session status request: states={states}, include_all={include_all_sessions}")
        
        if not states:
            return {
                "success": False,
                "error": "No states specified"
            }
        
        # Initialize LegiScan client if available
        if not LEGISCAN_AVAILABLE:
            return {
                "success": False,
                "error": "LegiScan API not available"
            }
        
        print(f"🔍 LEGISCAN_AVAILABLE: {LEGISCAN_AVAILABLE}")
        active_sessions = {}
        
        # Use the existing check_active_sessions method
        try:
            legiscan_client = EnhancedLegiScanClient()
            sessions_result = await legiscan_client.check_active_sessions(states)
            
            print(f"🔍 check_active_sessions result: {sessions_result}")
            
            if sessions_result.get('success'):
                active_sessions_data = sessions_result.get('active_sessions', {})
                
                # Filter based on include_all_sessions flag if needed
                if include_all_sessions:
                    active_sessions = active_sessions_data
                else:
                    # Filter for current year only
                    current_year = datetime.now().year
                    for state, state_sessions in active_sessions_data.items():
                        filtered_sessions = []
                        for session in state_sessions:
                            year_start = session.get('year_start', 0)
                            year_end = session.get('year_end', 0)
                            if year_start == current_year or (year_end and year_end >= current_year):
                                filtered_sessions.append(session)
                        if filtered_sessions:
                            active_sessions[state] = filtered_sessions
            else:
                print(f"❌ check_active_sessions failed: {sessions_result.get('error')}")
                        
        except Exception as e:
            print(f"Error checking sessions: {e}")
            import traceback
            traceback.print_exc()
        
        return {
            "success": True,
            "active_sessions": active_sessions,
            "states_checked": states
        }
        
    except Exception as e:
        print(f"Session status error: {e}")
        return {
            "success": False,
            "error": str(e)
        }

    # ===============================
# ADDITIONAL EXECUTIVE ORDER ENDPOINTS
# ===============================

@app.post("/api/executive-orders/run-pipeline")
async def run_executive_orders_pipeline():
    """Run the complete executive orders pipeline"""
    try:
        logger.info("🚀 Starting Executive Orders Pipeline")
        
        # Lazy load executive orders module only when needed
        if not load_executive_orders_module():
            return {
                "success": False,
                "message": "Executive Orders API not available"
            }
        
        # Use the updated integration function
        result = await fetch_executive_orders_simple_integration(
            period="inauguration",  # Since inauguration
            with_ai=True,
            limit=None  # No limit
        )
        
        if not result.get('success'):
            logger.warning(f"⚠️ Pipeline failed: {result.get('error', 'Unknown error')}")
            return {
                "success": False,
                "message": result.get('error', 'Pipeline failed')
            }
        
        orders = result.get('results', [])
        logger.info(f"📥 Pipeline retrieved {len(orders)} executive orders")
        
        # Transform orders for database save
        if orders and EXECUTIVE_ORDERS_AVAILABLE:
            try:
                transformed_orders = transform_orders_for_save(orders)
                saved_count = save_executive_orders_to_db(transformed_orders)
                
                return {
                    "success": True,
                    "message": f"Pipeline completed successfully",
                    "orders_fetched": len(orders),
                    "orders_saved": saved_count,
                    "ai_analysis": result.get('ai_analysis_enabled', False),
                    "date_range": result.get('date_range_used', 'Unknown'),
                    "api_response_count": result.get('api_response_count', 0),
                    "pipeline_type": "federal_register_direct_api"
                }
                
            except Exception as save_error:
                logger.error(f"❌ Error saving to database: {save_error}")
                return {
                    "success": False,
                    "message": f"Pipeline fetch succeeded but database save failed: {str(save_error)}"
                }
        else:
            return {
                "success": True if orders else False,
                "message": f"Pipeline completed - found {len(orders)} orders but database not available",
                "orders_fetched": len(orders),
                "orders_saved": 0
            }
            
    except Exception as e:
        logger.error(f"❌ Error in pipeline: {e}")
        return {
            "success": False,
            "message": str(e)
        }


@app.post("/api/executive-orders/quick-pipeline")
async def quick_executive_orders_pipeline():
    """Quick pipeline with limited orders"""
    try:
        logger.info("⚡ Starting Quick Executive Orders Pipeline")
        
        # Lazy load executive orders module only when needed
        if not load_executive_orders_module():
            return {
                "success": False,
                "message": "Executive Orders API not available"
            }
        
        # Quick fetch with limit
        result = await fetch_executive_orders_simple_integration(
            period="last_30_days",  # Last 30 days
            with_ai=True,
            limit=25  # Limited for quick processing
        )
        
        if not result.get('success'):
            return {
                "success": False,
                "message": result.get('error', 'Quick pipeline failed')
            }
        
        orders = result.get('results', [])
        
        # Save to database if available
        saved_count = 0
        if orders and EXECUTIVE_ORDERS_AVAILABLE:
            try:
                transformed_orders = transform_orders_for_save(orders)
                saved_count = save_executive_orders_to_db(transformed_orders)
            except Exception as save_error:
                logger.warning(f"⚠️ Quick pipeline save error: {save_error}")
        
        return {
            "success": True,
            "message": f"Quick pipeline completed",
            "orders_fetched": len(orders),
            "orders_saved": saved_count,
            "ai_analysis": result.get('ai_analysis_enabled', False),
            "date_range": result.get('date_range_used', 'Last 30 days'),
            "pipeline_type": "quick_federal_register"
        }
        
    except Exception as e:
        logger.error(f"❌ Error in quick pipeline: {e}")
        return {
            "success": False,
            "message": str(e)
        }


@app.post("/api/executive-orders/check-new-orders")
async def check_for_new_executive_orders():
    """
    Check Federal Register for new executive orders, process with AI, and save to database
    This is the endpoint called by the 'Check for New Orders' button
    """
    try:
        logger.info("🚀 Starting check for new executive orders")
        
        # Lazy load executive orders module only when needed
        if not load_executive_orders_module():
            return {
                "success": False,
                "message": "Executive Orders API not available"
            }
        
        # Get current database count
        db_count = await get_database_count()
        logger.info(f"📊 Database currently has {db_count} executive orders")
        
        # Get Federal Register count
        federal_count = await get_federal_register_count()
        logger.info(f"📊 Federal Register has {federal_count} executive orders")
        
        new_orders_available = max(0, federal_count - db_count)
        
        if new_orders_available == 0:
            return {
                "success": True,
                "message": "No new executive orders found",
                "new_orders_count": 0,
                "database_count": db_count,
                "federal_register_count": federal_count
            }
        
        logger.info(f"🆕 Found {new_orders_available} new executive orders to fetch")
        
        # Fetch new orders using the existing pipeline
        result = await fetch_executive_orders_simple_integration(
            period="recent",  # Get recent orders
            with_ai=True,     # Process with AI
            limit=None        # No limit to get all available
        )
        
        if not result.get('success'):
            return {
                "success": False,
                "message": f"Failed to fetch new orders: {result.get('message', 'Unknown error')}"
            }
        
        orders = result.get('results', [])
        logger.info(f"📥 Retrieved {len(orders)} orders from Federal Register")
        
        # Save new orders to database
        saved_count = 0
        if orders and EXECUTIVE_ORDERS_AVAILABLE:
            try:
                transformed_orders = transform_orders_for_save(orders)
                saved_count = save_executive_orders_to_db(transformed_orders)
                logger.info(f"💾 Saved {saved_count} new orders to database")
            except Exception as save_error:
                logger.error(f"❌ Error saving orders: {save_error}")
                return {
                    "success": False,
                    "message": f"Failed to save new orders: {str(save_error)}"
                }
        
        return {
            "success": True,
            "message": f"Successfully found and processed {saved_count} new executive orders",
            "new_orders_count": saved_count,
            "orders_fetched": len(orders),
            "database_count_before": db_count,
            "federal_register_count": federal_count,
            "ai_processing_enabled": True
        }
        
    except Exception as e:
        logger.error(f"❌ Error checking for new executive orders: {e}")
        return {
            "success": False,
            "message": f"Error checking for new orders: {str(e)}"
        }


@app.post("/api/fetch-executive-orders")
async def legacy_fetch_executive_orders(request: ExecutiveOrderFetchRequest):
    """Legacy endpoint for backward compatibility"""
    try:
        logger.info("🔄 Legacy fetch executive orders endpoint - calling simple integration")
        
        # Call the main implementation with the request
        result = await fetch_executive_orders_simple_endpoint(request)
        return result
        
    except Exception as e:
        logger.error(f"❌ Error in legacy fetch: {e}")
        return {
            "success": False,
            "message": str(e)
        }




@app.get("/api/task-status/{task_id}")
async def get_task_status(task_id: str):
    """Get the status of a manual refresh task"""
    try:
        # Check progress tracker first
        task_status = progress_tracker.get_task_status(task_id)
        if task_status:
            return task_status
        
        # Fallback to simple response
        return {
            "task_id": task_id,
            "status": "completed",
            "start_time": datetime.now().isoformat(),
            "end_time": datetime.now().isoformat(),
            "bills_updated": 0,
            "bills_added": 0,
            "error_message": None
        }
    except Exception as e:
        logger.error(f"❌ Error getting task status: {e}")
        return {
            "task_id": task_id,
            "status": "failed",
            "error_message": str(e)
        }

@app.get("/api/fetch-progress")
async def get_fetch_progress():
    """Get progress of all active fetch operations"""
    try:
        active_tasks = progress_tracker.get_all_active_tasks()
        
        # Also check database for current bill counts to show progress
        bill_counts = {}
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT 
                        state,
                        session_name,
                        COUNT(*) as count
                    FROM dbo.state_legislation 
                    WHERE state IN ('TX', 'CA', 'CO', 'KY', 'NV', 'SC')
                    GROUP BY state, session_name
                    ORDER BY state, count DESC
                ''')
                
                for state, session, count in cursor.fetchall():
                    if state not in bill_counts:
                        bill_counts[state] = {}
                    bill_counts[state][session] = count
        except Exception as e:
            logger.error(f"Error getting bill counts: {e}")
        
        return {
            "active_tasks": active_tasks,
            "current_bill_counts": bill_counts,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"❌ Error getting fetch progress: {e}")
        return {
            "active_tasks": {},
            "current_bill_counts": {},
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.get("/api/fetch-progress/{state}")
async def get_state_fetch_progress(state: str):
    """Get detailed fetch progress for a specific state"""
    try:
        state_upper = state.upper()
        
        # Get current bill counts for the state
        bill_counts = {}
        total_bills = 0
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT 
                    session_name,
                    COUNT(*) as count,
                    MIN(last_updated) as oldest_update,
                    MAX(last_updated) as newest_update
                FROM dbo.state_legislation 
                WHERE state = ?
                GROUP BY session_name
                ORDER BY count DESC
            ''', (state_upper,))
            
            for session, count, oldest, newest in cursor.fetchall():
                bill_counts[session] = {
                    'count': count,
                    'oldest_update': oldest.isoformat() if oldest else None,
                    'newest_update': newest.isoformat() if newest else None
                }
                total_bills += count
        
        # Get any active tasks for this state
        active_tasks = progress_tracker.get_all_active_tasks()
        state_tasks = {k: v for k, v in active_tasks.items() if state_upper in k or state.lower() in k}
        
        return {
            "state": state_upper,
            "total_bills": total_bills,
            "sessions": bill_counts,
            "active_tasks": state_tasks,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Error getting state fetch progress: {e}")
        return {
            "state": state_upper,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }


#@app.post("/api/fetch-executive-orders")
#async def legacy_fetch_executive_orders():
#    """Legacy endpoint for backward compatibility"""
#    try:
#        logger.info("🔄 Legacy fetch executive orders endpoint")
#        
#        # Call the main pipeline
#        result = await run_executive_orders_pipeline()
#        
#        return result
#        
#    except Exception as e:
#        logger.error(f"❌ Error in legacy fetch: {e}")
#        return {
#            "success": False,
#            "message": str(e)
#        }
# ===============================
# HIGHLIGHTS FUNCTIONS
# ===============================

def get_azure_sql_connection():
    """Get database connection using new multi-database support"""
    # This returns the actual connection object for backward compatibility
    # TODO: Update all calling code to use context managers properly
    from database_config import get_database_config
    import pyodbc
    import os
    
    config = get_database_config()
    
    # Azure SQL connection using pyodbc
    is_container = bool(os.getenv("CONTAINER_APP_NAME") or os.getenv("MSI_ENDPOINT"))
    
    if is_container:
        # Use MSI authentication in production
        connection_string = (
            "Driver={ODBC Driver 18 for SQL Server};"
            f"Server=tcp:{config['server']},1433;"
            f"Database={config['database']};"
            "Authentication=ActiveDirectoryMSI;"
            "Encrypt=yes;"
            "TrustServerCertificate=no;"
            "Connection Timeout=30;"
        )
    else:
        # Use SQL authentication for local development
        if not config.get('username') or not config.get('password'):
            raise ValueError("SQL credentials required for local development")
        connection_string = (
            "Driver={ODBC Driver 18 for SQL Server};"
            f"Server=tcp:{config['server']},1433;"
            f"Database={config['database']};"
            f"UID={config['username']};"
            f"PWD={config['password']};"
            "Encrypt=yes;"
            "TrustServerCertificate=no;"
            "Connection Timeout=30;"
        )
    
    conn = pyodbc.connect(connection_string, timeout=30)
    conn.autocommit = False
    return conn

def create_highlights_table():
    """Create the user highlights table"""
    try:
        conn = get_azure_sql_connection()
        if not conn:
            return False
            
        cursor = conn.cursor()
        
        from database_config import get_database_config
        config = get_database_config()
        is_postgresql = config['type'] == 'postgresql'
        
        if is_postgresql:
            create_table_sql = """
            CREATE TABLE IF NOT EXISTS user_highlights (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(50) NOT NULL,
                order_id VARCHAR(100) NOT NULL,
                order_type VARCHAR(50) NOT NULL,
                title TEXT,
                description TEXT,
                ai_summary TEXT,
                category VARCHAR(50),
                state VARCHAR(50),
                signing_date VARCHAR(50),
                html_url VARCHAR(500),
                pdf_url VARCHAR(500),
                legiscan_url VARCHAR(500),
                highlighted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                notes TEXT,
                priority_level INT DEFAULT 1,
                tags TEXT,
                is_archived BOOLEAN DEFAULT FALSE,
                CONSTRAINT UQ_user_highlight UNIQUE (user_id, order_id, order_type)
            );
            """
        else:
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
                highlighted_at DATETIME DEFAULT GETDATE(),
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
        SELECT id FROM dbo.user_highlights 
        WHERE user_id = ? AND order_id = ? AND order_type = ? AND is_archived = 0
        """
        cursor.execute(check_query, (user_id, order_id, order_type))
        existing = cursor.fetchone()
        
        if existing:
            print(f"ℹ️ Highlight already exists for {order_id}")
            conn.close()
            return True
        
        # Insert new highlight with item data
        insert_query = """
        INSERT INTO dbo.user_highlights (
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
            0      # is_archived (0 = False for SQL Server bit type)
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
            DELETE FROM dbo.user_highlights 
            WHERE user_id = ? AND order_id = ? AND order_type = ?
            """
            cursor.execute(delete_query, (user_id, order_id, order_type))
        else:
            delete_query = """
            DELETE FROM dbo.user_highlights 
            WHERE user_id = ? AND order_id = ?
            """
            cursor.execute(delete_query, (user_id, order_id))
        
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

#def get_user_highlights_direct(user_id: str) -> List[Dict]:
#    """Get all highlights for a user"""
#    try:
#        conn = get_azure_sql_connection()
#        if not conn:
#            return []
#            
#        cursor = conn.cursor()
#        
#        query = """
#        SELECT order_id, order_type, title, description, ai_summary, category, 
#               state, signing_date, html_url, pdf_url, legiscan_url, 
#               highlighted_at, notes, priority_level
#        FROM user_highlights 
#        WHERE user_id = %s AND is_archived = 0
#        ORDER BY highlighted_at DESC
#        """
#        
#        cursor.execute(query, user_id)
#        highlights = cursor.fetchall()
#        
#        results = []
#        for highlight in highlights:
#            (order_id, order_type, title, description, ai_summary, category, 
#             state, signing_date, html_url, pdf_url, legiscan_url, 
#             highlighted_at, notes, priority_level) = highlight
#            
#            result = {
#                'order_id': order_id,
#                'order_type': order_type,
#                'title': title or f'{order_type.replace("_", " ").title()} {order_id}',
#                'description': description or '',
#                'ai_summary': ai_summary or '',
#                'category': category or '',
#                'state': state or '',
#                'signing_date': signing_date or '',
#                'html_url': html_url or '',
#                'pdf_url': pdf_url or '',
#                'legiscan_url': legiscan_url or '',
#                'highlighted_at': highlighted_at.isoformat() if highlighted_at else None,
#                'notes': notes or '',
#                'priority_level': priority_level or 1
#            }
#            results.append(result)
#        
#        conn.close()
#        return results
#        
#    except Exception as e:
#        print(f"❌ Error getting user highlights: {e}")
#        return []

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
    """Get state legislation from database (works with both PostgreSQL and Azure SQL)"""
    try:
        print(f"🔍 DEBUG: Getting state legislation - limit={limit}, offset={offset}, filters={filters}")
        
        # Determine database type and parameter placeholder
        from database_config import get_database_config
        config = get_database_config()
        is_postgresql = config['type'] == 'postgresql'
        param_placeholder = '%s' if is_postgresql else '?'
        
        # Build SQL query for state legislation - adjust table name for database type
        table_name = "state_legislation" if is_postgresql else "dbo.state_legislation"
        base_query = f"""
        SELECT 
            id, bill_id, bill_number, title, description, state, state_abbr,
            status, category, introduced_date, last_action_date, session_id,
            session_name, bill_type, body, legiscan_url, pdf_url,
            ai_summary, ai_executive_summary, ai_talking_points, ai_key_points,
            ai_business_impact, ai_potential_impact, ai_version,
            created_at, last_updated, reviewed
        FROM {table_name}
        """
        
        # Add WHERE clause if filters exist
        where_conditions = []
        params = []
        
        if filters:
            if filters.get('state'):
                # Handle both state abbreviations and full names
                state_value = filters['state']
                where_conditions.append(f"(state = {param_placeholder} OR state_abbr = {param_placeholder} OR state LIKE {param_placeholder})")
                params.extend([state_value, state_value, f"%{state_value}%"])
                print(f"🔍 DEBUG: Added state filter: {state_value}")
            
            if filters.get('category'):
                where_conditions.append(f"category = {param_placeholder}")
                params.append(filters['category'])
                print(f"🔍 DEBUG: Added category filter: {filters['category']}")
            
            if filters.get('search'):
                where_conditions.append(f"(title LIKE {param_placeholder} OR description LIKE {param_placeholder} OR ai_summary LIKE {param_placeholder})")
                search_term = f"%{filters['search']}%"
                params.extend([search_term, search_term, search_term])
                print(f"🔍 DEBUG: Added search filter: {search_term}")
        
        if where_conditions:
            base_query += " WHERE " + " AND ".join(where_conditions)
        
        # Add ORDER BY and pagination - different syntax for each database
        base_query += " ORDER BY last_updated DESC, created_at DESC"
        if is_postgresql:
            base_query += f" LIMIT {limit} OFFSET {offset}"
        else:
            base_query += f" OFFSET {offset} ROWS FETCH NEXT {limit} ROWS ONLY"
        
        print(f"🔍 DEBUG: Final SQL Query: \n        {base_query}")
        
        # Execute query
        conn = get_azure_sql_connection()
        if not conn:
            return {'success': False, 'message': 'No database connection', 'results': [], 'count': 0}
        
        cursor = conn.cursor()
        
        # Get total count
        count_query = f"SELECT COUNT(*) FROM {table_name}"
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
        print(f"🔍 DEBUG: Columns: {columns}")
        
        # Convert to API format
        results = []
        print(f"🔍 DEBUG: About to process {len(rows)} rows")
        for i, row in enumerate(rows):
            db_record = dict(zip(columns, row))
            
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
                'status': convert_status_to_text(db_record) if db_record.get('status') else 'Unknown',
                'category': db_record.get('category', 'not-applicable'),
                'session': db_record.get('session_name', ''),
                'session_name': db_record.get('session_name', ''),  # Add session_name field
                'session_id': db_record.get('session_id', ''),     # Add session_id field
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
            
            # Debug the final API record for first few items
            if i < 2:
                print(f"🔍 DEBUG: Final API record {i+1} status field: {repr(api_record.get('status'))}")
                print(f"🔍 DEBUG: All status-related fields in API record:")
                for key, value in api_record.items():
                    if 'status' in key.lower():
                        print(f"   {key}: {repr(value)}")
                
                # Debug session data (removed for production)
            
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

def save_bills_to_state_legislation_table(bills):
    """Save bills to the state_legislation table (not the legislation/executive_orders table)"""
    try:
        if not bills:
            return 0
            
        from database_config import get_db_connection
        with get_db_connection() as conn:
            cursor = conn.cursor()
            saved_count = 0
            
            for bill in bills:
                try:
                    # Standardize state names to abbreviations
                    state_name = bill.get('state', '')
                    state_abbr = bill.get('state_abbr', '')
                    
                    # Map full names to abbreviations
                    state_mappings = {
                        'Texas': 'TX', 'California': 'CA', 'Colorado': 'CO',
                        'Florida': 'FL', 'Kentucky': 'KY', 'Nevada': 'NV', 
                        'South Carolina': 'SC'
                    }
                    
                    # Use abbreviation for both fields
                    if state_name in state_mappings:
                        final_state = state_mappings[state_name]
                    elif state_abbr:
                        final_state = state_abbr
                    else:
                        final_state = state_name
                    
                    # Map bill data to state_legislation table columns
                    params = (
                        bill.get('bill_id', ''),
                        bill.get('bill_number', ''),
                        bill.get('title', ''),
                        bill.get('description', ''),
                        final_state,  # Use standardized state
                        final_state,  # Use same for state_abbr
                        bill.get('status', ''),
                        bill.get('category', 'not-applicable'),
                        bill.get('introduced_date', ''),
                        bill.get('last_action_date', ''),
                        bill.get('session_id', ''),
                        bill.get('session_name', ''),
                        bill.get('bill_type', ''),
                        bill.get('body', ''),
                        bill.get('legiscan_url', ''),
                        bill.get('pdf_url', ''),
                        bill.get('ai_summary', ''),
                        bill.get('ai_executive_summary', ''),
                        bill.get('ai_talking_points', ''),
                        bill.get('ai_key_points', ''),
                        bill.get('ai_business_impact', ''),
                        bill.get('ai_potential_impact', ''),
                        bill.get('ai_version', ''),
                        bill.get('legiscan_status', '')
                    )
                    
                    # Use MERGE to avoid duplicates - convert bill_id to string for comparison
                    merge_sql = """
                    MERGE dbo.state_legislation AS target
                    USING (SELECT CAST(? as NVARCHAR(50)) as bill_id) AS source
                    ON (target.bill_id = source.bill_id)
                    WHEN MATCHED THEN
                        UPDATE SET 
                            bill_number = ?,
                            title = ?,
                            description = ?,
                            state = ?,
                            state_abbr = ?,
                            status = ?,
                            category = ?,
                            introduced_date = ?,
                            last_action_date = ?,
                            session_id = ?,
                            session_name = ?,
                            bill_type = ?,
                            body = ?,
                            legiscan_url = ?,
                            pdf_url = ?,
                            ai_summary = ?,
                            ai_executive_summary = ?,
                            ai_talking_points = ?,
                            ai_key_points = ?,
                            ai_business_impact = ?,
                            ai_potential_impact = ?,
                            ai_version = ?,
                            legiscan_status = ?,
                            last_updated = GETDATE()
                    WHEN NOT MATCHED THEN
                        INSERT (bill_id, bill_number, title, description, state, state_abbr, status, category, 
                               introduced_date, last_action_date, session_id, session_name, bill_type, body,
                               legiscan_url, pdf_url, ai_summary, ai_executive_summary, ai_talking_points, 
                               ai_key_points, ai_business_impact, ai_potential_impact, ai_version, 
                               legiscan_status, created_at, last_updated)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE());
                    """
                    
                    # Duplicate params for both MATCHED and NOT MATCHED clauses
                    all_params = (bill.get('bill_id', ''),) + params[1:] + params
                    
                    cursor.execute(merge_sql, all_params)
                    saved_count += 1
                    
                except Exception as e:
                    print(f"❌ Failed to save bill {bill.get('bill_id', 'unknown')}: {e}")
                    continue
            
            conn.commit()
            print(f"✅ Saved {saved_count} bills to state_legislation table")
            return saved_count
            
    except Exception as e:
        print(f"❌ Error saving to state_legislation table: {e}")
        return 0

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
        
        print(f"🔍 Saving {len(cleaned_bills)} state bills to state_legislation table")
        return save_bills_to_state_legislation_table(cleaned_bills)
        
    except Exception as e:
        print(f"❌ Error saving state legislation: {e}")
        import traceback
        traceback.print_exc()
        return 0


# ===============================
# FASTAPI APP SETUP
# ===============================

# AI client initialization
ENHANCED_AI_AVAILABLE = False
try:
    from ai import analyze_executive_order

    # Check Azure AI configuration
    ai_status = check_azure_ai_configuration()
    if ai_status["status"] == "connected":
        ENHANCED_AI_AVAILABLE = True
        logger.info("✅ Enhanced AI configuration detected")
    else:
        logger.warning(f"⚠️ Azure AI not fully configured: {ai_status['message']}")
except ImportError as e:
    logger.warning(f"⚠️ AI module not available: {e}")


# ===============================
# MAIN ENDPOINTS
# ===============================

@app.get("/api/executive-orders/debug-dates")
async def debug_executive_order_dates():
    """Debug endpoint to check date retrieval"""
    try:
        # Test direct database call
        from executive_orders_db import get_executive_orders_from_db as db_func
        db_result = db_func(limit=1, offset=0)
        
        if db_result.get('success') and db_result.get('results'):
            order = db_result['results'][0]
            return {
                "database_direct": {
                    "eo_number": order.get('eo_number'),
                    "signing_date": order.get('signing_date'),
                    "publication_date": order.get('publication_date'),
                    "title": order.get('title', '')[:60]
                },
                "database_keys": list(order.keys())[:20]
            }
        else:
            return {"error": "No results from database"}
            
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/executive-orders/debug-count")
async def debug_database_count():
    """Debug endpoint to check database counts"""
    try:
        from executive_orders_db import get_db_cursor
        
        with get_db_cursor() as cursor:
            debug_info = {}
            
            # Total count
            cursor.execute("SELECT COUNT(*) FROM executive_orders")
            debug_info['total_rows'] = cursor.fetchone()[0]
            
            # By document type (instead of president)
            cursor.execute("""
                SELECT COALESCE(presidential_document_type, 'Unknown'), COUNT(*) 
                FROM executive_orders 
                GROUP BY presidential_document_type
            """)
            type_counts = cursor.fetchall()
            debug_info['by_document_type'] = {t[0]: t[1] for t in type_counts}
            
            # Recent records
            cursor.execute("""
                SELECT TOP 5 eo_number, document_number, title, signing_date
                FROM executive_orders 
                ORDER BY COALESCE(signing_date, publication_date, created_at) DESC
            """)
            samples = cursor.fetchall()
            debug_info['recent_orders'] = [
                {
                    'eo_number': s[0],
                    'document_number': s[1], 
                    'title': s[2][:50] if s[2] else None,
                    'signing_date': str(s[3]) if s[3] else None
                } for s in samples
            ]
            
            # Get actual column names
            cursor.execute("""
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'executive_orders' AND TABLE_SCHEMA = 'dbo'
                ORDER BY ORDINAL_POSITION
            """)
            columns = cursor.fetchall()
            debug_info['table_columns'] = [c[0] for c in columns]
        
        return {
            "success": True,
            "debug_info": debug_info,
            "message": f"Found {debug_info['total_rows']} executive orders"
        }
        
    except Exception as e:
        logger.error(f"❌ Debug count error: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.get("/api/debug/executive-orders")
async def debug_executive_orders_api(
    test_mode: bool = Query(False, description="Run in test mode with small limits")
):
    """Debug endpoint for executive orders API"""
    try:
        logger.info("🔍 Running executive orders API diagnostics...")
        
        # Test different parameter combinations
        test_results = {}
        
        # Test 1: Basic call
        try:
            basic_result = get_executive_orders_from_db(limit=5, offset=0)
            test_results['basic_query'] = {
                'success': basic_result.get('success'),
                'count': basic_result.get('count', 0),
                'has_data': len(basic_result.get('results', [])) > 0
            }
        except Exception as e:
            test_results['basic_query'] = {'error': str(e)}
        
        # Test 2: With pagination
        try:
            paginated_result = get_executive_orders_from_db(limit=10, offset=5)
            test_results['pagination_query'] = {
                'success': paginated_result.get('success'),
                'count': paginated_result.get('count', 0),
                'offset_working': paginated_result.get('offset') == 5
            }
        except Exception as e:
            test_results['pagination_query'] = {'error': str(e)}
        
        # Test 3: With filters
        try:
            filtered_result = get_executive_orders_from_db(
                limit=5, 
                offset=0, 
                filters={'category': 'civic'}
            )
            test_results['filtered_query'] = {
                'success': filtered_result.get('success'),
                'count': filtered_result.get('count', 0),
                'filters_working': True
            }
        except Exception as e:
            test_results['filtered_query'] = {'error': str(e)}
        
        # Test 4: Database table info
        try:
            with get_db_cursor() as cursor:
                cursor.execute("SELECT COUNT(*) FROM executive_orders")
                total_records = cursor.fetchone()[0]
                
                cursor.execute("""
                    SELECT TOP 3 eo_number, title, signing_date 
                    FROM executive_orders 
                    ORDER BY signing_date DESC
                """)
                sample_records = cursor.fetchall()
                
                test_results['database_info'] = {
                    'total_records': total_records,
                    'sample_count': len(sample_records),
                    'table_accessible': True
                }
        except Exception as e:
            test_results['database_info'] = {'error': str(e)}
        
        return {
            "success": True,
            "timestamp": datetime.now().isoformat(),
            "test_results": test_results,
            "recommendations": [
                "Use per_page <= 100 in API calls",
                "Always check response.success before processing results",
                "Handle empty results gracefully",
                "Use pagination for large datasets"
            ]
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.get("/")
async def root():
    """Root endpoint with system status"""
    # Test database connection
    db_working = False
    connection_method = "Unknown"
    
    # New environment detection
    raw_env = os.getenv("ENVIRONMENT", "development")
    environment = "production" if raw_env == "production" or bool(os.getenv("CONTAINER_APP_NAME") or os.getenv("MSI_ENDPOINT")) else "development"
    
    try:
        # First try normal connection
        db_working = test_database_connection()
        connection_method = "MSI" if environment == "production" else "SQL Auth"
        
        # If SQL auth fails in development but we're in a container, try MSI as fallback
        if not db_working and environment != "production" and os.getenv("CONTAINER_APP_NAME"):
            logger.warning("⚠️ SQL Auth failed in container, trying MSI as fallback")
            # Override environment temporarily
            temp_env = "production"
            db_working = test_database_connection()
            connection_method = "MSI (Fallback)"
            # No need to restore since we're not modifying os.environ
        
    except Exception as e:
        logger.error(f"❌ Database connection test error: {e}")
    
    return {
        "message": "Enhanced LegislationVue API with Azure SQL Integration",
        "status": "healthy",
        "version": "14.0.1",
        "timestamp": datetime.now().isoformat(),
        "database": {
            "status": "connected" if db_working else "issues",
            "type": "Azure SQL",
            "connection_method": connection_method
        },
        "integrations": {
            "executive_orders": "available" if EXECUTIVE_ORDERS_AVAILABLE else "not_available",
            "legiscan": "available" if LEGISCAN_INITIALIZED else "not_available",
            "azure_ai": "available" if ENHANCED_AI_AVAILABLE else "not_configured"
        },
        "environment": environment,
        "container": bool(os.getenv("CONTAINER_APP_NAME"))
    }

@app.get("/api/status")
async def get_status():
    """Enhanced system status endpoint with optimized caching"""

    # Test database connection (with simple caching)
    cache_key = "db_status"
    current_time = time.time()
    if cache_key not in _health_check_cache:
        _health_check_cache[cache_key] = {"result": None, "timestamp": 0}

    db_cache = _health_check_cache[cache_key]
    if db_cache["result"] is not None and (current_time - db_cache["timestamp"]) < HEALTH_CHECK_CACHE_TTL:
        db_working = db_cache["result"].get("db_working", False)
        azure_sql_working = db_cache["result"].get("azure_sql_working", False)
        print("✅ Using cached database status")
    else:
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

        # Cache the results
        _health_check_cache[cache_key] = {
            "result": {"db_working": db_working, "azure_sql_working": azure_sql_working},
            "timestamp": current_time
        }

    # Test LegiScan API connection (cached)
    legiscan_status = await check_legiscan_connection()

    # Test Enhanced Azure AI connection (cached)
    enhanced_ai_status = await check_enhanced_ai_connection()

    raw_env = os.getenv("ENVIRONMENT", "development")
    environment = "production" if raw_env == "production" or bool(os.getenv("CONTAINER_APP_NAME") or os.getenv("MSI_ENDPOINT")) else "development"


    return {
        "environment": environment,
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
            "simple_executive_orders": "lazy_load" if not SIMPLE_EO_AVAILABLE else "loaded",
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

# Cache for health check results
_health_check_cache = {
    "legiscan": {"result": None, "timestamp": 0},
    "enhanced_ai": {"result": None, "timestamp": 0}
}
HEALTH_CHECK_CACHE_TTL = 60  # Cache results for 60 seconds

async def check_legiscan_connection():
    """Check if LegiScan API is properly configured and working (with caching)"""

    # Check cache first
    cache_entry = _health_check_cache["legiscan"]
    current_time = time.time()
    if cache_entry["result"] and (current_time - cache_entry["timestamp"]) < HEALTH_CHECK_CACHE_TTL:
        print(f"✅ Using cached LegiScan status: {cache_entry['result']}")
        return cache_entry["result"]

    # Check if API key is configured using YOUR environment variable name
    api_key = os.getenv('LEGISCAN_API_KEY')

    if not api_key:
        print("❌ LEGISCAN_API_KEY not found in environment")
        result = "not configured"
        _health_check_cache["legiscan"] = {"result": result, "timestamp": current_time}
        return result

    try:
        import httpx

        # Test with a simple LegiScan API call (reduced timeout)
        url = f"https://api.legiscan.com/?key={api_key}&op=getSessionList&state=CA"

        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=5.0)  # Reduced from 10s to 5s

            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'OK':
                    print("✅ LegiScan API connection successful")
                    result = "connected"
                    _health_check_cache["legiscan"] = {"result": result, "timestamp": current_time}
                    return result
                else:
                    print(f"❌ LegiScan API error: {data.get('alert', 'Unknown error')}")
                    result = "error"
                    _health_check_cache["legiscan"] = {"result": result, "timestamp": current_time}
                    return result
            else:
                print(f"❌ LegiScan API HTTP error: {response.status_code}")
                result = "error"
                _health_check_cache["legiscan"] = {"result": result, "timestamp": current_time}
                return result
                
    except ImportError:
        print("❌ httpx not installed - install with: pip install httpx")
        return "error"
    except Exception as e:
        print(f"❌ LegiScan API test failed: {e}")
        return "error"

async def check_enhanced_ai_connection():
    """Check if Enhanced Azure OpenAI is properly configured and working (with caching)"""

    # Check cache first
    cache_entry = _health_check_cache["enhanced_ai"]
    current_time = time.time()
    if cache_entry["result"] and (current_time - cache_entry["timestamp"]) < HEALTH_CHECK_CACHE_TTL:
        print(f"✅ Using cached Enhanced AI status: {cache_entry['result']}")
        return cache_entry["result"]

    if not enhanced_ai_client:
        result = "not configured"
        _health_check_cache["enhanced_ai"] = {"result": result, "timestamp": current_time}
        return result

    try:
        # Test simple AI call
        test_response = await process_with_ai(
            text="Test legislation about education technology",
            prompt_type=PromptType.EXECUTIVE_SUMMARY,
            context="Test"
        )

        if "Error generating" not in test_response:
            print("✅ Enhanced Azure OpenAI connection successful")
            result = "connected"
            _health_check_cache["enhanced_ai"] = {"result": result, "timestamp": current_time}
            return result
        else:
            print("❌ Enhanced Azure OpenAI test failed")
            result = "error"
            _health_check_cache["enhanced_ai"] = {"result": result, "timestamp": current_time}
            return result

    except Exception as e:
        print(f"❌ Enhanced Azure OpenAI test failed: {e}")
        result = "error"
        _health_check_cache["enhanced_ai"] = {"result": result, "timestamp": current_time}
        return result

@app.get("/api/debug/users")
async def debug_users():
    """Debug endpoint to see all users in database"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Check user_profiles table
            cursor.execute("SELECT user_id, display_name, msi_email, login_count, last_login, is_active FROM dbo.user_profiles")
            profiles = cursor.fetchall()
            
            # Check user_sessions table for unique users
            cursor.execute("SELECT DISTINCT user_id FROM dbo.user_sessions")
            session_users = cursor.fetchall()
            
            # Check user_highlights for unique users  
            cursor.execute("SELECT DISTINCT user_id FROM dbo.user_highlights")
            highlight_users = cursor.fetchall()
            
            return {
                "success": True,
                "user_profiles": [{"user_id": row[0], "display_name": row[1], "email": row[2], "login_count": row[3], "last_login": str(row[4]) if row[4] else None, "is_active": row[5]} for row in profiles],
                "session_users": [row[0] for row in session_users],
                "highlight_users": [row[0] for row in highlight_users]
            }
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/admin/schema-info")
async def get_schema_info():
    """Get user_profiles table schema information"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Check current table schema
            cursor.execute("""
                SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'user_profiles'
                ORDER BY ORDINAL_POSITION
            """)
            columns = [{"name": row[0], "type": row[1], "nullable": row[2]} for row in cursor.fetchall()]
            
            # Check if table exists
            cursor.execute("""
                SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'user_profiles'
            """)
            table_exists = cursor.fetchone()[0] > 0
            
            return {
                "success": True,
                "table_exists": table_exists,
                "columns": columns,
                "column_names": [col["name"] for col in columns]
            }
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/admin/remove-test-users")
async def remove_test_users():
    """Remove test users Jane Doe and John Smith"""
    try:
        print("🧹 Removing test users...")
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Test user IDs to remove  
            test_user_ids = ["739446089", "445124510"]  # Jane Doe, John Smith
            
            for user_id in test_user_ids:
                print(f"🗑️ Removing user {user_id}")
                
                cursor.execute("DELETE FROM dbo.user_profiles WHERE user_id = ?", (user_id,))
                profiles_removed = cursor.rowcount
                
                cursor.execute("DELETE FROM dbo.user_sessions WHERE user_id = ?", (user_id,))  
                sessions_removed = cursor.rowcount
                
                cursor.execute("DELETE FROM dbo.user_highlights WHERE user_id = ?", (user_id,))
                highlights_removed = cursor.rowcount
                
                cursor.execute("DELETE FROM dbo.page_views WHERE user_id = ?", (user_id,))
                pageviews_removed = cursor.rowcount
                
                print(f"✅ User {user_id}: profiles={profiles_removed}, sessions={sessions_removed}, highlights={highlights_removed}, pageviews={pageviews_removed}")
            
            conn.commit()
            print("🎉 Test users removed successfully!")
            
            return {"success": True, "message": "Test users removed"}
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return {"success": False, "error": str(e)}

@app.post("/api/admin/migrate-user-profiles")
async def migrate_user_profiles():
    """Migrate user_profiles table to add missing columns"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Get current columns
            cursor.execute("""
                SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'user_profiles'
            """)
            existing_columns = [row[0] for row in cursor.fetchall()]
            
            migration_steps = []
            
            # Add missing columns one by one
            if 'email' not in existing_columns:
                try:
                    cursor.execute("ALTER TABLE dbo.user_profiles ADD email NVARCHAR(255)")
                    migration_steps.append("✅ Added email column")
                except Exception as e:
                    migration_steps.append(f"⚠️ Email column: {e}")
            
            if 'first_name' not in existing_columns:
                try:
                    cursor.execute("ALTER TABLE dbo.user_profiles ADD first_name NVARCHAR(100)")
                    migration_steps.append("✅ Added first_name column")
                except Exception as e:
                    migration_steps.append(f"⚠️ First_name column: {e}")
                    
            if 'last_name' not in existing_columns:
                try:
                    cursor.execute("ALTER TABLE dbo.user_profiles ADD last_name NVARCHAR(100)")
                    migration_steps.append("✅ Added last_name column")
                except Exception as e:
                    migration_steps.append(f"⚠️ Last_name column: {e}")
                    
            if 'department' not in existing_columns:
                try:
                    cursor.execute("ALTER TABLE dbo.user_profiles ADD department NVARCHAR(100)")
                    migration_steps.append("✅ Added department column")
                except Exception as e:
                    migration_steps.append(f"⚠️ Department column: {e}")
                    
            if 'created_at' not in existing_columns:
                try:
                    cursor.execute("ALTER TABLE dbo.user_profiles ADD created_at DATETIME2 DEFAULT GETDATE()")
                    migration_steps.append("✅ Added created_at column")
                except Exception as e:
                    migration_steps.append(f"⚠️ Created_at column: {e}")
            
            conn.commit()
            
            return {
                "success": True,
                "message": "Migration completed",
                "steps": migration_steps,
                "original_columns": existing_columns
            }
            
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/admin/cleanup-test-users")
async def cleanup_test_users():
    """Remove test users created during development"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Remove test users by user_id (Jane Doe and John Smith)
            test_user_ids = ["739446089", "445124510"]  # Jane Doe, John Smith
            
            cleanup_results = []
            
            for user_id in test_user_ids:
                # Remove from user_profiles
                cursor.execute("DELETE FROM dbo.user_profiles WHERE user_id = ?", (user_id,))
                profiles_removed = cursor.rowcount
                
                # Remove from user_sessions  
                cursor.execute("DELETE FROM dbo.user_sessions WHERE user_id = ?", (user_id,))
                sessions_removed = cursor.rowcount
                
                # Remove from user_highlights
                cursor.execute("DELETE FROM dbo.user_highlights WHERE user_id = ?", (user_id,))
                highlights_removed = cursor.rowcount
                
                # Remove from page_views
                cursor.execute("DELETE FROM dbo.page_views WHERE user_id = ?", (user_id,))
                pageviews_removed = cursor.rowcount
                
                cleanup_results.append({
                    "user_id": user_id,
                    "profiles_removed": profiles_removed,
                    "sessions_removed": sessions_removed, 
                    "highlights_removed": highlights_removed,
                    "pageviews_removed": pageviews_removed
                })
                
                print(f"✅ Cleaned up test user {user_id}")
            
            conn.commit()
            
            return {
                "success": True,
                "message": "Test users cleaned up successfully",
                "results": cleanup_results
            }
            
    except Exception as e:
        print(f"❌ Failed to cleanup test users: {e}")
        return {"success": False, "error": str(e)}

@app.get("/api/admin/analytics")
async def get_admin_analytics_optimized(cleanup_test_users: bool = False):
    """Get admin analytics data including user activity and page statistics - OPTIMIZED"""
    try:
        print("🔍 Analytics endpoint called - OPTIMIZED VERSION - NEW TEST")
        print(f"📊 Request received at {datetime.now()}")
        print(f"🔍 cleanup_test_users parameter = {cleanup_test_users}")
        print(f"🔍 cleanup_test_users type = {type(cleanup_test_users)}")
        
        # CLEANUP FUNCTIONALITY - if cleanup_test_users parameter is True  
        if cleanup_test_users:  # Only cleanup when explicitly requested
            print("🧹 CLEANUP MODE ACTIVATED - Removing test users...")
            with get_db_connection() as conn:
                cursor = conn.cursor()
                test_user_ids = ["739446089", "445124510"]  # Jane Doe, John Smith
                
                for user_id in test_user_ids:
                    print(f"🗑️ Removing user {user_id}")
                    cursor.execute("DELETE FROM dbo.user_profiles WHERE user_id = ?", (user_id,))
                    cursor.execute("DELETE FROM dbo.user_sessions WHERE user_id = ?", (user_id,))
                    cursor.execute("DELETE FROM dbo.user_highlights WHERE user_id = ?", (user_id,))
                    cursor.execute("DELETE FROM dbo.page_views WHERE user_id = ?", (user_id,))
                    print(f"✅ Removed test user {user_id}")
                
                conn.commit()
                print("🎉 Test users cleanup completed!")
        
        start_time = time.time()
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Get general stats first
            print("🔍 DEBUG: Executing general stats query...")
            cursor.execute("""
                SELECT 
                    (SELECT COUNT(*) FROM executive_orders) as eo_count,
                    (SELECT COUNT(*) FROM state_legislation) as sl_count,
                    (SELECT COUNT(*) FROM dbo.user_profiles WHERE is_active = 1 AND msi_email LIKE '%@%' AND msi_email NOT LIKE 'anonymous-%@local.app') as unique_users,
                    (SELECT COUNT(*) FROM dbo.page_views) as total_page_views,
                    (SELECT COUNT(DISTINCT session_id) FROM dbo.user_sessions) as unique_sessions,
                    (SELECT COUNT(DISTINCT s.user_id) FROM dbo.user_sessions s
                     INNER JOIN dbo.user_profiles p ON s.user_id = p.user_id
                     WHERE CAST(s.started_at AS DATE) = CAST(GETDATE() AS DATE)
                     AND p.msi_email LIKE '%@%' 
                     AND p.msi_email NOT LIKE 'anonymous-%@local.app') as active_today
            """)
            
            general_row = cursor.fetchone()
            print(f"🔍 DEBUG: General stats query completed: {general_row}")
            if general_row:
                general_stats = {
                    "eo_count": general_row[0] or 0,
                    "sl_count": general_row[1] or 0,
                    "unique_users": general_row[2] or 0,
                    "total_page_views": general_row[3] or 0,
                    "unique_sessions": general_row[4] or 0,
                    "active_today": general_row[5] or 0
                }
            else:
                general_stats = {"eo_count": 0, "sl_count": 0, "unique_users": 0, "total_page_views": 0, "unique_sessions": 0, "active_today": 0}
                
            print(f"🔍 DEBUG: general_stats = {general_stats}")
            
            # Get top users with their activity - separate query (authenticated users only)
            print("🔍 DEBUG: UPDATED - Executing user stats query for authenticated AD users only [v2]...")
            cursor.execute("""
                SELECT TOP 10 
                    p.user_id,
                    p.display_name,
                    p.login_count,
                    p.last_login,
                    ISNULL(h.highlight_count, 0) as highlight_count,
                    ISNULL(h.active_days, 0) as active_days,
                    ISNULL(pv.page_views, 0) as page_views,
                    COALESCE(pv.most_active_page, 'N/A') as most_active_page
                FROM dbo.user_profiles p
                LEFT JOIN (
                    SELECT 
                        CAST(user_id AS NVARCHAR(50)) as user_id,
                        COUNT(*) as highlight_count,
                        COUNT(DISTINCT CAST(highlighted_at AS DATE)) as active_days
                    FROM dbo.user_highlights 
                    WHERE is_archived = 0
                    GROUP BY user_id
                ) h ON p.user_id = h.user_id
                LEFT JOIN (
                    SELECT 
                        user_id,
                        COUNT(*) as page_views,
                        (SELECT TOP 1 page_name FROM dbo.page_views pv2 
                         WHERE pv2.user_id = pv1.user_id 
                         GROUP BY page_name) as most_active_page
                    FROM dbo.page_views pv1
                    GROUP BY user_id
                ) pv ON p.user_id = pv.user_id
                WHERE p.is_active = 1 
                AND p.msi_email LIKE '%@%' 
                AND p.msi_email NOT LIKE 'anonymous-%@local.app'
                ORDER BY p.login_count DESC, h.highlight_count DESC
            """)
            
            user_results = cursor.fetchall()
            top_users = []
            for row in user_results:
                user_dict = {
                    "userId": str(row[0]),
                    "displayName": row[1] or "Unknown User",
                    "loginCount": row[2] or 0,
                    "lastLogin": row[3].isoformat() if row[3] else None,
                    "highlightCount": row[4] or 0,
                    "activeDays": row[5] or 0,
                    "pageViewCount": row[6] or 0,
                    "mostActivePage": row[7] or "N/A"
                }
                top_users.append(user_dict)
            
            # Get top pages - separate query
            print("🔍 DEBUG: Executing top pages query...")
            cursor.execute("""
                SELECT TOP 5 page_name, COUNT(*) as view_count
                FROM dbo.page_views 
                GROUP BY page_name 
                ORDER BY COUNT(*) DESC
            """)
            
            page_results = cursor.fetchall()
            top_pages = []
            for row in page_results:
                top_pages.append({
                    "pageName": row[0],
                    "viewCount": row[1]
                })
            
            # Build response using the data we collected
            analytics_data = {
                "totalPageViews": general_stats.get("total_page_views", 0),
                "uniqueSessions": general_stats.get("unique_sessions", 0),
                "uniqueUsers": general_stats.get("unique_users", 0),
                "activeToday": general_stats.get("active_today", 0),
                "topUsers": top_users[:5],  # Top 5 users
                "topPages": top_pages,
                "stateAnalytics": []  # Simplified for now
            }
            
            elapsed_time = time.time() - start_time
            print(f"✅ Analytics data prepared in {elapsed_time:.2f} seconds")
            
            return {
                "success": True,
                "data": analytics_data,
                "performance": {
                    "query_time_seconds": elapsed_time,
                    "optimized": True
                }
            }
    
    except Exception as e:
        print(f"❌ Analytics endpoint error: {e}")
        return {
            "success": False,
            "error": str(e),
            "data": {
                "totalPageViews": 0,
                "uniqueSessions": 0, 
                "activeToday": 0,
                "topUsers": [],
                "topPages": []
            }
        }

class UserProfileSyncRequest(BaseModel):
    email: str
    display_name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    department: Optional[str] = None

@app.post("/api/user/sync-profile-safe")  
async def sync_user_profile_safe(request: UserProfileSyncRequest):
    """Safe sync that works with existing table schema"""
    try:
        print(f"🔄 Safe syncing profile for user: {request.email}")
        
        # Generate consistent user ID for this email
        normalized_user_id = normalize_user_id(request.email)
        print(f"📋 Normalized user ID: {normalized_user_id} for email: {request.email}")
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Check if user profile already exists (by user_id only)
            cursor.execute("""
                SELECT user_id FROM dbo.user_profiles 
                WHERE user_id = ?
            """, (normalized_user_id,))
            
            existing_profile = cursor.fetchone()
            
            if existing_profile:
                # Update existing profile (safe columns only)
                cursor.execute("""
                    UPDATE dbo.user_profiles 
                    SET display_name = ?, 
                        last_login = GETDATE(),
                        login_count = ISNULL(login_count, 0) + 1
                    WHERE user_id = ?
                """, (
                    request.display_name,
                    normalized_user_id
                ))
                print(f"✅ Updated existing profile for {request.email} (user_id: {normalized_user_id})")
            else:
                # Create new profile (safe columns only)
                cursor.execute("""
                    INSERT INTO dbo.user_profiles (
                        user_id, display_name, last_login, login_count, is_active
                    ) VALUES (?, ?, GETDATE(), 1, 1)
                """, (
                    normalized_user_id,
                    request.display_name
                ))
                print(f"✅ Created new profile for {request.email} (user_id: {normalized_user_id})")
            
            conn.commit()
            
            return {
                "success": True,
                "message": f"Profile synced for {request.email}",
                "user_id": normalized_user_id,
                "email": request.email,
                "display_name": request.display_name
            }
            
    except Exception as e:
        print(f"❌ Error syncing user profile: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to sync user profile: {str(e)}"
        )

@app.post("/api/user/sync-profile")
async def sync_user_profile(request: UserProfileSyncRequest):
    """Sync user profile data from MSI authentication"""
    try:
        print(f"🔄 Syncing profile for user: {request.email}")
        
        # Generate consistent user ID for this email
        normalized_user_id = normalize_user_id(request.email)
        print(f"📋 Normalized user ID: {normalized_user_id} for email: {request.email}")
        
        # Ensure user profiles table exists and show debug info
        print(f"🔧 About to create/verify user_profiles table for {request.email}")
        create_user_profiles_table()
        print(f"🔧 Table creation completed for {request.email}")
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Try to add missing columns first
            try:
                cursor.execute("ALTER TABLE dbo.user_profiles ADD email NVARCHAR(255)")
                print("✅ Successfully added email column")
            except Exception as e:
                print(f"⚠️ Email column already exists or error: {e}")
            
            # Check if user profile already exists (by user_id)
            cursor.execute("""
                SELECT user_id FROM dbo.user_profiles 
                WHERE user_id = ?
            """, (normalized_user_id,))
            
            existing_profile = cursor.fetchone()
            
            if existing_profile:
                # Update existing profile - try with email, fallback without
                try:
                    cursor.execute("""
                        UPDATE dbo.user_profiles 
                        SET display_name = ?, 
                            email = ?,
                            last_login = GETDATE(),
                            login_count = ISNULL(login_count, 0) + 1
                        WHERE user_id = ?
                    """, (
                        request.display_name,
                        request.email,
                        normalized_user_id
                    ))
                    print(f"✅ Updated profile with email for {request.email} (user_id: {normalized_user_id})")
                except Exception as e:
                    # Fallback - update without email
                    print(f"⚠️ Could not update with email, using basic update: {e}")
                    cursor.execute("""
                        UPDATE dbo.user_profiles 
                        SET display_name = ?, 
                            last_login = GETDATE(),
                            login_count = ISNULL(login_count, 0) + 1
                        WHERE user_id = ?
                    """, (
                        request.display_name,
                        normalized_user_id
                    ))
                    print(f"✅ Updated profile (basic) for {request.email} (user_id: {normalized_user_id})")
            else:
                # Create new profile - try with email, fallback without
                try:
                    cursor.execute("""
                        INSERT INTO dbo.user_profiles (
                            user_id, email, display_name, last_login, login_count, is_active
                        ) VALUES (?, ?, ?, GETDATE(), 1, 1)
                    """, (
                        normalized_user_id,
                        request.email,
                        request.display_name
                    ))
                    print(f"✅ Created profile with email for {request.email} (user_id: {normalized_user_id})")
                except Exception as e:
                    # Fallback - create without email
                    print(f"⚠️ Could not create with email, using basic create: {e}")
                    cursor.execute("""
                        INSERT INTO dbo.user_profiles (
                            user_id, display_name, last_login, login_count, is_active
                        ) VALUES (?, ?, GETDATE(), 1, 1)
                    """, (
                        normalized_user_id,
                        request.display_name
                    ))
                    print(f"✅ Created profile (basic) for {request.email} (user_id: {normalized_user_id})")
            
            conn.commit()
            
        return {
            "success": True,
            "message": f"Profile synced for {request.email}",
            "user_id": normalized_user_id,
            "email": request.email,
            "display_name": request.display_name
        }
        
    except Exception as e:
        print(f"❌ Error syncing user profile: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to sync user profile: {str(e)}"
        )

def create_user_profiles_table():
    """Create user profiles table for MSI identity mapping"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Check what columns exist in the current table
            cursor.execute("""
                SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'user_profiles'
                ORDER BY ORDINAL_POSITION
            """)
            existing_columns = [row[0] for row in cursor.fetchall()]
            print(f"🔍 Existing user_profiles columns: {existing_columns}")
            
            # If table doesn't exist, create it with full schema
            if not existing_columns:
                create_table_sql = """
                CREATE TABLE dbo.user_profiles (
                    user_id NVARCHAR(50) PRIMARY KEY,
                    email NVARCHAR(255),
                    display_name NVARCHAR(255),
                    first_name NVARCHAR(100),
                    last_name NVARCHAR(100),
                    department NVARCHAR(100),
                    created_at DATETIME2 DEFAULT GETDATE(),
                    last_login DATETIME2 DEFAULT GETDATE(),
                    login_count INT DEFAULT 0,
                    is_active BIT DEFAULT 1
                );
                """
                cursor.execute(create_table_sql)
                print("✅ Created new user_profiles table with full schema")
            else:
                # Force add missing columns with better error handling
                required_columns = {
                    'email': 'NVARCHAR(255)',
                    'first_name': 'NVARCHAR(100)', 
                    'last_name': 'NVARCHAR(100)',
                    'department': 'NVARCHAR(100)',
                    'created_at': 'DATETIME2 DEFAULT GETDATE()'
                }
                
                for col_name, col_type in required_columns.items():
                    if col_name not in existing_columns:
                        try:
                            cursor.execute(f"ALTER TABLE dbo.user_profiles ADD {col_name} {col_type}")
                            print(f"✅ Added {col_name} column")
                        except Exception as e:
                            print(f"⚠️ Could not add {col_name} column: {e}")
                
                # Also make sure we have user_id as primary key if it doesn't exist
                if 'user_id' not in existing_columns:
                    try:
                        cursor.execute("ALTER TABLE dbo.user_profiles ADD user_id NVARCHAR(50)")
                        print("✅ Added user_id column") 
                    except Exception as e:
                        print(f"⚠️ Could not add user_id column: {e}")
            
            conn.commit()
            
            # Final check - show updated columns
            cursor.execute("""
                SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'user_profiles'
                ORDER BY ORDINAL_POSITION
            """)
            final_columns = [row[0] for row in cursor.fetchall()]
            print(f"✅ Final user_profiles columns: {final_columns}")
            
            return True
    except Exception as e:
        print(f"❌ Failed to create/update user profiles table: {e}")
        return False

@app.post("/api/admin/create-user-profile")
async def create_user_profile(request: dict):
    """Create or update a user profile for MSI identity mapping"""
    try:
        user_id = request.get('user_id')
        msi_email = request.get('msi_email')
        display_name = request.get('display_name')
        
        if not user_id or not msi_email:
            return {"success": False, "error": "user_id and msi_email are required"}
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Upsert user profile
            upsert_sql = """
            MERGE dbo.user_profiles AS target
            USING (SELECT ? as user_id, ? as msi_email, ? as display_name) AS source
            ON target.user_id = source.user_id
            WHEN MATCHED THEN
                UPDATE SET 
                    msi_email = source.msi_email,
                    display_name = source.display_name,
                    last_login = GETDATE()
            WHEN NOT MATCHED THEN
                INSERT (user_id, msi_email, display_name, created_at, last_login)
                VALUES (source.user_id, source.msi_email, source.display_name, GETDATE(), GETDATE());
            """
            
            cursor.execute(upsert_sql, (user_id, msi_email, display_name))
            conn.commit()
            
            print(f"✅ User profile created/updated: {user_id} -> {display_name}")
            
            return {
                "success": True,
                "message": f"User profile created/updated for {display_name}",
                "user_id": user_id,
                "display_name": display_name
            }
            
    except Exception as e:
        print(f"❌ Failed to create user profile: {e}")
        return {"success": False, "error": str(e)}

# ===============================
# ANALYTICS TRACKING TABLES
# ===============================

def create_page_views_table():
    """Create table to track page views"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            create_table_sql = """
            IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'page_views')
            CREATE TABLE dbo.page_views (
                id INT IDENTITY(1,1) PRIMARY KEY,
                user_id NVARCHAR(100) NOT NULL,
                page_name NVARCHAR(255) NOT NULL,
                page_path NVARCHAR(500) NOT NULL,
                session_id NVARCHAR(100),
                ip_address NVARCHAR(45),
                user_agent NVARCHAR(500),
                viewed_at DATETIME2 DEFAULT GETDATE(),
                INDEX IX_page_views_user_id (user_id),
                INDEX IX_page_views_viewed_at (viewed_at),
                INDEX IX_page_views_session_id (session_id)
            );
            """
            cursor.execute(create_table_sql)
            conn.commit()
            print("✅ Page views table created/verified")
            return True
    except Exception as e:
        print(f"❌ Failed to create page views table: {e}")
        return False

def create_user_sessions_table():
    """Create table to track user sessions"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            create_table_sql = """
            IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'user_sessions')
            CREATE TABLE dbo.user_sessions (
                id INT IDENTITY(1,1) PRIMARY KEY,
                session_id NVARCHAR(100) UNIQUE NOT NULL,
                user_id NVARCHAR(100) NOT NULL,
                display_name NVARCHAR(255),
                ip_address NVARCHAR(45),
                user_agent NVARCHAR(500),
                started_at DATETIME2 DEFAULT GETDATE(),
                last_activity DATETIME2 DEFAULT GETDATE(),
                ended_at DATETIME2 NULL,
                is_active BIT DEFAULT 1,
                INDEX IX_user_sessions_user_id (user_id),
                INDEX IX_user_sessions_started_at (started_at),
                INDEX IX_user_sessions_session_id (session_id)
            );
            """
            cursor.execute(create_table_sql)
            conn.commit()
            print("✅ User sessions table created/verified")
            return True
    except Exception as e:
        print(f"❌ Failed to create user sessions table: {e}")
        return False

def migrate_user_sessions_add_display_name():
    """Add display_name column to existing user_sessions table if it doesn't exist"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Check if display_name column exists
            cursor.execute("""
                SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'user_sessions' 
                AND COLUMN_NAME = 'display_name'
            """)
            
            if not cursor.fetchone():
                # Add display_name column
                cursor.execute("ALTER TABLE dbo.user_sessions ADD display_name NVARCHAR(255)")
                conn.commit()
                print("✅ Added display_name column to user_sessions table")
                return True
            else:
                print("✅ display_name column already exists in user_sessions table")
                return True
                
    except Exception as e:
        print(f"❌ Failed to migrate user_sessions table: {e}")
        return False

@app.get("/api/admin/recent-sessions")
async def get_recent_sessions(limit: int = 20):
    """Get recent user sessions with display names for analytics"""
    try:
        # Ensure the display_name column exists
        migrate_user_sessions_add_display_name()
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT TOP (?) 
                    s.session_id,
                    s.user_id,
                    COALESCE(s.display_name, p.display_name, 'Unknown User') as display_name,
                    s.started_at,
                    s.last_activity,
                    s.ended_at,
                    s.is_active,
                    DATEDIFF(MINUTE, s.started_at, COALESCE(s.ended_at, s.last_activity)) as duration_minutes
                FROM dbo.user_sessions s
                LEFT JOIN dbo.user_profiles p ON s.user_id = p.user_id
                ORDER BY s.started_at DESC
            """, (limit,))
            
            sessions = []
            for row in cursor.fetchall():
                session_dict = {
                    "sessionId": row[0],
                    "userId": row[1],
                    "displayName": row[2],
                    "startedAt": row[3].isoformat() if row[3] else None,
                    "lastActivity": row[4].isoformat() if row[4] else None,
                    "endedAt": row[5].isoformat() if row[5] else None,
                    "isActive": bool(row[6]),
                    "durationMinutes": row[7] or 0
                }
                sessions.append(session_dict)
            
            return {
                "success": True,
                "sessions": sessions,
                "total": len(sessions)
            }
            
    except Exception as e:
        print(f"❌ Failed to get recent sessions: {e}")
        return {"success": False, "error": str(e), "sessions": []}

# ===============================
# UPLOAD ENDPOINTS
# ===============================

@app.post("/api/admin/upload-data")
async def upload_data_endpoint(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    upload_type: str = Form(...),
    state: str = Form(None),
    with_ai: bool = Form(True),
    batch_size: int = Form(10)
):
    """Upload and process JSON or MD5 hash file"""
    return await upload_data_file(background_tasks, file, upload_type, state, with_ai, batch_size)

@app.get("/api/admin/upload-status/{job_id}")
async def get_upload_status_endpoint(job_id: str):
    """Get status of upload job"""
    return await get_upload_status(job_id)

@app.get("/api/admin/upload-jobs")
async def list_upload_jobs_endpoint():
    """List all upload jobs (last 50)"""
    return await list_upload_jobs()

def merge_manual_executions_with_job(job_data, job_name_map):
    """Merge manual executions with Azure job data"""
    global MANUAL_JOB_EXECUTIONS
    
    # Map Azure job names to manual job names
    manual_name = job_name_map.get(job_data["name"])
    if not manual_name:
        return job_data
    
    # Get manual executions for this job
    manual_executions = [
        exec for exec in MANUAL_JOB_EXECUTIONS 
        if exec["job_name"] == manual_name
    ]
    
    # Convert manual executions to the same format as Azure executions
    for manual_exec in manual_executions:
        formatted_exec = {
            "execution_name": manual_exec["execution_name"],
            "status": manual_exec["status"],
            "start_time": manual_exec["start_time"],
            "end_time": manual_exec["end_time"],
            "duration": manual_exec["duration"],
            "is_manual": True,
            "error": manual_exec.get("error"),
            "process_id": manual_exec.get("process_id")
        }
        job_data["executions"].append(formatted_exec)
    
    # Sort all executions by start time (most recent first)
    job_data["executions"].sort(
        key=lambda x: x["start_time"] or "", 
        reverse=True
    )
    
    # Limit to 10 most recent executions
    job_data["executions"] = job_data["executions"][:10]
    
    return job_data

@app.get("/api/admin/automation-report")
async def get_automation_report():
    """Get automation job execution report for Azure Container Apps and manual executions"""
    try:
        import subprocess
        import json
        from datetime import datetime, timedelta
        import os
        
        global MANUAL_JOB_EXECUTIONS
        
        report = {
            "success": True,
            "timestamp": datetime.utcnow().isoformat(),
            "jobs": [],
            "summary": {
                "total_executions": 0,
                "successful": 0,
                "failed": 0,
                "running": 0,
                "recent_failures": []
            }
        }
        
        # Check if Azure CLI is available and authenticated
        logger.info("🔍 Checking Azure CLI availability...")
        azure_cli_available = os.system("which az > /dev/null 2>&1") == 0
        logger.info(f"Azure CLI available: {azure_cli_available}")
        azure_authenticated = False

        if azure_cli_available:
            # Try to authenticate with managed identity if in Azure environment
            msi_endpoint = os.getenv("MSI_ENDPOINT")
            container_app_name = os.getenv("CONTAINER_APP_NAME")
            logger.info(f"MSI_ENDPOINT: {bool(msi_endpoint)}, CONTAINER_APP_NAME: {bool(container_app_name)}")

            if msi_endpoint or container_app_name:
                logger.info("🔐 Attempting Azure CLI login with managed identity...")
                login_result = os.system("az login --identity > /tmp/az_login.log 2>&1")
                logger.info(f"Login result code: {login_result}")

                if login_result == 0:
                    logger.info("✅ Azure CLI authenticated with managed identity")
                    azure_authenticated = True
                else:
                    logger.warning("❌ Failed to authenticate with managed identity")
                    # Log the error
                    try:
                        with open("/tmp/az_login.log", "r") as f:
                            error_log = f.read()
                            logger.warning(f"Login error: {error_log[:200]}")
                    except:
                        pass
            else:
                # Check if Azure CLI is already authenticated (local dev)
                logger.info("🔍 Checking existing Azure CLI authentication...")
                auth_check = os.system("az account show > /dev/null 2>&1")
                azure_authenticated = auth_check == 0
                logger.info(f"Azure authenticated (local): {azure_authenticated}")
        
        # Define the jobs to check
        jobs = [
            {"name": "job-executive-orders-nightly", "description": "Executive Orders Nightly Fetch", "schedule": "2:00 AM UTC"},
            {"name": "job-state-bills-nightly", "description": "State Bills Nightly Update", "schedule": "3:00 AM UTC"}
        ]
        
        # Map Azure job names to manual job names
        job_name_map = {
            "job-executive-orders-nightly": "executive-orders",
            "job-state-bills-nightly": "state-bills"
        }
        
        # Use mock data if Azure CLI is not available or not authenticated
        if not azure_cli_available or not azure_authenticated:
            # Provide mock data when Azure CLI is not available (local development)
            # Using current date for more realistic mock data
            today = datetime.utcnow().date()
            yesterday = today - timedelta(days=1)
            two_days_ago = today - timedelta(days=2)
            
            mock_jobs = [
                {
                    "name": "job-executive-orders-nightly",
                    "description": "Executive Orders Nightly Fetch",
                    "schedule": "2:00 AM UTC",
                    "executions": [
                        {"execution_name": f"job-executive-orders-nightly-{today}", "status": "Failed",
                         "start_time": f"{today}T02:00:00+00:00", "end_time": f"{today}T02:30:00+00:00", "duration": "30m 0s",
                         "error": "Database connection error: ('22007', '[22007] [Microsoft][ODBC Driver 18 for SQL Server][SQL Server]Conversion failed when converting date and/or time from character string. (241)')", "is_manual": False},
                        {"execution_name": f"job-executive-orders-nightly-{yesterday}", "status": "Failed",
                         "start_time": f"{yesterday}T02:00:00+00:00", "end_time": f"{yesterday}T02:30:00+00:00", "duration": "30m 0s",
                         "error": "Database authentication failed. Missing SQL credentials.", "is_manual": False},
                        {"execution_name": f"job-executive-orders-nightly-{two_days_ago}", "status": "Succeeded",
                         "start_time": f"{two_days_ago}T02:00:00+00:00", "end_time": f"{two_days_ago}T02:15:00+00:00", "duration": "15m 0s",
                         "error": None, "is_manual": False}
                    ]
                },
                {
                    "name": "job-state-bills-nightly",
                    "description": "State Bills Nightly Update",
                    "schedule": "3:00 AM UTC",
                    "executions": [
                        {"execution_name": f"job-state-bills-nightly-{today}", "status": "Failed",
                         "start_time": f"{today}T03:00:00+00:00", "end_time": f"{today}T03:01:00+00:00", "duration": "1m 0s",
                         "error": "ModuleNotFoundError: No module named 'legiscan_service'", "is_manual": False},
                        {"execution_name": f"job-state-bills-nightly-{yesterday}", "status": "Failed",
                         "start_time": f"{yesterday}T03:00:00+00:00", "end_time": f"{yesterday}T03:01:00+00:00", "duration": "1m 0s",
                         "error": "Azure SQL connection timeout after 30 seconds", "is_manual": False},
                        {"execution_name": f"job-state-bills-nightly-{two_days_ago}", "status": "Succeeded",
                         "start_time": f"{two_days_ago}T03:00:00+00:00", "end_time": f"{two_days_ago}T03:05:00+00:00", "duration": "5m 0s",
                         "error": None, "is_manual": False}
                    ]
                }
            ]
            
            # Merge manual executions with mock data
            for job_data in mock_jobs:
                job_data = merge_manual_executions_with_job(job_data, job_name_map)
                report["jobs"].append(job_data)
            
            # Calculate summary from merged data
            for job_data in report["jobs"]:
                for exec_data in job_data["executions"]:
                    report["summary"]["total_executions"] += 1
                    if exec_data["status"] == "Succeeded":
                        report["summary"]["successful"] += 1
                    elif exec_data["status"] == "Failed":
                        report["summary"]["failed"] += 1
                        # Add to recent failures if within last 24 hours
                        if exec_data["start_time"]:
                            try:
                                start_time = datetime.fromisoformat(exec_data["start_time"].replace("+00:00", "").replace("Z", ""))
                                if datetime.utcnow() - start_time < timedelta(days=1):
                                    report["summary"]["recent_failures"].append({
                                        "job": job_data["description"],
                                        "time": exec_data["start_time"],
                                        "execution": exec_data["execution_name"],
                                        "is_manual": exec_data.get("is_manual", False)
                                    })
                            except:
                                pass
                    elif exec_data["status"] == "Running":
                        report["summary"]["running"] += 1
            
            # Calculate success rate
            if report["summary"]["total_executions"] > 0:
                report["summary"]["success_rate"] = round(
                    (report["summary"]["successful"] / report["summary"]["total_executions"]) * 100, 1
                )
            else:
                report["summary"]["success_rate"] = 0
            
            report["message"] = f"Using mock data (Azure CLI not available) + {len(MANUAL_JOB_EXECUTIONS)} manual executions"
            return report
        
        for job_config in jobs:
            try:
                # Get recent executions for this job using Azure CLI
                cmd = [
                    "az", "containerapp", "job", "execution", "list",
                    "--name", job_config["name"],
                    "--resource-group", "rg-legislation-tracker",
                    "--query", "[0:10].{name:name, status:properties.status, startTime:properties.startTime, endTime:properties.endTime, template:properties.template}",
                    "-o", "json"
                ]

                result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)

                if result.returncode == 0:
                    executions = json.loads(result.stdout)

                    job_data = {
                        "name": job_config["name"],
                        "description": job_config["description"],
                        "schedule": job_config["schedule"],
                        "executions": []
                    }

                    for execution in executions:
                        exec_name = execution.get("name", "")

                        # Detect manual runs: they have random suffixes (letters) instead of just numbers
                        # Scheduled: job-executive-orders-nightly-29379000
                        # Manual: job-executive-orders-nightly-i77505l
                        is_manual = False
                        if exec_name:
                            # Extract the suffix after the last hyphen
                            parts = exec_name.split('-')
                            if len(parts) > 0:
                                suffix = parts[-1]
                                # If suffix contains letters, it's a manual run
                                is_manual = any(c.isalpha() for c in suffix)

                        exec_data = {
                            "execution_name": exec_name,
                            "status": execution.get("status", "Unknown"),
                            "start_time": execution.get("startTime", ""),
                            "end_time": execution.get("endTime", ""),
                            "duration": None,
                            "is_manual": is_manual,
                            "error": None
                        }

                        # Calculate duration if both times are available
                        if exec_data["start_time"] and exec_data["end_time"]:
                            try:
                                start = datetime.fromisoformat(exec_data["start_time"].replace("+00:00", ""))
                                end = datetime.fromisoformat(exec_data["end_time"].replace("+00:00", ""))
                                duration = (end - start).total_seconds()
                                exec_data["duration"] = f"{int(duration // 60)}m {int(duration % 60)}s"
                            except:
                                pass

                        # For failed jobs, try to get error details from Azure Log Analytics
                        if exec_data["status"] == "Failed":
                            try:
                                exec_name = execution.get("name", "")
                                logger.info(f"📋 Fetching logs for failed execution: {exec_name}")

                                # Get Log Analytics workspace ID from environment
                                env_query = [
                                    "az", "containerapp", "env", "show",
                                    "--name", "legis-vue",
                                    "--resource-group", "rg-legislation-tracker",
                                    "--query", "properties.appLogsConfiguration.logAnalyticsConfiguration.customerId",
                                    "-o", "tsv"
                                ]
                                env_result = subprocess.run(env_query, capture_output=True, text=True, timeout=10)
                                workspace_id = env_result.stdout.strip() if env_result.returncode == 0 else None

                                if workspace_id:
                                    # Query Log Analytics for error logs from this job
                                    analytics_query = (
                                        f"ContainerAppConsoleLogs_CL "
                                        f"| where ContainerJobName_s == '{job_config['name']}' "
                                        f"| where TimeGenerated > ago(24h) "
                                        f"| project TimeGenerated, Log_s "
                                        f"| order by TimeGenerated desc "
                                        f"| take 20"
                                    )

                                    log_cmd = [
                                        "az", "monitor", "log-analytics", "query",
                                        "--workspace", workspace_id,
                                        "--analytics-query", analytics_query,
                                        "-o", "json"
                                    ]

                                    log_result = subprocess.run(log_cmd, capture_output=True, text=True, timeout=15)

                                    if log_result.returncode == 0 and log_result.stdout:
                                        import json
                                        log_data = json.loads(log_result.stdout)

                                        if log_data:
                                            # Extract error lines
                                            error_lines = []
                                            for entry in log_data:
                                                log_text = entry.get('Log_s', '')
                                                # Look for actual errors
                                                if any(keyword in log_text.lower() for keyword in
                                                       ['error', 'failed', 'exception', 'traceback', 'errno', 'cannot', 'unable']):
                                                    error_lines.append(log_text.strip())

                                            if error_lines:
                                                # Take first 3 unique error lines
                                                unique_errors = list(dict.fromkeys(error_lines))[:3]
                                                exec_data["error"] = " | ".join(unique_errors)[:500]
                                                logger.info(f"✅ Found {len(unique_errors)} error lines for {exec_name}")
                                            else:
                                                # No specific errors found, show last log line
                                                last_log = log_data[0].get('Log_s', '') if log_data else ''
                                                exec_data["error"] = f"Job failed. Last log: {last_log[:200]}"
                                        else:
                                            exec_data["error"] = "Job execution failed (no logs found in last 24h)"
                                    else:
                                        exec_data["error"] = "Job execution failed. Unable to query logs."
                                else:
                                    exec_data["error"] = "Job execution failed. Log Analytics workspace not found."

                            except subprocess.TimeoutExpired:
                                exec_data["error"] = "Job execution failed. Log fetch timed out."
                            except Exception as e:
                                logger.warning(f"⚠️ Error fetching logs for {execution.get('name', '')}: {e}")
                                exec_data["error"] = f"Job execution failed. Error fetching logs: {str(e)[:150]}"

                        job_data["executions"].append(exec_data)
                    
                    # Merge with manual executions
                    job_data = merge_manual_executions_with_job(job_data, job_name_map)
                    
                    report["jobs"].append(job_data)
                else:
                    # Command failed, create job with just manual executions
                    job_data = {
                        "name": job_config["name"],
                        "description": job_config["description"],
                        "schedule": job_config["schedule"],
                        "error": "Failed to fetch execution history",
                        "executions": []
                    }
                    job_data = merge_manual_executions_with_job(job_data, job_name_map)
                    report["jobs"].append(job_data)
                    
            except subprocess.TimeoutExpired:
                job_data = {
                    "name": job_config["name"],
                    "description": job_config["description"],
                    "schedule": job_config["schedule"],
                    "error": "Azure CLI timeout",
                    "executions": []
                }
                job_data = merge_manual_executions_with_job(job_data, job_name_map)
                report["jobs"].append(job_data)
            except Exception as e:
                job_data = {
                    "name": job_config["name"],
                    "description": job_config["description"],
                    "schedule": job_config["schedule"],
                    "error": str(e),
                    "executions": []
                }
                job_data = merge_manual_executions_with_job(job_data, job_name_map)
                report["jobs"].append(job_data)
        
        # Recalculate summary from merged data
        report["summary"] = {
            "total_executions": 0,
            "successful": 0,
            "failed": 0,
            "running": 0,
            "recent_failures": []
        }
        
        for job_data in report["jobs"]:
            for exec_data in job_data["executions"]:
                report["summary"]["total_executions"] += 1
                if exec_data["status"] == "Succeeded":
                    report["summary"]["successful"] += 1
                elif exec_data["status"] == "Failed":
                    report["summary"]["failed"] += 1
                    # Add to recent failures if within last 24 hours
                    if exec_data["start_time"]:
                        try:
                            start_time = datetime.fromisoformat(exec_data["start_time"].replace("+00:00", "").replace("Z", ""))
                            if datetime.utcnow() - start_time < timedelta(days=1):
                                report["summary"]["recent_failures"].append({
                                    "job": job_data["description"],
                                    "time": exec_data["start_time"],
                                    "execution": exec_data["execution_name"],
                                    "is_manual": exec_data.get("is_manual", False)
                                })
                        except:
                            pass
                elif exec_data["status"] == "Running":
                    report["summary"]["running"] += 1
        
        # Calculate success rate
        if report["summary"]["total_executions"] > 0:
            report["summary"]["success_rate"] = round(
                (report["summary"]["successful"] / report["summary"]["total_executions"]) * 100, 1
            )
        else:
            report["summary"]["success_rate"] = 0
        
        report["message"] = f"Azure data + {len(MANUAL_JOB_EXECUTIONS)} manual executions"
        return report
        
    except Exception as e:
        logger.error(f"Error getting automation report: {e}")
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to fetch automation report. Azure CLI may not be available."
        }

# Local job execution tracking
MANUAL_JOB_EXECUTIONS = []

@app.post("/api/admin/clear-manual-executions")
async def clear_manual_executions():
    """Clear all manual job execution tracking data (for debugging)"""
    global MANUAL_JOB_EXECUTIONS
    count = len(MANUAL_JOB_EXECUTIONS)
    MANUAL_JOB_EXECUTIONS.clear()
    return {"success": True, "message": f"Cleared {count} manual executions"}

def track_manual_job_execution(job_name: str, status: str, start_time: str, end_time: str = None, error: str = None, process_id: int = None, azure_execution_name: str = None):
    """Track manual job execution in memory"""
    global MANUAL_JOB_EXECUTIONS
    
    execution_id = f"manual-{job_name}-{start_time.replace(':', '').replace('.', '').replace('T', '-').replace('+', '').replace('Z', '')}"
    
    # Look for existing execution with same ID to update
    existing_execution = None
    for i, exec in enumerate(MANUAL_JOB_EXECUTIONS):
        if exec["execution_name"] == execution_id:
            existing_execution = i
            break
    
    execution = {
        "execution_name": execution_id,
        "job_name": job_name,
        "status": status,
        "start_time": start_time,
        "end_time": end_time,
        "duration": None,
        "error": error,
        "process_id": process_id,
        "azure_execution_name": azure_execution_name,
        "is_manual": True
    }
    
    if start_time and end_time:
        try:
            start = datetime.fromisoformat(start_time.replace("+00:00", "").replace("Z", ""))
            end = datetime.fromisoformat(end_time.replace("+00:00", "").replace("Z", ""))
            duration = (end - start).total_seconds()
            execution["duration"] = f"{int(duration // 60)}m {int(duration % 60)}s"
        except:
            pass
    
    if existing_execution is not None:
        # Update existing execution
        MANUAL_JOB_EXECUTIONS[existing_execution] = execution
    else:
        # Add new execution
        # Remove old executions if we have too many (keep last 50)
        if len(MANUAL_JOB_EXECUTIONS) >= 50:
            MANUAL_JOB_EXECUTIONS = MANUAL_JOB_EXECUTIONS[-40:]
        
        MANUAL_JOB_EXECUTIONS.append(execution)
    
    return execution_id

async def monitor_manual_job(process, job_name: str, start_time: str, execution_id: str):
    """Monitor a manual job execution and update its status"""
    try:
        # Wait for the process to complete
        stdout, stderr = await asyncio.create_task(
            asyncio.to_thread(process.communicate)
        )
        
        end_time = datetime.utcnow().isoformat() + "Z"
        
        if process.returncode == 0:
            # Job succeeded
            track_manual_job_execution(
                job_name=job_name,
                status="Succeeded", 
                start_time=start_time,
                end_time=end_time,
                process_id=process.pid
            )
            logger.info(f"Manual job {job_name} completed successfully")
        else:
            # Job failed
            error_msg = stderr[:500] if stderr else "Unknown error"
            track_manual_job_execution(
                job_name=job_name,
                status="Failed",
                start_time=start_time, 
                end_time=end_time,
                error=error_msg,
                process_id=process.pid
            )
            logger.error(f"Manual job {job_name} failed: {error_msg}")
            
    except Exception as e:
        # Job errored
        end_time = datetime.utcnow().isoformat() + "Z"
        track_manual_job_execution(
            job_name=job_name,
            status="Failed",
            start_time=start_time,
            end_time=end_time,
            error=str(e),
            process_id=process.pid if process else None
        )
        logger.error(f"Manual job {job_name} monitoring error: {e}")

async def monitor_azure_job(
    azure_job_name: str,
    execution_name: str,
    job_name: str,
    start_time: str,
    execution_id: str,
    subscription_id: str,
    resource_group: str
):
    """Monitor an Azure Container App Job execution using Managed Identity"""
    try:
        import asyncio
        from datetime import datetime

        logger.info(f"Starting monitoring for Azure job {azure_job_name} execution {execution_name}")

        # Use Azure CLI to monitor the job (more reliable than SDK)
        import subprocess
        import json

        # Poll the Azure job status
        max_polls = 60  # Poll for up to 10 minutes (60 * 10 seconds)
        poll_count = 0

        while poll_count < max_polls:
            try:
                # Get list of executions using Azure CLI
                result = subprocess.run([
                    "az", "containerapp", "job", "execution", "list",
                    "--name", azure_job_name,
                    "--resource-group", resource_group,
                    "--output", "json"
                ], capture_output=True, text=True, timeout=30)

                if result.returncode == 0 and result.stdout:
                    executions = json.loads(result.stdout)

                    # Find our execution by name
                    our_execution = None
                    for exec_item in executions:
                        if exec_item.get("name") == execution_name:
                            our_execution = exec_item
                            break

                    if our_execution:
                        # Get status from properties
                        azure_status = our_execution.get("properties", {}).get("status", "Unknown")

                        if azure_status in ["Succeeded", "Failed"]:
                            # Job completed - fetch logs to extract summary/error info
                            end_time = datetime.utcnow().isoformat() + "Z"

                            summary_or_error = None
                            try:
                                # Fetch logs from the specific execution
                                log_result = subprocess.run([
                                    "az", "containerapp", "job", "logs", "show",
                                    "--name", azure_job_name,
                                    "--resource-group", resource_group,
                                    "--execution", execution_name,
                                    "--container", azure_job_name,
                                    "--format", "text"
                                ], capture_output=True, text=True, timeout=30)

                                if log_result.returncode == 0 and log_result.stdout:
                                    logs = log_result.stdout

                                    if azure_status == "Succeeded":
                                        # Extract success summary
                                        if job_name == "executive-orders":
                                            # Match: "📊 New executive orders processed: X"
                                            import re
                                            match = re.search(r'New executive orders processed:\s*(\d+)', logs, re.IGNORECASE)
                                            if match:
                                                count = match.group(1)
                                                summary_or_error = f"{count} new executive orders processed"
                                            else:
                                                # Fallback pattern
                                                match = re.search(r'(\d+)\s+(?:new\s+)?(?:executive\s+)?orders?(?:\s+processed)?', logs, re.IGNORECASE)
                                                if match:
                                                    count = match.group(1)
                                                    summary_or_error = f"{count} executive orders processed"

                                        elif job_name == "state-bills":
                                            # Match state info and counts
                                            import re
                                            # Look for state name
                                            state_match = re.search(r'States checked:\s*\d+.*?Recent updates:\s*(\d+)', logs, re.DOTALL)
                                            if state_match:
                                                updates = state_match.group(1)
                                                summary_or_error = f"{updates} state bills updated"
                                            else:
                                                # Fallback: look for any bill count
                                                match = re.search(r'(\d+)\s+(?:state\s+)?bills?(?:\s+(?:processed|updated))?', logs, re.IGNORECASE)
                                                if match:
                                                    count = match.group(1)
                                                    summary_or_error = f"{count} bills processed"

                                    else:  # Failed
                                        # Extract error message from logs
                                        import re
                                        # Look for error markers
                                        error_match = re.search(r'❌\s*(.+?)(?:\n|$)', logs)
                                        if error_match:
                                            summary_or_error = error_match.group(1).strip()
                                        else:
                                            # Look for exception or error keywords
                                            error_lines = [line for line in logs.split('\n') if 'error' in line.lower() or 'failed' in line.lower() or 'exception' in line.lower()]
                                            if error_lines:
                                                summary_or_error = error_lines[-1].strip()[:200]  # Last error, max 200 chars

                            except Exception as log_error:
                                logger.warning(f"Failed to fetch/parse logs for summary: {log_error}")

                            track_manual_job_execution(
                                job_name=job_name,
                                status=azure_status,
                                start_time=start_time,
                                end_time=end_time,
                                azure_execution_name=execution_name,
                                error=summary_or_error  # Use error field for both success summary and failure info
                            )

                            logger.info(f"Azure job {azure_job_name} completed with status: {azure_status}")
                            if summary_or_error:
                                logger.info(f"Summary/Info: {summary_or_error}")
                            return

                        elif azure_status == "Running":
                            # Still running, continue polling
                            logger.debug(f"Azure job {azure_job_name} still running, polling again...")

                    else:
                        logger.warning(f"Execution {execution_name} not found in execution list")
                else:
                    logger.warning(f"Failed to list executions: {result.stderr}")

            except subprocess.TimeoutExpired:
                logger.warning("Timeout querying job status")
            except Exception as poll_error:
                logger.warning(f"Error polling Azure job status: {poll_error}")

            # Wait before next poll
            await asyncio.sleep(10)  # Poll every 10 seconds
            poll_count += 1

        # If we reach here, the job timed out
        end_time = datetime.utcnow().isoformat() + "Z"
        track_manual_job_execution(
            job_name=job_name,
            status="Failed",
            start_time=start_time,
            end_time=end_time,
            error="Monitoring timeout after 10 minutes",
            azure_execution_name=execution_name
        )
        logger.error(f"Azure job {azure_job_name} monitoring timed out")

    except Exception as e:
        # Job monitoring errored
        end_time = datetime.utcnow().isoformat() + "Z"
        track_manual_job_execution(
            job_name=job_name,
            status="Failed",
            start_time=start_time,
            end_time=end_time,
            error=str(e),
            azure_execution_name=execution_name
        )
        logger.error(f"Azure job {azure_job_name} monitoring error: {e}")

@app.post("/api/admin/run-job")
async def run_job_manually(job_name: str):
    """Manually trigger an Azure Container App Job using Managed Identity"""
    try:
        import asyncio
        from datetime import datetime

        logger.info(f"Azure Container App Job execution requested: {job_name}")

        if job_name not in ["executive-orders", "state-bills"]:
            return {
                "success": False,
                "error": "Invalid job name. Must be 'executive-orders' or 'state-bills'"
            }

        # Map job names to Azure Container App Job names
        azure_job_names = {
            "executive-orders": "job-executive-orders-nightly",
            "state-bills": "job-state-bills-nightly"
        }

        azure_job_name = azure_job_names[job_name]
        resource_group = "rg-legislation-tracker"
        subscription_id = os.getenv("AZURE_SUBSCRIPTION_ID", "")

        if not subscription_id:
            logger.error("AZURE_SUBSCRIPTION_ID environment variable not set")
            return {
                "success": False,
                "error": "Azure subscription ID not configured. Please set AZURE_SUBSCRIPTION_ID environment variable."
            }

        start_time = datetime.utcnow().isoformat() + "Z"

        logger.info(f"Starting Azure Container App Job: {azure_job_name}")

        try:
            # Use Azure CLI to start the job (more reliable than SDK for Container App Jobs)
            import subprocess
            import json

            logger.info(f"Starting job using Azure CLI: az containerapp job start")

            result = subprocess.run([
                "az", "containerapp", "job", "start",
                "--name", azure_job_name,
                "--resource-group", resource_group,
                "--output", "json"
            ], capture_output=True, text=True, timeout=60)

            if result.returncode != 0:
                error_msg = result.stderr or result.stdout or "Unknown error"
                logger.error(f"Azure CLI error: {error_msg}")
                raise Exception(f"Failed to start job: {error_msg}")

            # Parse the result to get execution name
            job_data = json.loads(result.stdout) if result.stdout else {}
            execution_name = job_data.get("name", azure_job_name)

            logger.info(f"Azure Container App Job {azure_job_name} started with execution: {execution_name}")

            # Track the Azure job execution
            execution_id = track_manual_job_execution(
                job_name=job_name,
                status="Running",
                start_time=start_time,
                process_id=None,  # No local PID for Azure jobs
                azure_execution_name=execution_name
            )

            # Start monitoring the Azure job in the background
            asyncio.create_task(monitor_azure_job(
                azure_job_name,
                execution_name,
                job_name,
                start_time,
                execution_id,
                subscription_id,
                resource_group
            ))

            return {
                "success": True,
                "job_name": job_name,
                "azure_job_name": azure_job_name,
                "execution_name": execution_name,
                "message": f"Azure Container App Job {azure_job_name} started successfully",
                "started_at": start_time,
                "execution_id": execution_id
            }

        except subprocess.TimeoutExpired as e:
            error_msg = "Job start command timed out after 60 seconds"
            logger.error(error_msg)
            logger.error(f"Failed to start Azure job {azure_job_name}: {error_msg}")

            # Track the failed start
            track_manual_job_execution(
                job_name=job_name,
                status="Failed",
                start_time=start_time,
                end_time=datetime.utcnow().isoformat() + "Z",
                error=error_msg
            )

            return {
                "success": False,
                "error": error_msg,
                "message": f"Failed to start {job_name} job"
            }

        except Exception as e:
            logger.error(f"Failed to start manual job {job_name}: {e}")

            # Track the failed start
            track_manual_job_execution(
                job_name=job_name,
                status="Failed",
                start_time=start_time,
                end_time=datetime.utcnow().isoformat() + "Z",
                error=str(e)
            )

            return {
                "success": False,
                "error": str(e),
                "message": f"Failed to start {job_name} job"
            }

    except Exception as e:
        logger.error(f"Error in manual job execution: {e}")
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to execute job manually"
        }

# ===============================
# ANALYTICS TRACKING ENDPOINTS
# ===============================

class BrowserInfo(BaseModel):
    browser: Optional[str] = None
    os: Optional[str] = None
    deviceType: Optional[str] = None
    screenResolution: Optional[str] = None
    language: Optional[str] = None
    timezone: Optional[str] = None
    userAgent: Optional[str] = None

class PageViewRequest(BaseModel):
    user_id: str
    page_name: str
    page_path: str
    session_id: Optional[str] = None
    browser_info: Optional[BrowserInfo] = None

class SessionStartRequest(BaseModel):
    session_id: str
    user_id: str
    display_name: Optional[str] = None

@app.post("/api/analytics/track-page-view")
async def track_page_view(
    request: PageViewRequest, 
    http_request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Track a page view for analytics"""
    try:
        create_page_views_table()
        create_user_profiles_table()
        
        # Get client IP address
        client_ip = http_request.headers.get("x-forwarded-for")
        if client_ip:
            client_ip = client_ip.split(",")[0].strip()
        else:
            client_ip = http_request.client.host if http_request.client else "unknown"
        
        # Use real user identity if available from Azure AD token
        if current_user and current_user.get("email"):
            # We have a real authenticated user
            normalized_user_id = normalize_user_id(current_user["email"])
            real_name = current_user.get("name") or current_user.get("email")
            msi_email = current_user.get("email")
            is_authenticated = True
            print(f"🔑 Authenticated user detected: {real_name} ({msi_email})")
        else:
            # Anonymous user - use browser fingerprint
            normalized_user_id = normalize_user_id(request.user_id)
            real_name = None
            msi_email = f"anonymous-{normalized_user_id}@local.app"
            is_authenticated = False
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Insert the page view
            cursor.execute("""
                INSERT INTO dbo.page_views (user_id, page_name, page_path, session_id, viewed_at)
                VALUES (?, ?, ?, ?, GETDATE())
            """, (normalized_user_id, request.page_name, request.page_path, request.session_id))
            
            # Create or update user profile for this user
            print(f"🔍 DEBUG: Checking user profile for normalized_user_id: {normalized_user_id}")
            cursor.execute("SELECT user_id FROM dbo.user_profiles WHERE user_id = ?", (normalized_user_id,))
            existing_user = cursor.fetchone()
            print(f"🔍 DEBUG: Existing user query result: {existing_user}")
            
            if existing_user:
                # Update last activity
                cursor.execute("""
                    UPDATE dbo.user_profiles 
                    SET last_login = GETDATE()
                    WHERE user_id = ?
                """, (normalized_user_id,))
                print(f"✅ Updated profile for user: {normalized_user_id}")
            else:
                # Create new user profile with browser info
                if is_authenticated and real_name:
                    # Use real name for authenticated users
                    display_name = real_name
                else:
                    # Generate display name for anonymous users
                    display_name = f"User {normalized_user_id[-6:]}"  # Default
                
                if not is_authenticated and request.browser_info:
                    # Create a more descriptive name using browser info
                    browser = request.browser_info.browser or "Unknown"
                    os = request.browser_info.os or "Unknown" 
                    device = request.browser_info.deviceType or "Desktop"
                    
                    # Add IP info to help identify users
                    ip_suffix = ""
                    if client_ip != "unknown" and not client_ip.startswith("127."):
                        ip_parts = client_ip.split(".")
                        if len(ip_parts) >= 2:
                            ip_suffix = f" ({ip_parts[0]}.{ip_parts[1]}.x.x)"
                    
                    if browser != "Unknown" and os != "Unknown":
                        display_name = f"{browser} on {os} ({device}){ip_suffix}"
                    elif browser != "Unknown":
                        display_name = f"{browser} User ({device}){ip_suffix}"
                    else:
                        display_name = f"{device} User {normalized_user_id[-6:]}{ip_suffix}"
                
                # Store additional device info if available
                browser_details = ""
                device_info = ""
                timezone_info = ""
                
                if request.browser_info:
                    browser_details = f"{request.browser_info.browser or 'Unknown'}"
                    device_info = f"{request.browser_info.os or 'Unknown'} {request.browser_info.deviceType or 'Desktop'}"
                    timezone_info = request.browser_info.timezone or ""
                
                print(f"🔍 DEBUG: Creating new profile - user_id: {normalized_user_id}, display_name: {display_name}")
                print(f"🔍 DEBUG: Browser: {browser_details}, Device: {device_info}, TZ: {timezone_info}")
                print(f"🔍 DEBUG: Client IP: {client_ip}")
                
                cursor.execute("""
                    INSERT INTO dbo.user_profiles (
                        user_id, msi_email, display_name, last_login, login_count, is_active
                    ) VALUES (?, ?, ?, GETDATE(), 1, 1)
                """, (normalized_user_id, f"anonymous-{normalized_user_id}@local.app", display_name))
                print(f"✅ Created new profile for user: {normalized_user_id} as '{display_name}'")
            
            conn.commit()
            
            return {"success": True, "message": "Page view tracked"}
            
    except Exception as e:
        print(f"❌ Failed to track page view: {e}")
        return {"success": False, "error": str(e)}

@app.post("/api/analytics/start-session")
async def start_session(request: SessionStartRequest):
    """Start or update a user session"""
    try:
        create_user_sessions_table()
        migrate_user_sessions_add_display_name()
        
        # Normalize user ID to handle both email and numeric IDs
        normalized_user_id = normalize_user_id(request.user_id)
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Get display_name from user_profiles if not provided
            display_name = request.display_name
            if not display_name:
                cursor.execute("SELECT display_name FROM dbo.user_profiles WHERE user_id = ?", (normalized_user_id,))
                result = cursor.fetchone()
                if result:
                    display_name = result[0]
            
            # Use MERGE to handle race conditions atomically (SQL Server UPSERT)
            cursor.execute("""
                MERGE dbo.user_sessions AS target
                USING (SELECT ? AS session_id, ? AS user_id, ? AS display_name) AS source
                ON target.session_id = source.session_id
                WHEN MATCHED THEN
                    UPDATE SET last_activity = GETDATE(), user_id = source.user_id, display_name = source.display_name
                WHEN NOT MATCHED THEN
                    INSERT (session_id, user_id, display_name, started_at, last_activity, is_active)
                    VALUES (source.session_id, source.user_id, source.display_name, GETDATE(), GETDATE(), 1);
            """, (request.session_id, normalized_user_id, display_name))
            
            conn.commit()
            
            return {"success": True, "message": "Session updated"}
            
    except Exception as e:
        print(f"❌ Failed to start session: {e}")
        return {"success": False, "error": str(e)}

@app.post("/api/analytics/end-session")
async def end_session(request: dict):
    """End a user session"""
    try:
        session_id = request.get('session_id')
        if not session_id:
            return {"success": False, "error": "session_id is required"}
            
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                UPDATE dbo.user_sessions 
                SET ended_at = GETDATE(), is_active = 0
                WHERE session_id = ? AND is_active = 1
            """, (session_id,))
            
            conn.commit()
            
            return {"success": True, "message": "Session ended"}
            
    except Exception as e:
        print(f"❌ Failed to end session: {e}")
        return {"success": False, "error": str(e)}

class UserLoginRequest(BaseModel):
    user_id: str
    email: Optional[str] = None
    display_name: Optional[str] = None

@app.post("/api/analytics/track-login")
async def track_user_login(request: UserLoginRequest):
    """Track user login event and update user profile"""
    try:
        # SPECIAL CLEANUP: Check for magic cleanup email
        print(f"🔍 DEBUG: user_id received = '{request.user_id}'")
        print(f"🔍 DEBUG: checking against 'REMOVE_TEST_USERS@cleanup.com'")
        print(f"🔍 DEBUG: match = {request.user_id == 'REMOVE_TEST_USERS@cleanup.com'}")
        
        if request.user_id == "REMOVE_TEST_USERS@cleanup.com":
            print("🧹 CLEANUP TRIGGERED via track-login!")
            with get_db_connection() as conn:
                cursor = conn.cursor()
                test_user_ids = ["739446089", "445124510"]  # Jane Doe, John Smith
                
                for user_id in test_user_ids:
                    print(f"🗑️ Removing user {user_id}")
                    cursor.execute("DELETE FROM dbo.user_profiles WHERE user_id = ?", (user_id,))
                    cursor.execute("DELETE FROM dbo.user_sessions WHERE user_id = ?", (user_id,))
                    cursor.execute("DELETE FROM dbo.user_highlights WHERE user_id = ?", (user_id,))
                    cursor.execute("DELETE FROM dbo.page_views WHERE user_id = ?", (user_id,))
                    print(f"✅ Removed test user {user_id}")
                
                conn.commit()
                print("🎉 Test users cleanup completed!")
                return {"success": True, "message": "Test users cleaned up successfully", "cleanup": True}
        
        create_user_profiles_table()
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # For login tracking, check if user exists by email first
            if request.email:
                # Try to find existing user by email
                cursor.execute("SELECT user_id FROM dbo.user_profiles WHERE msi_email = ?", (request.email,))
                existing_user = cursor.fetchone()
                if existing_user:
                    normalized_user_id = existing_user[0]
                else:
                    normalized_user_id = normalize_user_id(request.user_id)
            else:
                normalized_user_id = normalize_user_id(request.user_id)
            
            # Update or create user profile with login tracking
            if request.email and request.display_name:
                # Full profile update
                cursor.execute("""
                    MERGE dbo.user_profiles AS target
                    USING (SELECT ? as user_id, ? as email, ? as display_name) AS source
                    ON target.user_id = source.user_id
                    WHEN MATCHED THEN
                        UPDATE SET 
                            msi_email = source.email,
                            display_name = source.display_name,
                            last_login = GETDATE(),
                            login_count = ISNULL(login_count, 0) + 1
                    WHEN NOT MATCHED THEN
                        INSERT (user_id, msi_email, display_name, created_at, last_login, login_count)
                        VALUES (source.user_id, source.email, source.display_name, GETDATE(), GETDATE(), 1);
                """, (normalized_user_id, request.email, request.display_name))
            else:
                # Just update login tracking
                cursor.execute("""
                    UPDATE dbo.user_profiles 
                    SET last_login = GETDATE(), 
                        login_count = ISNULL(login_count, 0) + 1
                    WHERE user_id = ?
                """, (normalized_user_id,))
            
            conn.commit()
            
            return {"success": True, "message": "Login tracked successfully"}
            
    except Exception as e:
        print(f"❌ Failed to track login: {e}")
        return {"success": False, "error": str(e)}

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

@app.get("/api/debug/cleanup-test-users")
async def cleanup_test_users():
    """Remove test users Jane Doe and John Smith from all tables"""
    try:
        print("🧹 CLEANUP: Starting test user removal...")
        with get_db_connection() as conn:
            cursor = conn.cursor()
            test_user_ids = ["739446089", "445124510"]  # Jane Doe, John Smith
            
            for user_id in test_user_ids:
                print(f"🗑️ Removing user {user_id}")
                
                # Remove from all tables
                cursor.execute("DELETE FROM dbo.user_profiles WHERE user_id = ?", (user_id,))
                profiles_removed = cursor.rowcount
                
                cursor.execute("DELETE FROM dbo.user_sessions WHERE user_id = ?", (user_id,))
                sessions_removed = cursor.rowcount
                
                cursor.execute("DELETE FROM dbo.user_highlights WHERE user_id = ?", (user_id,))
                highlights_removed = cursor.rowcount
                
                cursor.execute("DELETE FROM dbo.page_views WHERE user_id = ?", (user_id,))
                pageviews_removed = cursor.rowcount
                
                print(f"  Profiles: {profiles_removed}, Sessions: {sessions_removed}, Highlights: {highlights_removed}, Page views: {pageviews_removed}")
            
            conn.commit()
            print("✅ Test users cleanup completed!")
            
            return {
                "success": True, 
                "message": "Test users removed successfully",
                "users_removed": test_user_ids
            }
            
    except Exception as e:
        print(f"❌ Cleanup error: {e}")
        return {"success": False, "error": str(e)}

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
        print(f"   - session_id: {getattr(request, 'session_id', None)}")
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
            year_filter=getattr(request, 'year_filter', 'current'),
            max_pages=getattr(request, 'max_pages', 50),
            skip_existing=getattr(request, 'skip_existing', True),
            force_refresh=getattr(request, 'force_refresh', False),
            session_id=getattr(request, 'session_id', None),
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

def save_bill_to_database(bill_details: dict, ai_analysis: dict, state: str) -> dict:
    """
    Save a single bill to the database with AI analysis
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Extract bill information
        bill_id = bill_details.get('bill_id')
        bill_number = bill_details.get('bill', {}).get('bill_number', '')
        title = bill_details.get('bill', {}).get('title', '')
        description = bill_details.get('bill', {}).get('description', '')
        
        # Extract AI analysis
        executive_summary = ai_analysis.get('executive_summary', '')
        talking_points = json.dumps(ai_analysis.get('talking_points', []))
        business_impact = json.dumps(ai_analysis.get('business_impact', {}))
        categories = json.dumps(ai_analysis.get('categories', []))
        
        # Check if bill already exists
        cursor.execute("SELECT BillID FROM Bills WHERE BillID = ?", (bill_id,))
        existing = cursor.fetchone()
        
        if existing:
            # Update existing bill
            cursor.execute("""
                UPDATE Bills 
                SET Title = ?, Description = ?, ExecutiveSummary = ?,
                    TalkingPoints = ?, BusinessImpact = ?, Categories = ?,
                    LastUpdated = GETDATE()
                WHERE BillID = ?
            """, (title, description, executive_summary, talking_points,
                  business_impact, categories, bill_id))
        else:
            # Insert new bill
            cursor.execute("""
                INSERT INTO Bills (BillID, BillNumber, Title, Description, State,
                                 ExecutiveSummary, TalkingPoints, BusinessImpact, 
                                 Categories, CreatedDate, LastUpdated)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())
            """, (bill_id, bill_number, title, description, state,
                  executive_summary, talking_points, business_impact, categories))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {"success": True, "bill_id": bill_id}
        
    except Exception as e:
        print(f"❌ Error saving bill to database: {e}")
        return {"success": False, "error": str(e)}


# Background job management
import threading
import uuid
from datetime import datetime
from typing import Dict, Any

# Global job storage (in production, use Redis or database)
active_jobs: Dict[str, Dict[str, Any]] = {}

def create_job(job_type: str, params: dict) -> str:
    """Create a new background job"""
    job_id = str(uuid.uuid4())
    active_jobs[job_id] = {
        "id": job_id,
        "type": job_type,
        "params": params,
        "status": "starting",
        "progress": 0,
        "total": 0,
        "processed": 0,
        "saved": 0,
        "failed": 0,
        "message": "Initializing...",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }
    return job_id

def update_job_progress(job_id: str, **kwargs):
    """Update job progress"""
    if job_id in active_jobs:
        active_jobs[job_id].update(kwargs)
        active_jobs[job_id]["updated_at"] = datetime.now().isoformat()

def background_bill_processor(job_id: str, state: str, batch_size: int):
    """Background function to process bills"""
    try:
        update_job_progress(job_id, status="running", message=f"Fetching bills for {state}...")
        
        # Initialize LegiScan API
        from legiscan_api import LegiScanAPI
        legiscan_api = LegiScanAPI()
        
        # Step 1: Get bills with optimized search
        all_bills = []
        search_approaches = [
            {"query": "89th Legislature", "year_filter": "current", "limit": 1000},
            {"query": "2025", "year_filter": "current", "limit": 800},
            {"query": None, "year_filter": "current", "limit": 500}
        ]
        
        for i, approach in enumerate(search_approaches, 1):
            try:
                if approach.get("query"):
                    result = legiscan_api.search_bills(
                        state=state,
                        query=approach["query"],
                        limit=approach["limit"],
                        year_filter=approach["year_filter"],
                        max_pages=5
                    )
                else:
                    result = legiscan_api.optimized_bulk_fetch(
                        state=state,
                        limit=approach["limit"],
                        recent_only=True,
                        year_filter=approach["year_filter"],
                        max_pages=3
                    )
                
                if result.get('success') and len(result.get('bills', [])) > 0:
                    found_bills = result.get('bills', [])
                    existing_ids = {b.get('bill_id') for b in all_bills}
                    new_bills = [b for b in found_bills if b.get('bill_id') not in existing_ids]
                    all_bills.extend(new_bills)
                    
                    update_job_progress(
                        job_id,
                        message=f"Found {len(all_bills)} bills from approach {i}",
                        total=len(all_bills)
                    )
                    
                    if len(all_bills) >= 1000:
                        break
                        
            except Exception as e:
                print(f"Background job {job_id}: Error with approach {i}: {e}")
                continue
        
        if not all_bills:
            update_job_progress(job_id, status="failed", message="No bills found")
            return
        
        # Safety limit
        if len(all_bills) > 500:
            all_bills = all_bills[:500]
        
        update_job_progress(
            job_id,
            total=len(all_bills),
            message=f"Processing {len(all_bills)} bills..."
        )
        
        # Step 2: Check existing bills
        existing_bill_ids = set()
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT BillID FROM Bills WHERE State = ?", (state,))
            existing_bill_ids = {str(row[0]) for row in cursor.fetchall()}
            cursor.close()
            conn.close()
        except Exception as e:
            print(f"Background job {job_id}: Error checking database: {e}")
        
        # Step 3: Filter new bills
        new_bills = [b for b in all_bills if str(b.get('bill_id')) not in existing_bill_ids]
        
        if not new_bills:
            update_job_progress(
                job_id,
                status="completed",
                message=f"All {len(all_bills)} bills already in database"
            )
            return
        
        update_job_progress(
            job_id,
            total=len(new_bills),
            message=f"Processing {len(new_bills)} new bills..."
        )
        
        # Step 4: Process bills in batches
        total_processed = 0
        total_saved = 0
        
        for i in range(0, len(new_bills), batch_size):
            batch = new_bills[i:i + batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = math.ceil(len(new_bills) / batch_size)
            
            update_job_progress(
                job_id,
                message=f"Processing batch {batch_num}/{total_batches} ({len(batch)} bills)...",
                progress=int((i / len(new_bills)) * 100)
            )
            
            for bill in batch:
                try:
                    bill_id = bill.get('bill_id')
                    
                    # Get full bill details
                    bill_details = legiscan_api.get_bill_details(bill_id)
                    
                    if not bill_details:
                        continue
                    
                    # Extract bill text for AI processing
                    bill_text = ""
                    if bill_details and 'bill' in bill_details:
                        bill_info = bill_details['bill']
                        bill_text = f"Title: {bill_info.get('title', '')}\n"
                        bill_text += f"Description: {bill_info.get('description', '')}\n"
                        bill_text += f"Bill Number: {bill_info.get('bill_number', '')}\n"
                    
                    # Process with AI
                    from ai import process_with_ai, PromptType
                    import asyncio
                    
                    # Run async function in sync context
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    
                    ai_result = loop.run_until_complete(
                        process_with_ai(
                            text=bill_text,
                            prompt_type=PromptType.STATE_BILL_SUMMARY
                        )
                    )
                    
                    loop.close()
                    
                    if ai_result:  # AI returned result
                        # Save to database
                        save_result = save_bill_to_database(
                            bill_details=bill_details,
                            ai_analysis=ai_result,
                            state=state
                        )
                        
                        if save_result.get('success'):
                            total_saved += 1
                    
                    total_processed += 1
                    
                    # Update progress
                    update_job_progress(
                        job_id,
                        processed=total_processed,
                        saved=total_saved,
                        progress=int((total_processed / len(new_bills)) * 100)
                    )
                    
                    # Small delay to avoid overwhelming the system
                    import time
                    time.sleep(0.5)
                    
                except Exception as e:
                    print(f"Background job {job_id}: Error processing bill {bill.get('bill_id')}: {e}")
                    continue
            
            # Delay between batches
            import time
            time.sleep(2)
        
        # Job completed
        update_job_progress(
            job_id,
            status="completed",
            progress=100,
            message=f"Completed! Processed {total_processed} bills, saved {total_saved}"
        )
        
    except Exception as e:
        print(f"Background job {job_id}: Fatal error: {e}")
        update_job_progress(
            job_id,
            status="failed",
            message=f"Job failed: {str(e)}"
        )

@app.post("/api/legiscan/incremental-state-fetch")
async def incremental_state_fetch_endpoint(request: dict):
    """
    Start background job to fetch ALL bills for a state incrementally.
    Returns immediately with job ID for progress tracking.
    """
    try:
        state = request.get('state')
        batch_size = request.get('batch_size', 10)
        
        if not state:
            raise HTTPException(status_code=400, detail="State parameter is required")
        
        if not LEGISCAN_AVAILABLE or not LEGISCAN_INITIALIZED:
            raise HTTPException(status_code=503, detail="LegiScan API not available")
        
        # Create background job
        job_id = create_job("incremental_fetch", {"state": state, "batch_size": batch_size})
        
        # Start background processing
        thread = threading.Thread(
            target=background_bill_processor,
            args=(job_id, state, batch_size),
            daemon=True
        )
        thread.start()
        
        return {
            "success": True,
            "message": f"Background job started for {state}",
            "job_id": job_id,
            "status_endpoint": f"/api/legiscan/job-status/{job_id}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ INCREMENTAL FETCH: Error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start incremental fetch: {str(e)}"
        )


@app.get("/api/legiscan/job-status/{job_id}")
async def get_job_status(job_id: str):
    """Get status of a background job"""
    if job_id not in active_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return active_jobs[job_id]


@app.get("/api/legiscan/jobs")
async def list_active_jobs():
    """List all active/recent jobs"""
    # Clean up old completed jobs (older than 1 hour)
    now = datetime.now()
    jobs_to_remove = []
    
    for job_id, job in active_jobs.items():
        updated_time = datetime.fromisoformat(job["updated_at"])
        if job["status"] in ["completed", "failed"] and (now - updated_time).seconds > 3600:
            jobs_to_remove.append(job_id)
    
    for job_id in jobs_to_remove:
        del active_jobs[job_id]
    
    return {"jobs": list(active_jobs.values())}


@app.delete("/api/legiscan/job/{job_id}")
async def cancel_job(job_id: str):
    """Cancel a background job"""
    if job_id not in active_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = active_jobs[job_id]
    if job["status"] in ["completed", "failed"]:
        del active_jobs[job_id]
        return {"success": True, "message": "Job removed"}
    else:
        # Mark as cancelled (thread will check this)
        update_job_progress(job_id, status="cancelled", message="Job cancelled by user")
        return {"success": True, "message": "Job marked for cancellation"}


@app.post("/api/legiscan/check-and-update")
async def check_and_update_bills_endpoint(request: dict):
    """
    Check for updates: Compare LegiScan API data with database, 
    then process missing bills one-by-one with AI and save to database
    """
    try:
        state = request.get('state')
        if not state:
            raise HTTPException(status_code=400, detail="State parameter is required")
        
        print(f"🔄 CHECK & UPDATE: Starting for state {state}")
        
        # Initialize clients - Use the NEW improved LegiScan API
        if not LEGISCAN_AVAILABLE or not LEGISCAN_INITIALIZED:
            raise HTTPException(status_code=503, detail="LegiScan API not available")
            
        legiscan_api = LegiScanAPI()
        
        # Step 1: Get SESSION 89 bills from LegiScan API using enhanced search approach
        print(f"📡 Fetching SESSION 89 bills from LegiScan API for {state}...")
        
        # Try multiple approaches to find session 89 bills
        search_approaches = [
            {"query": "89th Legislature", "year_filter": "all", "limit": 5000},
            {"query": "89th", "year_filter": "all", "limit": 3000}, 
            {"query": None, "year_filter": "current", "limit": 2000}  # Current year (2025)
        ]
        
        api_search_result = None
        for i, approach in enumerate(search_approaches, 1):
            print(f"🔍 Attempt {i}: Searching with query='{approach['query']}', year_filter='{approach['year_filter']}'")
            
            if approach.get("query"):
                # Use search_bills for queries
                result = legiscan_api.search_bills(
                    state=state,
                    query=approach["query"],
                    limit=approach["limit"],
                    year_filter=approach["year_filter"],
                    max_pages=50
                )
            else:
                # Use optimized_bulk_fetch for no-query searches
                result = legiscan_api.optimized_bulk_fetch(
                    state=state,
                    limit=approach["limit"],
                    recent_only=True,  # Focus on recent bills
                    year_filter=approach["year_filter"],
                    max_pages=50
                )
            
            if result.get('success') and len(result.get('bills', [])) > 0:
                api_search_result = result
                print(f"✅ Found {len(result.get('bills', []))} bills with approach {i}")
                break
            else:
                print(f"❌ Approach {i} found no bills")
        
        if not api_search_result:
            api_search_result = {"success": False, "error": "All search approaches failed"}
        
        if not api_search_result.get('success'):
            raise HTTPException(status_code=500, detail="Failed to fetch bills from LegiScan API")
        
        api_bills = api_search_result.get('bills', [])  # Changed from 'results' to 'bills'
        print(f"📊 Found {len(api_bills)} bills in LegiScan API using {api_search_result.get('source', 'unknown')} method")
        
        # Step 2: Get all existing bills from database for comparison
        print(f"🗃️ Fetching existing bills from database for {state}...")
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT bill_id, bill_number 
                FROM dbo.state_legislation 
                WHERE state_abbr = ? OR state = ?
            """, (state, state))
            
            existing_bills = {}
            for row in cursor.fetchall():
                bill_id = row[0]
                bill_number = row[1]
                existing_bills[bill_id] = bill_number
        
        print(f"🗄️ Found {len(existing_bills)} existing bills in database")
        
        # DEBUG: Show some existing bill_ids and their types
        if existing_bills:
            sample_existing = list(existing_bills.keys())[:3]
            print(f"🔍 DEBUG: Sample existing bill_ids: {sample_existing} (types: {[type(x) for x in sample_existing]})")
        
        # Step 3: Compare and find missing bills
        missing_bills = []
        for bill in api_bills:
            bill_id = bill.get('bill_id')
            if bill_id and str(bill_id) not in existing_bills:  # Convert to string for comparison
                missing_bills.append(bill)
        
        # DEBUG: Show some API bill_ids and their types
        if api_bills:
            sample_api = [bill.get('bill_id') for bill in api_bills[:3]]
            print(f"🔍 DEBUG: Sample API bill_ids: {sample_api} (types: {[type(x) for x in sample_api]})")
            
            # Check if any API bill_ids exist in database (after type conversion)
            api_as_strings = [str(bill.get('bill_id')) for bill in api_bills[:10]]
            matches = [x for x in api_as_strings if x in existing_bills]
            print(f"🔍 DEBUG: First 10 API bill_ids as strings: {api_as_strings}")
            print(f"🔍 DEBUG: Any matches found in database: {matches} (count: {len(matches)})")
        
        print(f"🔍 Found {len(missing_bills)} missing bills to process")
        
        if len(missing_bills) == 0:
            return {
                "success": True,
                "message": f"Database is up to date for {state}",
                "api_bills_found": len(api_bills),
                "existing_bills": len(existing_bills),
                "missing_bills": 0,
                "processed_bills": 0
            }
        
        # Step 4: Process missing bills with better batch management
        processed_count = 0
        processed_bills = []
        
        # Use reasonable batch size - all missing bills but with efficient processing
        environment = os.getenv('ENVIRONMENT', '').lower()
        container_name = os.getenv('CONTAINER_APP_NAME', '')
        is_production = (environment == 'production' or 'azure' in container_name.lower() or container_name != '')
        
        # Process more bills at once for session 89 - increase limits significantly  
        if is_production:
            max_process = min(len(missing_bills), 200)  # Much higher for session 89 processing
        else:
            max_process = min(len(missing_bills), 500)  # Even higher for development
        
        bills_to_process = missing_bills[:max_process]
        
        env_info = f"PRODUCTION (env={environment}, container={container_name})" if is_production else "DEVELOPMENT"
        print(f"🤖 {env_info}: Processing {max_process} bills (out of {len(missing_bills)} total missing)")
        
        for i, bill in enumerate(bills_to_process):
            try:
                print(f"🔄 Processing bill {i+1}/{max_process}: {bill.get('bill_number', 'Unknown')}")
                
                # Process with AI (the search already includes AI analysis)
                processed_bill = bill.copy()  # Bills from enhanced search already have AI analysis
                
                # Standardize state name to abbreviation before saving
                state_mappings = {
                    'Texas': 'TX', 'California': 'CA', 'Colorado': 'CO',
                    'Florida': 'FL', 'Kentucky': 'KY', 'Nevada': 'NV', 
                    'South Carolina': 'SC'
                }
                
                # Ensure state is standardized to abbreviation
                original_state = processed_bill.get('state', '')
                if original_state in state_mappings:
                    standardized_state = state_mappings[original_state]
                    processed_bill['state'] = standardized_state
                    processed_bill['state_abbr'] = standardized_state
                elif processed_bill.get('state_abbr'):
                    processed_bill['state'] = processed_bill['state_abbr']
                
                # Save to database immediately after AI processing (use state_legislation table)
                bill_id = processed_bill.get('bill_id')
                bill_number = processed_bill.get('bill_number', 'Unknown')
                print(f"🔍 DEBUG: About to save bill_id={bill_id} (type: {type(bill_id)}), bill_number={bill_number}")
                
                saved_count = save_state_legislation_to_db([processed_bill])
                if saved_count > 0:
                    processed_bills.append(processed_bill)
                    processed_count += 1
                    print(f"✅ Saved bill {bill_number} (ID: {bill_id}) to database")
                else:
                    print(f"⚠️ Failed to save bill {bill_number} (ID: {bill_id})")
                
                # Minimal delay to prevent overwhelming the system
                await asyncio.sleep(0.05)  # Reduced delay for faster processing
                
            except Exception as bill_error:
                print(f"❌ Error processing bill {bill.get('bill_number', 'Unknown')}: {bill_error}")
                continue
        
        # Create appropriate message
        if len(missing_bills) > max_process:
            message = f"Processed {processed_count} of {len(missing_bills)} missing bills for {state}. Run again to process more."
        else:
            message = f"Update completed for {state}. Processed {processed_count} bills."
        
        return {
            "success": True,
            "message": message,
            "api_bills_found": len(api_bills),
            "existing_bills": len(existing_bills), 
            "missing_bills": len(missing_bills),
            "processed_bills": processed_count,
            "remaining_bills": len(missing_bills) - max_process if len(missing_bills) > max_process else 0,
            "results": processed_bills[:5] if processed_bills else []  # Return first 5 for preview
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ CHECK & UPDATE: Error: {e}")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Check and update failed: {str(e)}"
        )

# Temporarily disabled for debugging
# @app.post("/api/legiscan/fetch-recent")
async def fetch_recent_bills_endpoint_disabled(request: dict):
    """
    Incremental fetch: Check DB for most recent bill, then fetch only newer bills from API
    """
    try:
        state = request.get('state')
        if not state:
            raise HTTPException(status_code=400, detail="State parameter is required")
        
        print(f"🔄 INCREMENTAL FETCH: Starting for state {state}")
        
        # Step 1: Get most recent bill date from database
        most_recent_date = get_most_recent_bill_date(state)
        print(f"📅 Most recent bill date in DB: {most_recent_date}")
        
        # Step 2: Prepare search parameters based on most recent date
        enhanced_ai = request.get('enhanced_ai', True)
        limit = request.get('limit', 100)
        
        if most_recent_date:
            # Use the date to filter API results
            try:
                from datetime import datetime, timedelta
                if isinstance(most_recent_date, str):
                    cutoff_date = datetime.fromisoformat(most_recent_date.replace('Z', '+00:00'))
                else:
                    cutoff_date = most_recent_date
                
                # Add 1 day buffer to ensure we don't miss any bills
                search_from_date = cutoff_date - timedelta(days=1)
                date_query = search_from_date.strftime('%Y-%m-%d')
                print(f"📅 Searching for bills newer than: {date_query}")
                
            except Exception as date_error:
                print(f"⚠️ Date parsing error: {date_error}, falling back to recent search")
                date_query = "recent"
        else:
            print("📅 No existing bills found, fetching all recent bills")
            date_query = "recent"
        
        # Step 3: Make async API call with date filtering and streaming
        print(f"🚀 Making incremental API call with streaming enabled...")
        
        # Use the existing enhanced client for streaming
        if not enhanced_ai_client:
            raise HTTPException(
                status_code=503, 
                detail="Enhanced AI client not available"
            )
        
        # Initialize clients for streaming
        enhanced_client = EnhancedLegiScanClient()
        
        # Step 4: Process with chunking/streaming to handle large responses
        results = []
        processed_count = 0
        
        async def stream_process_bills():
            nonlocal processed_count
            try:
                # Search bills with the date filter - with timeout handling
                try:
                    search_result = await asyncio.wait_for(
                        enhanced_client.search_bills_enhanced(
                            state=state,
                            query=date_query,
                            limit=limit,
                            year_filter="current"
                        ),
                        timeout=60.0  # 60 second timeout for API call
                    )
                    bills = search_result.get('results', []) if isinstance(search_result, dict) else []
                except asyncio.TimeoutError:
                    print(f"⚠️ LegiScan API timeout after 60 seconds, retrying with smaller limit...")
                    # Retry with smaller limit
                    search_result = await asyncio.wait_for(
                        enhanced_client.search_bills_enhanced(
                            state=state,
                            query=date_query,
                            limit=min(limit, 25),  # Reduce limit
                            year_filter="current"
                        ),
                        timeout=30.0  # 30 second timeout for retry
                    )
                    bills = search_result.get('results', []) if isinstance(search_result, dict) else []
                
                print(f"📊 Found {len(bills)} potentially new bills")
                
                # Process bills in chunks to avoid timeouts
                chunk_size = 10
                for i in range(0, len(bills), chunk_size):
                    chunk = bills[i:i+chunk_size]
                    print(f"🔄 Processing chunk {i//chunk_size + 1} ({len(chunk)} bills)")
                    
                    chunk_results = []
                    
                    # Process each bill in the chunk
                    for bill in chunk:
                        try:
                            # Check if bill already exists to avoid duplicates
                            with get_db_connection() as conn:
                                cursor = conn.cursor()
                                cursor.execute("SELECT COUNT(*) FROM legislation WHERE bill_id = ?", (bill.get('bill_id', ''),))
                                if cursor.fetchone()[0] > 0:
                                    print(f"⏭️ Bill {bill.get('bill_number', '')} already exists, skipping")
                                    continue
                            
                            # Process new bill - bills already have AI analysis from search
                            chunk_results.append(bill)
                                
                            processed_count += 1
                            
                            # Small delay to prevent overwhelming the API/DB
                            await asyncio.sleep(0.1)
                            
                        except Exception as bill_error:
                            print(f"⚠️ Error processing bill {bill.get('bill_number', '')}: {bill_error}")
                            continue
                    
                    # Save chunk to database
                    if chunk_results:
                        saved_count = save_state_legislation_to_db(chunk_results)
                        print(f"✅ Saved chunk: {saved_count} bills")
                        results.extend(chunk_results)
                
                return results
                
            except asyncio.TimeoutError as timeout_error:
                print(f"⚠️ API timeout during processing: {timeout_error}")
                # Return partial results if any
                if results:
                    print(f"📊 Returning {len(results)} partial results before timeout")
                    return results
                raise HTTPException(
                    status_code=504,
                    detail="LegiScan API is not responding. The service may be temporarily unavailable. Please try again later."
                )
            except Exception as stream_error:
                print(f"❌ Streaming error: {stream_error}")
                # Check if it's a connection error
                if "Connection timeout" in str(stream_error) or "ConnectionResetError" in str(stream_error):
                    raise HTTPException(
                        status_code=503,
                        detail="LegiScan API connection failed. The service may be experiencing issues. Please try again in a few minutes."
                    )
                raise
        
        # Execute the streaming process with overall timeout
        try:
            final_results = await asyncio.wait_for(
                stream_process_bills(),
                timeout=900.0  # 15 minute overall timeout for large datasets like Texas
            )
        except asyncio.TimeoutError:
            print(f"⚠️ Overall operation timeout after 15 minutes")
            # Return any partial results
            if results:
                return {
                    "success": True,
                    "message": f"Partial incremental fetch completed for {state} (15-minute timeout)",
                    "bills_found": len(results),
                    "bills_processed": processed_count,
                    "most_recent_date_before": most_recent_date,
                    "search_query_used": date_query,
                    "results": results[:10] if results else [],
                    "warning": "Operation timed out but some bills were processed"
                }
            raise HTTPException(
                status_code=504,
                detail="Operation timed out after 5 minutes. LegiScan API may be slow or unavailable."
            )
        
        return {
            "success": True,
            "message": f"Incremental fetch completed for {state}",
            "bills_found": len(final_results),
            "bills_processed": processed_count,
            "most_recent_date_before": most_recent_date,
            "search_query_used": date_query,
            "results": final_results[:10] if final_results else []  # Return first 10 for preview
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ INCREMENTAL FETCH: Error: {e}")
        traceback.print_exc()
        raise HTTPException(
            status_code=500, 
            detail=f"Incremental fetch failed: {str(e)}"
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


@app.get("/api/executive-orders/check-updates")
async def check_for_executive_order_updates():
    """Check if Federal Register has more executive orders than our database"""
    try:
        logger.info("🔍 Checking for executive order updates...")
        
        # Lazy load executive orders module only when needed
        if not load_executive_orders_module():
            return {
                "success": False,
                "error": "Executive Orders API not available",
                "has_updates": False,
                "federal_count": 0,
                "database_count": 0
            }
        
        # Get count from Federal Register
        simple_eo = SimpleExecutiveOrders()
        federal_result = simple_eo.get_executive_orders_count()
        
        if not federal_result.get('success'):
            logger.error(f"❌ Failed to get Federal Register count: {federal_result.get('error')}")
            return {
                "success": False,
                "error": federal_result.get('error'),
                "has_updates": False,
                "federal_count": 0,
                "database_count": 0
            }
        
        federal_count = federal_result.get('count', 0)
        
        # Get count from database using existing function
        database_count = await get_database_count()
        
        has_updates = federal_count > database_count
        update_count = max(0, federal_count - database_count)
        
        logger.info(f"📊 Update check: Federal={federal_count}, Database={database_count}, Updates={update_count}")
        
        return {
            "success": True,
            "has_updates": has_updates,
            "federal_count": federal_count,
            "database_count": database_count,
            "update_count": update_count,
            "message": f"Found {update_count} new executive orders available" if has_updates else "Database is up to date"
        }
        
    except Exception as e:
        logger.error(f"❌ Error checking for updates: {e}")
        return {
            "success": False,
            "error": str(e),
            "has_updates": False,
            "federal_count": 0,
            "database_count": 0
        }

@app.get("/api/executive-orders")
async def get_executive_orders_with_highlights(
    category: Optional[str] = Query(None, description="Executive order category filter"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(100, ge=1, le=1000, description="Items per page"),
    search: Optional[str] = Query(None, description="Search term"),
    sort_by: str = Query("signing_date", description="Sort field"),
    sort_order: str = Query("desc", description="Sort order (asc, desc)"),
    user_id: Optional[str] = Query(None, description="User ID to show highlight status"),
    use_cache: bool = Query(True, description="Use cached results if available")
):
    """Get executive orders with highlighting, pagination, and validation - OPTIMIZED"""
    
    try:
        logger.info(f"🔍 Getting executive orders - page: {page}, per_page: {per_page}")
        
        # Check cache first
        cache_params = {
            "category": category,
            "page": page,
            "per_page": per_page,
            "search": search,
            "sort_by": sort_by,
            "sort_order": sort_order,
            "user_id": user_id
        }
        
        if use_cache:
            cached_result = api_cache.get("executive-orders", cache_params)
            if cached_result:
                return cached_result
        
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
                "success": False,  # ⚡ ADD SUCCESS FLAG
                "results": [],
                "count": 0,
                "total_pages": 1,
                "page": page,
                "per_page": per_page,
                "total": 0,
                "error": error_msg,
                "timestamp": datetime.now().isoformat(),  # ⚡ ADD TIMESTAMP
                "database_type": "Azure SQL"
            }
        
        orders = result.get('results', [])
        logger.info(f"📋 Got {len(orders)} orders from database")
        
        # Apply validation and formatting
        validated_orders = []
        for i, order in enumerate(orders):
            try:
                eo_number = order.get('eo_number', '') or order.get('bill_number', '')
                logger.info(f"📝 Processing order {i+1}: eo_number={eo_number}, title={order.get('title', 'No title')[:50]}...")
                
                # Map database fields to expected EO fields
                formatted_order = {
                    'eo_number': eo_number,
                    'executive_order_number': eo_number,
                    'title': order.get('title', ''),
                    'summary': order.get('summary', ''),
                    'signing_date': order.get('signing_date', ''),
                    'publication_date': order.get('publication_date', ''),
                    'category': order.get('category', 'not-applicable'),
                    'reviewed': order.get('reviewed', False),
                    'html_url': order.get('html_url', ''),
                    'pdf_url': order.get('pdf_url', ''),
                    'ai_summary': order.get('ai_summary', ''),
                    'ai_executive_summary': order.get('ai_executive_summary', ''),
                    'ai_key_points': order.get('ai_key_points', ''),
                    'ai_talking_points': order.get('ai_talking_points', ''),
                    'ai_business_impact': order.get('ai_business_impact', ''),
                    'ai_potential_impact': order.get('ai_potential_impact', ''),
                    'source': order.get('source', 'Database')
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
        
        response_data = {
            "success": True,  # ⚡ ADD SUCCESS FLAG
            "results": validated_orders,
            "count": len(validated_orders),
            "total_pages": total_pages,
            "page": page,
            "per_page": per_page,
            "total": total_count,
            "database_type": "Azure SQL",
            "cached": False,
            "timestamp": datetime.now().isoformat(),  # ⚡ ADD TIMESTAMP
            "has_more": page < total_pages  # ⚡ ADD PAGINATION HELPER
        }
        
        # Cache the successful response
        if use_cache:
            api_cache.set("executive-orders", cache_params, response_data)
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Unexpected error in get_executive_orders_with_highlights: {e}")
        import traceback
        traceback.print_exc()
        
        return {
            "success": False,  # ⚡ ADD SUCCESS FLAG
            "results": [],
            "count": 0,
            "total_pages": 1,
            "page": page,
            "per_page": per_page,
            "total": 0,
            "error": f"Unexpected error: {str(e)}",
            "timestamp": datetime.now().isoformat(),  # ⚡ ADD TIMESTAMP
            "database_type": "Azure SQL"
        }



#@app.get("/api/executive-orders")
#async def get_executive_orders_with_highlights(
#    category: Optional[str] = Query(None, description="Executive order category filter"),
#    page: int = Query(1, ge=1, description="Page number"),
#    per_page: int = Query(25, ge=1, le=100, description="Items per page"),
#    search: Optional[str] = Query(None, description="Search term"),
#    sort_by: str = Query("signing_date", description="Sort field"),
#    sort_order: str = Query("desc", description="Sort order (asc, desc)"),
#    user_id: Optional[str] = Query(None, description="User ID to show highlight status")
#):
#    """Get executive orders with highlighting, pagination, and validation"""
#    
#    try:
#        logger.info(f"🔍 Getting executive orders - page: {page}, per_page: {per_page}")
#        
#        if not EXECUTIVE_ORDERS_AVAILABLE:
#            logger.warning("Executive orders functionality not available")
#            return {
#                "results": [],
#                "count": 0,
#                "total_pages": 1,
#                "page": page,
#                "per_page": per_page,
#                "message": "Executive orders functionality not available"
#            }
#        
#        # Build filters for the Azure SQL integration
#        filters = {}
#        if category:
#            filters['category'] = category
#        if search:
#            filters['search'] = search
#        
#        logger.info(f"📊 Calling get_executive_orders_from_db with filters: {filters}")
#        
#        result = get_executive_orders_from_db(
#            limit=per_page,
#            offset=(page - 1) * per_page,
#            filters=filters
#        )
#        
#        logger.info(f"📥 Database result: success={result.get('success')}, count={result.get('count', 0)}")
#        
#        if not result.get('success'):
#            error_msg = result.get('message', 'Failed to retrieve executive orders')
#            logger.error(f"❌ Database query failed: {error_msg}")
#            
#            return {
#                "results": [],
#                "count": 0,
#                "total_pages": 1,
#                "page": page,
#                "per_page": per_page,
#                "error": error_msg
#            }
#        
#        orders = result.get('results', [])
#        logger.info(f"📋 Got {len(orders)} orders from database")
#        
#        # Apply validation and formatting
#        validated_orders = []
#        for i, order in enumerate(orders):
#            try:
#                eo_number = order.get('bill_number', '')
#                logger.info(f"📝 Processing order {i+1}: bill_number={eo_number}, title={order.get('title', 'No title')[:50]}...")
#                
#                # Map Azure SQL fields to expected EO fields
#                formatted_order = {
#                    'eo_number': eo_number,
#                    'executive_order_number': eo_number,
#                    'title': order.get('title', ''),
#                    'summary': order.get('description', ''),
#                    'signing_date': order.get('introduced_date', ''),
#                    'publication_date': order.get('last_action_date', ''),
#                    'category': order.get('category', 'not-applicable'),
#                    'html_url': order.get('legiscan_url', ''),
#                    'pdf_url': order.get('pdf_url', ''),
#                    'ai_summary': order.get('ai_summary', ''),
#                    'ai_executive_summary': order.get('ai_executive_summary', ''),
#                    'ai_key_points': order.get('ai_talking_points', ''),
#                    'ai_talking_points': order.get('ai_talking_points', ''),
#                    'ai_business_impact': order.get('ai_business_impact', ''),
#                    'ai_potential_impact': order.get('ai_potential_impact', ''),
#                    'source': 'Azure SQL Database'
#                }
#                
#                validated_orders.append(formatted_order)
#                logger.info(f"✅ Processed order: {eo_number}")
#            except Exception as e:
#                logger.error(f"❌ Error processing order {i+1}: {e}")
#                continue
#        
#        logger.info(f"✅ Returning {len(validated_orders)} validated orders")
#        
#        # Calculate proper pagination
#        total_count = result.get('total', len(validated_orders))
#        total_pages = math.ceil(total_count / per_page) if total_count > 0 else 1
#        
#        return {
#            "results": validated_orders,
#            "count": len(validated_orders),
#            "total_pages": total_pages,
#            "page": page,
#            "per_page": per_page,
#            "total": total_count,
#            "database_type": "Azure SQL"
#        }
#        
#    except HTTPException:
#        raise
#    except Exception as e:
#        logger.error(f"❌ Unexpected error in get_executive_orders_with_highlights: {e}")
#        import traceback
#        traceback.print_exc()
#        
#        return {
#            "results": [],
#            "count": 0,
#            "total_pages": 1,
#            "page": page,
#            "per_page": per_page,
#            "error": f"Unexpected error: {str(e)}"
#        }

@app.post("/api/fetch-executive-orders-simple")
async def fetch_executive_orders_simple_endpoint(request: ExecutiveOrderFetchRequest):
    """Fetch executive orders from Federal Register API with AI processing - Only new orders"""
    try:
        logger.info(f"🚀 Starting executive orders fetch via Federal Register API")
        logger.info(f"📋 Request: {request.model_dump()}")
        
        # Lazy load executive orders module only when needed
        if not load_executive_orders_module():
            raise HTTPException(
                status_code=503,
                detail="Executive Orders API not available"
            )
        
        # First check what's new
        check_result = await check_for_executive_order_updates()
        
        if not check_result.get('has_updates'):
            logger.info("✅ Database is already up to date")
            return {
                "success": True,
                "results": [],
                "count": 0,
                "orders_saved": 0,
                "total_found": check_result.get('federal_count', 0),
                "database_count": check_result.get('database_count', 0),
                "ai_successful": 0,
                "ai_failed": 0,
                "message": 'Database is already up to date - no new orders to fetch',
                "date_range_used": f"{request.start_date or '01/20/2025'} to {request.end_date or datetime.now().strftime('%m/%d/%Y')}",
                "method": "federal_register_api_direct"
            }
        
        # Calculate how many new orders we need to fetch
        update_count = check_result.get('update_count', 0)
        logger.info(f"📊 Need to fetch {update_count} new orders")
        
        # Call integration function with a limit to only fetch new orders
        # Add a small buffer to ensure we get all new orders
        buffer_amount = max(5, int(update_count * 0.1))  # 10% buffer or minimum 5
        fetch_limit = update_count + buffer_amount
        
        logger.info(f"📊 Fetching {fetch_limit} orders ({update_count} new + {buffer_amount} buffer)")
        
        result = await fetch_executive_orders_simple_integration(
            start_date=request.start_date,
            end_date=request.end_date,
            with_ai=request.with_ai,
            limit=fetch_limit,  # Only fetch the new orders plus buffer
            save_to_db=request.save_to_db,
            only_new=True  # Flag to indicate we only want new orders
        )
        
        logger.info(f"📊 Fetch result: {result.get('count', 0)} orders processed")
        
        if result.get('success'):
            return {
                "success": True,
                "results": result.get('results', []),
                "count": result.get('count', 0),
                "orders_saved": result.get('orders_saved', 0),
                "total_found": check_result.get('federal_count', 0),
                "database_count": check_result.get('database_count', 0),
                "expected_new": update_count,
                "ai_successful": result.get('ai_successful', 0),
                "ai_failed": result.get('ai_failed', 0),
                "message": result.get('message', 'Executive orders fetched successfully'),
                "date_range_used": result.get('date_range_used'),
                "method": "federal_register_api_direct_incremental"
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

@app.patch("/api/executive-orders/{id}/review")
async def update_executive_order_review_status(
    id: str,
    request: dict
):
    """Update review status for executive orders - FIXED VERSION"""
    try:
        logger.info(f"🔍 REVIEW ENDPOINT CALLED: ID={id}, Request={request}")
        
        reviewed = request.get('reviewed', False)
        
        # Validate input
        if not isinstance(reviewed, bool):
            raise HTTPException(status_code=400, detail="'reviewed' must be a boolean")
        
        logger.info(f"🔍 BACKEND: Updating executive order review status - ID: {id}, reviewed: {reviewed}")
        
        # Ensure database connection function is available
        try:
            conn = get_azure_sql_connection()
        except Exception as e:
            logger.error(f"❌ Database connection error: {e}")
            raise HTTPException(status_code=500, detail="Database connection not available")
        
        if not conn:
            raise HTTPException(status_code=503, detail="Database connection failed")
        
        cursor = conn.cursor()
        
        # First, let's see what's actually in the database
        cursor.execute("SELECT TOP 3 id, eo_number, title FROM executive_orders ORDER BY last_updated DESC")
        sample_records = cursor.fetchall()
        logger.info(f"🔍 BACKEND: Sample records in database:")
        for record in sample_records:
            logger.info(f"   id: {record[0]}, eo_number: {record[1]}, title: {record[2][:30] if record[2] else 'None'}...")
        
        # Try to find the record multiple ways
        search_attempts = [
            ("Direct ID match", "SELECT id FROM executive_orders WHERE id = ?", id),
            ("EO number match (eo- prefix)", "SELECT id FROM executive_orders WHERE eo_number = ?", id.replace('eo-', '') if id.startswith('eo-') else id),
            ("Document number match", "SELECT id FROM executive_orders WHERE document_number = ?", id.replace('eo-', '') if id.startswith('eo-') else id),
            ("String ID match", "SELECT id FROM executive_orders WHERE CAST(id AS VARCHAR) = ?", str(id))
        ]
        
        found_record_id = None
        for attempt_name, query, param in search_attempts:
            try:
                logger.info(f"🔍 BACKEND: Trying {attempt_name} with param: {param}")
                logger.info(f"🔍 BACKEND: Query: {query}")
                cursor.execute(query, (param,))
                result = cursor.fetchone()
                if result:
                    found_record_id = result[0]
                    logger.info(f"✅ BACKEND: Found record with {attempt_name}, database ID: {found_record_id}")
                    break
                else:
                    logger.info(f"❌ BACKEND: No match with {attempt_name}")
            except Exception as e:
                logger.error(f"❌ BACKEND: Error with {attempt_name}: {e}")
        
        if not found_record_id:
            logger.error(f"❌ BACKEND: Could not find any record for ID: {id}")
            conn.close()
            raise HTTPException(status_code=404, detail=f"Executive order not found for ID: {id}")
        
        # First, let's check the current reviewed value
        check_query = "SELECT reviewed FROM executive_orders WHERE id = ?"
        cursor.execute(check_query, (found_record_id,))
        current_reviewed_result = cursor.fetchone()
        current_reviewed = current_reviewed_result[0] if current_reviewed_result else "NULL"
        logger.info(f"🔍 BACKEND: Current reviewed status in DB: {current_reviewed}")
        
        # Update the record
        update_query = "UPDATE executive_orders SET reviewed = %s WHERE id = %s"
        logger.info(f"🔍 BACKEND: Executing review update: {update_query} with reviewed='{reviewed}', id={found_record_id}")
        cursor.execute(update_query, (reviewed, found_record_id))
        rows_affected = cursor.rowcount
        
        logger.info(f"🔍 BACKEND: Review update affected {rows_affected} rows")
        
        if rows_affected == 0:
            conn.close()
            raise HTTPException(status_code=404, detail="No rows were updated")
        
        # Commit the transaction
        logger.info(f"🔍 BACKEND: Committing review transaction...")
        conn.commit()
        
        # Verify the update worked by reading back the value
        verify_query = "SELECT reviewed FROM executive_orders WHERE id = ?"
        cursor.execute(verify_query, (found_record_id,))
        updated_reviewed_result = cursor.fetchone()
        updated_reviewed = updated_reviewed_result[0] if updated_reviewed_result else "NULL"
        logger.info(f"🔍 BACKEND: Verified reviewed status in DB after update: {updated_reviewed}")
        
        conn.close()
        
        logger.info(f"✅ BACKEND: Successfully updated executive order {found_record_id} reviewed status from '{current_reviewed}' to '{updated_reviewed}'")
        
        # Clear cache to ensure fresh data on next request
        api_cache.clear()
        logger.info("🔄 Cache cleared after executive order review status update")
        
        return {
            "success": True,
            "message": f"Review status updated to {reviewed}",
            "id": id,
            "database_id": found_record_id,
            "reviewed": reviewed,
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error updating executive order review status: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update review status: {str(e)}"
        )

@app.patch("/api/executive-orders/{id}/category")
async def update_executive_order_category(
    id: str,
    request: dict
):
    """Update category for executive orders"""
    try:
        logger.info(f"🔍 CATEGORY ENDPOINT CALLED: ID={id}, Request={request}")
        
        category = request.get('category', 'civic')
        
        # Validate category
        valid_categories = ['civic', 'education', 'engineering', 'healthcare', 'not-applicable', 'all', 'all_practice_areas']
        if category not in valid_categories:
            raise HTTPException(status_code=400, detail=f"Invalid category. Must be one of: {valid_categories}")
        
        logger.info(f"🔍 BACKEND: Updating executive order category - ID: {id}, category: {category}")
        
        # Ensure database connection function is available
        try:
            conn = get_azure_sql_connection()
        except Exception as e:
            logger.error(f"❌ Database connection error: {e}")
            raise HTTPException(status_code=500, detail="Database connection not available")
        
        if not conn:
            raise HTTPException(status_code=503, detail="Database connection failed")
        
        cursor = conn.cursor()
        
        # Find the record - try multiple ID formats
        found_record_id = None
        
        # Try direct lookup by eo_number (numeric part)
        try:
            eo_number = id.replace('eo-', '') if id.startswith('eo-') else id
            query = "SELECT id FROM executive_orders WHERE eo_number = ?"
            logger.info(f"🔍 BACKEND: Trying eo_number lookup with: {eo_number}")
            cursor.execute(query, (eo_number,))
            result = cursor.fetchone()
            if result:
                found_record_id = result[0]
                logger.info(f"✅ BACKEND: Found record by eo_number, database ID: {found_record_id}")
        except Exception as e:
            logger.error(f"❌ BACKEND: Error with eo_number lookup: {e}")
        
        # If not found, try document_number lookup
        if not found_record_id:
            try:
                query = "SELECT id FROM executive_orders WHERE document_number = ?"
                logger.info(f"🔍 BACKEND: Trying document_number lookup with: {id}")
                cursor.execute(query, (id,))
                result = cursor.fetchone()
                if result:
                    found_record_id = result[0]
                    logger.info(f"✅ BACKEND: Found record by document_number, database ID: {found_record_id}")
            except Exception as e:
                logger.error(f"❌ BACKEND: Error with document_number lookup: {e}")
        
        # If not found, try direct ID lookup (if it's numeric)
        if not found_record_id:
            try:
                if id.isdigit():
                    query = "SELECT id FROM executive_orders WHERE id = ?"
                    logger.info(f"🔍 BACKEND: Trying direct ID lookup with: {id}")
                    cursor.execute(query, (int(id),))
                    result = cursor.fetchone()
                    if result:
                        found_record_id = result[0]
                        logger.info(f"✅ BACKEND: Found record by direct ID, database ID: {found_record_id}")
            except Exception as e:
                logger.error(f"❌ BACKEND: Error with direct ID lookup: {e}")
        
        if not found_record_id:
            logger.error(f"❌ BACKEND: Could not find any record for ID: {id}")
            conn.close()
            raise HTTPException(status_code=404, detail=f"Executive order not found for ID: {id}")
        
        # First, let's check the current category value
        check_query = "SELECT category FROM executive_orders WHERE id = ?"
        cursor.execute(check_query, (found_record_id,))
        current_category_result = cursor.fetchone()
        current_category = current_category_result[0] if current_category_result else "NULL"
        logger.info(f"🔍 BACKEND: Current category in DB: {current_category}")
        
        # Update the record
        update_query = "UPDATE executive_orders SET category = ? WHERE id = ?"
        logger.info(f"🔍 BACKEND: Executing update: {update_query} with category='{category}', id={found_record_id}")
        cursor.execute(update_query, (category, found_record_id))
        rows_affected = cursor.rowcount
        
        logger.info(f"🔍 BACKEND: Update affected {rows_affected} rows")
        
        if rows_affected == 0:
            conn.close()
            raise HTTPException(status_code=404, detail="No rows were updated")
        
        # Commit the transaction
        logger.info(f"🔍 BACKEND: Committing transaction...")
        conn.commit()
        
        # Verify the update worked by reading back the value
        verify_query = "SELECT category FROM executive_orders WHERE id = ?"
        cursor.execute(verify_query, (found_record_id,))
        updated_category_result = cursor.fetchone()
        updated_category = updated_category_result[0] if updated_category_result else "NULL"
        logger.info(f"🔍 BACKEND: Verified category in DB after update: {updated_category}")
        
        conn.close()
        
        logger.info(f"✅ BACKEND: Successfully updated executive order {found_record_id} category from '{current_category}' to '{updated_category}'")
        
        # Clear cache to ensure fresh data on next request
        api_cache.clear()
        logger.info("🔄 Cache cleared after executive order category update")
        
        return {
            "success": True,
            "message": f"Category updated to {category}",
            "id": id,
            "database_id": found_record_id,
            "category": category,
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error updating executive order category: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update category: {str(e)}"
        )

@app.get("/api/debug/executive-order/{id}")
async def debug_executive_order(id: str):
    """Debug endpoint to check executive order data"""
    try:
        conn = get_azure_sql_connection()
        if not conn:
            return {"error": "Database connection failed"}
        
        cursor = conn.cursor()
        
        # Try to find the record using the same logic as the update endpoint
        found_record_id = None
        
        # Try direct lookup by eo_number (numeric part)
        try:
            eo_number = id.replace('eo-', '') if id.startswith('eo-') else id
            query = "SELECT id, eo_number, document_number, title, category, reviewed FROM executive_orders WHERE eo_number = ?"
            cursor.execute(query, eo_number)
            result = cursor.fetchone()
            if result:
                conn.close()
                return {
                    "found_by": "eo_number",
                    "search_param": eo_number,
                    "result": {
                        "id": result[0],
                        "eo_number": result[1],
                        "document_number": result[2],
                        "title": result[3],
                        "category": result[4],
                        "reviewed": result[5]
                    }
                }
        except Exception as e:
            pass
        
        # Try document_number lookup
        try:
            query = "SELECT id, eo_number, document_number, title, category, reviewed FROM executive_orders WHERE document_number = ?"
            cursor.execute(query, id)
            result = cursor.fetchone()
            if result:
                conn.close()
                return {
                    "found_by": "document_number",
                    "search_param": id,
                    "result": {
                        "id": result[0],
                        "eo_number": result[1],
                        "document_number": result[2],
                        "title": result[3],
                        "category": result[4],
                        "reviewed": result[5]
                    }
                }
        except Exception as e:
            pass
        
        # Try direct ID lookup
        try:
            if id.isdigit():
                query = "SELECT id, eo_number, document_number, title, category, reviewed FROM executive_orders WHERE id = ?"
                cursor.execute(query, (int(id),))
                result = cursor.fetchone()
                if result:
                    conn.close()
                    return {
                        "found_by": "direct_id",
                        "search_param": id,
                        "result": {
                            "id": result[0],
                            "eo_number": result[1],
                            "document_number": result[2],
                            "title": result[3],
                            "category": result[4]
                        }
                    }
        except Exception as e:
            pass
        
        conn.close()
        return {"error": f"Executive order not found for ID: {id}", "searched_for": id}
        
    except Exception as e:
        return {"error": f"Debug failed: {str(e)}"}

@app.get("/api/debug/database-state")
async def debug_database_state():
    """Debug endpoint to check database state and column information"""
    try:
        conn = get_azure_sql_connection()
        if not conn:
            return {"error": "Database connection failed"}
        
        cursor = conn.cursor()
        
        # Check table schema
        schema_query = """
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'executive_orders'
        ORDER BY ORDINAL_POSITION
        """
        cursor.execute(schema_query)
        schema_results = cursor.fetchall()
        
        columns = []
        for row in schema_results:
            columns.append({
                "column_name": row[0],
                "data_type": row[1],
                "is_nullable": row[2],
                "default_value": row[3]
            })
        
        # Get sample records with key fields
        sample_query = """
        SELECT TOP 5 id, eo_number, document_number, title, category, reviewed, last_updated
        FROM executive_orders
        ORDER BY last_updated DESC
        """
        cursor.execute(sample_query)
        sample_results = cursor.fetchall()
        
        sample_records = []
        for row in sample_results:
            sample_records.append({
                "id": row[0],
                "eo_number": row[1],
                "document_number": row[2],
                "title": row[3][:50] if row[3] else None,
                "category": row[4],
                "reviewed": row[5],
                "last_updated": str(row[6]) if row[6] else None
            })
        
        # Check for specific record
        specific_query = """
        SELECT id, eo_number, document_number, title, category, reviewed
        FROM executive_orders
        WHERE eo_number = '14316' OR document_number LIKE '%14316%'
        """
        cursor.execute(specific_query)
        specific_results = cursor.fetchall()
        
        specific_records = []
        for row in specific_results:
            specific_records.append({
                "id": row[0],
                "eo_number": row[1],
                "document_number": row[2],
                "title": row[3][:50] if row[3] else None,
                "category": row[4],
                "reviewed": row[5]
            })
        
        conn.close()
        
        return {
            "table_schema": columns,
            "sample_records": sample_records,
            "specific_14316_records": specific_records,
            "total_columns": len(columns)
        }
        
    except Exception as e:
        return {"error": f"Database state check failed: {str(e)}"}

@app.post("/api/debug/test-persistence")
async def test_database_persistence():
    """Test if database changes actually persist"""
    try:
        conn = get_azure_sql_connection()
        if not conn:
            return {"error": "Database connection failed"}
        
        cursor = conn.cursor()
        
        # Find a test record
        cursor.execute("SELECT TOP 1 id, eo_number, reviewed FROM executive_orders WHERE eo_number IS NOT NULL")
        test_record = cursor.fetchone()
        
        if not test_record:
            conn.close()
            return {"error": "No test record found"}
        
        record_id = test_record[0]
        eo_number = test_record[1]
        current_reviewed = test_record[2]
        
        # Toggle the reviewed status
        new_reviewed = not current_reviewed if current_reviewed is not None else True
        
        logger.info(f"🧪 TEST: Record {record_id} (EO {eo_number}) - changing reviewed from {current_reviewed} to {new_reviewed}")
        
        # Update the record
        update_query = "UPDATE executive_orders SET reviewed = %s WHERE id = %s"
        cursor.execute(update_query, new_reviewed, record_id)
        rows_affected = cursor.rowcount
        
        logger.info(f"🧪 TEST: Update affected {rows_affected} rows")
        
        # Commit the transaction
        conn.commit()
        logger.info(f"🧪 TEST: Transaction committed")
        
        # Verify the change in the same connection
        verify_query = "SELECT reviewed FROM executive_orders WHERE id = ?"
        cursor.execute(verify_query, record_id)
        verified_value = cursor.fetchone()[0]
        
        logger.info(f"🧪 TEST: Verified value in same connection: {verified_value}")
        
        # Close connection and open a new one to test persistence
        conn.close()
        
        # New connection to verify persistence
        new_conn = get_azure_sql_connection()
        new_cursor = new_conn.cursor()
        
        check_query = "SELECT reviewed FROM executive_orders WHERE id = ?"
        new_cursor.execute(check_query, record_id)
        final_value = new_cursor.fetchone()[0]
        
        logger.info(f"🧪 TEST: Final value in new connection: {final_value}")
        
        new_conn.close()
        
        return {
            "test_record_id": record_id,
            "eo_number": eo_number,
            "original_value": current_reviewed,
            "intended_value": new_reviewed,
            "verified_same_connection": verified_value,
            "verified_new_connection": final_value,
            "persistence_working": final_value == new_reviewed,
            "rows_affected": rows_affected
        }
        
    except Exception as e:
        logger.error(f"🧪 TEST FAILED: {str(e)}")
        return {"error": f"Test failed: {str(e)}"}

@app.post("/api/debug/direct-sql-test")
async def direct_sql_test():
    """Direct SQL test to diagnose database persistence issues"""
    try:
        conn = get_azure_sql_connection()
        if not conn:
            return {"error": "Database connection failed"}
        
        cursor = conn.cursor()
        
        # Step 1: Check connection properties
        autocommit_status = getattr(conn, 'autocommit', 'unknown')
        logger.info(f"🔍 SQL TEST: Connection autocommit: {autocommit_status}")
        
        # Step 2: Find a test record
        cursor.execute("SELECT TOP 1 id, eo_number, reviewed FROM executive_orders WHERE eo_number = '14316'")
        test_record = cursor.fetchone()
        
        if not test_record:
            return {"error": "Test record 14316 not found"}
        
        record_id, eo_number, original_reviewed = test_record
        logger.info(f"🔍 SQL TEST: Found record - ID: {record_id}, EO: {eo_number}, Original reviewed: {original_reviewed}")
        
        # Step 3: Try explicit transaction with detailed logging
        new_reviewed = not original_reviewed if original_reviewed is not None else True
        
        try:
            # Begin explicit transaction
            cursor.execute("BEGIN TRANSACTION")
            logger.info(f"🔍 SQL TEST: Started explicit transaction")
            
            # Perform update
            update_sql = "UPDATE executive_orders SET reviewed = %s WHERE id = %s"
            cursor.execute(update_sql, new_reviewed, record_id)
            rows_affected = cursor.rowcount
            logger.info(f"🔍 SQL TEST: Update executed, rows affected: {rows_affected}")
            
            # Check value before commit
            cursor.execute("SELECT reviewed FROM executive_orders WHERE id = ?", record_id)
            value_before_commit = cursor.fetchone()[0]
            logger.info(f"🔍 SQL TEST: Value before commit: {value_before_commit}")
            
            # Commit transaction
            cursor.execute("COMMIT TRANSACTION")
            logger.info(f"🔍 SQL TEST: Transaction committed")
            
            # Check value after commit
            cursor.execute("SELECT reviewed FROM executive_orders WHERE id = ?", record_id)
            value_after_commit = cursor.fetchone()[0]
            logger.info(f"🔍 SQL TEST: Value after commit: {value_after_commit}")
            
        except Exception as tx_error:
            logger.error(f"🔍 SQL TEST: Transaction error: {tx_error}")
            try:
                cursor.execute("ROLLBACK TRANSACTION")
                logger.info(f"🔍 SQL TEST: Transaction rolled back")
            except:
                pass
            raise tx_error
        
        # Step 4: Close and reopen connection to test persistence
        conn.close()
        logger.info(f"🔍 SQL TEST: Closed connection")
        
        # New connection
        new_conn = get_azure_sql_connection()
        new_cursor = new_conn.cursor()
        logger.info(f"🔍 SQL TEST: Opened new connection")
        
        # Check value with new connection
        new_cursor.execute("SELECT reviewed FROM executive_orders WHERE id = ?", record_id)
        final_value = new_cursor.fetchone()[0]
        logger.info(f"🔍 SQL TEST: Final value with new connection: {final_value}")
        
        new_conn.close()
        
        return {
            "test_successful": True,
            "record_id": record_id,
            "eo_number": eo_number,
            "original_value": original_reviewed,
            "intended_value": new_reviewed,
            "value_before_commit": value_before_commit,
            "value_after_commit": value_after_commit,
            "final_value_new_connection": final_value,
            "persistence_working": final_value == new_reviewed,
            "autocommit_status": autocommit_status,
            "rows_affected": rows_affected
        }
        
    except Exception as e:
        logger.error(f"🔍 SQL TEST FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"error": f"SQL test failed: {str(e)}"}

@app.get("/api/debug/connection-info") 
async def debug_connection_info():
    """Check database connection configuration"""
    try:
        conn = get_azure_sql_connection()
        if not conn:
            return {"error": "Database connection failed"}
        
        cursor = conn.cursor()
        
        # Get connection info
        cursor.execute("SELECT @@VERSION")
        version = cursor.fetchone()[0]
        
        cursor.execute("SELECT DB_NAME()")
        database_name = cursor.fetchone()[0]
        
        cursor.execute("SELECT SUSER_NAME()")
        user_name = cursor.fetchone()[0]
        
        cursor.execute("SELECT @@TRANCOUNT")
        tran_count = cursor.fetchone()[0]
        
        autocommit_status = getattr(conn, 'autocommit', 'unknown')
        
        conn.close()
        
        return {
            "sql_server_version": version[:100],  # Truncate version string
            "database_name": database_name,
            "user_name": user_name,
            "transaction_count": tran_count,
            "autocommit_status": autocommit_status
        }
        
    except Exception as e:
        return {"error": f"Connection info failed: {str(e)}"}

@app.get("/api/debug/executive-orders-schema")
async def debug_executive_orders_schema():
    """Debug and fix executive orders table schema"""
    try:
        conn = get_azure_sql_connection()
        if not conn:
            return {"error": "Database connection failed"}
        
        cursor = conn.cursor()
        
        # Check current schema
        cursor.execute("""
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'executive_orders' AND TABLE_SCHEMA = 'dbo'
            ORDER BY ORDINAL_POSITION
        """)
        
        columns = cursor.fetchall()
        column_names = [col[0] for col in columns]
        
        schema_info = {
            "table_exists": len(columns) > 0,
            "total_columns": len(columns),
            "columns": [{"name": col[0], "type": col[1], "nullable": col[2]} for col in columns],
            "has_reviewed_column": "reviewed" in column_names
        }
        
        # If reviewed column doesn't exist, add it
        if "reviewed" not in column_names:
            try:
                cursor.execute("ALTER TABLE executive_orders ADD reviewed BIT DEFAULT 0")
                conn.commit()
                schema_info["reviewed_column_added"] = True
                logger.info("✅ Added 'reviewed' column to executive_orders table")
            except Exception as e:
                schema_info["reviewed_column_error"] = str(e)
                logger.error(f"❌ Failed to add reviewed column: {e}")
        
        # Get sample data
        try:
            cursor.execute("SELECT TOP 3 id, eo_number, title, reviewed FROM executive_orders")
            samples = cursor.fetchall()
            schema_info["sample_data"] = [
                {
                    "id": row[0],
                    "eo_number": row[1], 
                    "title": row[2][:50] if row[2] else None,
                    "reviewed": row[3] if len(row) > 3 else "N/A"
                } for row in samples
            ]
        except Exception as e:
            schema_info["sample_data_error"] = str(e)
        
        cursor.close()
        conn.close()
        
        return {
            "success": True,
            "schema_info": schema_info,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.get("/api/debug/routes")
async def debug_routes():
    """Debug endpoint to see all registered routes"""
    routes_info = []
    
    for route in app.routes:
        if hasattr(route, 'methods') and hasattr(route, 'path'):
            routes_info.append({
                "path": route.path,
                "methods": list(route.methods),
                "name": getattr(route, 'name', 'Unknown')
            })
    
    # Filter for review-related routes
    review_routes = [r for r in routes_info if 'review' in r['path']]
    executive_orders_routes = [r for r in routes_info if 'executive-orders' in r['path']]
    
    return {
        "total_routes": len(routes_info),
        "review_routes": review_routes,
        "executive_orders_routes": executive_orders_routes,
        "all_routes": routes_info
    }

@app.get("/api/debug/highlights/{user_id}")
async def debug_user_highlights(user_id: str = "1"):
    """Debug endpoint to analyze highlights data structure"""
    try:
        logger.info(f"🔍 DEBUG: Starting highlights analysis for user {user_id}")
        
        # Get raw highlights from database
        raw_highlights = get_user_highlights_direct(user_id)
        
        debug_info = {
            "total_highlights": len(raw_highlights) if raw_highlights else 0,
            "raw_highlights": raw_highlights[:5] if raw_highlights else [],  # First 5 for inspection
            "highlights_by_type": {},
            "missing_fields": [],
            "data_issues": []
        }
        
        if raw_highlights:
            # Analyze by type
            for highlight in raw_highlights:
                order_type = highlight.get('order_type', 'unknown')
                if order_type not in debug_info["highlights_by_type"]:
                    debug_info["highlights_by_type"][order_type] = []
                debug_info["highlights_by_type"][order_type].append({
                    "order_id": highlight.get('order_id'),
                    "title": highlight.get('title', '')[:50] + "..." if highlight.get('title') else 'No title',
                    "has_title": bool(highlight.get('title')),
                    "has_description": bool(highlight.get('description')),
                    "has_ai_summary": bool(highlight.get('ai_summary'))
                })
            
            # Check for missing critical fields
            required_fields = ['order_id', 'order_type', 'title']
            for highlight in raw_highlights:
                for field in required_fields:
                    if not highlight.get(field):
                        debug_info["missing_fields"].append({
                            "highlight_id": highlight.get('id'),
                            "missing_field": field,
                            "order_type": highlight.get('order_type')
                        })
        
        return {
            "success": True,
            "debug_info": debug_info,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ DEBUG: Error analyzing highlights: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.patch("/api/test-review/{id}")
async def test_review_endpoint(id: str, request: dict):
    """Test endpoint to verify PATCH method works"""
    return {
        "success": True,
        "message": "PATCH method working",
        "id": id,
        "received_data": request,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/debug/executive-orders-endpoints")
async def debug_executive_orders_endpoints():
    """Test all executive orders endpoints"""
    try:
        test_results = {}
        
        # Test 1: Check if endpoints are registered
        registered_routes = []
        for route in app.routes:
            if hasattr(route, 'path') and 'executive-orders' in route.path:
                registered_routes.append({
                    "path": route.path,
                    "methods": list(getattr(route, 'methods', [])),
                    "name": getattr(route, 'name', 'Unknown')
                })
        
        test_results["registered_routes"] = registered_routes
        
        # Test 2: Check database connection
        try:
            conn = get_azure_sql_connection()
            if conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM executive_orders")
                count = cursor.fetchone()[0]
                cursor.close()
                conn.close()
                test_results["database_connection"] = {"status": "OK", "record_count": count}
            else:
                test_results["database_connection"] = {"status": "FAILED", "error": "No connection"}
        except Exception as e:
            test_results["database_connection"] = {"status": "ERROR", "error": str(e)}
        
        # Test 3: Check table schema
        try:
            conn = get_azure_sql_connection()
            cursor = conn.cursor()
            cursor.execute("""
                SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'executive_orders' AND TABLE_SCHEMA = 'dbo'
            """)
            columns = [row[0] for row in cursor.fetchall()]
            test_results["table_schema"] = {
                "columns": columns,
                "has_reviewed_column": "reviewed" in columns
            }
            cursor.close()
            conn.close()
        except Exception as e:
            test_results["table_schema"] = {"error": str(e)}
        
        return {
            "success": True,
            "test_results": test_results,
            "timestamp": datetime.now().isoformat(),
            "recommendations": [
                "Ensure server is restarted after code changes",
                "Check for import errors in logs",
                "Verify database connection is working",
                "Confirm 'reviewed' column exists in database"
            ]
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.get("/api/test/review-status")
async def test_review_status_endpoints():
    """Test review status functionality for both executive orders and state legislation"""
    try:
        test_results = {
            "executive_orders": {},
            "state_legislation": {},
            "timestamp": datetime.now().isoformat()
        }
        
        # Test Executive Orders Review Endpoint
        try:
            conn = get_azure_sql_connection()
            cursor = conn.cursor()
            
            cursor.execute("SELECT TOP 1 id, eo_number FROM executive_orders")
            test_eo = cursor.fetchone()
            
            if test_eo:
                test_eo_id = test_eo[1] or test_eo[0]  # Use eo_number or id
                test_results["executive_orders"] = {
                    "test_id": test_eo_id,
                    "endpoint_exists": True,
                    "database_record_found": True,
                    "test_url": f"/api/executive-orders/eo-{test_eo_id}/review"
                }
            else:
                test_results["executive_orders"] = {
                    "error": "No executive orders found in database"
                }
            
            cursor.close()
            conn.close()
            
        except Exception as e:
            test_results["executive_orders"] = {"error": str(e)}
        
        return {
            "success": True,
            "test_results": test_results,
            "instructions": {
                "executive_orders": "PATCH /api/executive-orders/{id}/review with {reviewed: true/false}",
                "state_legislation": "PATCH /api/state-legislation/{id}/review with {reviewed: true/false}"
            }
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

# ===============================
# HIGHLIGHTS API ENDPOINTS
# ===============================


@app.get("/api/highlights")
async def get_user_highlights_endpoint(
    user_id: str = Query("1", description="User identifier")
):
    """Get all highlights for a user"""
    
    # Normalize user ID to handle both email and numeric IDs
    normalized_user_id = normalize_user_id(user_id)
    user_id = normalized_user_id  # Use normalized ID for the rest of the function
    
    try:
        # Create table if needed
        create_highlights_table()
        
        highlights = get_user_highlights_direct(user_id)
        
        # ⚡ ENSURE HIGHLIGHTS IS ALWAYS AN ARRAY
        if highlights is None:
            highlights = []
        elif not isinstance(highlights, list):
            logger.warning(f"⚠️ Highlights not a list: {type(highlights)}, converting...")
            highlights = []
        
        logger.info(f"✅ Retrieved {len(highlights)} highlights for user {user_id}")
        
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

@app.get("/api/highlights-with-content-test")
async def test_highlights_direct():
    """Test endpoint to debug highlight data serialization"""
    try:
        highlights_with_content = get_user_highlights_with_content("1")
        
        # Find first state bill and return minimal data
        for h in highlights_with_content:
            if h['order_type'] == 'state_legislation':
                return {
                    "success": True,
                    "debug": "direct_access",
                    "title": h['title'],
                    "state": h['state'],
                    "raw_data": str(h)[:200]
                }
        
        return {"success": False, "message": "No state bills found"}
        
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/highlights-with-content")
async def get_user_highlights_with_content_endpoint(
    user_id: str = Query("1", description="User identifier")
):
    """Get all highlights for a user with full content - OPTIMIZED for fast loading"""
    
    try:
        # Normalize user ID to handle email addresses
        normalized_user_id = normalize_user_id(user_id)
        
        # Use the optimized function that joins highlights with full content
        highlights_with_content = get_user_highlights_with_content(normalized_user_id)
        
        # ⚡ ENSURE HIGHLIGHTS IS ALWAYS AN ARRAY
        if highlights_with_content is None:
            highlights_with_content = []
        elif not isinstance(highlights_with_content, list):
            logger.warning(f"⚠️ Highlights not a list: {type(highlights_with_content)}, converting...")
            highlights_with_content = []
        
        logger.info(f"✅ Retrieved {len(highlights_with_content)} highlights with full content for user {user_id}")
        
        return {
            "success": True,
            "user_id": normalized_user_id,
            "highlights": highlights_with_content,
            "results": highlights_with_content,  # Also provide as 'results' for compatibility
            "count": len(highlights_with_content),
            "database_type": "Azure SQL",
            "optimization": "joined_queries",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting user highlights with content: {e}")
        return {
            "success": False,
            "error": str(e),
            "highlights": [],
            "results": []
        }

@app.get("/api/test-new-endpoint")
async def test_new_endpoint():
    """Test endpoint to verify server is loading new code"""
    return {"message": "New endpoint works!", "timestamp": datetime.now().isoformat()}

@app.get("/api/test-simple")
async def test_simple():
    """Simple test endpoint"""
    return {"status": "working"}

@app.get("/api/executive-orders/new-count")
async def get_new_orders_count():
    """Get count of new executive orders that haven't been viewed"""
    return {"success": True, "new_count": 1}

@app.get("/api/executive-orders/new")
async def get_new_orders(limit: int = 10):
    """Get list of new executive orders"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT TOP (?) eo_number, title, signing_date, created_at, category
                FROM dbo.executive_orders 
                WHERE is_new = 1
                ORDER BY created_at DESC
            """, (limit,))
            orders = cursor.fetchall()
            
        order_list = []
        for order in orders:
            order_list.append({
                "eo_number": order[0],
                "title": order[1],
                "signing_date": order[2].isoformat() if order[2] else None,
                "created_at": order[3].isoformat() if order[3] else None,
                "category": order[4]
            })
            
        return {
            "success": True,
            "new_orders": order_list,
            "count": len(order_list)
        }
    except Exception as e:
        logger.error(f"❌ Error getting new orders: {e}")
        return {
            "success": False,
            "error": str(e),
            "new_orders": [],
            "count": 0
        }

@app.post("/api/executive-orders/mark-viewed/{eo_number}")
async def mark_order_as_viewed(eo_number: str, user_id: Optional[str] = Query(None)):
    """Mark an executive order as viewed (no longer new)"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE dbo.executive_orders 
                SET is_new = 0,
                    first_viewed_at = CASE 
                        WHEN first_viewed_at IS NULL THEN GETDATE() 
                        ELSE first_viewed_at 
                    END,
                    last_updated = GETDATE()
                WHERE eo_number = ?
            """, (eo_number,))
            conn.commit()
            
        return {
            "success": True,
            "message": f"Order {eo_number} marked as viewed"
        }
    except Exception as e:
        logger.error(f"❌ Error marking order as viewed: {e}")
        return {
            "success": False,
            "error": str(e)
        }


#@app.get("/api/highlights")
#async def get_user_highlights_endpoint(
#    user_id: str = Query("1", description="User identifier")
#):
#    """Get all highlights for a user"""
#    
#    if not HIGHLIGHTS_DB_AVAILABLE:
#        return {
#            "success": False,
#            "message": "Highlights database not available. Please ensure Azure SQL is configured.",
#            "highlights": []
#        }
#    
#    try:
#        # Create table if it doesn't exist
#        create_highlights_table()
#        
#        highlights = get_user_highlights_direct(user_id)
#        
#        return {
#            "success": True,
#            "user_id": user_id,
#            "highlights": highlights,
#            "results": highlights,  # Also provide as 'results' for compatibility
#            "count": len(highlights),
#            "database_type": "Azure SQL",
#            "timestamp": datetime.now().isoformat()
#        }
#        
#    except Exception as e:
#        logger.error(f"Error getting user highlights: {e}")
#        return {
#            "success": False,
#            "error": str(e),
#            "highlights": [],
#            "results": []
#        }

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
        
        # Get the item data based on order type
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
                logger.warning(f"Could not get executive order data for highlight: {e}")
        
        elif request.order_type == 'state_legislation':
            try:
                # Get state legislation data from database
                db_result = get_state_legislation_from_db(limit=1000, offset=0, filters={})
                if db_result.get('success'):
                    for bill in db_result.get('results', []):
                        if str(bill.get('id')) == str(request.order_id):
                            item_data = {
                                'title': bill.get('title', ''),
                                'description': bill.get('description', ''),
                                'ai_summary': bill.get('ai_summary', ''),
                                'category': bill.get('category', ''),
                                'state': bill.get('state', ''),
                                'signing_date': bill.get('introduced_date', ''),
                                'html_url': bill.get('legiscan_url', ''),
                                'pdf_url': '',  # State bills typically don't have PDF URLs
                                'legiscan_url': bill.get('legiscan_url', '')
                            }
                            break
            except Exception as e:
                logger.warning(f"Could not get state legislation data for highlight: {e}")
        
        # Normalize user ID to handle email addresses  
        normalized_user_id = normalize_user_id(request.user_id)
        
        success = add_highlight_direct(
            user_id=normalized_user_id,
            order_id=request.order_id, 
            order_type=request.order_type,
            item_data=item_data
        )
        
        if success:
            return {
                "success": True,
                "message": "Highlight added successfully",
                "user_id": normalized_user_id,
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
        # Normalize user ID to handle email addresses
        normalized_user_id = normalize_user_id(user_id)
        
        success = remove_highlight_direct(normalized_user_id, order_id, order_type)
        
        if success:
            return {
                "success": True,
                "message": "Highlight removed successfully",
                "user_id": normalized_user_id,
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

@app.get("/api/state-legislation/count")
async def get_state_legislation_count(
    state: Optional[str] = Query(None, description="State abbreviation or full name"),
    category: Optional[str] = Query(None, description="Filter by category"),
    search: Optional[str] = Query(None, description="Search in title and description")
):
    """
    Get the exact count of state legislation from the database
    """
    try:
        if not AZURE_SQL_AVAILABLE:
            return {"success": False, "message": "Database not available", "count": 0}
        
        conn = get_azure_sql_connection()
        if not conn:
            return {'success': False, 'message': 'No database connection', 'count': 0}
        
        try:
            cursor = conn.cursor()
            
            # Build count query
            count_query = "SELECT COUNT(*) FROM dbo.state_legislation WHERE 1=1"
            params = []
            
            # Add filters
            if state:
                count_query += " AND (state = ? OR state_abbr = ? OR state LIKE ?)"
                params.extend([state, state, f"%{state}%"])
            
            if category and category != 'all':
                count_query += " AND category = ?"
                params.append(category)
            
            if search:
                count_query += " AND (title LIKE ? OR description LIKE ?)"
                search_term = f"%{search}%"
                params.extend([search_term, search_term])
            
            # Execute count query
            cursor.execute(count_query, params)
            total_count = cursor.fetchone()[0]
            
            return {
                "success": True,
                "count": total_count,
                "state": state,
                "category": category,
                "search": search
            }
            
        except Exception as e:
            print(f"❌ Database query error: {e}")
            return {"success": False, "message": str(e), "count": 0}
        finally:
            conn.close()
            
    except Exception as e:
        print(f"❌ API error: {e}")
        return {"success": False, "message": str(e), "count": 0}

# Debug: Check if this endpoint is being registered
logger.info("📍 Registering /api/state-legislation endpoint...")

@app.get("/api/state-legislation")
async def get_state_legislation_endpoint(
    state: Optional[str] = Query(None, description="State abbreviation or full name"),
    category: Optional[str] = Query(None, description="Filter by category"),
    limit: int = Query(15000, description="Maximum number of results"),
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

# Debug: Add logging to see if this code is executed
logger.info("🔍 Registering /api/search endpoint...")

@app.get("/api/search")
async def global_search(
    q: str = Query(..., min_length=1, description="Search query"),
    type: Optional[str] = Query(None, description="Filter by type: executive_orders, state_legislation, all"),
    category: Optional[str] = Query(None, description="Filter by category"),
    state: Optional[str] = Query(None, description="Filter by state (for state legislation)"),
    limit: int = Query(20, ge=1, le=100, description="Maximum results to return")
):
    """Global search across executive orders and state legislation"""
    
    try:
        logger.info(f"🔍 Global search: q='{q}', type={type}, category={category}, state={state}")
        
        results = {
            "executive_orders": [],
            "state_legislation": [],
            "proclamations": []
        }
        
        search_types = []
        if type == "executive_orders":
            search_types = ["executive_orders"]
        elif type == "state_legislation":
            search_types = ["state_legislation"]
        else:  # all or None
            search_types = ["executive_orders", "state_legislation"]
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Search executive orders
            if "executive_orders" in search_types:
                eo_query = """
                    SELECT TOP (?)
                        eo_number as executive_order_number,
                        title,
                        ai_executive_summary as ai_summary,
                        ai_talking_points,
                        ai_business_impact,
                        signing_date,
                        category,
                        html_url as url,
                        pdf_url,
                        'executive_order' as type
                    FROM dbo.executive_orders
                    WHERE (
                        eo_number LIKE ? OR
                        title LIKE ? OR
                        ai_executive_summary LIKE ? OR
                        summary LIKE ?
                    )
                """
                
                eo_params = [limit, f'%{q}%', f'%{q}%', f'%{q}%', f'%{q}%']
                
                if category and category != 'all':
                    eo_query += " AND category = ?"
                    eo_params.append(category)
                
                eo_query += " ORDER BY signing_date DESC"
                
                cursor.execute(eo_query, eo_params)
                columns = [column[0] for column in cursor.description]
                
                for row in cursor.fetchall():
                    eo_dict = dict(zip(columns, row))
                    results["executive_orders"].append(eo_dict)
            
            # Search state legislation
            if "state_legislation" in search_types:
                sl_query = """
                    SELECT TOP (?)
                        bill_number,
                        title,
                        ai_summary,
                        ai_executive_summary,
                        ai_talking_points,
                        ai_business_impact,
                        description,
                        state,
                        category,
                        status,
                        introduced_date,
                        last_action_date,
                        session,
                        session_name,
                        legiscan_url,
                        'state_legislation' as type,
                        bill_id,
                        id
                    FROM dbo.state_legislation
                    WHERE (
                        bill_number LIKE ? OR
                        title LIKE ? OR
                        ai_summary LIKE ? OR
                        description LIKE ?
                    )
                """
                
                sl_params = [limit, f'%{q}%', f'%{q}%', f'%{q}%', f'%{q}%']
                
                if state and state != 'all':
                    sl_query += " AND state = ?"
                    sl_params.append(state.upper())
                
                if category and category != 'all':
                    sl_query += " AND category = ?"
                    sl_params.append(category)
                
                sl_query += " ORDER BY introduced_date DESC"
                
                cursor.execute(sl_query, sl_params)
                columns = [column[0] for column in cursor.description]
                
                for row in cursor.fetchall():
                    sl_dict = dict(zip(columns, row))
                    results["state_legislation"].append(sl_dict)
        
        # Calculate total results
        total_results = (
            len(results["executive_orders"]) + 
            len(results["state_legislation"]) + 
            len(results["proclamations"])
        )
        
        logger.info(f"✅ Search returned {total_results} results")
        
        return {
            "success": True,
            "query": q,
            "total_results": total_results,
            "executive_orders": results["executive_orders"],
            "state_legislation": results["state_legislation"],
            "proclamations": results["proclamations"]
        }
        
    except Exception as e:
        logger.error(f"❌ Search error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

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
                year_filter=getattr(request, 'year_filter', 'all'),
                max_pages=getattr(request, 'max_pages', 5),
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
            print(f"Processing state: {state}")
            # State processing logic would go here
            state_results[state] = {"status": "pending"}
        
        return {
            "success": True,
            "message": "Multi-state processing initiated",
            "states": request.states,
            "results": state_results
        }
        
    except Exception as e:
        print(f"❌ Error in fetch_state_legislation: {e}")
        return {
            "success": False,
            "error": str(e),
            "states": request.states
        }

# ===============================
# STATUS UPDATE ENDPOINTS
# ===============================

@app.post("/api/bills/update-statuses")
async def update_bill_statuses(quick_mode: bool = True):
    """Update bill statuses from LegiScan API"""
    try:
        from update_bill_statuses_endpoint import update_all_texas_statuses
        
        logger.info(f"🔄 Starting bill status update (quick_mode={quick_mode})")
        
        # Run the status update
        result = update_all_texas_statuses(quick_mode=quick_mode)
        
        if result.get('success'):
            logger.info(f"✅ Status update completed: {result['total_updated']} bills updated")
            return {
                "success": True,
                "message": f"Updated {result['total_updated']} bill statuses",
                "total_updated": result['total_updated'],
                "total_bills": result['total_bills'],
                "quick_mode": quick_mode,
                "sessions": result['sessions']
            }
        else:
            logger.error(f"❌ Status update failed: {result}")
            raise HTTPException(status_code=500, detail="Status update failed")
            
    except Exception as e:
        logger.error(f"❌ Error updating bill statuses: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update statuses: {str(e)}")

@app.get("/api/bills/status-update-info")
async def get_status_update_info():
    """Get information about the last status update"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Get latest update times for each session
            sessions = [
                '89th Legislature Regular Session',
                '89th Legislature 1st Special Session', 
                '89th Legislature 2nd Special Session'
            ]
            
            session_info = []
            for session_name in sessions:
                cursor.execute("""
                    SELECT 
                        COUNT(*) as total_bills,
                        MAX(last_updated) as latest_update,
                        COUNT(CASE WHEN last_updated > DATEADD(hour, -24, GETDATE()) THEN 1 END) as updated_today
                    FROM dbo.state_legislation 
                    WHERE state = 'TX' AND session_name = ?
                """, (session_name,))
                
                result = cursor.fetchone()
                session_info.append({
                    "session_name": session_name,
                    "total_bills": result[0] if result else 0,
                    "latest_update": result[1].isoformat() if result and result[1] else None,
                    "updated_today": result[2] if result else 0
                })
            
            return {
                "success": True,
                "sessions": session_info,
                "recommendation": "Run status update if latest_update is older than 24 hours"
            }
            
    except Exception as e:
        logger.error(f"❌ Error getting status update info: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get status info: {str(e)}")

# State Legislation New Bill Notification Endpoints
@app.get("/api/state-legislation/new-count")
async def get_new_bills_count(state: Optional[str] = Query(None)):
    """Get count of new state bills that haven't been viewed"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            if state:
                # Get count for specific state
                cursor.execute("""
                    SELECT COUNT(*) as new_bills_count
                    FROM dbo.state_legislation
                    WHERE state = ? AND is_new = 1
                """, (state,))
                
                result = cursor.fetchone()
                count = result[0] if result else 0
                
                return {
                    "success": True,
                    "state": state,
                    "new_count": count
                }
            else:
                # Get count for all states
                cursor.execute("""
                    SELECT 
                        state,
                        COUNT(*) as new_bills_count
                    FROM dbo.state_legislation
                    WHERE is_new = 1
                    GROUP BY state
                    ORDER BY state
                """)
                
                results = cursor.fetchall()
                state_counts = {row[0]: row[1] for row in results}
                total_count = sum(state_counts.values())
                
                return {
                    "success": True,
                    "total_new_count": total_count,
                    "state_counts": state_counts
                }
                
    except Exception as e:
        logger.error(f"❌ Error getting new bills count: {e}")
        return {
            "success": False,
            "error": str(e),
            "new_count": 0
        }

@app.get("/api/state-legislation/new")
async def get_new_bills(state: Optional[str] = Query(None), limit: int = Query(10)):
    """Get list of new state bills"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Build query based on whether state is specified
            if state:
                query = """
                    SELECT TOP (?) 
                        bill_id, bill_number, title, description, state, 
                        introduced_date, last_action_date, category, session_name,
                        created_at, last_updated
                    FROM dbo.state_legislation
                    WHERE is_new = 1 AND state = ?
                    ORDER BY created_at DESC, last_updated DESC
                """
                cursor.execute(query, (limit, state))
            else:
                query = """
                    SELECT TOP (?) 
                        bill_id, bill_number, title, description, state, 
                        introduced_date, last_action_date, category, session_name,
                        created_at, last_updated
                    FROM dbo.state_legislation
                    WHERE is_new = 1
                    ORDER BY created_at DESC, last_updated DESC
                """
                cursor.execute(query, (limit,))
            
            bills = cursor.fetchall()
            
            bill_list = []
            for bill in bills:
                bill_dict = {
                    "bill_id": bill[0],
                    "bill_number": bill[1],
                    "title": bill[2],
                    "description": bill[3],
                    "state": bill[4],
                    "introduced_date": bill[5],
                    "last_action_date": bill[6],
                    "category": bill[7],
                    "session_name": bill[8],
                    "created_at": bill[9],
                    "last_updated": bill[10]
                }
                bill_list.append(bill_dict)
            
        return {
            "success": True,
            "new_bills": bill_list,
            "count": len(bill_list),
            "state_filter": state
        }
        
    except Exception as e:
        logger.error(f"❌ Error getting new bills: {e}")
        return {
            "success": False,
            "error": str(e),
            "new_bills": [],
            "count": 0
        }

@app.post("/api/state-legislation/mark-viewed/{bill_id}")
async def mark_bill_as_viewed(bill_id: str, user_id: Optional[str] = Query("1")):
    """Mark a state bill as viewed (no longer new)"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Mark as viewed and set first_viewed_at if not already set
            cursor.execute("""
                UPDATE dbo.state_legislation
                SET is_new = 0,
                    first_viewed_at = CASE 
                        WHEN first_viewed_at IS NULL THEN GETDATE() 
                        ELSE first_viewed_at 
                    END,
                    last_updated = GETDATE()
                WHERE bill_id = ? AND is_new = 1
            """, (bill_id,))
            
            rows_affected = cursor.rowcount
            conn.commit()
            
        return {
            "success": True,
            "message": f"Bill {bill_id} marked as viewed",
            "rows_affected": rows_affected
        }
        
    except Exception as e:
        logger.error(f"❌ Error marking bill as viewed: {e}")
        return {
            "success": False,
            "error": str(e)
        }

