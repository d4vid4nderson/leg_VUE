#!/bin/bash

# Setup Cron Job for Nightly Bill Updates
# This script configures the cron job for automated nightly bill updates

# Configuration
PROJECT_PATH="/Users/david.anderson/Downloads/PoliticalVue/backend"
PYTHON_ENV="python3"  # or path to your virtual environment python
LOG_DIR="$PROJECT_PATH/logs"
CRON_TIME="0 2 * * *"  # Run at 2 AM daily

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Setting up nightly bill update cron job...${NC}"

# Create logs directory if it doesn't exist
if [ ! -d "$LOG_DIR" ]; then
    mkdir -p "$LOG_DIR"
    echo -e "${GREEN}✅ Created logs directory: $LOG_DIR${NC}"
fi

# Create the cron job script
CRON_SCRIPT="$PROJECT_PATH/scripts/run_nightly_update.sh"

cat > "$CRON_SCRIPT" << EOF
#!/bin/bash

# Nightly Bill Update Cron Job Script
# Generated on: $(date)

# Set working directory
cd "$PROJECT_PATH"

# Set up environment
export PYTHONPATH="\$PYTHONPATH:$PROJECT_PATH"
export PATH="\$PATH:/usr/local/bin"

# Log file with timestamp
LOG_FILE="$LOG_DIR/nightly_update_\$(date +%Y%m%d_%H%M%S).log"

# Function to log with timestamp
log() {
    echo "\$(date '+%Y-%m-%d %H:%M:%S') - \$1" | tee -a "\$LOG_FILE"
}

# Start logging
log "Starting nightly bill update"
log "Python path: \$(which $PYTHON_ENV)"
log "Working directory: \$(pwd)"

# Check if virtual environment exists and activate it
if [ -f "venv/bin/activate" ]; then
    log "Activating virtual environment"
    source venv/bin/activate
elif [ -f "../venv/bin/activate" ]; then
    log "Activating virtual environment from parent directory"
    source ../venv/bin/activate
fi

# Run the nightly update
log "Running nightly bill update task"
$PYTHON_ENV -c "
import sys
import asyncio
sys.path.append('$PROJECT_PATH')
from tasks.nightly_bill_updater import NightlyBillUpdater

async def main():
    try:
        updater = NightlyBillUpdater()
        result = await updater.run_nightly_update()
        print(f'Nightly update completed: {result}')
        return 0
    except Exception as e:
        print(f'Nightly update failed: {str(e)}')
        return 1

exit_code = asyncio.run(main())
sys.exit(exit_code)
" 2>&1 | tee -a "\$LOG_FILE"

# Check exit code
if [ \${PIPESTATUS[0]} -eq 0 ]; then
    log "✅ Nightly update completed successfully"
    
    # Clean up old log files (keep last 30 days)
    find "$LOG_DIR" -name "nightly_update_*.log" -type f -mtime +30 -delete
    
    # Optional: Send success notification
    # curl -X POST -H 'Content-type: application/json' --data '{"text":"Nightly bill update completed successfully"}' YOUR_WEBHOOK_URL
    
    exit 0
else
    log "❌ Nightly update failed"
    
    # Optional: Send failure notification
    # curl -X POST -H 'Content-type: application/json' --data '{"text":"Nightly bill update failed - check logs"}' YOUR_WEBHOOK_URL
    
    exit 1
fi
EOF

# Make the script executable
chmod +x "$CRON_SCRIPT"
echo -e "${GREEN}✅ Created cron job script: $CRON_SCRIPT${NC}"

# Create a backup of existing crontab
echo -e "${YELLOW}📋 Creating backup of existing crontab...${NC}"
crontab -l > "$PROJECT_PATH/scripts/crontab_backup_$(date +%Y%m%d_%H%M%S).txt" 2>/dev/null || echo "No existing crontab found"

# Check if cron job already exists
EXISTING_CRON=$(crontab -l 2>/dev/null | grep "run_nightly_update.sh")

if [ -n "$EXISTING_CRON" ]; then
    echo -e "${YELLOW}⚠️ Existing nightly update cron job found:${NC}"
    echo "$EXISTING_CRON"
    echo -e "${YELLOW}Do you want to replace it? (y/N)${NC}"
    read -r response
    
    if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
        # Remove existing cron job
        crontab -l 2>/dev/null | grep -v "run_nightly_update.sh" | crontab -
        echo -e "${GREEN}✅ Removed existing cron job${NC}"
    else
        echo -e "${YELLOW}⏭️ Keeping existing cron job${NC}"
        exit 0
    fi
fi

# Add new cron job
echo -e "${GREEN}📅 Adding new cron job...${NC}"
(crontab -l 2>/dev/null; echo "$CRON_TIME $CRON_SCRIPT") | crontab -

# Verify cron job was added
if crontab -l | grep -q "run_nightly_update.sh"; then
    echo -e "${GREEN}✅ Cron job added successfully!${NC}"
    echo ""
    echo -e "${GREEN}📋 Current crontab:${NC}"
    crontab -l | grep "run_nightly_update.sh"
    echo ""
    echo -e "${GREEN}📅 Schedule: Daily at 2:00 AM${NC}"
    echo -e "${GREEN}📁 Script: $CRON_SCRIPT${NC}"
    echo -e "${GREEN}📝 Logs: $LOG_DIR/nightly_update_YYYYMMDD_HHMMSS.log${NC}"
else
    echo -e "${RED}❌ Failed to add cron job${NC}"
    exit 1
fi

