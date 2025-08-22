-- Create legislative sessions tracking table
-- Run this SQL script to create the session tracking table if it doesn't exist

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='legislative_sessions' AND xtype='U')
BEGIN
    CREATE TABLE dbo.legislative_sessions (
        id int IDENTITY(1,1) PRIMARY KEY,
        session_id varchar(50) NOT NULL UNIQUE,
        state varchar(10) NOT NULL,
        session_name varchar(255) NOT NULL,
        is_special bit NOT NULL DEFAULT 0,
        is_active bit NOT NULL DEFAULT 1,
        year_start int NULL,
        year_end int NULL,
        created_at datetime2 NOT NULL DEFAULT GETDATE(),
        updated_at datetime2 NOT NULL DEFAULT GETDATE()
    );
    
    -- Create indexes for better performance
    CREATE INDEX IX_legislative_sessions_state ON dbo.legislative_sessions(state);
    CREATE INDEX IX_legislative_sessions_active ON dbo.legislative_sessions(is_active);
    CREATE INDEX IX_legislative_sessions_state_active ON dbo.legislative_sessions(state, is_active);
    
    PRINT 'Created legislative_sessions table with indexes';
END
ELSE
BEGIN
    PRINT 'legislative_sessions table already exists';
END