#!/usr/bin/env python3
"""
Process Colorado Bills with AI Summaries
Uses existing Azure OpenAI configuration from the backend
"""

import os
import time
from datetime import datetime
from database_config import get_db_connection
from openai import AzureOpenAI

# Use existing Azure OpenAI configuration
AZURE_ENDPOINT = os.getenv('AZURE_OPENAI_ENDPOINT')
AZURE_KEY = os.getenv('AZURE_OPENAI_API_KEY')
DEPLOYMENT_NAME = os.getenv('AZURE_OPENAI_DEPLOYMENT_NAME', 'summarize-gpt-4.1')

# Initialize Azure OpenAI client
client = AzureOpenAI(
    azure_endpoint=AZURE_ENDPOINT,
    api_key=AZURE_KEY,
    api_version="2024-02-15-preview"
)

def generate_ai_summary(bill_data):
    """Generate AI summary for a bill using Azure OpenAI"""
    try:
        # Create prompt for summary
        prompt = f"""
        Analyze this legislative bill and provide:
        1. Executive Summary (2-3 sentences)
        2. Key Talking Points (3-5 bullet points)
        3. Business Impact Assessment
        
        Bill Information:
        Bill Number: {bill_data['bill_number']}
        Title: {bill_data['title']}
        Description: {bill_data['description']}
        State: Colorado
        Status: {bill_data['status']}
        
        Provide a clear, concise analysis focusing on practical implications.
        """
        
        # Call Azure OpenAI
        response = client.chat.completions.create(
            model=DEPLOYMENT_NAME,
            messages=[
                {"role": "system", "content": "You are a legislative analyst providing clear, actionable summaries of bills."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=800,
            temperature=0.3
        )
        
        content = response.choices[0].message.content
        
        # Parse the response into sections
        sections = content.split('\n\n')
        
        # Extract different parts
        executive_summary = ""
        talking_points = ""
        business_impact = ""
        
        for section in sections:
            if 'Executive Summary' in section or sections.index(section) == 0:
                executive_summary = section.replace('Executive Summary:', '').strip()
            elif 'Talking Points' in section or 'Key Points' in section:
                talking_points = section.replace('Key Talking Points:', '').replace('Talking Points:', '').strip()
            elif 'Business Impact' in section or 'Impact' in section:
                business_impact = section.replace('Business Impact Assessment:', '').replace('Business Impact:', '').strip()
        
        return {
            'full_summary': content,
            'executive_summary': executive_summary,
            'talking_points': talking_points,
            'business_impact': business_impact
        }
        
    except Exception as e:
        print(f"      ❌ AI generation error: {e}")
        return None

def process_colorado_bills(limit=None, test_mode=False):
    """Process Colorado bills that need AI summaries"""
    print("🏛️ Processing Colorado Bills with AI")
    print("=" * 50)
    
    if not AZURE_ENDPOINT or not AZURE_KEY:
        print("❌ Azure OpenAI credentials not configured")
        print("   Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY in .env")
        return
    
    print(f"✅ Using Azure OpenAI")
    print(f"   Endpoint: {AZURE_ENDPOINT}")
    print(f"   Model: {DEPLOYMENT_NAME}")
    print()
    
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Get CO bills without AI summaries
            query = """
                SELECT 
                    id, bill_id, bill_number, title, description, status
                FROM dbo.state_legislation
                WHERE (state = 'CO' OR state_abbr = 'CO')
                AND (ai_executive_summary IS NULL OR ai_executive_summary = '')
                ORDER BY introduced_date DESC
            """
            
            if test_mode:
                query = query.replace("SELECT", "SELECT TOP 5")
            elif limit:
                query = query.replace("SELECT", f"SELECT TOP {limit}")
            
            cursor.execute(query)
            bills = cursor.fetchall()
            
            total = len(bills)
            print(f"📊 Found {total} Colorado bills without AI summaries")
            
            if test_mode:
                print("🧪 TEST MODE: Processing first 5 bills only")
            
            if not bills:
                print("✅ All bills already have AI summaries!")
                return
            
            processed = 0
            failed = 0
            
            for i, bill in enumerate(bills):
                id_val, bill_id, bill_number, title, description, status = bill
                
                print(f"\n[{i+1}/{total}] Processing {bill_number}")
                print(f"   Title: {(title or '')[:60]}...")
                
                # Prepare bill data
                bill_data = {
                    'bill_number': bill_number,
                    'title': title or '',
                    'description': description or '',
                    'status': status or 'Unknown'
                }
                
                # Generate AI summary
                ai_result = generate_ai_summary(bill_data)
                
                if ai_result:
                    # Update database
                    update_query = """
                        UPDATE dbo.state_legislation
                        SET ai_summary = ?,
                            ai_executive_summary = ?,
                            ai_talking_points = ?,
                            ai_business_impact = ?,
                            ai_version = '1.0',
                            last_updated = ?
                        WHERE id = ?
                    """
                    
                    cursor.execute(update_query, (
                        ai_result['full_summary'][:2000],  # Limit length
                        ai_result['executive_summary'][:1000],
                        ai_result['talking_points'][:1000],
                        ai_result['business_impact'][:1000],
                        datetime.now(),
                        id_val
                    ))
                    
                    processed += 1
                    print(f"   ✅ AI summary generated and saved")
                    
                    # Commit every 10 bills
                    if processed % 10 == 0:
                        conn.commit()
                        print(f"   💾 Progress saved ({processed} bills)")
                else:
                    failed += 1
                    print(f"   ❌ Failed to generate AI summary")
                
                # Delay to avoid rate limiting
                time.sleep(1)
                
                # In test mode, show sample output
                if test_mode and ai_result:
                    print("\n   📝 Sample Summary:")
                    print(f"   {ai_result['executive_summary'][:200]}...")
            
            # Final commit
            conn.commit()
            
            print("\n" + "=" * 50)
            print("✅ Processing Complete!")
            print(f"   📊 Processed: {processed}")
            print(f"   ❌ Failed: {failed}")
            print(f"   📈 Success rate: {(processed/(processed+failed)*100):.1f}%")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

def main():
    """Main function"""
    print("🤖 Colorado Bills AI Summary Generator")
    print("=" * 60)
    
    # Test mode first
    test = input("Run in test mode (process 5 bills)? (y/n): ").lower()
    
    if test == 'y':
        process_colorado_bills(test_mode=True)
    else:
        # Full processing
        limit = input("Enter max bills to process (or press Enter for all 450): ").strip()
        
        if limit:
            process_colorado_bills(limit=int(limit))
        else:
            confirm = input("Process all 450 Colorado bills? This will take ~8 minutes. (y/n): ").lower()
            if confirm == 'y':
                process_colorado_bills()
            else:
                print("Cancelled")

if __name__ == "__main__":
    main()