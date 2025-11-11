#!/usr/bin/env python3
"""Test log extraction from Azure Container App Jobs"""

import subprocess
import re

def test_log_fetch_and_extract():
    """Test fetching logs and extracting summaries"""

    # Get recent state bills execution
    print("🔍 Fetching recent state bills execution...")
    result = subprocess.run([
        "az", "containerapp", "job", "execution", "list",
        "--name", "job-state-bills-nightly",
        "--resource-group", "rg-legislation-tracker",
        "--query", "[0].{name:name, status:properties.status}",
        "-o", "json"
    ], capture_output=True, text=True, timeout=30)

    if result.returncode != 0:
        print(f"❌ Failed to list executions: {result.stderr}")
        return

    import json
    exec_info = json.loads(result.stdout)
    exec_name = exec_info["name"]
    status = exec_info["status"]

    print(f"✅ Found execution: {exec_name} ({status})")

    # Fetch logs
    print(f"📜 Fetching logs for {exec_name}...")
    log_result = subprocess.run([
        "az", "containerapp", "job", "logs", "show",
        "--name", "job-state-bills-nightly",
        "--resource-group", "rg-legislation-tracker",
        "--execution", exec_name,
        "--container", "job-state-bills-nightly",
        "--format", "text"
    ], capture_output=True, text=True, timeout=30)

    if log_result.returncode != 0:
        print(f"❌ Failed to fetch logs: {log_result.stderr}")
        return

    logs = log_result.stdout
    print(f"✅ Fetched {len(logs)} characters of logs\n")

    # Show relevant log lines
    print("=" * 80)
    print("RELEVANT LOG LINES:")
    print("=" * 80)
    for line in logs.split('\n'):
        if any(keyword in line.lower() for keyword in ['daily fetch', 'bills processed', 'states', 'successful', 'completed']):
            print(line)
    print("=" * 80)
    print()

    # Test regex patterns
    print("🧪 Testing regex patterns...")

    # Pattern 1: Daily fetch successful
    daily_match = re.search(r'Daily fetch successful:\s*(\d+)\s+states?,\s*(\d+)\s+bills?\s+processed', logs, re.IGNORECASE)
    if daily_match:
        states_count = int(daily_match.group(1))
        bills_count = int(daily_match.group(2))
        if bills_count == 0:
            summary = "Nothing to update at this time"
        else:
            summary = f"Updated {bills_count} bill{'s' if bills_count != 1 else ''} across {states_count} state{'s' if states_count != 1 else ''}"
        print(f"✅ Pattern 1 matched: {summary}")
        return summary

    # Pattern 2: New bills added
    new_bills_match = re.search(r'New bills added:\s*(\d+)', logs, re.IGNORECASE)
    if new_bills_match:
        count = int(new_bills_match.group(1))
        if count == 0:
            summary = "Nothing to update at this time"
        else:
            summary = f"Updated {count} bill{'s' if count != 1 else ''}"
        print(f"✅ Pattern 2 matched: {summary}")
        return summary

    print("❌ No patterns matched")
    print("\nℹ️  First 500 chars of logs:")
    print(logs[:500])
    return None

if __name__ == "__main__":
    test_log_fetch_and_extract()
