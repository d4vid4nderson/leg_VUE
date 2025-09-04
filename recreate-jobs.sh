#!/bin/bash

# Recreate State Bills Nightly Job
az containerapp job create \
  --name job-state-bills-nightly \
  --resource-group rg-legislation-tracker \
  --environment managedEnvironment-rglegislationt-85f2 \
  --trigger-type Schedule \
  --cron-expression "0 3 * * *" \
  --replica-timeout 3600 \
  --replica-retry-limit 3 \
  --parallelism 1 \
  --replica-completion-count 1 \
  --image moregroupdev.azurecr.io/legis-vue-backend:1144 \
  --cpu 1.0 \
  --memory 2.0Gi \
  --registry-server moregroupdev.azurecr.io \
  --secrets \
    azure-endpoint=string="${AZURE_ENDPOINT}" \
    azure-key=string="${AZURE_KEY}" \
    azure-model-name=string="${AZURE_MODEL_NAME}" \
    azure-sql-server=string="${AZURE_SQL_SERVER}" \
    azure-sql-database=string="${AZURE_SQL_DATABASE}" \
    azure-sql-username=string="${AZURE_SQL_USERNAME}" \
    azure-sql-password=string="${AZURE_SQL_PASSWORD}" \
    legiscan-api-key=string="${LEGISCAN_API_KEY}" \
  --env-vars \
    AZURE_ENDPOINT=secretref:azure-endpoint \
    AZURE_KEY=secretref:azure-key \
    AZURE_MODEL_NAME=secretref:azure-model-name \
    AZURE_SQL_SERVER=secretref:azure-sql-server \
    AZURE_SQL_DATABASE=secretref:azure-sql-database \
    AZURE_SQL_USERNAME=secretref:azure-sql-username \
    AZURE_SQL_PASSWORD=secretref:azure-sql-password \
    LEGISCAN_API_KEY=secretref:legiscan-api-key \
    ENVIRONMENT=production \
    PYTHONUNBUFFERED=1 \
  --command python \
  --args "/app/tasks/enhanced_nightly_state_bills.py" "--production"

echo "Created job-state-bills-nightly"

# Recreate Executive Orders Nightly Job  
az containerapp job create \
  --name job-executive-orders-nightly \
  --resource-group rg-legislation-tracker \
  --environment managedEnvironment-rglegislationt-85f2 \
  --trigger-type Schedule \
  --cron-expression "0 2 * * *" \
  --replica-timeout 3600 \
  --replica-retry-limit 3 \
  --parallelism 1 \
  --replica-completion-count 1 \
  --image moregroupdev.azurecr.io/legis-vue-backend:1144 \
  --cpu 1.0 \
  --memory 2.0Gi \
  --registry-server moregroupdev.azurecr.io \
  --secrets \
    azure-endpoint=string="${AZURE_ENDPOINT}" \
    azure-key=string="${AZURE_KEY}" \
    azure-model-name=string="${AZURE_MODEL_NAME}" \
    azure-sql-server=string="${AZURE_SQL_SERVER}" \
    azure-sql-database=string="${AZURE_SQL_DATABASE}" \
    azure-sql-username=string="${AZURE_SQL_USERNAME}" \
    azure-sql-password=string="${AZURE_SQL_PASSWORD}" \
    legiscan-api-key=string="${LEGISCAN_API_KEY}" \
  --env-vars \
    AZURE_ENDPOINT=secretref:azure-endpoint \
    AZURE_KEY=secretref:azure-key \
    AZURE_MODEL_NAME=secretref:azure-model-name \
    AZURE_SQL_SERVER=secretref:azure-sql-server \
    AZURE_SQL_DATABASE=secretref:azure-sql-database \
    AZURE_SQL_USERNAME=secretref:azure-sql-username \
    AZURE_SQL_PASSWORD=secretref:azure-sql-password \
    LEGISCAN_API_KEY=secretref:legiscan-api-key \
    ENVIRONMENT=production \
    PYTHONUNBUFFERED=1 \
  --command python \
  --args "/app/tasks/nightly_executive_orders.py"

echo "Created job-executive-orders-nightly"

echo "Both jobs recreated successfully with image 1144"