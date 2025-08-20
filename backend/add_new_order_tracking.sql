-- Add is_new field to executive_orders table to track new items
-- This field will be set to 1 when orders are first fetched, and reset when user views them

ALTER TABLE dbo.executive_orders 
ADD is_new BIT DEFAULT 0;

-- Add index for performance on new order queries
CREATE INDEX IX_executive_orders_is_new 
ON dbo.executive_orders (is_new, created_at);

-- Add first_viewed_at field to track when user first sees the order
ALTER TABLE dbo.executive_orders 
ADD first_viewed_at DATETIME NULL;

-- Create a procedure to mark orders as viewed
CREATE OR ALTER PROCEDURE MarkOrderAsViewed
    @executive_order_number NVARCHAR(50),
    @user_id NVARCHAR(255) = NULL
AS
BEGIN
    UPDATE dbo.executive_orders 
    SET is_new = 0,
        first_viewed_at = CASE 
            WHEN first_viewed_at IS NULL THEN GETDATE() 
            ELSE first_viewed_at 
        END,
        last_updated = GETDATE()
    WHERE executive_order_number = @executive_order_number;
    
    -- Return updated record
    SELECT * FROM dbo.executive_orders 
    WHERE executive_order_number = @executive_order_number;
END;

-- Create a procedure to get new orders count
CREATE OR ALTER PROCEDURE GetNewOrdersCount
AS
BEGIN
    SELECT COUNT(*) as new_count
    FROM dbo.executive_orders 
    WHERE is_new = 1;
END;

-- Create a procedure to get new orders with details  
CREATE OR ALTER PROCEDURE GetNewOrders
    @limit INT = 10
AS
BEGIN
    SELECT TOP (@limit) 
        executive_order_number,
        title,
        signing_date,
        created_at,
        category
    FROM dbo.executive_orders 
    WHERE is_new = 1
    ORDER BY created_at DESC;
END;