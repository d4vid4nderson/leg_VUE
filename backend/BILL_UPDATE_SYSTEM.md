# Bill Update System Documentation

## Overview

This document describes the comprehensive bill update system implemented for the PoliticalVue application. The system provides automated nightly updates, manual refresh capabilities, user notifications, and progress tracking.

## System Architecture

### Components

1. **Nightly Bill Updater** (`tasks/nightly_bill_updater.py`)
   - Automated background task that runs nightly
   - Fetches updated bills from LegiScan API
   - Processes bills through AI analysis
   - Manages update logging and notifications

2. **Enhanced LegiScan Service** (`legiscan_service_enhanced.py`)
   - Extended API client with incremental update capabilities
   - Rate limiting and batch processing
   - Comprehensive bill change tracking

3. **Update API Endpoints** (`api/update_endpoints.py`)
   - RESTful endpoints for update status and control
   - Manual refresh triggers
   - Notification management

4. **Frontend Components**
   - `UpdateNotification.jsx` - User notification system
   - `ManualRefresh.jsx` - Manual refresh controls
   - `UpdateProgress.jsx` - Progress tracking display

5. **Database Schema** (`database/migrations/add_update_tracking.sql`)
   - Update logging and tracking tables
   - Notification storage
   - Update statistics views

## Features

### 1. Automated Nightly Updates

- **Schedule**: Runs daily at 2:00 AM
- **Process**: 
  - Fetches active legislative sessions
  - Retrieves updated bills since last run
  - Processes new/changed bills through AI
  - Logs results and creates notifications

### 2. Manual Refresh System

- **On-demand updates** for urgent changes
- **Progress tracking** with real-time status
- **Rate limiting** to prevent API abuse
- **Task management** with unique IDs

### 3. User Notifications

- **Real-time alerts** for new updates
- **Notification bell** with count badges
- **Expandable details** with recent changes
- **Mark as read** functionality

### 4. Progress Indicators

- **Visual progress bars** during updates
- **Time estimates** and elapsed time
- **Statistics display** (bills added/updated)
- **Error handling** with detailed messages

## Installation & Setup

### 1. Database Setup

Run the database migration:

```bash
cd /Users/david.anderson/Downloads/PoliticalVue/backend
psql -d your_database -f database/migrations/add_update_tracking.sql
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

Ensure you have these packages:
- `aiohttp` - Async HTTP client
- `asyncio` - Async programming
- `sqlalchemy` - Database ORM
- `pydantic` - Data validation
- `python-dotenv` - Environment variables

### 3. Environment Variables

Set up your environment variables:

```bash
# LegiScan API
LEGISCAN_API_KEY=your_legiscan_api_key

# AI Service (choose one)
OPENAI_API_KEY=your_openai_key
# OR
AZURE_ENDPOINT=your_azure_endpoint
AZURE_KEY=your_azure_key
AZURE_MODEL_NAME=gpt-4o-mini

# Database
DATABASE_URL=your_database_url
```

### 4. Cron Job Setup

Run the setup script:

```bash
chmod +x scripts/setup_cron.sh
./scripts/setup_cron.sh
```

This will:
- Create the cron job script
- Set up logging directory
- Configure nightly execution at 2 AM
- Create monitoring and test scripts

### 5. Frontend Integration

Add the components to your React application:

```javascript
// In your main page component
import UpdateNotification from './components/UpdateNotification';
import ManualRefresh from './components/ManualRefresh';

function StatePage() {
    return (
        <div>
            {/* Update notification at top */}
            <UpdateNotification 
                stateCode="CA" 
                sessionId="current_session"
                onRefresh={handleDataRefresh}
            />
            
            {/* Manual refresh button */}
            <ManualRefresh 
                stateCode="CA"
                onRefreshComplete={handleRefreshComplete}
            />
            
            {/* Your existing content */}
        </div>
    );
}
```

## API Endpoints

### Update Status
```
GET /api/updates/status
```
Returns current update status and notifications count.

### Manual Refresh
```
POST /api/updates/manual-refresh
```
Triggers a manual refresh of bill data.

### Task Status
```
GET /api/updates/task-status/{task_id}
```
Returns status of a specific update task.

### Notifications
```
GET /api/updates/notifications
POST /api/updates/notifications/{id}/mark-read
POST /api/updates/notifications/mark-all-read
```
Manage user notifications.

## Usage Examples

### 1. Check Update Status

```bash
curl -X GET http://localhost:8000/api/updates/status
```

### 2. Trigger Manual Refresh

```bash
curl -X POST http://localhost:8000/api/updates/manual-refresh \
  -H "Content-Type: application/json" \
  -d '{"state_code": "CA", "force_update": false}'
