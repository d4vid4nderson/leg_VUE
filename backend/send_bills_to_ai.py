#!/usr/bin/env python3
"""
Send Bills to Azure AI Foundry for Processing
Sends bills without summaries to your existing AI endpoint
"""

import requests
import json
import time
from datetime import datetime
from database_config import get_db_connection

# Configuration - Update with your Azure AI Foundry endpoint
AI_ENDPOINT = "http://localhost:8000/api/process-bill-ai"  # Your existing AI endpoint
BATCH_SIZE = 10
DELAY_BETWEEN_CALLS = 1  # seconds

def send_bill_to_ai(bill_data):
    """Send a single bill to your AI processing endpoint"""
    try:
        # Send to your existing AI endpoint
        response = requests.post(
            AI_ENDPOINT,
            json=bill_data,
            timeout=30
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            print(f"      ⚠️ AI processing returned {response.status_code}")
            return None
            
    except Exception as e:
        print(f"      ❌ Error sending to AI: {e}")
        return None

def process_state_bills(state_abbr, limit=None):
    """Process bills for a state"""
    print(f"\n🏛️ Processing {state_abbr} Bills")
    print("=" * 50)
    
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Get bills without AI summaries
            query = """
                SELECT 
                    id, bill_id, bill_number, title, description,
                    state, status, introduced_date, last_action_date,
                    session_id, session_name, bill_type, body,
                    legiscan_url, pdf_url
                FROM dbo.state_legislation
                WHERE (state = ? OR state_abbr = ?)
                AND (
                    ai_executive_summary IS NULL 
                    OR ai_executive_summary = ''
                    OR ai_summary IS NULL
                    OR ai_summary = ''
                )
                ORDER BY introduced_date DESC
            """
            
            if limit:
                query = query.replace("SELECT", f"SELECT TOP {limit}")
            
            cursor.execute(query, (state_abbr, state_abbr))
            bills = cursor.fetchall()
            
            print(f"📊 Found {len(bills)} bills without AI summaries")
            
            if not bills:
                print("✅ All bills already have AI summaries!")
                return 0
            
            processed = 0
            failed = 0
            
            # Process bills
            for i, bill in enumerate(bills):
                (id_val, bill_id, bill_number, title, description,
                 state, status, introduced_date, last_action_date,
                 session_id, session_name, bill_type, body,
                 legiscan_url, pdf_url) = bill
                
                print(f"\n   [{i+1}/{len(bills)}] Processing {bill_number}...")
                
                # Prepare bill data for AI
                bill_payload = {
                    'id': id_val,
                    'bill_id': bill_id,
                    'bill_number': bill_number,
                    'title': title or '',
                    'description': description or '',
                    'state': state,
                    'status': status,
                    'introduced_date': str(introduced_date) if introduced_date else '',
                    'last_action_date': str(last_action_date) if last_action_date else '',
                    'session_id': session_id,
                    'session_name': session_name or '',
                    'bill_type': bill_type or '',
                    'body': body or '',
                    'url': legiscan_url or '',
                    'pdf_url': pdf_url or ''
                }
                
                # Send to AI for processing
                ai_result = send_bill_to_ai(bill_payload)
                
                if ai_result:
                    # Update database with AI results
                    update_query = """
                        UPDATE dbo.state_legislation
                        SET ai_summary = ?,
                            ai_executive_summary = ?,
                            ai_talking_points = ?,
                            ai_key_points = ?,
                            ai_business_impact = ?,
                            ai_potential_impact = ?,
                            ai_version = ?,
                            last_updated = ?
                        WHERE id = ?
                    """
                    
                    cursor.execute(update_query, (
                        ai_result.get('summary', ''),
                        ai_result.get('executive_summary', ''),
                        ai_result.get('talking_points', ''),
                        ai_result.get('key_points', ''),
                        ai_result.get('business_impact', ''),
                        ai_result.get('potential_impact', ''),
                        ai_result.get('ai_version', '1.0'),
                        datetime.now(),
                        id_val
                    ))
                    
                    processed += 1
                    print(f"      ✅ AI summaries saved")
                    
                    # Commit every 10 bills
                    if processed % 10 == 0:
                        conn.commit()
                        print(f"      💾 Progress saved ({processed} bills)")
                else:
                    failed += 1
                    print(f"      ❌ Failed to process")
                
                # Delay between calls
                time.sleep(DELAY_BETWEEN_CALLS)
            
            # Final commit
            conn.commit()
            
            print(f"\n" + "=" * 50)
            print(f"✅ {state_abbr} Processing Complete!")
            print(f"   📊 Processed: {processed}")
            print(f"   ❌ Failed: {failed}")
            if processed + failed > 0:
                print(f"   📈 Success rate: {(processed/(processed+failed)*100):.1f}%")
            
            return processed
            
    except Exception as e:
        print(f"❌ Error processing {state_abbr}: {e}")
        import traceback
        traceback.print_exc()
        return 0

def main():
    """Main function"""
    print("🤖 Send Bills to Azure AI Foundry")
    print("=" * 60)
    
    # Get current counts
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Show bills needing AI summaries by state
            cursor.execute("""
                SELECT state, COUNT(*) as count
                FROM dbo.state_legislation
                WHERE ai_executive_summary IS NULL 
                   OR ai_executive_summary = ''
                   OR ai_summary IS NULL
                   OR ai_summary = ''
                GROUP BY state
                ORDER BY count DESC
            """)
            
            print("\n📊 Bills needing AI summaries:")
            states_need_ai = []
            for state, count in cursor.fetchall():
                print(f"   {state}: {count} bills")
                states_need_ai.append(state)
            
    except Exception as e:
        print(f"Error checking database: {e}")
        return
    
    print("\n" + "-" * 40)
    print("Starting with Colorado (CO) as requested")
    print("-" * 40)
    
    # Process Colorado first
    process_state_bills('CO', limit=None)
    
    # Ask if user wants to continue with other states
    print("\n" + "=" * 60)
    continue_processing = input("\nProcess other states? (y/n): ").lower()
    
    if continue_processing == 'y':
        for state in states_need_ai:
            if state != 'CO':  # Skip CO since we already did it
                print(f"\nProcessing {state}...")
                confirm = input(f"Process {state}? (y/n/skip all): ").lower()
                
                if confirm == 'y':
                    process_state_bills(state)
                elif confirm == 'skip all':
                    break
    
    print("\n🎉 All processing complete!")

if __name__ == "__main__":
    main()