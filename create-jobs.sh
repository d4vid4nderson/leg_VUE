#!/bin/bash

# Create state bills nightly job
az containerapp job create \
  --name job-state-bills-nightly \
  --resource-group rg-legislation-tracker \
  --environment legis-vue \
  --trigger-type Schedule \
  --cron-expression "0 3 * * *" \
  --replica-timeout 3600 \
  --replica-retry-limit 3 \
  --parallelism 1 \
  --replica-completion-count 1 \
  --image mcr.microsoft.com/k8se/quickstart-jobs:latest \
  --cpu 1.0 \
  --memory 2.0Gi

echo "State bills job created. Now updating with correct image..."

# Update with correct command and image
az containerapp job update \
  --name job-state-bills-nightly \
  --resource-group rg-legislation-tracker \
  --container-name job-state-bills-nightly \
  --image moregroupdev.azurecr.io/legis-vue-backend:1144 \
  --command "python" "/app/tasks/enhanced_nightly_state_bills.py" "--production"

echo "State bills job updated."

# Create executive orders nightly job
az containerapp job create \
  --name job-executive-orders-nightly \
  --resource-group rg-legislation-tracker \
  --environment legis-vue \
  --trigger-type Schedule \
  --cron-expression "0 2 * * *" \
  --replica-timeout 3600 \
  --replica-retry-limit 3 \
  --parallelism 1 \
  --replica-completion-count 1 \
  --image mcr.microsoft.com/k8se/quickstart-jobs:latest \
  --cpu 1.0 \
  --memory 2.0Gi

echo "Executive orders job created. Now updating with correct image..."

# Update with correct command and image
az containerapp job update \
  --name job-executive-orders-nightly \
  --resource-group rg-legislation-tracker \
  --container-name job-executive-orders-nightly \
  --image moregroupdev.azurecr.io/legis-vue-backend:1144 \
  --command "python" "/app/tasks/nightly_executive_orders.py"

echo "Executive orders job updated."
echo "Both jobs have been recreated successfully!"