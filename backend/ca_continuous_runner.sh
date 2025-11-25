#!/bin/bash
# Continuous California processing runner

echo "🔄 Starting continuous California processing"
echo "This will run until all bills are processed"
echo "========================================"

while true; do
    # Check remaining bills
    REMAINING=$(docker exec backend python -c "
from database_config import get_db_connection
with get_db_connection() as conn:
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM dbo.state_legislation WHERE state = \"CA\" AND (ai_executive_summary IS NULL OR ai_executive_summary = \"\")')
    print(cursor.fetchone()[0])
" 2>/dev/null)
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Remaining bills: $REMAINING"
    
    if [ "$REMAINING" -eq "0" ]; then
        echo "✅ All California bills processed!"
        break
    fi
    
    echo "🚀 Starting processing batch..."
    docker exec backend python /app/process_california_complete.py
    
    echo "⏳ Waiting 30 seconds before next batch..."
    sleep 30
done

echo "🎉 Processing complete!"