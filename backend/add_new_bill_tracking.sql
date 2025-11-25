-- Add new bill tracking fields to state_legislation table
-- Similar to executive orders new tracking functionality

-- Add is_new column to track new bills
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'state_legislation' AND COLUMN_NAME = 'is_new'
)
BEGIN
    ALTER TABLE dbo.state_legislation 
    ADD is_new BIT DEFAULT 0;
    PRINT 'Added is_new column to state_legislation table';
END
ELSE
BEGIN
    PRINT 'is_new column already exists in state_legislation table';
END

-- Add first_viewed_at column to track when a bill was first viewed by a user
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'state_legislation' AND COLUMN_NAME = 'first_viewed_at'
)
BEGIN
    ALTER TABLE dbo.state_legislation 
    ADD first_viewed_at DATETIME NULL;
    PRINT 'Added first_viewed_at column to state_legislation table';
END
ELSE
BEGIN
    PRINT 'first_viewed_at column already exists in state_legislation table';
END

-- Create index on is_new for faster queries
IF NOT EXISTS (
    SELECT * FROM sys.indexes 
    WHERE name = 'IX_state_legislation_is_new' 
    AND object_id = OBJECT_ID('dbo.state_legislation')
)
BEGIN
    CREATE INDEX IX_state_legislation_is_new 
    ON dbo.state_legislation (is_new) 
    WHERE is_new = 1;
    PRINT 'Created index IX_state_legislation_is_new';
END
ELSE
BEGIN
    PRINT 'Index IX_state_legislation_is_new already exists';
END

-- Create index on first_viewed_at for performance
IF NOT EXISTS (
    SELECT * FROM sys.indexes 
    WHERE name = 'IX_state_legislation_first_viewed_at' 
    AND object_id = OBJECT_ID('dbo.state_legislation')
)
BEGIN
    CREATE INDEX IX_state_legislation_first_viewed_at 
    ON dbo.state_legislation (first_viewed_at);
    PRINT 'Created index IX_state_legislation_first_viewed_at';
END
ELSE
BEGIN
    PRINT 'Index IX_state_legislation_first_viewed_at already exists';
END

-- Create stored procedure to mark a bill as viewed
IF OBJECT_ID('dbo.sp_mark_bill_as_viewed', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_mark_bill_as_viewed;
GO

CREATE PROCEDURE dbo.sp_mark_bill_as_viewed
    @bill_id NVARCHAR(50),
    @user_id NVARCHAR(100) = '1'
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE dbo.state_legislation
    SET is_new = 0,
        first_viewed_at = CASE 
            WHEN first_viewed_at IS NULL THEN GETDATE() 
            ELSE first_viewed_at 
        END,
        last_updated = GETDATE()
    WHERE bill_id = @bill_id
    AND is_new = 1;
    
    SELECT @@ROWCOUNT as rows_affected;
END
GO

-- Create stored procedure to get new bills count by state
IF OBJECT_ID('dbo.sp_get_new_bills_count', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_get_new_bills_count;
GO

CREATE PROCEDURE dbo.sp_get_new_bills_count
    @state NVARCHAR(10) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    IF @state IS NULL
    BEGIN
        -- Get count for all states
        SELECT 
            state,
            COUNT(*) as new_bills_count
        FROM dbo.state_legislation
        WHERE is_new = 1
        GROUP BY state
        ORDER BY state;
    END
    ELSE
    BEGIN
        -- Get count for specific state
        SELECT 
            @state as state,
            COUNT(*) as new_bills_count
        FROM dbo.state_legislation
        WHERE state = @state AND is_new = 1;
    END
END
GO

-- Create stored procedure to bulk mark bills as new (for scheduler)
IF OBJECT_ID('dbo.sp_mark_bills_as_new', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_mark_bills_as_new;
GO

CREATE PROCEDURE dbo.sp_mark_bills_as_new
    @state NVARCHAR(10),
    @hours_back INT = 2
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE dbo.state_legislation
    SET is_new = 1,
        last_updated = GETDATE()
    WHERE state = @state
    AND (created_at >= DATEADD(hour, -@hours_back, GETDATE()) 
         OR last_updated >= DATEADD(hour, -@hours_back, GETDATE()))
    AND (is_new IS NULL OR is_new = 0);
    
    SELECT @@ROWCOUNT as rows_affected;
END
GO

PRINT 'New bill tracking setup completed successfully!';