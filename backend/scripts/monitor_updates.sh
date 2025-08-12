#!/bin/bash

# Monitor Nightly Update Status
# This script checks the status of recent nightly updates

LOG_DIR="/Users/david.anderson/Downloads/PoliticalVue/backend/logs"
PROJECT_PATH="/Users/david.anderson/Downloads/PoliticalVue/backend"

echo "🔍 Nightly Update Monitor"
echo "========================"
echo ""

# Check if cron job exists
if crontab -l | grep -q "run_nightly_update.sh"; then
    echo "✅ Cron job is configured"
    echo "Schedule: $(crontab -l | grep 'run_nightly_update.sh' | cut -d' ' -f1-5)"
else
    echo "❌ Cron job not found"
fi

echo ""

# Check recent log files
echo "📋 Recent Update Logs:"
if [ -d "$LOG_DIR" ]; then
    ls -la "$LOG_DIR"/nightly_update_*.log 2>/dev/null | tail -5
    
    echo ""
    echo "📊 Last Update Status:"
    LATEST_LOG=$(ls -t "$LOG_DIR"/nightly_update_*.log 2>/dev/null | head -1)
    
    if [ -n "$LATEST_LOG" ]; then
        echo "File: $LATEST_LOG"
        echo "Size: $(du -h "$LATEST_LOG" | cut -f1)"
        echo "Modified: $(date -r "$LATEST_LOG")"
        echo ""
        echo "Last 10 lines:"
        tail -10 "$LATEST_LOG"
    else
        echo "No log files found"
    fi
else
    echo "Log directory not found: $LOG_DIR"
fi

echo ""

# Check if update process is running
if pgrep -f "nightly_bill_updater" > /dev/null; then
    echo "🔄 Update process is currently running"
    echo "PID: $(pgrep -f 'nightly_bill_updater')"
else
    echo "💤 No update process currently running"
fi

echo ""

# Check next scheduled run
echo "⏰ Next Scheduled Run:"
echo "   $(date -d 'tomorrow 2:00')"
