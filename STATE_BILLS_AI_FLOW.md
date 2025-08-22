# State Bills AI Processing Flow

## Overview
The enhanced nightly state bills automation now includes complete AI processing using your existing state legislation AI system (not the executive order AI).

## Complete Processing Flow

### 1. 🕐 **Scheduled Execution**
- **When**: Daily at 3:00 AM UTC (9:00 PM CST previous day)
- **Where**: Azure Container Job `job-state-bills-nightly`
- **Environment**: Production Azure environment

### 2. 🔍 **Phase 1: Session Discovery**
```
LegiScan API → Discover new legislative sessions for target states
```
- Scans target states: `CA, TX, NV, KY, SC, CO, FL, NY, IL, PA`
- Identifies new legislative sessions not in database
- Logs newly discovered sessions for processing

### 3. 📜 **Phase 2: New Bill Fetching**
```
New Sessions → LegiScan API → Fetch complete bill lists → Mark for AI processing
```
- Gets bill lists for newly discovered sessions
- Downloads bill details (title, description, status, dates)
- Inserts into database with `needs_ai_processing = 1`

### 4. 🔄 **Phase 3: Status Updates**
```
Existing Bills → LegiScan API → Check status changes → Mark changed bills for AI
```
- Samples recent bills (last 50 that haven't been updated in 7 days)
- Checks for status changes (passed, failed, vetoed, etc.)
- Marks bills with status changes for AI reprocessing

### 5. 🤖 **Phase 4: State Legislation AI Processing**
```
Bills needing AI → analyze_state_legislation() → Generate summaries → Save to database
```

**AI Processing uses your existing state legislation system:**
- **Function**: `analyze_state_legislation()` from `ai.py`
- **Input**: Title, description, state, bill number
- **Output**: Executive summary with practice area categorization

**Practice Area Categories:**
- `healthcare` - Medical, insurance, patient care
- `education` - Schools, students, universities
- `engineering` - Infrastructure, technology, construction
- `civic` - Government, elections, taxes, policy
- `not-applicable` - Default fallback

### 6. 💾 **Database Storage Pattern**
```sql
UPDATE dbo.state_legislation
SET ai_executive_summary = ?,  -- 🤖 Main AI summary
    ai_summary = ?,            -- 🤖 Copy for frontend display
    category = ?,              -- 🤖 Practice area classification
    ai_version = 'azure_openai_nightly_v1',
    needs_ai_processing = 0,   -- Mark as completed
    last_updated = ?
WHERE id = ?
```

## Enhanced Logging & Monitoring

The job provides detailed state-specific logging:
```
🚀 Starting Enhanced Azure Container Job: State Bills & Session Discovery
1️⃣ PHASE 1: Session Discovery
🏛️ Checking CA for new sessions...
✅ Known session: CA - Regular Session 2025-2026 (2,884 bills)
🆕 New session discovered: TX - Special Session 2025 (ID: 1234)

2️⃣ PHASE 2: Fetching Bills for New Sessions
📜 Fetching bills for TX session: Special Session 2025
➕ Added new bill: TX HB123

3️⃣ PHASE 3: Status Updates Check
📊 Status change: CA AB456: 'Committee' → 'Passed Assembly'

4️⃣ PHASE 4: AI Processing Queue
🧠 Processing 10 bills with state legislation AI
🤖 [1/10] Processing: TX HB123
✅ [1/10] AI analysis completed for TX HB123 - healthcare

✅ State legislation AI processing completed:
  📊 Total processed: 10
  🤖 AI successful: 9
  ❌ AI failed: 1
🔍 Verification: 9 bills with AI summaries in last hour
```

## Rate Limiting & Performance

- **Session Discovery**: 1 second delay between states
- **Bill Fetching**: 0.5 seconds between bill detail requests
- **Status Updates**: 1 second between status checks
- **AI Processing**: 2 seconds between AI calls (matching existing pattern)
- **Batch Limits**: 
  - AI processing: 10 bills per run
  - Status updates: 50 bills per run

## Error Handling

- Individual failures don't stop the entire job
- Bills marked as processed to avoid infinite retries
- Partial AI failures are logged and tracked
- Database transactions ensure data consistency

## Integration with Existing System

**Matches your existing state bill processing:**
- ✅ Uses same `analyze_state_legislation()` function
- ✅ Same database field updates (`ai_executive_summary`, `ai_summary`)
- ✅ Same practice area categorization
- ✅ Same rate limiting (2 seconds between AI calls)
- ✅ Same AI version tracking

**Differences from executive orders:**
- ❌ Does NOT use `analyze_executive_order()` 
- ✅ Uses state-specific prompts and logic
- ✅ Includes practice area categorization
- ✅ Processes in smaller batches (10 vs unlimited)

## Manual Testing

Test individual phases:
```bash
# Test session discovery only
az containerapp job start --name job-state-bills-nightly --resource-group rg-legislation-tracker

# View execution logs
az containerapp job execution list --name job-state-bills-nightly --resource-group rg-legislation-tracker

# Check for bills needing AI processing
# SQL: SELECT COUNT(*) FROM dbo.state_legislation WHERE needs_ai_processing = 1
```

## Current Processing Status

Based on CLAUDE.md documentation:
- **California (CA)**: 100% complete (2,884/2,884)
- **Colorado (CO)**: 100% complete (833/833) 
- **Kentucky (KY)**: 100% complete (1,441/1,441)
- **Nevada (NV)**: 40.2% complete (526/1,310) - **784 remaining**
- **South Carolina (SC)**: 8.9% complete (200/2,247) - **2,047 remaining**
- **Texas (TX)**: 7.7% complete (956/12,418) - **11,462 remaining**

The nightly automation will now:
1. Keep completed states updated with new sessions/bills
2. Gradually process remaining bills in NV, SC, TX
3. Discover new sessions in all target states
4. Apply AI processing using your existing state legislation system

Your state bills now get the same AI processing as your manual batch operations, but automated nightly!