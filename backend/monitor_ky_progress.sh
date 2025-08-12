#!/bin/bash
# Monitor Kentucky AI processing progress

echo "📊 Monitoring Kentucky AI Processing Progress"
echo "============================================"

while true; do
    echo -e "\n[$(date '+%Y-%m-%d %H:%M:%S')]"
    
    # Check status
    docker exec backend python /app/check_ky_status.py | grep -E "(With AI|Need AI)"
    
    # Check if processor is running
    RUNNING=$(docker exec backend ps aux | grep -c "ky_auto_restart.py" | grep -v grep)
    if [ "$RUNNING" -gt 0 ]; then
        echo "✅ Processor is running"
    else
        echo "⚠️ Processor not running"
    fi
    
    # Wait 60 seconds
    sleep 60
done