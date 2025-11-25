#!/bin/bash

# Script to fix Azure Container Apps job schedules to run at correct UTC times
# The jobs are currently running at 9PM and 10PM CDT instead of 2AM and 3AM UTC

echo "Fixing Azure Container Apps job schedules..."

# Executive Orders job - should run at 2:00 AM UTC
# In CDT (UTC-5), 2:00 AM UTC = 9:00 PM CDT previous day
# In CST (UTC-6), 2:00 AM UTC = 8:00 PM CST previous day
# Cron expression: "0 2 * * *" for 2:00 AM UTC
az containerapp job update \
  --name job-executive-orders-nightly \
  --resource-group rg-legislation-tracker \
  --cron-expression "0 2 * * *" \
  --output table

echo "Updated Executive Orders job to run at 2:00 AM UTC"

# State Bills job - should run at 3:00 AM UTC  
# In CDT (UTC-5), 3:00 AM UTC = 10:00 PM CDT previous day
# In CST (UTC-6), 3:00 AM UTC = 9:00 PM CST previous day
# Cron expression: "0 3 * * *" for 3:00 AM UTC
az containerapp job update \
  --name job-state-bills-nightly \
  --resource-group rg-legislation-tracker \
  --cron-expression "0 3 * * *" \
  --output table

echo "Updated State Bills job to run at 3:00 AM UTC"

echo ""
echo "Current job configurations:"
az containerapp job show \
  --name job-executive-orders-nightly \
  --resource-group rg-legislation-tracker \
  --query "properties.configuration.triggerType" \
  -o json

az containerapp job show \
  --name job-state-bills-nightly \
  --resource-group rg-legislation-tracker \
  --query "properties.configuration.triggerType" \
  -o json

echo ""
echo "Schedule fix complete!"
echo ""
echo "Note: Azure Container Apps uses UTC for cron schedules by default."
echo "Executive Orders: 2:00 AM UTC = 9:00 PM CDT (previous day) / 8:00 PM CST (previous day)"
echo "State Bills: 3:00 AM UTC = 10:00 PM CDT (previous day) / 9:00 PM CST (previous day)"