# Create systemd service alternative (optional)
echo -e "${YELLOW}🔧 Creating systemd service alternative...${NC}"

SYSTEMD_SERVICE="$PROJECT_PATH/scripts/nightly-bill-update.service"
cat > "$SYSTEMD_SERVICE" << EOF
[Unit]
Description=Nightly Bill Update Service
After=network.target

[Service]
Type=oneshot
User=$(whoami)
WorkingDirectory=$PROJECT_PATH
ExecStart=$CRON_SCRIPT
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

SYSTEMD_TIMER="$PROJECT_PATH/scripts/nightly-bill-update.timer"
cat > "$SYSTEMD_TIMER" << EOF
[Unit]
Description=Run Nightly Bill Update Service
Requires=nightly-bill-update.service

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

echo -e "${GREEN}✅ Created systemd service files:${NC}"
echo -e "   Service: $SYSTEMD_SERVICE"
echo -e "   Timer: $SYSTEMD_TIMER"
echo ""
echo -e "${YELLOW}💡 To use systemd instead of cron:${NC}"
echo -e "   sudo cp $SYSTEMD_SERVICE /etc/systemd/system/"
echo -e "   sudo cp $SYSTEMD_TIMER /etc/systemd/system/"
echo -e "   sudo systemctl daemon-reload"
echo -e "   sudo systemctl enable nightly-bill-update.timer"
echo -e "   sudo systemctl start nightly-bill-update.timer"

# Create monitoring script
MONITOR_SCRIPT="$PROJECT_PATH/scripts/monitor_updates.sh"
cat > "$MONITOR_SCRIPT" << EOF
#!/bin/bash

# Monitor Nightly Update Status
# This script checks the status of recent nightly updates

LOG_DIR="$LOG_DIR"
PROJECT_PATH="$PROJECT_PATH"

echo "🔍 Nightly Update Monitor"
echo "========================"
echo ""

# Check if cron job exists
if crontab -l | grep -q "run_nightly_update.sh"; then
    echo "✅ Cron job is configured"
    echo "Schedule: \$(crontab -l | grep 'run_nightly_update.sh' | cut -d' ' -f1-5)"
else
    echo "❌ Cron job not found"
fi

echo ""

# Check recent log files
echo "📋 Recent Update Logs:"
if [ -d "\$LOG_DIR" ]; then
    ls -la "\$LOG_DIR"/nightly_update_*.log 2>/dev/null | tail -5
    
    echo ""
    echo "📊 Last Update Status:"
    LATEST_LOG=\$(ls -t "\$LOG_DIR"/nightly_update_*.log 2>/dev/null | head -1)
    
    if [ -n "\$LATEST_LOG" ]; then
        echo "File: \$LATEST_LOG"
        echo "Size: \$(du -h "\$LATEST_LOG" | cut -f1)"
        echo "Modified: \$(date -r "\$LATEST_LOG")"
        echo ""
        echo "Last 10 lines:"
        tail -10 "\$LATEST_LOG"
    else
        echo "No log files found"
    fi
else
    echo "Log directory not found: \$LOG_DIR"
fi

echo ""

# Check if update process is running
if pgrep -f "nightly_bill_updater" > /dev/null; then
    echo "🔄 Update process is currently running"
    echo "PID: \$(pgrep -f 'nightly_bill_updater')"
else
    echo "💤 No update process currently running"
fi

echo ""

# Check next scheduled run
echo "⏰ Next Scheduled Run:"
echo "   \$(date -d 'tomorrow 2:00')"
EOF

chmod +x "$MONITOR_SCRIPT"
echo -e "${GREEN}✅ Created monitoring script: $MONITOR_SCRIPT${NC}"

# Create manual test script
TEST_SCRIPT="$PROJECT_PATH/scripts/test_update.sh"
cat > "$TEST_SCRIPT" << EOF
#!/bin/bash

# Test Nightly Update Script
# This script allows you to test the nightly update manually

echo "🧪 Testing Nightly Bill Update"
echo "=============================="
echo ""

cd "$PROJECT_PATH"

# Ask for confirmation
echo "This will run the nightly update process manually."
echo "Are you sure you want to continue? (y/N)"
read -r response

if [ "\$response" != "y" ] && [ "\$response" != "Y" ]; then
    echo "Test cancelled"
    exit 0
fi

echo ""
echo "🚀 Starting test update..."

# Run the update script
bash "$CRON_SCRIPT"

echo ""
echo "✅ Test completed"
echo "Check the logs in: $LOG_DIR"
EOF

chmod +x "$TEST_SCRIPT"
echo -e "${GREEN}✅ Created test script: $TEST_SCRIPT${NC}"

echo ""
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo ""
echo -e "${GREEN}Available Commands:${NC}"
echo -e "   📊 Monitor: $MONITOR_SCRIPT"
echo -e "   🧪 Test: $TEST_SCRIPT"
echo -e "   📝 Logs: ls -la $LOG_DIR"
echo ""
echo -e "${GREEN}📋 Next Steps:${NC}"
echo -e "   1. Test the update manually: $TEST_SCRIPT"
echo -e "   2. Monitor the first few runs: $MONITOR_SCRIPT"
echo -e "   3. Check logs regularly: $LOG_DIR"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo -e "   - Logs are automatically cleaned up after 30 days"
echo -e "   - Use '$MONITOR_SCRIPT' to check update status"
echo -e "   - Uncomment webhook URLs in the script for notifications"
echo -e "   - Consider using systemd for more advanced process management"
EOF