-- ============================================
-- Supabase PostgreSQL Schema
-- Generated from Azure SQL Server export
-- ============================================

-- ============================================
-- 1. EXECUTIVE ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS executive_orders (
    id SERIAL PRIMARY KEY,
    document_number VARCHAR(100),
    eo_number VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    summary TEXT,
    signing_date DATE,
    publication_date DATE,
    citation VARCHAR(200),
    presidential_document_type VARCHAR(100),
    category VARCHAR(100),
    html_url VARCHAR(500),
    pdf_url VARCHAR(500),
    trump_2025_url VARCHAR(500),
    ai_summary TEXT,
    ai_executive_summary TEXT,
    ai_key_points TEXT,
    ai_talking_points TEXT,
    ai_business_impact TEXT,
    ai_potential_impact TEXT,
    ai_version VARCHAR(100),
    source VARCHAR(100),
    raw_data_available BOOLEAN DEFAULT false,
    processing_status VARCHAR(50),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_scraped_at TIMESTAMP,
    content TEXT,
    tags VARCHAR(500),
    ai_analysis TEXT,
    reviewed BOOLEAN NOT NULL DEFAULT false,
    is_new BOOLEAN DEFAULT false,
    first_viewed_at TIMESTAMP
);

-- Indexes for executive_orders
CREATE INDEX IF NOT EXISTS idx_eo_publication_date ON executive_orders(publication_date DESC);
CREATE INDEX IF NOT EXISTS idx_eo_signing_date ON executive_orders(signing_date DESC);
CREATE INDEX IF NOT EXISTS idx_eo_category ON executive_orders(category);
CREATE INDEX IF NOT EXISTS idx_eo_eo_number ON executive_orders(eo_number);
CREATE INDEX IF NOT EXISTS idx_eo_is_new ON executive_orders(is_new, created_at DESC);

-- ============================================
-- 2. STATE LEGISLATION TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS state_legislation (
    id SERIAL PRIMARY KEY,
    bill_id VARCHAR(100) NOT NULL UNIQUE,
    bill_number VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    state VARCHAR(50) NOT NULL,
    state_abbr VARCHAR(5),
    status VARCHAR(100),
    category VARCHAR(50),
    introduced_date VARCHAR(20),
    last_action_date VARCHAR(20),
    session_id VARCHAR(50),
    session_name VARCHAR(100),
    bill_type VARCHAR(50),
    body VARCHAR(20),
    legiscan_url TEXT,
    pdf_url TEXT,
    ai_summary TEXT,
    ai_executive_summary TEXT,
    ai_talking_points TEXT,
    ai_key_points TEXT,
    ai_business_impact TEXT,
    ai_potential_impact TEXT,
    ai_version VARCHAR(50),
    created_at VARCHAR(30) NOT NULL,
    last_updated VARCHAR(30) NOT NULL,
    reviewed BOOLEAN NOT NULL DEFAULT false,
    legiscan_status VARCHAR(255),
    session VARCHAR(255),
    is_new BOOLEAN DEFAULT false,
    first_viewed_at TIMESTAMP
);

-- Indexes for state_legislation
CREATE INDEX IF NOT EXISTS idx_sl_state ON state_legislation(state);
CREATE INDEX IF NOT EXISTS idx_sl_state_date ON state_legislation(state, last_action_date DESC);
CREATE INDEX IF NOT EXISTS idx_sl_bill_number ON state_legislation(bill_number);
CREATE INDEX IF NOT EXISTS idx_sl_category ON state_legislation(category);
CREATE INDEX IF NOT EXISTS idx_sl_session_id ON state_legislation(session_id);
CREATE INDEX IF NOT EXISTS idx_sl_is_new ON state_legislation(is_new);

-- ============================================
-- 3. USER HIGHLIGHTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_highlights (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    order_id VARCHAR(255) NOT NULL,
    order_type VARCHAR(50) NOT NULL,
    highlighted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    priority_level INTEGER DEFAULT 1,
    tags TEXT,
    is_archived BOOLEAN DEFAULT false,
    title TEXT,
    description TEXT,
    ai_summary TEXT,
    category VARCHAR(50),
    state VARCHAR(50),
    signing_date VARCHAR(50),
    html_url VARCHAR(500),
    pdf_url VARCHAR(500),
    legiscan_url VARCHAR(500),
    UNIQUE(user_id, order_id, order_type)
);

-- Indexes for user_highlights
CREATE INDEX IF NOT EXISTS idx_uh_user_id ON user_highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_uh_user_order ON user_highlights(user_id, order_id);

-- ============================================
-- 4. PAGE VIEWS TABLE (Analytics)
-- ============================================
CREATE TABLE IF NOT EXISTS page_views (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    page_name VARCHAR(255) NOT NULL,
    page_path VARCHAR(500) NOT NULL,
    session_id VARCHAR(100),
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    duration_seconds INTEGER,
    left_at TIMESTAMP
);

-- Indexes for page_views
CREATE INDEX IF NOT EXISTS idx_pv_user_id ON page_views(user_id);
CREATE INDEX IF NOT EXISTS idx_pv_viewed_at ON page_views(viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_pv_session_id ON page_views(session_id);

-- ============================================
-- 5. USER PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id VARCHAR(50) PRIMARY KEY,
    msi_email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    given_name VARCHAR(100),
    surname VARCHAR(100),
    msi_object_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    login_count INTEGER DEFAULT 0,
    email VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    department VARCHAR(100)
);

-- Index for user_profiles
CREATE INDEX IF NOT EXISTS idx_up_email ON user_profiles(email);

-- ============================================
-- 6. USER ACTIVITY EVENTS TABLE (Analytics)
-- ============================================
CREATE TABLE IF NOT EXISTS user_activity_events (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    session_id VARCHAR(100),
    event_type VARCHAR(50) NOT NULL,
    event_category VARCHAR(50),
    page_name VARCHAR(255),
    page_path VARCHAR(500),
    event_data TEXT,
    duration_seconds INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for user_activity_events
CREATE INDEX IF NOT EXISTS idx_uae_user_id ON user_activity_events(user_id);
CREATE INDEX IF NOT EXISTS idx_uae_created_at ON user_activity_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_uae_event_type ON user_activity_events(event_type);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Enable public access since auth is removed
-- ============================================

-- Enable RLS on all tables
ALTER TABLE executive_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE state_legislation ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_events ENABLE ROW LEVEL SECURITY;

-- Policies for public read access
CREATE POLICY "Allow public read" ON executive_orders FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON state_legislation FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON user_highlights FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON page_views FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON user_activity_events FOR SELECT USING (true);

-- Policies for public write access (analytics and highlights)
CREATE POLICY "Allow public insert" ON page_views FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert" ON user_activity_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert" ON user_highlights FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON user_highlights FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON user_highlights FOR DELETE USING (true);
CREATE POLICY "Allow public insert" ON user_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON user_profiles FOR UPDATE USING (true);

