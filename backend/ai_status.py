# ai_status.py - Improved Azure AI status checks

import os
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

def check_azure_ai_configuration() -> Dict[str, Any]:
    """Check if Azure AI is properly configured"""
    result = {
        "status": "not_configured",
        "message": "Azure AI not configured",
        "details": {}
    }
    
    # Check environment variables
    azure_endpoint = os.getenv("AZURE_ENDPOINT")
    azure_key = os.getenv("AZURE_KEY")
    azure_model = os.getenv("AZURE_MODEL_NAME")
    
    # Log what we find but don't expose sensitive information
    logger.info(f"🔍 Checking Azure AI configuration")
    logger.info(f"- AZURE_ENDPOINT: {'✅ Set' if azure_endpoint else '❌ Not set'}")
    logger.info(f"- AZURE_KEY: {'✅ Set' if azure_key else '❌ Not set'}")
    logger.info(f"- AZURE_MODEL_NAME: {'✅ Set' if azure_model else '❌ Not set'}")
    
    # All required variables must be set
    if not all([azure_endpoint, azure_key, azure_model]):
        missing = []
        if not azure_endpoint: missing.append("AZURE_ENDPOINT")
        if not azure_key: missing.append("AZURE_KEY")
        if not azure_model: missing.append("AZURE_MODEL_NAME")
        
        result["status"] = "not_configured"
        result["message"] = f"Azure AI missing configuration: {', '.join(missing)}"
        result["details"] = {"missing_variables": missing}
        logger.warning(f"⚠️ {result['message']}")
        return result
    
    # All variables are set - configuration looks good
    result["status"] = "connected"
    result["message"] = "Azure AI configured correctly"
    result["details"] = {
        "endpoint": azure_endpoint,
        "model": azure_model,
        "all_variables_set": True
    }
    logger.info(f"✅ Azure AI configured correctly")
    return result

def get_ai_status_for_api() -> Dict[str, str]:
    """Get Azure AI status for API response"""
    config = check_azure_ai_configuration()
    
    if config["status"] == "connected":
        return {
            "status": "connected",
            "message": "Azure AI connected and ready",
            "ai_model": os.getenv("AZURE_MODEL_NAME", "Unknown")
        }
    else:
        return {
            "status": "error",
            "message": config["message"],
            "details": "Check environment variables AZURE_ENDPOINT, AZURE_KEY, and AZURE_MODEL_NAME"
        }
