"""
Configuration file for State Legislation Processor

Modify these settings to control the behavior of the nightly processor.
"""

# States to process automatically
# Add or remove states as needed
CONFIGURED_STATES = [
    'TX',  # Texas
    'CA',  # California  
    'NV',  # Nevada
    'KY',  # Kentucky
    'SC',  # South Carolina
    'CO'   # Colorado
]

# Processing limits (to avoid API rate limiting)
PROCESSING_LIMITS = {
    'new_bills_per_session': 10,        # Max new bills to process per session per run
    'status_updates_per_session': 50,   # Max bill status updates per session per run
    'source_links_per_state': 20,       # Max missing source links to fix per state per run
    'category_updates_per_state': 50,   # Max category updates per state per run
    'api_delay_seconds': 1,              # Delay between API calls
    'status_update_delay_seconds': 0.5   # Delay between status update API calls
}

# Data retention settings
DATA_SETTINGS = {
    'status_update_cutoff_days': 30,    # Only update status for bills modified in last N days
    'ai_summary_max_length': 2000,     # Max length for AI-generated summaries
    'title_max_length': 500,           # Max length for bill titles
    'description_max_length': 500,     # Max length for bill descriptions
    'status_max_length': 200           # Max length for status descriptions
}

# Approved practice area categories (DO NOT MODIFY without updating frontend)
APPROVED_CATEGORIES = [
    'Civic',
    'Education', 
    'Engineering',
    'Healthcare',
    'Not Applicable'  # Default fallback
]

# Practice area keywords for categorization
# Add keywords to improve categorization accuracy
PRACTICE_AREA_KEYWORDS = {
    'Education': [
        'school', 'education', 'student', 'teacher', 'university', 'college', 
        'academic', 'curriculum', 'tuition', 'scholarship', 'classroom', 
        'campus', 'diploma', 'degree', 'learning', 'instruction', 'educational',
        'kindergarten', 'elementary', 'secondary', 'assessment instrument',
        'public school', 'private school', 'charter school', 'vocational',
        'training', 'certification', 'accreditation'
    ],
    'Healthcare': [
        'health', 'medical', 'hospital', 'insurance', 'medicare', 'medicaid', 
        'patient', 'pharmacy', 'physician', 'nurse', 'clinic', 'treatment', 
        'disease', 'mental health', 'dental', 'vision', 'prescription', 'drug', 
        'medicine', 'therapeutic', 'diagnosis', 'surgery', 'emergency medical',
        'healthcare', 'wellness', 'prevention', 'vaccine', 'immunization',
        'rehabilitation', 'therapy', 'ambulance', 'first aid'
    ],
    'Engineering': [
        'engineering', 'infrastructure', 'construction', 'bridge', 'highway',
        'transportation', 'road', 'vehicle', 'traffic', 'transit', 'building',
        'structural', 'civil engineering', 'mechanical', 'electrical',
        'environment', 'environmental', 'water management', 'stormwater',
        'drainage', 'pollution', 'waste management', 'renewable energy',
        'solar', 'wind', 'utilities', 'public works', 'maintenance',
        'zoning', 'planning', 'development'
    ],
    'Civic': [
        'election', 'voting', 'ballot', 'campaign', 'political', 'democracy', 
        'citizenship', 'voter', 'candidate', 'ethics', 'transparency',
        'accountability', 'public meeting', 'open records', 'governance',
        'municipal', 'county', 'local government', 'public participation',
        'civic engagement', 'public hearing', 'referendum', 'initiative'
    ]
}

# Logging configuration
LOGGING_CONFIG = {
    'level': 'INFO',  # DEBUG, INFO, WARNING, ERROR
    'log_file': 'nightly_state_processor.log',
    'max_log_size_mb': 50,
    'backup_count': 5
}