# Texas Legislation Fetch Issue - Root Cause & Solution

## Problem Analysis ✅

**Issue**: Texas has 11 pages of bills on LegiScan (thousands of bills), but the system was only fetching 723 bills before timing out.

### Root Causes Identified:

1. **Pagination Logic Flaw**: 
   - Code stopped fetching when any page returned < 50 bills
   - Texas might have pages with < 50 bills, causing early termination

2. **Wrong API Approach**:
   - Using `getSearch` with pagination (inefficient for full datasets)
   - Should use `getMasterList` API to get ALL bills in one call

3. **Timeout Issues**:
   - 30-second API timeouts too short for large datasets
   - 5-minute overall timeout insufficient for Texas-sized states
   - No chunked processing for database saves

4. **Max Pages Limitation**:
   - Default `max_pages=3` in fetch endpoint
   - Texas has 11 pages, so only getting ~25% of bills

## Solutions Implemented ✅

### 1. **Enhanced API Strategy** (`legiscan_api.py`)
- **NEW**: Added `get_master_list()` method using LegiScan's `getMasterList` API
- **ENHANCED**: `optimized_bulk_fetch()` now uses master list for comprehensive fetching
- **FALLBACK**: Still supports search-based pagination for smaller requests

### 2. **Fixed Pagination Logic** 
- **BEFORE**: `if len(page_bills) < 50: break`  # Stopped too early
- **AFTER**: `if len(page_bills) == 0: break`   # Only stops on truly empty pages

### 3. **Increased Timeouts**
- **API Requests**: 30s → 60s per request
- **Overall Operation**: 5 minutes → 15 minutes
- **Max Pages**: 3 → 15 pages for comprehensive fetching

### 4. **Chunked Processing** (`main.py`)
- Database saves now process in chunks of 100 bills
- Prevents memory issues and timeouts on large datasets
- Progress logging for large operations

### 5. **Enhanced Error Handling**
- Better timeout error messages
- Partial results returned if timeout occurs
- Detailed logging for troubleshooting

## Technical Details

### LegiScan API Usage:
```python
# OLD APPROACH (Pagination)
search_bills(state, query=None, limit=limit, max_pages=3)

# NEW APPROACH (Master List)  
get_master_list(state) → Returns ALL bills for state in one call
```

### Processing Flow:
1. **For Large Requests** (`limit > 100` or `year_filter='all'`):
   - Use `getMasterList` API (gets all bills at once)
   - Process and clean bill data
   - Apply limit if needed

2. **For Small Requests**:
   - Fallback to search-based pagination
   - Enhanced pagination that doesn't stop early

3. **Database Saving**:
   - Process in 100-bill chunks
   - Progress logging
   - Timeout handling

## Expected Results

### Before Fix:
- Texas: ~723 bills (3 pages × ~241 bills/page)
- Frequent timeouts on large states
- Incomplete datasets

### After Fix:
- Texas: ALL bills from master list (potentially 2000+ bills)
- No pagination limitations  
- Robust timeout handling
- Chunked processing prevents overload

## Testing Recommendation

Test with Texas specifically:
```bash
# Test the enhanced fetch
curl -X POST "http://localhost:8000/api/state-legislation/fetch" \
  -H "Content-Type: application/json" \
  -d '{
    "states": ["Texas"],
    "bills_per_state": 5000,
    "save_to_db": true,
    "year_filter": "all",
    "max_pages": 15
  }'
```

Expected outcome: Should fetch all Texas bills from LegiScan master list, matching the 11 pages visible on the website.