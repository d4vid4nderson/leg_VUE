# Azure SQL to Supabase Migration Guide

## Overview

This guide walks through migrating your LegislativeVUE database from Azure SQL Server to Supabase (PostgreSQL).

## Step 1: Export Data from Azure SQL

### Option A: Using the Export Script (Recommended)

```bash
cd backend
python scripts/export_azure_data.py
```

This will create:
- `exports/*.csv` - Data files for each table
- `exports/*_schema.csv` - Schema information
- `exports/supabase_schema.sql` - PostgreSQL CREATE TABLE statements

### Option B: Using Azure Data Studio / SSMS

1. Connect to your Azure SQL database
2. Right-click database → Tasks → Export Data
3. Export each table to CSV format

### Option C: Using sqlcmd (Command Line)

```bash
# Export executive_orders
sqlcmd -S sql-legislation-tracker.database.windows.net -d db-executiveorders -U your_username -P your_password -Q "SELECT * FROM dbo.executive_orders" -o executive_orders.csv -s"," -W

# Repeat for other tables
```

## Step 2: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create account
2. Create a new project
3. Note your:
   - **Project URL**: `https://xxxxxxxxxxxx.supabase.co`
   - **Database Host**: `db.xxxxxxxxxxxx.supabase.co`
   - **Database Password**: (set during project creation)
   - **API Keys**: Found in Settings → API

## Step 3: Create Tables in Supabase

### Using the SQL Editor

1. Go to Supabase Dashboard → SQL Editor
2. Run the generated `supabase_schema.sql` file
3. Or use these PostgreSQL CREATE TABLE statements:

```sql
-- Executive Orders Table
CREATE TABLE IF NOT EXISTS executive_orders (
    id SERIAL PRIMARY KEY,
    document_number VARCHAR(100) UNIQUE,
    eo_number VARCHAR(50),
    title TEXT,
    summary TEXT,
    signing_date DATE,
    publication_date DATE,
    citation VARCHAR(255),
    presidential_document_type VARCHAR(100),
    category VARCHAR(100),
    html_url TEXT,
    pdf_url TEXT,
    trump_2025_url TEXT,
    ai_summary TEXT,
    ai_executive_summary TEXT,
    ai_key_points TEXT,
    ai_talking_points TEXT,
    ai_business_impact TEXT,
    ai_potential_impact TEXT,
    ai_version VARCHAR(50),
    ai_analysis TEXT,
    source VARCHAR(100),
    raw_data_available BOOLEAN DEFAULT false,
    processing_status VARCHAR(50),
    error_message TEXT,
    content TEXT,
    tags TEXT,
    is_new BOOLEAN DEFAULT true,
    first_viewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_scraped_at TIMESTAMP
);

-- State Legislation Table
CREATE TABLE IF NOT EXISTS state_legislation (
    id BIGSERIAL PRIMARY KEY,
    bill_id BIGINT UNIQUE,
    bill_number VARCHAR(50),
    title VARCHAR(1000),
    description TEXT,
    status INTEGER,
    status_date DATE,
    bill_type VARCHAR(10),
    chamber VARCHAR(10),
    current_chamber VARCHAR(10),
    sponsors TEXT,
    subjects TEXT,
    full_text_url VARCHAR(500),
    state VARCHAR(5) DEFAULT 'TX',
    session_year INTEGER,
    legiscan_url VARCHAR(500),
    state_url VARCHAR(500),
    session_name VARCHAR(255),
    completed BOOLEAN DEFAULT false,
    ai_summary TEXT,
    ai_executive_summary TEXT,
    ai_impact_analysis TEXT,
    ai_key_provisions TEXT,
    ai_political_implications TEXT,
    ai_stakeholder_analysis TEXT,
    ai_talking_points TEXT,
    ai_business_impact TEXT,
    category VARCHAR(100),
    introduced_date DATE,
    last_action_date DATE,
    is_new BOOLEAN DEFAULT true,
    first_viewed_at TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_date TIMESTAMP,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Highlights Table
CREATE TABLE IF NOT EXISTS user_highlights (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    order_id VARCHAR(100) NOT NULL,
    order_type VARCHAR(50),
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
    priority_level INTEGER DEFAULT 1,
    tags TEXT,
    is_archived BOOLEAN DEFAULT false,
    UNIQUE(user_id, order_id, order_type)
);

-- Legislative Sessions Table
CREATE TABLE IF NOT EXISTS legislative_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(50) UNIQUE,
    state VARCHAR(10),
    session_name VARCHAR(255),
    is_special BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    year_start INTEGER,
    year_end INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Page Views Table (Analytics)
CREATE TABLE IF NOT EXISTS page_views (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50),
    page_name VARCHAR(255),
    page_path VARCHAR(500),
    session_id VARCHAR(100),
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    duration_seconds INTEGER,
    left_at TIMESTAMP
);

-- User Profiles Table
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id VARCHAR(50) PRIMARY KEY,
    msi_email VARCHAR(255),
    display_name VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    department VARCHAR(100),
    last_login TIMESTAMP,
    login_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Activity Events Table
CREATE TABLE IF NOT EXISTS user_activity_events (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50),
    session_id VARCHAR(100),
    event_type VARCHAR(50),
    event_category VARCHAR(50),
    page_name VARCHAR(255),
    page_path VARCHAR(500),
    event_data TEXT,
    duration_seconds INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_eo_date ON executive_orders(publication_date DESC);
CREATE INDEX IF NOT EXISTS idx_eo_category ON executive_orders(category);
CREATE INDEX IF NOT EXISTS idx_eo_is_new ON executive_orders(is_new, created_at);

CREATE INDEX IF NOT EXISTS idx_sl_state_date ON state_legislation(state, last_action_date DESC);
CREATE INDEX IF NOT EXISTS idx_sl_bill_number ON state_legislation(bill_number);
CREATE INDEX IF NOT EXISTS idx_sl_is_new ON state_legislation(is_new);

CREATE INDEX IF NOT EXISTS idx_highlights_user ON user_highlights(user_id, highlighted_at DESC);
CREATE INDEX IF NOT EXISTS idx_highlights_order ON user_highlights(user_id, order_id);

CREATE INDEX IF NOT EXISTS idx_sessions_state ON legislative_sessions(state, is_active);

CREATE INDEX IF NOT EXISTS idx_page_views_user ON page_views(user_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_user ON user_activity_events(user_id, created_at DESC);
```

