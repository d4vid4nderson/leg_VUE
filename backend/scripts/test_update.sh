#!/bin/bash

# Test Nightly Update Script
# This script allows you to test the nightly update manually

echo "🧪 Testing Nightly Bill Update"
echo "=============================="
echo ""

cd "/Users/david.anderson/Downloads/PoliticalVue/backend"

# Ask for confirmation
echo "This will run the nightly update process manually."
echo "Are you sure you want to continue? (y/N)"
read -r response

if [ "$response" != "y" ] && [ "$response" != "Y" ]; then
    echo "Test cancelled"
    exit 0
fi

echo ""
echo "🚀 Starting test update..."

# Run the update script
bash "/Users/david.anderson/Downloads/PoliticalVue/backend/scripts/run_nightly_update.sh"

echo ""
echo "✅ Test completed"
echo "Check the logs in: /Users/david.anderson/Downloads/PoliticalVue/backend/logs"
