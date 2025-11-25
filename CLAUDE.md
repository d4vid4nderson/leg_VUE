# PoliticalVue State Bills Processing Guide

## Overview
This guide provides instructions for processing state legislation bills with AI summaries, fixing dates, and assigning practice area categories.

## Current State Status

### Completed States
- **Colorado (CO)**: ✅ 833/833 bills (100% complete)
  - All bills have AI summaries, dates, and practice areas

### In Progress
- **California (CA)**: 🔄 939/2,884 bills (32.6% complete)
  - Need to process remaining 1,945 bills

### Pending States
- **Texas (TX)**: 623/12,209 bills (5.1% complete)
- **Nevada (NV)**: 526/1,310 bills (40.2% complete)  
- **Kentucky (KY)**: 107/1,441 bills (7.4% complete)
- **South Carolina (SC)**: 200/2,247 bills (8.9% complete)

## Processing Scripts

### 1. Check State Status
```bash
# Check current processing status for any state
docker exec backend python -c "
from database_config import get_db_connection

STATE = 'CA'  # Change to TX, NV, KY, SC as needed

with get_db_connection() as conn:
    cursor = conn.cursor()
    cursor.execute('''
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN ai_executive_summary IS NOT NULL AND ai_executive_summary != '' THEN 1 ELSE 0 END) as with_ai,
            SUM(CASE WHEN introduced_date IS NULL OR introduced_date = '' THEN 1 ELSE 0 END) as missing_dates,
            SUM(CASE WHEN category = 'not-applicable' OR category IS NULL THEN 1 ELSE 0 END) as no_category
        FROM dbo.state_legislation
        WHERE state = ?
    ''', (STATE,))
    
    total, with_ai, missing_dates, no_category = cursor.fetchone()
    print(f'{STATE} Status:')
    print(f'  Total: {total} bills')
    print(f'  With AI: {with_ai} ({with_ai/total*100:.1f}%)')
    print(f'  Missing dates: {missing_dates}')
    print(f'  Need category: {no_category}')
    print(f'  Remaining: {total - with_ai} bills to process')
"
```

### 2. Process State Bills with AI (Batch Processing)

Save this as `/app/process_state_batch.py` in the container:

