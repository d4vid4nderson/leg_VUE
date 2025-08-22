# Azure Nightly Automation Setup Guide

This guide explains how to set up automated nightly processing for PoliticalVue using Azure Container Jobs instead of local containers.

## Overview

Your automation has been moved from local containers to Azure Container Jobs that run in your production environment:

- **Executive Orders**: Fetches new orders daily at 2:00 AM UTC
- **State Bills**: Checks for updates daily at 3:00 AM UTC

## Architecture

```
Azure Container Apps Environment
├── legis-vue-backend (main app)
├── legis-vue-frontend (main app)
├── job-executive-orders-nightly (scheduled job)
└── job-state-bills-nightly (scheduled job)
```

## Files Created

1. **`azure-scheduler-jobs.bicep`** - Infrastructure as Code template
2. **`backend/tasks/nightly_executive_orders.py`** - Executive order job script
3. **`backend/tasks/nightly_state_bills.py`** - State bills job script
4. **`deploy-scheduler-jobs.sh`** - Deployment script

## Deployment Steps

### 1. Build and Push Updated Images

Your existing Azure DevOps pipeline already handles this. The scheduler scripts are included in the backend image.

### 2. Deploy Container Jobs

```bash
# Make sure you're logged into Azure CLI
az login

# Deploy the jobs
./deploy-scheduler-jobs.sh
```

### 3. Verify Deployment

```bash
# Check job status
az containerapp job show --name job-executive-orders-nightly --resource-group rg-legislation-tracker
az containerapp job show --name job-state-bills-nightly --resource-group rg-legislation-tracker

# View execution history
az containerapp job execution list --name job-executive-orders-nightly --resource-group rg-legislation-tracker
```

## Manual Testing

You can trigger jobs manually for testing:

```bash
# Test executive orders job
az containerapp job start --name job-executive-orders-nightly --resource-group rg-legislation-tracker

# Test state bills job
az containerapp job start --name job-state-bills-nightly --resource-group rg-legislation-tracker
```

## Monitoring

### View Job Logs

```bash
# Get latest execution
EXECUTION_NAME=$(az containerapp job execution list --name job-executive-orders-nightly --resource-group rg-legislation-tracker --query "[0].name" -o tsv)

# View logs
az containerapp job execution logs show --name job-executive-orders-nightly --resource-group rg-legislation-tracker --job-execution-name $EXECUTION_NAME
```

### Job Status

Jobs run automatically on schedule:
- **Executive Orders**: Daily at 2:00 AM UTC (8:00 PM CST previous day)
- **State Bills**: Daily at 3:00 AM UTC (9:00 PM CST previous day)

## Benefits of Azure Container Jobs

1. **Cost Effective**: Only runs when scheduled (no 24/7 containers)
2. **Scalable**: Azure manages resources automatically
3. **Reliable**: Built-in retry logic and monitoring
4. **Secure**: Uses Azure Key Vault for secrets
5. **Integrated**: Same environment as your main application

## Environment Variables

Jobs automatically get secrets from Azure Key Vault:
- `AZURE_ENDPOINT` - AI service endpoint
- `AZURE_KEY` - AI service key
- `AZURE_SQL_*` - Database connection info
- `LEGISCAN_API_KEY` - LegiScan API access

## Troubleshooting

### Job Failed to Start
```bash
# Check job configuration
az containerapp job show --name job-executive-orders-nightly --resource-group rg-legislation-tracker

# Check if secrets are accessible
az keyvault secret list --vault-name kv-legislation-tracker
```

### Job Execution Failed
```bash
# Check execution logs
az containerapp job execution list --name job-executive-orders-nightly --resource-group rg-legislation-tracker
az containerapp job execution logs show --name job-executive-orders-nightly --resource-group rg-legislation-tracker --job-execution-name <execution-name>
```

### Update Schedule
To change the schedule, modify the `cronExpression` in `azure-scheduler-jobs.bicep` and redeploy:

```bicep
scheduleTriggerConfig: {
  cronExpression: '0 2 * * *' // 2:00 AM UTC daily
  parallelism: 1
  completions: 1
}
```

## Migration from Local

Your local schedulers can be stopped since the Azure jobs are now handling the automation:

```bash
# Stop local containers
docker-compose down

# The Azure jobs will continue running in production
```

## Next Steps

1. Deploy the jobs using the deployment script
2. Monitor the first few executions
3. Verify data is being updated in production
4. Stop local schedulers to avoid duplication

The automation will now run reliably in Azure without requiring your local machine to be running!