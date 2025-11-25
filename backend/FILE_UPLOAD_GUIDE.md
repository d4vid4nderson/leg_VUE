# Local File Upload Guide

Since the web upload is experiencing network issues, you can upload your files directly using the local file uploader script.

## ✅ **Confirmed Working Solution**

The local file uploader bypasses the web interface and processes files directly into the database.

## 📁 **How to Upload Your Files**

### **Step 1: Copy your files to the Docker container**
```bash
# Copy your JSON file
docker cp /path/to/your/file.json backend:/tmp/

# Copy your MD5 hash file  
docker cp /path/to/your/file.hash.md5 backend:/tmp/
```

### **Step 2: Run the uploader**
```bash
# For JSON files
docker exec backend python /app/local_file_uploader.py /tmp/your_file.json state_legislation TX

# For MD5 hash files
docker exec backend python /app/local_file_uploader.py /tmp/your_file.hash.md5 state_legislation TX

# For Executive Orders
docker exec backend python /app/local_file_uploader.py /tmp/your_orders.json executive_orders
```

## 📋 **Command Format**
```bash
python /app/local_file_uploader.py <file_path> <upload_type> <state>
```

**Parameters:**
- `file_path`: Path to your file inside the container (usually `/tmp/filename`)
- `upload_type`: Either `state_legislation` or `executive_orders`
- `state`: State code (e.g., `TX`) - required for state legislation only

## 📄 **Supported File Formats**

### **JSON Format (.json)**
```json
[
  {
    "bill_number": "HB1001",
    "title": "Bill title here",
    "description": "Bill description here",
    "status": "Introduced", 
    "introduced_date": "2025-01-15",
    "session_name": "89th Legislature Regular Session"
  }
]
```

### **MD5 Hash Format (.hash.md5 or .md5)**
```
abc123def456 HB1001_bill.pdf
789ghi012jkl SB502_bill.pdf
```

## 🎯 **For Your Texas Bills**

If you have Texas legislature files to upload:

1. **Copy your file to the container:**
   ```bash
   docker cp /path/to/your/texas_bills.json backend:/tmp/
   ```

2. **Upload to database:**
   ```bash
   docker exec backend python /app/local_file_uploader.py /tmp/texas_bills.json state_legislation TX
   ```

3. **Verify upload:**
   ```bash
   docker exec backend python -c "
   from database_config import get_db_connection
   with get_db_connection() as conn:
       cursor = conn.cursor()
       cursor.execute('SELECT COUNT(*) FROM dbo.state_legislation WHERE state = \"TX\"')
       print(f'Texas bills in database: {cursor.fetchone()[0]}')
   "
   ```

## ✨ **Features**

- ✅ **Automatic categorization** (healthcare, education, tax, etc.)
- ✅ **Duplicate detection** (updates existing bills)
- ✅ **Error handling** (shows failed items and reasons)
- ✅ **Progress tracking** (shows processed count)
- ✅ **Database validation** (checks required fields)

## 🔍 **Example Output**
```
================================================================================
LOCAL FILE UPLOADER - Process JSON and MD5 Hash Files
================================================================================
📁 File: /tmp/texas_bills.json
📝 Type: state_legislation
🏛️ State: TX
🔧 Format: .json

🔍 Processing JSON file: /tmp/texas_bills.json
📊 Found 150 items in JSON file
💾 Processing 150 items for state_legislation
  ✅ Processed 10/150 items...
  ✅ Processed 20/150 items...
  ...
✅ Database committed - 148 items saved

================================================================================
PROCESSING RESULTS
================================================================================
✅ Processing completed successfully!
📊 Total items: 150
✅ Successful: 148
❌ Failed: 2

🎉 Done! Your data has been uploaded to the database.
```

This method is more reliable than the web upload and gives you direct control over the process!