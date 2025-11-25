# Nightly State Legislation Processor Setup Guide

This comprehensive automated system handles all aspects of state legislation processing that we implemented during our session improvements.

## 🎯 What It Does

The nightly processor automatically:

1. **Session Management**: Checks for active/inactive/special sessions for each state
2. **New Bill Detection**: Identifies new legislation in active sessions
3. **AI Processing**: Generates executive summaries for new bills
4. **Status Updates**: Updates bill progress and status information
5. **Source Links**: Ensures all bills have LegiScan source material links
6. **Categorization**: Applies practice area tags (Civic, Education, Engineering, Healthcare, Not Applicable)

## 📁 Files Created

```
backend/
├── nightly_state_legislation_processor.py    # Main processor
├── schedule_nightly_processor.py             # Scheduler wrapper
├── state_processor_config.py                 # Configuration settings
├── run_nightly_processor.sh                  # Docker execution script
└── create_session_tracking_table.sql         # Database setup
```

## 🚀 Setup Instructions

### 1. Database Setup

First, create the session tracking table:

```bash
# Run this SQL script in your database
docker exec backend sqlcmd -S your_server -d your_database -i create_session_tracking_table.sql
```

### 2. Configuration

Edit `state_processor_config.py` to customize:

- **States to process**: Add/remove states in `CONFIGURED_STATES`
- **Processing limits**: Adjust API rate limits
- **Practice area keywords**: Improve categorization accuracy

### 3. Test the Processor

Test with a single state first:

```bash
# Test with Texas
./run_nightly_processor.sh TX

# Or run manually in Docker
docker exec backend python nightly_state_legislation_processor.py TX
```

### 4. Schedule Nightly Execution

#### Option A: Cron Job (Linux/Mac)

Add to crontab for 2 AM daily execution:

```bash
crontab -e

# Add this line:
0 2 * * * cd /path/to/PoliticalVue/backend && ./run_nightly_processor.sh >> /var/log/nightly_processor.log 2>&1
```

#### Option B: Windows Task Scheduler

Create a scheduled task that runs:
```cmd
cd C:\path\to\PoliticalVue\backend && run_nightly_processor.sh
```

#### Option C: Manual Execution

Run whenever needed:
```bash
./run_nightly_processor.sh
```

## 📊 Processing Limits

The system includes built-in rate limiting to avoid overwhelming the LegiScan API:

- **New bills per session**: 10 per run
- **Status updates per session**: 50 per run  
- **Source links per state**: 20 per run
- **Category updates per state**: 50 per run
- **API delay**: 1 second between calls

These limits ensure the processor completes in reasonable time while staying within API limits.

## 📋 Monitoring

### Log Files

The processor creates detailed logs:

- `nightly_state_processor.log` - Main processing log
- `nightly_scheduler.log` - Scheduler log

### View Recent Activity

```bash
# View recent processing results
docker exec backend tail -50 nightly_state_processor.log

# Check for errors
docker exec backend grep "ERROR" nightly_state_processor.log
```

### Processing Statistics

Each run logs statistics:

- Sessions updated
- New bills added
- Bills with status updates
- Bills categorized
- AI summaries generated
- Source links added

## 🔧 Troubleshooting

### Common Issues

1. **"Backend container not running"**
   - Start your backend container: `docker-compose up backend`

2. **API rate limiting errors**
   - Increase delays in `state_processor_config.py`
   - Reduce processing limits

3. **Database connection errors**
   - Check database configuration in `database_config.py`
   - Verify connection string and credentials

4. **Missing AI summaries**
   - Check Azure OpenAI configuration
   - Verify API keys are set correctly

### Debug Mode

Run with detailed logging:

```bash
docker exec backend python nightly_state_legislation_processor.py TX --debug
```

## 🎛️ Configuration Options

### States to Process

Edit `CONFIGURED_STATES` in `state_processor_config.py`:

```python
CONFIGURED_STATES = [
    'TX',  # Texas
    'CA',  # California
    'NV',  # Nevada
    'FL',  # Florida (add new states)
]
```

### Processing Limits

Adjust in `PROCESSING_LIMITS`:

```python
PROCESSING_LIMITS = {
    'new_bills_per_session': 20,        # Process more bills per run
    'status_updates_per_session': 100,  # Update more statuses
    'api_delay_seconds': 0.5,           # Faster API calls (be careful!)
}
```

### Practice Area Keywords

Improve categorization by adding keywords:

```python
PRACTICE_AREA_KEYWORDS = {
    'Healthcare': [
        'health', 'medical', 'hospital',
        'telehealth',  # Add new keywords
        'mental health',
        'addiction treatment'
    ]
}
```

## 🔄 What Gets Updated

### Texas 2nd Special Session Example

The processor will:

1. ✅ Check if session is still active
2. ✅ Find any new bills (beyond the current 472)
3. ✅ Update bill statuses (e.g., "Introduced" → "Referred to Committee")
4. ✅ Generate AI summaries for new bills
5. ✅ Ensure all bills have source links
6. ✅ Apply practice area tags using approved categories

### All Configured States

The same process runs for:
- Texas (TX)
- California (CA)  
- Nevada (NV)
- Kentucky (KY)
- South Carolina (SC)
- Colorado (CO)

## 🎉 Benefits

This automated system ensures:

- **Consistency**: All improvements we made are applied systematically
- **Completeness**: No bills are missed or left incomplete
- **Current Data**: Bill statuses stay up-to-date automatically
- **Proper Categorization**: Only approved practice area tags are used
- **Rate Limiting**: API usage stays within reasonable limits
- **Monitoring**: Detailed logs for troubleshooting

## 🔮 Future Enhancements

Easy to extend:

- Add new states to `CONFIGURED_STATES`
- Improve AI prompts in the `ai.py` module
- Add new practice area categories (update both config and frontend)
- Implement email notifications for processing results
- Add metrics dashboard for processing statistics

## 💡 Manual Override

You can still run individual components manually:

```bash
# Process only one state
docker exec backend python nightly_state_legislation_processor.py CA

# Update only bill statuses (modify the script to skip other steps)
# Or run specific functions from the Python REPL
```

This system incorporates all the improvements we made during our Texas 2nd Special Session work and ensures they're applied consistently across all states going forward!