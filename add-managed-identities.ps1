# PowerShell script to add managed identities to Azure SQL Database
# Run this with Azure PowerShell or Azure Cloud Shell

# Connect to Azure (if not already connected)
# Connect-AzAccount

# Set variables
$resourceGroupName = "rg-legislation-tracker"
$serverName = "sql-legislation-tracker"
$databaseName = "db-executiveorders"

# Get access token for Azure SQL
$token = [Microsoft.Azure.Commands.Common.Authentication.AzureSession]::Instance.AuthenticationFactory.Authenticate($context.Account, $context.Environment, $context.Tenant.Id, $null, "https://database.windows.net/", $null).AccessToken

# SQL commands to add managed identities
$sqlCommands = @"
-- Add job-executive-orders-nightly managed identity
CREATE USER [job-executive-orders-nightly] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [job-executive-orders-nightly];
ALTER ROLE db_datawriter ADD MEMBER [job-executive-orders-nightly];
ALTER ROLE db_ddladmin ADD MEMBER [job-executive-orders-nightly];

-- Add job-state-bills-nightly managed identity  
CREATE USER [job-state-bills-nightly] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [job-state-bills-nightly];
ALTER ROLE db_datawriter ADD MEMBER [job-state-bills-nightly]; 
ALTER ROLE db_ddladmin ADD MEMBER [job-state-bills-nightly];

-- Grant additional permissions
GRANT EXECUTE TO [job-state-bills-nightly];
GRANT EXECUTE TO [job-executive-orders-nightly];
"@

# Execute the SQL commands
try {
    $connection = New-Object System.Data.SqlClient.SqlConnection
    $connection.ConnectionString = "Server=tcp:$serverName.database.windows.net,1433;Database=$databaseName;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
    $connection.AccessToken = $token
    $connection.Open()
    
    $command = New-Object System.Data.SqlClient.SqlCommand($sqlCommands, $connection)
    $command.ExecuteNonQuery()
    
    Write-Host "Successfully added managed identities to database" -ForegroundColor Green
    
    $connection.Close()
} catch {
    Write-Error "Failed to add managed identities: $($_.Exception.Message)"
}