# Fix Executive Orders - Missing Talking Points & Business Impact

## Overview
This guide will help you regenerate AI analysis for executive orders that are missing talking points or business impact fields.

## The Script
I've created `backend/fix_executive_orders_ai.py` which will:
1. Check the database for executive orders missing AI fields
2. Regenerate complete AI analysis (summary + talking points + business impact)
3. Update the database with all three components

## Option 1: Run from Azure Container App Job (RECOMMENDED)

Since your local IP is blocked by Azure SQL, the easiest way is to run this as an Azure Container App Job.

### Step 1: Check the current status
```bash
# First, let's see how many EOs need fixing
az containerapp job start \
  --name job-executive-orders-nightly \
  --resource-group rg-legislation-tracker \
  --command "python /app/fix_executive_orders_ai.py --check-only"
```

### Step 2: Dry run to see what would be fixed
```bash
az containerapp job start \
  --name job-executive-orders-nightly \
  --resource-group rg-legislation-tracker \
  --command "python /app/fix_executive_orders_ai.py --dry-run"
```

### Step 3: Actually fix the executive orders
```bash
# Process in batches of 10 (default)
az containerapp job start \
  --name job-executive-orders-nightly \
  --resource-group rg-legislation-tracker \
  --command "python /app/fix_executive_orders_ai.py"

# Or process in larger batches (faster but more expensive)
az containerapp job start \
  --name job-executive-orders-nightly \
  --resource-group rg-legislation-tracker \
  --command "python /app/fix_executive_orders_ai.py --batch-size 25"
```

## Option 2: Run from Docker Container (if Azure SQL firewall allows Docker IP)

### Step 1: Check status
```bash
docker exec backend python /app/fix_executive_orders_ai.py --check-only
```

### Step 2: Dry run
```bash
docker exec backend python /app/fix_executive_orders_ai.py --dry-run
```

### Step 3: Fix them
```bash
# Small batch (slower, safer)
docker exec backend python /app/fix_executive_orders_ai.py --batch-size 5

# Medium batch (recommended)
docker exec backend python /app/fix_executive_orders_ai.py --batch-size 10

# Large batch (faster, more expensive)
docker exec backend python /app/fix_executive_orders_ai.py --batch-size 25
```

## Option 3: Manually Add Your IP to Azure SQL Firewall

1. Go to Azure Portal
2. Navigate to your SQL Server: `sql-legislation-tracker`
3. Go to "Networking" or "Firewalls and virtual networks"
4. Add a firewall rule:
   - **Rule name**: `local-dev`
   - **Start IP**: `24.153.195.154`
   - **End IP**: `24.153.195.154`
5. Click "Save"
6. Wait 5 minutes for the rule to take effect
7. Then run Option 2 commands

## Expected Output

### Check-only output:
```
🔍 Checking executive orders for missing AI fields...
============================================================
📊 Total Executive Orders: 150
❌ Missing Talking Points: 85 (56.7%)
❌ Missing Business Impact: 85 (56.7%)
❌ Missing Both: 85 (56.7%)
```

### Dry-run output:
```
🔍 DRY RUN - Showing what would be fixed:
1. EO 14117: Strengthening American Leadership in Clean Energy...
   Has Summary: ✅
2. EO 14116: Reducing Gun Violence and Making Our Communi...
   Has Summary: ✅
...
```

### Actual fix output:
```
📦 Processing batch 1/9
------------------------------------------------------------
[1/85] Processing EO 14117...
  ✅ Updated EO 14117
     Summary: 845 chars
     Talking Points: 2043 chars
     Business Impact: 1256 chars

[2/85] Processing EO 14116...
  ✅ Updated EO 14116
     Summary: 923 chars
     Talking Points: 2187 chars
     Business Impact: 1398 chars
...

============================================================
📊 Final Results:
  Total Processed: 85
  ✅ Successful: 83
  ❌ Failed: 2
  Success Rate: 97.6%
```

## Script Options

```bash
python fix_executive_orders_ai.py [OPTIONS]

Options:
  --check-only          Only check status, don't fix anything
  --dry-run            Show what would be fixed without actually fixing
  --batch-size N       Process N executive orders at a time (default: 10)
```

## Cost Estimate

Each executive order requires 3 Azure OpenAI API calls:
- Executive Summary: ~600 tokens
- Talking Points: ~800 tokens
- Business Impact: ~1000 tokens

**Total per EO**: ~2400 tokens ≈ $0.012

For 85 executive orders: ~204,000 tokens ≈ **$1.02** total

## Monitoring Progress

If running as an Azure Container App Job, you can monitor logs:

```bash
# Check if job is running
az containerapp job execution list \
  --name job-executive-orders-nightly \
  --resource-group rg-legislation-tracker \
  --output table

# Get the execution name from above, then view logs
az containerapp logs show \
  --name job-executive-orders-nightly \
  --resource-group rg-legislation-tracker \
  --tail 100
```

## Verification After Fix

To verify all executive orders now have complete AI analysis:

```bash
# Run the check-only command again
docker exec backend python /app/fix_executive_orders_ai.py --check-only

# Should show:
# ❌ Missing Talking Points: 0 (0.0%)
# ❌ Missing Business Impact: 0 (0.0%)
```

Or check in your frontend - navigate to any executive order and verify all three tabs display content:
1. Executive Summary ✅
2. Talking Points ✅
3. Business Impact ✅

## Troubleshooting

### "Database connection error: IP not allowed"
- Use Option 1 (Azure Container App Job)
- OR add your IP to Azure SQL firewall (Option 3)

### "Rate limit exceeded"
- Reduce batch size: `--batch-size 5`
- Add delay between batches (already built in: 2 seconds per EO)

### Some EOs failed to process
- Normal - a few may fail due to API issues
- Re-run the script and it will only process the ones still missing
- Failed EOs will be logged in the output

## Next Steps After Fix

1. ✅ Verify in database that talking points and business impacts are populated
2. ✅ Check frontend to see all three AI sections displaying
3. ✅ Rebuild and push Docker image to Azure (if not done yet)
4. ✅ Ensure nightly jobs use the updated image for future EOs

---

**Note**: This script only fixes **existing** executive orders. New executive orders will automatically get all three AI components from the updated `analyze_executive_order()` function we fixed earlier.