## Step 4: Import Data

### Option A: Supabase Dashboard (Small datasets)

1. Go to Table Editor
2. Click on table → Insert → Import data from CSV
3. Upload your exported CSV files

### Option B: Using psql (Large datasets - Recommended)

```bash
# Connect to Supabase
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Import data (run for each table)
\copy executive_orders FROM 'exports/executive_orders.csv' WITH (FORMAT csv, HEADER true);
\copy state_legislation FROM 'exports/state_legislation.csv' WITH (FORMAT csv, HEADER true);
\copy user_highlights FROM 'exports/user_highlights.csv' WITH (FORMAT csv, HEADER true);
\copy legislative_sessions FROM 'exports/legislative_sessions.csv' WITH (FORMAT csv, HEADER true);
```

### Option C: Using Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Import using db push
supabase db push
```

## Step 5: Update Backend Configuration

### Install PostgreSQL Driver

```bash
cd backend
pip install psycopg2-binary
# or for async support:
pip install asyncpg
```

### Update Environment Variables

Create/update your `.env` file:

```env
# Supabase Configuration
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Direct Database Connection (for backend)
SUPABASE_DB_HOST=db.xxxxxxxxxxxx.supabase.co
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=your-database-password

# Remove or comment out Azure SQL settings
# AZURE_SQL_SERVER=...
# AZURE_SQL_DATABASE=...
```

### Replace database_config.py

Copy `scripts/supabase_config.py` to replace `database_config.py`:

```bash
cp scripts/supabase_config.py database_config.py
```

## Step 6: SQL Syntax Changes

Some queries need updates for PostgreSQL:

| SQL Server | PostgreSQL | Notes |
|------------|------------|-------|
| `GETDATE()` | `CURRENT_TIMESTAMP` | Current timestamp |
| `SELECT TOP 10` | `SELECT ... LIMIT 10` | Limit at end |
| `ISNULL(x, y)` | `COALESCE(x, y)` | Null handling |
| `BIT` | `BOOLEAN` | true/false |
| `NVARCHAR(MAX)` | `TEXT` | Large text |
| `IDENTITY` | `SERIAL` | Auto-increment |
| `[column]` | `"column"` | Reserved word quoting |

### Common Query Updates

```python
# Before (SQL Server)
cursor.execute("SELECT TOP 10 * FROM executive_orders ORDER BY publication_date DESC")

# After (PostgreSQL)
cursor.execute("SELECT * FROM executive_orders ORDER BY publication_date DESC LIMIT 10")
```

```python
# Before (SQL Server)
cursor.execute("INSERT INTO table (col) VALUES (?) ", (value,))

# After (PostgreSQL) - use %s instead of ?
cursor.execute("INSERT INTO table (col) VALUES (%s)", (value,))
```

## Step 7: Update Frontend (Optional - Direct Supabase)

If you want to use Supabase client directly from frontend:

```bash
cd frontend
npm install @supabase/supabase-js
```

Create `src/config/supabase.js`:

```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

Update `.env`:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Step 8: Enable Row Level Security (Optional)

For public access without auth:

```sql
-- Allow public read access
ALTER TABLE executive_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON executive_orders FOR SELECT USING (true);

ALTER TABLE state_legislation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON state_legislation FOR SELECT USING (true);

-- Repeat for other tables as needed
```

## Verification Checklist

- [ ] All tables created in Supabase
- [ ] Data imported successfully
- [ ] Row counts match between Azure and Supabase
- [ ] Backend connects to Supabase
- [ ] API endpoints return data
- [ ] Frontend loads data correctly
- [ ] Analytics tracking works

## Troubleshooting

### Connection Issues
- Ensure your IP is allowed in Supabase (Database → Settings → Network)
- Check SSL mode is set to 'require'
- Verify credentials in environment variables

### Data Type Issues
- TEXT columns may need trimming if they had NVARCHAR length limits
- BIT → BOOLEAN: 0 becomes false, 1 becomes true
- DATETIME → TIMESTAMP: Usually automatic

### Query Errors
- Replace `?` with `%s` in parameterized queries
- Move LIMIT to end of query instead of TOP
- Use COALESCE instead of ISNULL
