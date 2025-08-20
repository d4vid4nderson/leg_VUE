#!/usr/bin/env python3
"""
Test script for State Legislation Scheduler
Quick test without waiting for 3 AM
"""

import asyncio
import sys
from state_legislation_scheduler import StateLegislationScheduler

async def test_fetch():
    """Test the daily fetch process without waiting for 3 AM"""
    
    scheduler = StateLegislationScheduler()
    
    print("🧪 Testing State Legislation Scheduler Components...")
    print(f"⏰ Scheduler configured for: {scheduler.target_time} Central Time")
    print(f"🏛️ Active states: {', '.join(scheduler.active_states)}")
    
    # Test state selection
    print("\n📋 Testing state selection...")
    states = await scheduler.get_states_with_new_sessions()
    print(f"Selected states: {states}")
    
    # Test new bill counting
    print("\n📊 Testing new bill tracking...")
    for state in states[:1]:  # Test with first state only
        await scheduler.mark_recent_bills_as_new(state)
        print(f"✅ Marked recent bills as new for {state}")
    
    # Get time until next 3 AM
    seconds = scheduler.get_seconds_until_target()
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    print(f"\n⏰ Next scheduled run: {hours}h {minutes}m from now")
    
    print("\n✅ All scheduler components tested successfully!")
    print("🚀 To run the full scheduler: python state_legislation_scheduler.py")
    print("📅 It will automatically run at 3 AM Central Time daily")

if __name__ == "__main__":
    asyncio.run(test_fetch())