```

### 3. Monitor Updates

```bash
# Use the monitoring script
./scripts/monitor_updates.sh

# Or check logs directly
tail -f logs/nightly_update_*.log
```

## Monitoring & Maintenance

### 1. Log Files

Logs are stored in `logs/nightly_update_YYYYMMDD_HHMMSS.log`:
- Automatic cleanup after 30 days
- Detailed error reporting
- Performance metrics

### 2. Monitoring Script

```bash
./scripts/monitor_updates.sh
```

Shows:
- Cron job status
- Recent log files
- Last update results
- Next scheduled run

### 3. Testing

```bash
# Test the update process manually
./scripts/test_update.sh

# Run specific components
python -c "from tasks.nightly_bill_updater import NightlyBillUpdater; import asyncio; asyncio.run(NightlyBillUpdater().run_nightly_update())"
```

## Error Handling

### Common Issues

1. **API Rate Limits**
   - Built-in rate limiting prevents this
   - Automatic retry with exponential backoff

2. **Database Connection Issues**
   - Connection pooling handles temporary failures
   - Automatic reconnection attempts

3. **AI Service Failures**
   - Graceful degradation when AI is unavailable
   - Fallback to basic categorization

4. **Cron Job Failures**
   - Detailed logging for troubleshooting
   - Email notifications (if configured)

### Troubleshooting

1. **Check Logs**
   ```bash
   tail -100 logs/nightly_update_*.log
   ```

2. **Verify Cron Job**
   ```bash
   crontab -l | grep nightly_update
   ```

3. **Test API Connection**
   ```bash
   python -c "from legiscan_service_enhanced import legiscan_service; import asyncio; print(asyncio.run(legiscan_service.get_session_list('CA')))"
   ```

4. **Check Database**
   ```sql
   SELECT * FROM update_logs ORDER BY update_started DESC LIMIT 10;
   ```

## Performance Optimization

### 1. Rate Limiting

- LegiScan API: 60 requests/minute, 1000/hour
- Automatic throttling between requests
- Batch processing for efficiency

### 2. Database Optimization

- Indexes on frequently queried columns
- Efficient update queries
- Connection pooling

### 3. Memory Management

- Streaming large datasets
- Garbage collection after processing
- Memory monitoring during updates

## Security Considerations

1. **API Key Protection**
   - Store in environment variables
   - Never commit to version control
   - Rotate keys regularly

2. **Database Security**
   - Parameterized queries prevent SQL injection
   - Connection encryption
   - Access control

3. **Rate Limiting**
   - Prevents API abuse
   - Protects against DoS attacks
   - Graceful degradation

## Future Enhancements

1. **Real-time Updates**
   - WebSocket connections
   - Push notifications
   - Live bill tracking

2. **Advanced AI Analysis**
   - Sentiment analysis
   - Impact prediction
   - Stakeholder identification

3. **Multi-tenant Support**
   - User-specific notifications
   - Custom update schedules
   - Personalized filtering

4. **Mobile App Integration**
   - Push notifications
   - Offline support
   - Mobile-optimized UI

## Support

For issues or questions:

1. Check the logs first
2. Review this documentation
3. Test components individually
4. Contact the development team

## Changelog

### Version 1.0 (Current)
- Initial release
- Nightly automated updates
- Manual refresh functionality
- User notifications
- Progress tracking
- Comprehensive logging

### Planned Updates
- Real-time notifications
- Advanced filtering
- Mobile app support
- Performance improvements