```python
#!/usr/bin/env python3
"""
Process state bills in batches with AI summaries
Usage: python process_state_batch.py CA 50
"""

import sys
import asyncio
import time
from datetime import datetime
from database_config import get_db_connection
from ai import analyze_executive_order

# Practice area keywords mapping
PRACTICE_AREA_KEYWORDS = {
    'healthcare': ['health', 'medical', 'hospital', 'insurance', 'medicare', 'patient', 'pharmacy'],
    'education': ['school', 'education', 'student', 'teacher', 'university', 'college'],
    'tax': ['tax', 'revenue', 'fiscal', 'budget', 'appropriation', 'finance'],
    'environment': ['environment', 'climate', 'pollution', 'renewable', 'conservation'],
    'criminal-justice': ['criminal', 'crime', 'police', 'prison', 'sentence', 'conviction'],
    'labor': ['labor', 'employment', 'worker', 'wage', 'union', 'workplace'],
    'housing': ['housing', 'rent', 'tenant', 'landlord', 'eviction', 'mortgage'],
    'transportation': ['transportation', 'highway', 'road', 'vehicle', 'traffic', 'transit'],
    'agriculture': ['agriculture', 'farm', 'crop', 'livestock', 'ranch'],
    'technology': ['technology', 'internet', 'digital', 'cyber', 'data', 'privacy'],
}

def determine_practice_area(title, description):
    """Determine practice area based on content"""
    text = f"{title or ''} {description or ''}".lower()
    
    for area, keywords in PRACTICE_AREA_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text:
                return area
    
    return 'government-operations'

async def process_bill(bill_data):
    """Process a single bill with AI"""
    id_val, bill_number, title, description, status = bill_data
    
    try:
        # Create context
        bill_context = f"""
        Bill Number: {bill_number}
        Title: {title or 'No title'}
        Description: {description or 'No description'}
        Status: {status or 'Unknown'}
        State: {STATE}
        """
        
        # Generate AI analysis
        ai_result = await analyze_executive_order(bill_context)
        
        if ai_result and isinstance(ai_result, dict):
            # Extract values
            executive_summary = ai_result.get('ai_executive_summary', '')
            talking_points = ai_result.get('ai_talking_points', '')
            business_impact = ai_result.get('ai_business_impact', '')
            
            # Determine practice area
            practice_area = determine_practice_area(title, description)
            
            # Update database
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE dbo.state_legislation
                    SET ai_executive_summary = ?,
                        ai_talking_points = ?,
                        ai_business_impact = ?,
                        ai_summary = ?,
                        category = ?,
                        ai_version = '1.0',
                        last_updated = ?
                    WHERE id = ?
                """, (
                    str(executive_summary)[:2000],
                    str(talking_points)[:2000],
                    str(business_impact)[:2000],
                    str(executive_summary)[:2000],
                    practice_area,
                    datetime.now(),
                    id_val
                ))
                conn.commit()
            
            print(f"✅ {bill_number} - {practice_area}")
            return True
            
    except Exception as e:
        print(f"❌ {bill_number} - Error: {e}")
        return False
    
    # Rate limiting
    await asyncio.sleep(1)

async def process_batch(state, batch_size=50):
    """Process a batch of bills for a state"""
    print(f"\n🔄 Processing {state} bills (batch of {batch_size})")
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Get bills without AI summaries
        cursor.execute(f"""
            SELECT TOP {batch_size} id, bill_number, title, description, status
            FROM dbo.state_legislation
            WHERE state = ?
            AND (ai_executive_summary IS NULL OR ai_executive_summary = '')
            ORDER BY bill_number
        """, (state,))
        
        bills = cursor.fetchall()
        
        if not bills:
            print(f"✅ No bills to process for {state}")
            return 0
        
        print(f"📊 Processing {len(bills)} bills...")
        
        processed = 0
        for bill in bills:
            success = await process_bill(bill)
            if success:
                processed += 1
        
        print(f"✅ Processed {processed}/{len(bills)} bills")
        return processed

async def main():
    global STATE
    
    if len(sys.argv) < 2:
        print("Usage: python process_state_batch.py STATE [batch_size]")
        print("States: CA, TX, NV, KY, SC")
        sys.exit(1)
    
    STATE = sys.argv[1].upper()
    batch_size = int(sys.argv[2]) if len(sys.argv) > 2 else 50
    
    start_time = time.time()
    processed = await process_batch(STATE, batch_size)
    elapsed = time.time() - start_time
    
    print(f"\n⏱️ Time: {elapsed/60:.1f} minutes")
    print(f"📈 Rate: {processed/elapsed*60:.1f} bills/minute")

if __name__ == "__main__":
    asyncio.run(main())
```

### 3. Fix Missing Dates for State

```bash
# Fix dates using last_action_date as fallback
docker exec backend python -c "
from database_config import get_db_connection

STATE = 'TX'  # Change as needed

with get_db_connection() as conn:
    cursor = conn.cursor()
    
    # Use last_action_date as fallback for missing introduced_date
    cursor.execute('''
        UPDATE dbo.state_legislation
        SET introduced_date = last_action_date
        WHERE state = ?
        AND (introduced_date IS NULL OR introduced_date = '')
        AND last_action_date IS NOT NULL
        AND last_action_date != ''
    ''', (STATE,))
    
    updated = cursor.rowcount
    conn.commit()
    print(f'Updated {updated} {STATE} bills with dates')
"
```

### 4. Sync AI Summaries for Frontend

```bash
# Copy ai_executive_summary to ai_summary for frontend display
docker exec backend python -c "
from database_config import get_db_connection

STATE = 'TX'  # Change as needed

with get_db_connection() as conn:
    cursor = conn.cursor()
    
    cursor.execute('''
        UPDATE dbo.state_legislation
        SET ai_summary = ai_executive_summary
        WHERE state = ?
        AND ai_executive_summary IS NOT NULL
        AND ai_executive_summary != ''
        AND (ai_summary IS NULL OR ai_summary = '')
    ''', (STATE,))
    
    updated = cursor.rowcount
    conn.commit()
    print(f'Synced {updated} {STATE} bills for frontend')
"
```

