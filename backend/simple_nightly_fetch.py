#!/usr/bin/env python3
"""
Simple Nightly Fetch Script
Uses the existing working API endpoints to fetch new bills
"""

import requests
import json
import time
from datetime import datetime

# Configuration
API_BASE_URL = "http://localhost:8000"
STATES_TO_UPDATE = ["TX", "CA", "CO", "FL", "KY", "NV", "SC"]

def log_message(message):
    """Log with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"{timestamp} - {message}")

def check_and_update_state(state):
    """Use the existing check-and-update endpoint for a state"""
    log_message(f"🔄 Starting update for {state}")
    
    try:
        url = f"{API_BASE_URL}/api/legiscan/check-and-update"
        payload = {"state": state}
        
        # Make request with longer timeout for large datasets
        response = requests.post(
            url,
            json=payload,
            timeout=600  # 10 minutes
        )
        
        if response.status_code == 200:
            data = response.json()
            log_message(f"✅ {state} update completed:")
            log_message(f"   📊 Bills in API: {data.get('bills_found', data.get('api_bills_found', 'N/A'))}")
            log_message(f"   📄 Bills processed: {data.get('bills_processed', data.get('processed_bills', 0))}")
            log_message(f"   💾 Message: {data.get('message', 'No message')}")
            
            return {
                "state": state,
                "success": True,
                "bills_processed": data.get('bills_processed', data.get('processed_bills', 0)),
                "message": data.get('message', '')
            }
        else:
            log_message(f"❌ {state} update failed: HTTP {response.status_code}")
            log_message(f"   Response: {response.text}")
            
            return {
                "state": state,
                "success": False,
                "error": f"HTTP {response.status_code}: {response.text}"
            }
            
    except Exception as e:
        log_message(f"❌ {state} update error: {str(e)}")
        return {
            "state": state,
            "success": False,
            "error": str(e)
        }

def run_nightly_fetch():
    """Main function to run nightly fetch for all states"""
    log_message("🚀 Starting nightly bill fetch")
    
    results = []
    total_processed = 0
    
    for state in STATES_TO_UPDATE:
        result = check_and_update_state(state)
        results.append(result)
        
        if result["success"]:
            total_processed += result.get("bills_processed", 0)
        
        # Small delay between states to be respectful to the API
        time.sleep(2)
    
    # Summary
    log_message("📊 Nightly fetch summary:")
    log_message(f"   🏛️ States processed: {len(STATES_TO_UPDATE)}")
    log_message(f"   ✅ Successful updates: {sum(1 for r in results if r['success'])}")
    log_message(f"   ❌ Failed updates: {sum(1 for r in results if not r['success'])}")
    log_message(f"   📄 Total bills processed: {total_processed}")
    
    # Log any failures
    failures = [r for r in results if not r['success']]
    if failures:
        log_message("❌ Failed state updates:")
        for failure in failures:
            log_message(f"   {failure['state']}: {failure['error']}")
    
    log_message("🎉 Nightly fetch completed")
    
    return {
        "success": len(failures) == 0,
        "total_states": len(STATES_TO_UPDATE),
        "successful_states": len(STATES_TO_UPDATE) - len(failures),
        "failed_states": len(failures),
        "total_bills_processed": total_processed,
        "results": results
    }

if __name__ == "__main__":
    result = run_nightly_fetch()
    exit_code = 0 if result["success"] else 1
    exit(exit_code)