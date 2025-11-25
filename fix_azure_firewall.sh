#!/bin/bash

# Script to add your current IP to Azure SQL Server firewall rules
# This fixes the database connection issues for local development

echo "🔧 Fixing Azure SQL Server Firewall Rules"
echo "=========================================="

# Get your current public IP
PUBLIC_IP=$(curl -s https://api.ipify.org)
echo "📍 Your current public IP: $PUBLIC_IP"

# Azure SQL Server details
RESOURCE_GROUP="rg-PoliticalVue"
SERVER_NAME="sql-legislation-tracker"
RULE_NAME="LocalDev-$PUBLIC_IP"

echo ""
echo "🔐 Please login to Azure CLI..."
az login

echo ""
echo "🔥 Adding firewall rule for IP: $PUBLIC_IP"
az sql server firewall-rule create \
    --resource-group $RESOURCE_GROUP \
    --server $SERVER_NAME \
    --name "$RULE_NAME" \
    --start-ip-address $PUBLIC_IP \
    --end-ip-address $PUBLIC_IP

if [ $? -eq 0 ]; then
    echo "✅ Firewall rule added successfully!"
    echo ""
    echo "📝 Rule Details:"
    echo "   - Server: $SERVER_NAME"
    echo "   - Rule Name: $RULE_NAME"
    echo "   - IP Address: $PUBLIC_IP"
    echo ""
    echo "⏳ Please wait 1-2 minutes for the firewall rule to take effect."
    echo ""
    echo "🔄 After waiting, restart your Docker containers:"
    echo "   docker-compose down"
    echo "   docker-compose up -d"
else
    echo "❌ Failed to add firewall rule. Please check your Azure credentials and permissions."
    exit 1
fi

echo ""
echo "📋 To view all firewall rules:"
echo "   az sql server firewall-rule list --resource-group $RESOURCE_GROUP --server $SERVER_NAME"

echo ""
echo "🗑️  To remove this rule later:"
echo "   az sql server firewall-rule delete --resource-group $RESOURCE_GROUP --server $SERVER_NAME --name \"$RULE_NAME\""