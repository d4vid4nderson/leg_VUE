#!/usr/bin/env python3
"""
Test database connection in container environment
"""
import os
import sys
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_connection():
    """Test container database connection"""
    logger.info("🧪 Testing container database connection")
    logger.info(f"⏰ Test time: {datetime.utcnow().isoformat()}Z")
    
    # Add backend to path
    backend_dir = '/app'
    sys.path.insert(0, backend_dir)
    os.environ['PYTHONPATH'] = backend_dir + ':' + os.environ.get('PYTHONPATH', '')
    
    # Check environment variables
    logger.info(f"🌐 ENVIRONMENT: {os.getenv('ENVIRONMENT', 'not set')}")
    logger.info(f"🗄️ AZURE_SQL_SERVER: {os.getenv('AZURE_SQL_SERVER', 'not set')}")
    logger.info(f"🏗️ CONTAINER_APP_NAME: {os.getenv('CONTAINER_APP_NAME', 'not set')}")
    logger.info(f"🆔 MSI_ENDPOINT: {os.getenv('MSI_ENDPOINT', 'not set')}")
    
    try:
        from database_config import get_db_connection, test_database_connection
        logger.info("✅ Database config imported successfully")
        
        # Test connection
        result = test_database_connection()
        if result:
            logger.info("✅ Database connection test PASSED")
        else:
            logger.error("❌ Database connection test FAILED")
            
        sys.exit(0 if result else 1)
        
    except ImportError as e:
        logger.error(f"❌ Import error: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    test_connection()