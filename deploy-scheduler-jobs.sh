#!/bin/bash

# Deploy Azure Container Jobs for PoliticalVue Nightly Automation
# This script deploys scheduled jobs to Azure Container Apps Environment

set -e

echo "🚀 Deploying PoliticalVue Nightly Automation Jobs to Azure"

# Configuration
RESOURCE_GROUP="rg-legislation-tracker"
LOCATION="centralus"
SUBSCRIPTION_ID="47a3dc42-3a05-4529-9b6e-f4416090970b"

# Check if Azure CLI is logged in
if ! az account show &> /dev/null; then
    echo "❌ Please log in to Azure CLI first: az login"
    exit 1
fi

# Set subscription
echo "🎯 Setting Azure subscription..."
az account set --subscription "$SUBSCRIPTION_ID"

# Deploy Bicep template
echo "📦 Deploying Azure Container Jobs..."
az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --template-file "azure-scheduler-jobs.bicep" \
    --parameters location="$LOCATION" \
    --verbose

if [ $? -eq 0 ]; then
    echo "✅ Azure Container Jobs deployed successfully!"
    echo ""
    echo "📋 Deployed jobs:"
    echo "  🏛️  Executive Orders: job-executive-orders-nightly (runs daily at 2:00 AM UTC)"
    echo "  📜 State Bills: job-state-bills-nightly (runs daily at 3:00 AM UTC)"
    echo ""
    echo "🔍 To monitor the jobs:"
    echo "  az containerapp job show --name job-executive-orders-nightly --resource-group $RESOURCE_GROUP"
    echo "  az containerapp job show --name job-state-bills-nightly --resource-group $RESOURCE_GROUP"
    echo ""
    echo "▶️  To trigger a job manually:"
    echo "  az containerapp job start --name job-executive-orders-nightly --resource-group $RESOURCE_GROUP"
    echo "  az containerapp job start --name job-state-bills-nightly --resource-group $RESOURCE_GROUP"
    echo ""
    echo "📊 To view job execution history:"
    echo "  az containerapp job execution list --name job-executive-orders-nightly --resource-group $RESOURCE_GROUP"
    echo "  az containerapp job execution list --name job-state-bills-nightly --resource-group $RESOURCE_GROUP"
    echo ""
    echo "🎉 Your nightly automation is now running in Azure!"
else
    echo "❌ Deployment failed. Please check the errors above."
    exit 1
fi