## Usage Instructions

### Process a State (e.g., Texas)

1. **Check current status:**
```bash
docker exec backend python -c "...check status script..." # Set STATE='TX'
```

2. **Fix missing dates:**
```bash
docker exec backend python -c "...fix dates script..." # Set STATE='TX'
```

3. **Process bills in batches:**
```bash
# Process 50 bills at a time
docker exec backend python /app/process_state_batch.py TX 50

# Run in background
docker exec -d backend python /app/process_state_batch.py TX 50

# Process larger batch
docker exec backend python /app/process_state_batch.py TX 100
```

4. **Monitor progress:**
```bash
# Check how many bills remain
docker exec backend python -c "
from database_config import get_db_connection
with get_db_connection() as conn:
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM dbo.state_legislation WHERE state = ? AND (ai_executive_summary IS NULL OR ai_executive_summary = \"\")', ('TX',))
    remaining = cursor.fetchone()[0]
    print(f'Texas: {remaining} bills remaining')
"
```

5. **Sync for frontend:**
```bash
docker exec backend python -c "...sync summaries script..." # Set STATE='TX'
```

### Automated Processing Loop

For continuous processing, create this script as `/app/auto_process_state.sh`:

```bash
#!/bin/bash
STATE=$1
BATCH_SIZE=${2:-50}

echo "🔄 Auto-processing $STATE in batches of $BATCH_SIZE"

while true; do
    # Run batch
    python /app/process_state_batch.py $STATE $BATCH_SIZE
    
    # Check remaining
    REMAINING=$(python -c "
from database_config import get_db_connection
with get_db_connection() as conn:
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM dbo.state_legislation WHERE state = \"$STATE\" AND (ai_executive_summary IS NULL OR ai_executive_summary = \"\")')
    print(cursor.fetchone()[0])
")
    
    echo "Remaining: $REMAINING bills"
    
    if [ "$REMAINING" -eq 0 ]; then
        echo "✅ $STATE processing complete!"
        break
    fi
    
    # Wait before next batch
    sleep 30
done
```

Run with:
```bash
docker exec -d backend bash /app/auto_process_state.sh TX 50
```

## Processing Order Recommendation

Based on current progress and bill counts:

1. **Nevada (NV)** - 784 remaining (quick win)
2. **South Carolina (SC)** - 2,047 remaining  
3. **Kentucky (KY)** - 1,334 remaining
4. **California (CA)** - 1,945 remaining (continue)
5. **Texas (TX)** - 11,586 remaining (largest)

## Troubleshooting

### If processing stops:
1. Check Docker container is running: `docker ps`
2. Check container logs: `docker logs backend --tail 50`
3. Restart processing with smaller batch size (25 instead of 50)

### If AI summaries aren't showing in frontend:
1. Run the sync script to copy ai_executive_summary to ai_summary
2. Check that bills have both fields populated

### Rate limiting issues:
1. Reduce batch size
2. Increase delay between API calls
3. Process during off-peak hours

## Database Fields

Each bill should have:
- `introduced_date` - Date bill was introduced
- `last_action_date` - Latest action date
- `ai_executive_summary` - Main AI summary
- `ai_talking_points` - Discussion points
- `ai_business_impact` - Business implications
- `ai_summary` - Copy for frontend display
- `category` - Practice area tag
- `session_name` - Legislative session

## Commands to Run for Each State

### Quick Processing Template
```bash
STATE="TX"  # Change to your state

# 1. Check status
docker exec backend python -c "..." # Use status check script

# 2. Fix dates
docker exec backend python -c "..." # Use fix dates script  

# 3. Process in batches (run multiple times)
docker exec backend python /app/process_state_batch.py $STATE 50

# 4. Sync summaries
docker exec backend python -c "..." # Use sync script
```