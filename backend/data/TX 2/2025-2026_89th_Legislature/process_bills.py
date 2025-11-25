
import json
import os
import sqlite3

def find_bill_files(directory):
    """Finds all JSON bill files in the specified directory."""
    bill_files = []
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith(".json"):
                bill_files.append(os.path.join(root, file))
    return bill_files

def extract_bill_data(file_path):
    """Extracts relevant data from a single bill JSON file."""
    with open(file_path, 'r') as f:
        data = json.load(f)
        bill = data.get("bill", {})
        return {
            "bill_id": bill.get("bill_id"),
            "title": bill.get("title"),
            "status": bill.get("status"),
            "status_date": bill.get("status_date"),
            "sponsors": [sponsor.get("name") for sponsor in bill.get("sponsors", [])],
            "full_text": bill.get("texts", [{}])[0].get("url")
        }

def simulate_azure_ai_processing(bill_data):
    """Simulates sending data to Azure AI Foundry and receiving results."""
    print(f"Simulating Azure AI processing for bill: {bill_data['title']}")
    # In a real implementation, you would make an API call to Azure AI here
    # For example:
    # response = requests.post(AZURE_AI_ENDPOINT, json=bill_data)
    # return response.json()
    return {"processed": True, "analysis": "This is a simulated analysis."}


def save_to_database(db_connection, bill_data, ai_results):
    """Saves the bill data and AI results to the database."""
    cursor = db_connection.cursor()
    cursor.execute('''
        INSERT INTO state_legislation (bill_id, title, status, status_date, sponsors, full_text_url, ai_analysis)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (
        bill_data["bill_id"],
        bill_data["title"],
        bill_data["status"],
        bill_data["status_date"],
        ", ".join(bill_data["sponsors"]),
        bill_data["full_text"],
        ai_results["analysis"]
    ))
    db_connection.commit()

def setup_database():
    """Sets up a temporary in-memory SQLite database for demonstration."""
    conn = sqlite3.connect(":memory:")
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE state_legislation (
            bill_id INTEGER PRIMARY KEY,
            title TEXT,
            status INTEGER,
            status_date TEXT,
            sponsors TEXT,
            full_text_url TEXT,
            ai_analysis TEXT
        )
    ''')
    conn.commit()
    return conn

def main():
    """Main function to process all bills."""
    bill_directory = "bill"
    db_connection = setup_database()

    bill_files = find_bill_files(bill_directory)
    for file_path in bill_files[:5]:  # Limiting to 5 for demonstration
        print(f"Processing {file_path}...")
        bill_data = extract_bill_data(file_path)
        ai_results = simulate_azure_ai_processing(bill_data)
        save_to_database(db_connection, bill_data, ai_results)
        print(f"Finished processing and saving {file_path}")

    # Verify data was saved
    cursor = db_connection.cursor()
    cursor.execute("SELECT title, ai_analysis FROM state_legislation")
    print("\n=== Verification: First 5 bills processed and saved ===")
    for row in cursor.fetchall():
        print(f"Title: {row[0]}\nAnalysis: {row[1]}\n")


if __name__ == "__main__":
    main()


