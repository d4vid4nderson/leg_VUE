-- SQL Server script to create the dbo.state_legislation table
-- Run this script in your SQL Server database before running the Python processing script

CREATE TABLE dbo.state_legislation (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    bill_id BIGINT NOT NULL UNIQUE,
    bill_number NVARCHAR(50) NOT NULL,
    title NVARCHAR(1000) NOT NULL,
    description NVARCHAR(MAX),
    status INT,
    status_date DATE,
    bill_type NVARCHAR(10),
    chamber NVARCHAR(10),
    current_chamber NVARCHAR(10),
    sponsors NVARCHAR(MAX), -- JSON string of sponsors array
    subjects NVARCHAR(MAX), -- JSON string of subjects array
    full_text_url NVARCHAR(500),
    state NVARCHAR(5) DEFAULT 'TX',
    session_year INT,
    legiscan_url NVARCHAR(500),
    state_url NVARCHAR(500),
    completed BIT DEFAULT 0,
    
    -- AI Analysis fields
    ai_summary NVARCHAR(MAX),
    ai_impact_analysis NVARCHAR(MAX),
    ai_key_provisions NVARCHAR(MAX), -- JSON string of provisions array
    ai_political_implications NVARCHAR(MAX),
    ai_stakeholder_analysis NVARCHAR(MAX),
    processed_date DATETIME2,
    
    -- Metadata
    created_date DATETIME2 DEFAULT GETUTCDATE(),
    updated_date DATETIME2 DEFAULT GETUTCDATE(),
    
    -- Indexes for performance
    INDEX IX_state_legislation_bill_number (bill_number),
    INDEX IX_state_legislation_session_year (session_year),
    INDEX IX_state_legislation_status (status),
    INDEX IX_state_legislation_bill_type (bill_type),
    INDEX IX_state_legislation_completed (completed)
);

-- Create a trigger to update the updated_date on modifications
CREATE TRIGGER trg_state_legislation_updated
ON dbo.state_legislation
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.state_legislation
    SET updated_date = GETUTCDATE()
    FROM dbo.state_legislation sl
    INNER JOIN inserted i ON sl.id = i.id;
END;
