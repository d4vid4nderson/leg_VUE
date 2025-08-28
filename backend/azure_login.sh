#!/bin/bash

# Azure login script for container apps job execution monitoring
# This script authenticates using managed identity

echo "Authenticating with Azure..."

# Try managed identity first (works in Azure Container Apps)
if az login --identity --username $MANAGED_IDENTITY_CLIENT_ID 2>/dev/null; then
    echo "Successfully authenticated with managed identity"
else
    echo "Managed identity not available, trying service principal..."
    
    # Fallback to service principal if available
    if [ ! -z "$AZURE_CLIENT_ID" ] && [ ! -z "$AZURE_CLIENT_SECRET" ] && [ ! -z "$AZURE_TENANT_ID" ]; then
        az login --service-principal -u $AZURE_CLIENT_ID -p $AZURE_CLIENT_SECRET --tenant $AZURE_TENANT_ID
        echo "Authenticated with service principal"
    else
        echo "Warning: No authentication method available. Azure CLI commands may fail."
        echo "To enable authentication, set AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, and AZURE_TENANT_ID environment variables"
    fi
fi

# Set default subscription if specified
if [ ! -z "$AZURE_SUBSCRIPTION_ID" ]; then
    az account set --subscription $AZURE_SUBSCRIPTION_ID
    echo "Set subscription to $AZURE_SUBSCRIPTION_ID"
fi

echo "Azure authentication setup complete"