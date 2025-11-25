#!/usr/bin/env python3
"""
Add simple upload endpoint to main.py
"""

upload_endpoint_code = '''
# Simple file upload endpoint
@app.post("/api/admin/upload-data")
async def simple_upload_endpoint(file: UploadFile = File(...)):
    """Simple file upload for testing"""
    try:
        contents = await file.read()
        
        return {
            "success": True,
            "filename": file.filename,
            "size": len(contents),
            "message": f"Received {file.filename} ({len(contents)} bytes)"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
'''

# Read main.py
with open('/app/main.py', 'r') as f:
    content = f.read()

# Remove any existing upload endpoints
lines = content.split('\n')
new_lines = []
skip_lines = False

for line in lines:
    if 'upload_jobs = {}' in line or '@app.post("/api/admin/upload-data")' in line:
        skip_lines = True
    elif skip_lines and (line.strip() == '' or line.startswith('if __name__')):
        skip_lines = False
    
    if not skip_lines:
        new_lines.append(line)

content = '\n'.join(new_lines)

# Add the simple endpoint before if __name__
if_main_pos = content.find('if __name__ == "__main__":')
if if_main_pos != -1:
    content = content[:if_main_pos] + upload_endpoint_code + '\n\n' + content[if_main_pos:]

# Write back
with open('/app/main.py', 'w') as f:
    f.write(content)

print('✅ Added simple upload endpoint to main.py')