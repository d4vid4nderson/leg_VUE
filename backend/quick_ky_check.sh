#!/bin/bash
# Quick KY processing check

echo "🔍 Kentucky Processing Status"
echo "=============================="

# Get current status
docker exec backend python -c "
from database_config import get_db_connection

with get_db_connection() as conn:
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*), SUM(CASE WHEN ai_executive_summary IS NOT NULL THEN 1 ELSE 0 END) FROM dbo.state_legislation WHERE state = \\'KY\\'')
    total, processed = cursor.fetchone()
    remaining = total - processed
    percent = (processed/total)*100
    
    print(f'✅ Processed: {processed}/{total} ({percent:.1f}%)')
    print(f'📊 Remaining: {remaining} bills')
    
    # Estimate time
    if remaining > 0:
        # Assuming ~50 bills per batch, 30 seconds between batches
        estimated_minutes = (remaining / 50) * 0.5
        hours = int(estimated_minutes / 60)
        minutes = int(estimated_minutes % 60)
        print(f'⏱️ Estimated time: {hours}h {minutes}m (at 50 bills/batch)')
"

# Check if running
if docker exec backend ps aux | grep -q "ky_auto_restart.py"; then
    echo "✅ Processor is RUNNING"
else
    echo "⚠️ Processor is NOT running"
    echo "   Run: docker exec -d backend python /app/ky_auto_restart.py"
fi