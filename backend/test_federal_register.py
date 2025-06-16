# test_federal_register.py - Quick test of your Federal Register API URL
import requests
import json
from datetime import datetime

def test_federal_register_api():
    """Test your specific Federal Register API URL"""
    
    print("🧪 Testing Federal Register API")
    print("=" * 50)
    
    # Your specific API URL parameters
    base_url = "https://www.federalregister.gov/api/v1/documents.json"
    
    params = {
        'conditions[correction]': '0',
        'conditions[president]': 'donald-trump',
        'conditions[presidential_document_type]': 'executive_order',
        'conditions[signing_date][gte]': '01/20/2025',
        'conditions[signing_date][lte]': '06/17/2025',
        'conditions[type][]': 'PRESDOCU',
        'fields[]': [
            'citation',
            'document_number',
            'end_page',
            'html_url',
            'pdf_url',
            'type',
            'subtype',
            'publication_date',
            'signing_date',
            'start_page',
            'title',
            'disposition_notes',
            'executive_order_number',
            'not_received_for_publication',
            'full_text_xml_url',
            'body_html_url',
            'json_url'
        ],
        'include_pre_1994_docs': 'true',
        'maximum_per_page': '10000',
        'order': 'executive_order',
        'per_page': '10'  # Small number for testing
    }
    
    try:
        print(f"🌐 Making request to: {base_url}")
        print(f"📅 Date range: 01/20/2025 to 06/17/2025")
        print(f"👤 President: donald-trump")
        print(f"📋 Document type: executive_order")
        print()
        
        response = requests.get(base_url, params=params, timeout=30)
        
        print(f"📊 Response Status: {response.status_code}")
        print(f"🔗 Full URL: {response.url}")
        print()
        
        if response.status_code == 200:
            data = response.json()
            
            print("✅ API Request Successful!")
            print(f"📈 Total Count: {data.get('count', 'Not provided')}")
            print(f"📋 Results in this page: {len(data.get('results', []))}")
            print(f"🔄 Next page: {'Yes' if data.get('next_page_url') else 'No'}")
            print()
            
            results = data.get('results', [])
            
            if results:
                print("📄 Sample Executive Orders:")
                print("-" * 80)
                
                for i, doc in enumerate(results[:5], 1):
                    title = doc.get('title', 'No title')
                    eo_number = doc.get('executive_order_number', 'No EO number')
                    doc_number = doc.get('document_number', 'No doc number')
                    signing_date = doc.get('signing_date', 'No signing date')
                    publication_date = doc.get('publication_date', 'No pub date')
                    
                    print(f"{i}. EO #{eo_number}")
                    print(f"   Title: {title[:70]}{'...' if len(title) > 70 else ''}")
                    print(f"   Document: {doc_number}")
                    print(f"   Signed: {signing_date}")
                    print(f"   Published: {publication_date}")
                    print(f"   PDF: {'Yes' if doc.get('pdf_url') else 'No'}")
                    print(f"   HTML: {'Yes' if doc.get('html_url') else 'No'}")
                    print()
                
                print("🎯 Field Analysis:")
                if results:
                    sample_doc = results[0]
                    available_fields = list(sample_doc.keys())
                    print(f"   Available fields: {len(available_fields)}")
                    print(f"   Fields: {', '.join(available_fields)}")
                    print()
                
                # Check for specific fields
                field_analysis = {
                    'executive_order_number': sum(1 for doc in results if doc.get('executive_order_number')),
                    'signing_date': sum(1 for doc in results if doc.get('signing_date')),
                    'publication_date': sum(1 for doc in results if doc.get('publication_date')),
                    'html_url': sum(1 for doc in results if doc.get('html_url')),
                    'pdf_url': sum(1 for doc in results if doc.get('pdf_url')),
                    'title': sum(1 for doc in results if doc.get('title'))
                }
                
                print("📊 Field Coverage:")
                for field, count in field_analysis.items():
                    percentage = (count / len(results)) * 100
                    print(f"   {field}: {count}/{len(results)} ({percentage:.0f}%)")
                
            else:
                print("⚠️ No executive orders found in the response")
                print("This might mean:")
                print("- No EOs in the date range")
                print("- Different field names")
                print("- API parameters need adjustment")
            
        else:
            print(f"❌ API Request Failed: {response.status_code}")
            print(f"Error: {response.text[:500]}")
            
            if response.status_code == 404:
                print("\n💡 Suggestions:")
                print("- Check if the API endpoint URL is correct")
                print("- Verify the API is still active")
            elif response.status_code == 400:
                print("\n💡 Suggestions:")
                print("- Check parameter format")
                print("- Verify date format (should be MM/DD/YYYY)")
                print("- Check field names")
    
    except requests.exceptions.Timeout:
        print("❌ Request timed out")
        print("💡 Try increasing timeout or check internet connection")
    
    except requests.exceptions.ConnectionError:
        print("❌ Connection error")
        print("💡 Check internet connection and API endpoint")
    
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
    
    print("\n" + "=" * 50)
    print("🏁 Test completed")

if __name__ == "__main__":
    test_federal_register_api()