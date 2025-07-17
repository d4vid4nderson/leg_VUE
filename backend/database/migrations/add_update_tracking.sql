-- Migration: Add update tracking support
-- Created: 2025-01-17

-- Add update tracking columns to bills table
ALTER TABLE bills ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS legiscan_last_modified TIMESTAMP;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS update_source VARCHAR(50) DEFAULT 'legiscan';
ALTER TABLE bills ADD COLUMN IF NOT EXISTS needs_ai_processing BOOLEAN DEFAULT FALSE;

-- Create update_logs table for tracking batch updates
CREATE TABLE IF NOT EXISTS update_logs (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(50),
    state_code VARCHAR(5),
    update_started TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_completed TIMESTAMP,
    bills_updated INTEGER DEFAULT 0,
    bills_added INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'running', -- 'running', 'completed', 'failed'
    error_message TEXT,
    update_type VARCHAR(20) DEFAULT 'nightly' -- 'nightly', 'manual', 'incremental'
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_bills_last_updated ON bills(last_updated);
CREATE INDEX IF NOT EXISTS idx_bills_session_updated ON bills(session_id, last_updated);
CREATE INDEX IF NOT EXISTS idx_update_logs_session ON update_logs(session_id, update_started);
CREATE INDEX IF NOT EXISTS idx_update_logs_status ON update_logs(status, update_started);

-- Create update_notifications table for user notifications
CREATE TABLE IF NOT EXISTS update_notifications (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50), -- For future user-specific notifications
    session_id VARCHAR(50),
    state_code VARCHAR(5),
    new_bills_count INTEGER DEFAULT 0,
    updated_bills_count INTEGER DEFAULT 0,
    notification_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notification_read BOOLEAN DEFAULT FALSE,
    notification_type VARCHAR(20) DEFAULT 'bill_update' -- 'bill_update', 'session_change'
);

-- Add trigger to auto-update last_updated timestamp
CREATE OR REPLACE FUNCTION update_bills_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bills_update_timestamp
    BEFORE UPDATE ON bills
    FOR EACH ROW
    EXECUTE FUNCTION update_bills_timestamp();

-- Create view for update statistics
CREATE OR REPLACE VIEW update_statistics AS
SELECT 
    state_code,
    session_id,
    COUNT(*) as total_bills,
    COUNT(CASE WHEN last_updated > CURRENT_TIMESTAMP - INTERVAL '24 hours' THEN 1 END) as updated_today,
    COUNT(CASE WHEN needs_ai_processing = TRUE THEN 1 END) as needs_ai_processing,
    MAX(last_updated) as last_update_time
FROM bills 
GROUP BY state_code, session_id;