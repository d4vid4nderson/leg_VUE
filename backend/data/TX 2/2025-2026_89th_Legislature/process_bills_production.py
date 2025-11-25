#!/usr/bin/env python3
"""
Production script to process Texas legislative bills through Azure AI Foundry
and save results to SQL Server database.
"""

import json
import os
import pyodbc
import requests
from datetime import datetime
from typing import Dict, List, Optional
import time
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configuration - Replace these with your actual values
CONFIG = {
    'azure_ai_endpoint': os.getenv('AZURE_AI_ENDPOINT', 'https://your-foundry-endpoint.com'),
    'azure_ai_key': os.getenv('AZURE_AI_KEY', 'your-api-key'),
    'sql_server': os.getenv('SQL_SERVER', 'your-server.database.windows.net'),
    'sql_database': os.getenv('SQL_DATABASE', 'your-database'),
    'sql_username': os.getenv('SQL_USERNAME', 'your-username'),
    'sql_password': os.getenv('SQL_PASSWORD', 'your-password'),
    'batch_size': 10,  # Number of bills to process at once
    'delay_between_batches': 2,  # Seconds to wait between batches
}

class BillProcessor:
    def __init__(self):
        self.db_connection = None
        self.setup_database_connection()
    
    def setup_database_connection(self):
        """Establishes connection to SQL Server database."""
        try:
            connection_string = (
                f"DRIVER={{ODBC Driver 17 for SQL Server}};"
                f"SERVER={CONFIG['sql_server']};"
                f"DATABASE={CONFIG['sql_database']};"
                f"UID={CONFIG['sql_username']};"
                f"PWD={CONFIG['sql_password']};"
                f"Encrypt=yes;"
                f"TrustServerCertificate=no;"
                f"Connection Timeout=30;"
            )
            self.db_connection = pyodbc.connect(connection_string)
            logger.info("Successfully connected to SQL Server database")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            raise
    
    def find_bill_files(self, directory: str) -> List[str]:
        """Finds all JSON bill files in the specified directory."""
        bill_files = []
        bill_dir = os.path.join(directory, "bill")
        
        if not os.path.exists(bill_dir):
            logger.error(f"Bill directory not found: {bill_dir}")
            return []
            
        for root, _, files in os.walk(bill_dir):
            for file in files:
                if file.endswith(".json"):
                    bill_files.append(os.path.join(root, file))
        
        logger.info(f"Found {len(bill_files)} bill files")
        return bill_files
    
    def extract_bill_data(self, file_path: str) -> Optional[Dict]:
        """Extracts relevant data from a single bill JSON file."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                bill = data.get("bill", {})
                
                # Extract sponsors
                sponsors = []
                for sponsor in bill.get("sponsors", []):
                    sponsors.append({
                        'name': sponsor.get("name", ""),
                        'party': sponsor.get("party", ""),
                        'role': sponsor.get("role", ""),
                        'district': sponsor.get("district", "")
                    })
                
                # Extract bill text
                texts = bill.get("texts", [])
                full_text_url = texts[0].get("url", "") if texts else ""
                
                # Extract subjects/categories
                subjects = [subj.get("subject_name", "") for subj in bill.get("subjects", [])]
                
                return {
                    "bill_id": bill.get("bill_id"),
                    "bill_number": bill.get("bill_number", ""),
                    "title": bill.get("title", ""),
                    "description": bill.get("description", ""),
                    "status": bill.get("status"),
                    "status_date": bill.get("status_date"),
                    "bill_type": bill.get("bill_type", ""),
                    "chamber": bill.get("body", ""),
                    "current_chamber": bill.get("current_body", ""),
                    "sponsors": sponsors,
                    "subjects": subjects,
                    "full_text_url": full_text_url,
                    "state": bill.get("state", "TX"),
                    "session_year": bill.get("session", {}).get("year_start", 2025),
                    "legiscan_url": bill.get("url", ""),
                    "state_url": bill.get("state_link", ""),
                    "completed": bool(bill.get("completed", 0))
                }
        except Exception as e:
            logger.error(f"Error processing file {file_path}: {e}")
            return None
    
    def process_with_azure_ai(self, bill_data: Dict) -> Dict:
        """Sends bill data to Azure AI Foundry for analysis."""
        try:
            headers = {
                'Authorization': f'Bearer {CONFIG["azure_ai_key"]}',
                'Content-Type': 'application/json'
            }
            
            # Prepare payload for Azure AI
            payload = {
                'title': bill_data['title'],
                'description': bill_data['description'],
                'subjects': bill_data['subjects'],
                'bill_type': bill_data['bill_type'],
                'sponsors': bill_data['sponsors']
            }
            
            # Make API call to Azure AI Foundry
            response = requests.post(
                CONFIG['azure_ai_endpoint'],
                headers=headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                ai_results = response.json()
                logger.info(f"Successfully processed bill {bill_data['bill_number']} with Azure AI")
                return {
                    'summary': ai_results.get('summary', ''),
                    'impact_analysis': ai_results.get('impact_analysis', ''),
                    'key_provisions': ai_results.get('key_provisions', []),
                    'political_implications': ai_results.get('political_implications', ''),
                    'stakeholder_analysis': ai_results.get('stakeholder_analysis', ''),
                    'processed_date': datetime.now().isoformat()
                }
            else:
                logger.error(f"Azure AI API error: {response.status_code} - {response.text}")
                return self._get_fallback_analysis(bill_data)
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Request to Azure AI failed: {e}")
            return self._get_fallback_analysis(bill_data)
        except Exception as e:
            logger.error(f"Unexpected error in Azure AI processing: {e}")
            return self._get_fallback_analysis(bill_data)
    
    def _get_fallback_analysis(self, bill_data: Dict) -> Dict:
        """Provides fallback analysis when Azure AI is unavailable."""
        return {
            'summary': f"Bill {bill_data['bill_number']}: {bill_data['title']}",
            'impact_analysis': 'Analysis pending - Azure AI processing failed',
            'key_provisions': [],
            'political_implications': 'To be analyzed',
            'stakeholder_analysis': 'To be analyzed',
            'processed_date': datetime.now().isoformat()
        }
    
    def save_to_database(self, bill_data: Dict, ai_results: Dict) -> bool:
        """Saves the bill data and AI results to the SQL Server database."""
        try:
            cursor = self.db_connection.cursor()
            
            # Prepare data for insertion
            sponsors_json = json.dumps(bill_data['sponsors'])
            subjects_json = json.dumps(bill_data['subjects'])
            key_provisions_json = json.dumps(ai_results['key_provisions'])
            
            # SQL INSERT statement
            sql = \"\"\"\n            INSERT INTO dbo.state_legislation (\n                bill_id, bill_number, title, description, status, status_date,\n                bill_type, chamber, current_chamber, sponsors, subjects,\n                full_text_url, state, session_year, legiscan_url, state_url,\n                completed, ai_summary, ai_impact_analysis, ai_key_provisions,\n                ai_political_implications, ai_stakeholder_analysis, processed_date,\n                created_date\n            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n            \"\"\"\n            \n            cursor.execute(sql, (\n                bill_data['bill_id'],\n                bill_data['bill_number'],\n                bill_data['title'],\n                bill_data['description'],\n                bill_data['status'],\n                bill_data['status_date'],\n                bill_data['bill_type'],\n                bill_data['chamber'],\n                bill_data['current_chamber'],\n                sponsors_json,\n                subjects_json,\n                bill_data['full_text_url'],\n                bill_data['state'],\n                bill_data['session_year'],\n                bill_data['legiscan_url'],\n                bill_data['state_url'],\n                bill_data['completed'],\n                ai_results['summary'],\n                ai_results['impact_analysis'],\n                key_provisions_json,\n                ai_results['political_implications'],\n                ai_results['stakeholder_analysis'],\n                ai_results['processed_date'],\n                datetime.now().isoformat()\n            ))\n            \n            self.db_connection.commit()\n            logger.info(f"Successfully saved bill {bill_data['bill_number']} to database\")\n            return True\n            \n        except Exception as e:\n            logger.error(f\"Failed to save bill {bill_data['bill_number']} to database: {e}\")\n            self.db_connection.rollback()\n            return False\n    \n    def process_all_bills(self, directory: str):\n        \"\"\"Main function to process all bills.\"\"\"\n        bill_files = self.find_bill_files(directory)\n        \n        if not bill_files:\n            logger.error(\"No bill files found\")\n            return\n        \n        processed_count = 0\n        error_count = 0\n        \n        logger.info(f\"Starting to process {len(bill_files)} bills\")\n        \n        for i, file_path in enumerate(bill_files, 1):\n            try:\n                logger.info(f\"Processing bill {i}/{len(bill_files)}: {os.path.basename(file_path)}\")\n                \n                # Extract bill data\n                bill_data = self.extract_bill_data(file_path)\n                if not bill_data:\n                    error_count += 1\n                    continue\n                \n                # Process with Azure AI\n                ai_results = self.process_with_azure_ai(bill_data)\n                \n                # Save to database\n                if self.save_to_database(bill_data, ai_results):\n                    processed_count += 1\n                else:\n                    error_count += 1\n                \n                # Rate limiting\n                if i % CONFIG['batch_size'] == 0:\n                    logger.info(f\"Processed {i} bills. Pausing for {CONFIG['delay_between_batches']} seconds...\")\n                    time.sleep(CONFIG['delay_between_batches'])\n                    \n            except Exception as e:\n                logger.error(f\"Unexpected error processing {file_path}: {e}\")\n                error_count += 1\n        \n        logger.info(f\"Processing complete. Successfully processed: {processed_count}, Errors: {error_count}\")\n    \n    def close(self):\n        \"\"\"Closes database connection.\"\"\"\n        if self.db_connection:\n            self.db_connection.close()\n            logger.info(\"Database connection closed\")\n\n\ndef main():\n    \"\"\"Main execution function.\"\"\"\n    logger.info(\"Starting Texas Legislative Bill Processing\")\n    \n    processor = BillProcessor()\n    \n    try:\n        # Process all bills in the current directory\n        processor.process_all_bills(\".\")\n    except KeyboardInterrupt:\n        logger.info(\"Processing interrupted by user\")\n    except Exception as e:\n        logger.error(f\"Unexpected error: {e}\")\n    finally:\n        processor.close()\n        logger.info(\"Processing finished\")\n\n\nif __name__ == \"__main__\":\n    main()\n
