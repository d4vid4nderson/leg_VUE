# Texas Legislative Bill Processing Setup

This guide will help you set up the processing pipeline to analyze Texas legislative bills using Azure AI Foundry and store results in your SQL Server database.

## Prerequisites

1. **Azure AI Foundry account** with API access
2. **SQL Server database** (Azure SQL Database or on-premises)
3. **Python 3.8+** installed
4. **ODBC Driver 17 for SQL Server** installed

## Setup Instructions

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 2. Create Environment Variables

Create a `.env` file in this directory with your actual credentials:

```bash
# Azure AI Foundry Configuration
AZURE_AI_ENDPOINT=https://your-foundry-endpoint.com/api/v1/analyze
AZURE_AI_KEY=your-azure-ai-api-key

# SQL Server Configuration
SQL_SERVER=your-server.database.windows.net
SQL_DATABASE=your-database-name
SQL_USERNAME=your-username
SQL_PASSWORD=your-password
```

### 3. Create Database Table

Run the `create_table.sql` script in your SQL Server database to create the `dbo.state_legislation` table.

### 4. Install ODBC Driver (if not already installed)

**On macOS:**
```bash
brew install msodbcsql17 mssql-tools
```

**On Ubuntu/Debian:**
```bash
curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add -
curl https://packages.microsoft.com/config/ubuntu/20.04/prod.list > /etc/apt/sources.list.d/mssql-release.list
apt-get update
ACCEPT_EULA=Y apt-get install msodbcsql17 mssql-tools
```

**On Windows:**
Download and install from Microsoft's official site.

## Usage

### Test Run (Limited Bills)
```bash
python3 process_bills.py
```

### Production Run (All Bills)
```bash
python3 process_bills_production.py
```

## Azure AI Foundry Integration

The script expects your Azure AI endpoint to accept a JSON payload like:

```json
{
    "title": "Bill title",
    "description": "Bill description",
    "subjects": ["Subject1", "Subject2"],
    "bill_type": "B",
    "sponsors": [
        {
            "name": "Sponsor Name",
            "party": "R",
            "role": "Rep",
            "district": "HD-001"
        }
    ]
}
```

And return a response like:

```json
{
    "summary": "Brief summary of the bill",
    "impact_analysis": "Analysis of potential impact",
    "key_provisions": ["Provision 1", "Provision 2"],
    "political_implications": "Political analysis",
    "stakeholder_analysis": "Stakeholder impact analysis"
}
```

## Database Schema

The `dbo.state_legislation` table includes:

- **Bill Information**: bill_id, bill_number, title, description, status, etc.
- **Legislative Details**: sponsors, subjects, chamber, session_year
- **AI Analysis**: ai_summary, ai_impact_analysis, ai_key_provisions, etc.
- **URLs**: full_text_url, legiscan_url, state_url
- **Metadata**: created_date, updated_date, processed_date

## Customization

### Modify AI Processing
Edit the `process_with_azure_ai()` method in `process_bills_production.py` to match your Azure AI Foundry API specification.

### Adjust Database Schema
Modify `create_table.sql` and the corresponding `save_to_database()` method if you need different fields.

### Rate Limiting
Adjust `batch_size` and `delay_between_batches` in the CONFIG section to respect your API limits.

## Monitoring

The script includes comprehensive logging. Check the console output for:
- Processing progress
- API call successes/failures  
- Database save operations
- Error details

## Troubleshooting

### Common Issues

1. **Database Connection Errors**: Verify your connection string and firewall settings
2. **Azure AI API Errors**: Check your endpoint URL and API key
3. **ODBC Driver Issues**: Ensure the correct driver version is installed
4. **Large Dataset Processing**: Consider processing in smaller batches or resuming from specific points

### Resume Processing
The script checks for existing bill_ids in the database to avoid duplicates. You can safely restart the process if it's interrupted.

## Bill Count Information

Current dataset contains approximately:
- **11,503** bills
- **181** people records  
- **9,726** vote records

Total processing time will depend on your Azure AI API rate limits and database performance.

## Next Steps

After processing:
1. Verify data in your `dbo.state_legislation` table
2. Create database views for your frontend queries
3. Set up scheduled runs for future legislative sessions
4. Configure your PoliticalVue frontend to display the processed data
