-- Add managed identities for Container App Jobs to Azure SQL Database
-- Run this script as the Azure AD admin in SQL Server Management Studio or Azure Data Studio

-- Add job-state-bills-nightly managed identity
CREATE USER [job-state-bills-nightly] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [job-state-bills-nightly];
ALTER ROLE db_datawriter ADD MEMBER [job-state-bills-nightly];
ALTER ROLE db_ddladmin ADD MEMBER [job-state-bills-nightly];

-- Add job-executive-orders-nightly managed identity  
CREATE USER [job-executive-orders-nightly] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [job-executive-orders-nightly];
ALTER ROLE db_datawriter ADD MEMBER [job-executive-orders-nightly]; 
ALTER ROLE db_ddladmin ADD MEMBER [job-executive-orders-nightly];

-- Grant additional permissions if needed
GRANT EXECUTE TO [job-state-bills-nightly];
GRANT EXECUTE TO [job-executive-orders-nightly];

-- Verify the users were created
SELECT name, type_desc, authentication_type_desc 
FROM sys.database_principals 
WHERE name IN ('job-state-bills-nightly', 'job-executive-orders-nightly');