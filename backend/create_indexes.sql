-- Performance Optimization Indexes for PoliticalVue Database
-- Run this script to add indexes that will significantly improve query performance

-- Executive Orders Table Indexes
-- ================================

-- Index for date-based queries (most common query pattern)
CREATE INDEX idx_executive_orders_date 
ON dbo.executive_orders(publication_date DESC, signing_date DESC);

-- Index for president + date queries (for filtering)
CREATE INDEX idx_executive_orders_president_date 
ON dbo.executive_orders(president, publication_date DESC);

-- Index for category filtering
CREATE INDEX idx_executive_orders_category 
ON dbo.executive_orders(category);

-- Index for EO number lookups
CREATE INDEX idx_executive_orders_eo_number 
ON dbo.executive_orders(eo_number);

-- Composite index for common query pattern
CREATE INDEX idx_executive_orders_lookup 
ON dbo.executive_orders(id, publication_date, president, category);

-- Full-text search index for title and summary
CREATE FULLTEXT CATALOG ft_executive_orders AS DEFAULT;
CREATE FULLTEXT INDEX ON dbo.executive_orders(title, summary, ai_summary) 
KEY INDEX PK_executive_orders;

-- Highlights Table Indexes
-- ================================

-- Index for user + order lookups (most common pattern)
CREATE INDEX idx_highlights_user_order 
ON dbo.highlights(user_id, order_id);

-- Index for user + type lookups
CREATE INDEX idx_highlights_user_type 
ON dbo.highlights(user_id, item_type);

-- Index for finding all highlights for a user
CREATE INDEX idx_highlights_user 
ON dbo.highlights(user_id, created_at DESC);

-- Composite index for highlight existence checks
CREATE INDEX idx_highlights_existence 
ON dbo.highlights(user_id, order_id, item_type);

-- State Legislation Table Indexes (if exists)
-- ================================

-- Check if state_legislation table exists before creating indexes
IF OBJECT_ID('dbo.state_legislation', 'U') IS NOT NULL
BEGIN
    -- Index for state + date queries
    CREATE INDEX idx_state_legislation_state_date 
    ON dbo.state_legislation(state, last_action_date DESC);

    -- Index for bill type filtering
    CREATE INDEX idx_state_legislation_bill_type 
    ON dbo.state_legislation(bill_type);

    -- Index for status filtering
    CREATE INDEX idx_state_legislation_status 
    ON dbo.state_legislation(status);

    -- Composite index for common state queries
    CREATE INDEX idx_state_legislation_state_lookup 
    ON dbo.state_legislation(state, bill_type, status, last_action_date DESC);
END

-- Query to verify indexes were created
SELECT 
    t.name AS TableName,
    i.name AS IndexName,
    i.type_desc AS IndexType,
    STUFF((
        SELECT ', ' + c.name
        FROM sys.index_columns ic
        JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
        ORDER BY ic.key_ordinal
        FOR XML PATH('')
    ), 1, 2, '') AS IndexColumns
FROM sys.indexes i
JOIN sys.tables t ON i.object_id = t.object_id
WHERE t.name IN ('executive_orders', 'highlights', 'state_legislation')
AND i.type > 0
ORDER BY t.name, i.name;