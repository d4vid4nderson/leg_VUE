#!/bin/bash

# Nightly Bill Update Cron Job Script
# Generated on: Thu Aug  7 22:03:01 CDT 2025

# Set working directory
cd "/Users/david.anderson/Downloads/PoliticalVue/backend"

# Set up environment
export PYTHONPATH="$PYTHONPATH:/Users/david.anderson/Downloads/PoliticalVue/backend"
export PATH="$PATH:/usr/local/bin"

# Log file with timestamp
LOG_FILE="/Users/david.anderson/Downloads/PoliticalVue/backend/logs/nightly_update_$(date +%Y%m%d_%H%M%S).log"

# Function to log with timestamp
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Start logging
log "Starting nightly bill update"
log "Python path: $(which python3)"
log "Working directory: $(pwd)"

# Check if virtual environment exists and activate it
if [ -f "venv/bin/activate" ]; then
    log "Activating virtual environment"
    source venv/bin/activate
elif [ -f "../venv/bin/activate" ]; then
    log "Activating virtual environment from parent directory"
    source ../venv/bin/activate
fi

# Check if backend is running, start if needed
log "Checking if backend is running..."
if ! curl -s http://localhost:8000/api/status > /dev/null 2>&1; then
    log "Backend not running, starting it..."
    python3 main.py > /dev/null 2>&1 &
    BACKEND_PID=$!
    log "Started backend with PID: $BACKEND_PID"
    
    # Wait for backend to start up
    for i in {1..30}; do
        if curl -s http://localhost:8000/api/status > /dev/null 2>&1; then
            log "Backend is ready after ${i} seconds"
            break
        fi
        sleep 1
    done
    
    if ! curl -s http://localhost:8000/api/status > /dev/null 2>&1; then
        log "❌ Failed to start backend"
        exit 1
    fi
    
    STARTED_BACKEND=true
else
    log "Backend is already running"
    STARTED_BACKEND=false
fi

# Run the lightweight status update (much faster than full fetch)
log "Running nightly bill status update"
python3 update_bill_status.py 2>&1 | tee -a "$LOG_FILE"
FETCH_EXIT_CODE=$?

# Stop backend if we started it
if [ "$STARTED_BACKEND" = true ]; then
    log "Stopping backend (PID: $BACKEND_PID)"
    kill $BACKEND_PID 2>/dev/null || true
    sleep 5
    # Force kill if still running
    kill -9 $BACKEND_PID 2>/dev/null || true
fi

# Check exit code
if [ $FETCH_EXIT_CODE -eq 0 ]; then
    log "✅ Nightly update completed successfully"
    
    # Clean up old log files (keep last 30 days)
    find "/Users/david.anderson/Downloads/PoliticalVue/backend/logs" -name "nightly_update_*.log" -type f -mtime +30 -delete
    
    # Optional: Send success notification
    # curl -X POST -H 'Content-type: application/json' --data '{"text":"Nightly bill update completed successfully"}' YOUR_WEBHOOK_URL
    
    exit 0
else
    log "❌ Nightly update failed"
    
    # Optional: Send failure notification
    # curl -X POST -H 'Content-type: application/json' --data '{"text":"Nightly bill update failed - check logs"}' YOUR_WEBHOOK_URL
    
    exit 1
fi
