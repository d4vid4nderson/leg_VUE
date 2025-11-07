# Azure Managed Identity Setup Guide

## Overview
This guide walks you through configuring Managed Identity for your Container App to securely trigger Azure Container App Jobs without storing credentials.

## What Changed
✅ **Replaced**: Azure CLI subprocess calls
✅ **With**: Azure SDK with DefaultAzureCredential (Managed Identity)
✅ **Added**: Azure SDK dependencies to requirements.txt

## Prerequisites
- Azure subscription with Container Apps deployed
- Azure Portal access with appropriate permissions
- Resource Group: `rg-legislation-tracker`
- Container App: `legis-vue-backend`
- Jobs: `job-executive-orders-nightly`, `job-state-bills-nightly`

---

## Step 1: Enable Managed Identity on Container App

### Option A: Using Azure Portal (Recommended)

1. **Navigate to your Container App**
   - Go to [Azure Portal](https://portal.azure.com)
   - Search for "Container Apps"
   - Select `legis-vue-backend`

2. **Enable System-Assigned Managed Identity**
   - In the left menu, click **"Identity"**
   - Under **"System assigned"** tab
   - Toggle **Status** to **"On"**
   - Click **"Save"**
   - Click **"Yes"** to confirm

3. **Copy the Object (principal) ID**
   - After saving, you'll see an **Object (principal) ID**
   - **Copy this ID** - you'll need it in Step 2

### Option B: Using Azure CLI

```bash
# Enable managed identity
az containerapp identity assign \
  --name legis-vue-backend \
  --resource-group rg-legislation-tracker \
  --system-assigned

# Get the principal ID (save this for next step)
az containerapp identity show \
  --name legis-vue-backend \
  --resource-group rg-legislation-tracker \
  --query principalId \
  --output tsv
```

---

## Step 2: Grant Permissions to Start Jobs

Your Container App's managed identity needs permission to start and monitor the Container App Jobs.

### Option A: Using Azure Portal (Recommended)

1. **Navigate to Resource Group**
   - Go to `rg-legislation-tracker`
   - Click **"Access control (IAM)"** in left menu

2. **Add Role Assignment**
   - Click **"+ Add"** → **"Add role assignment"**

3. **Select Role**
   - Select the **"Role"** tab
   - Search for and select **"Contributor"**
   - Click **"Next"**

   > **Note**: For more granular permissions, you can create a custom role with only these permissions:
   > - `Microsoft.App/jobs/start/action`
   > - `Microsoft.App/jobs/executions/read`
   > - `Microsoft.App/jobs/read`

4. **Assign to Managed Identity**
   - Select **"Managed identity"**
   - Click **"+ Select members"**
   - Under **"Managed identity"**, select **"Container App"**
   - Select **`legis-vue-backend`**
   - Click **"Select"**

5. **Review and Assign**
   - Click **"Review + assign"**
   - Click **"Review + assign"** again to confirm

### Option B: Using Azure CLI

```bash
# Get the subscription ID
SUBSCRIPTION_ID=$(az account show --query id --output tsv)

# Get the principal ID of the managed identity
PRINCIPAL_ID=$(az containerapp identity show \
  --name legis-vue-backend \
  --resource-group rg-legislation-tracker \
  --query principalId \
  --output tsv)

# Assign Contributor role at resource group level
az role assignment create \
  --assignee $PRINCIPAL_ID \
  --role "Contributor" \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/rg-legislation-tracker"
```

---

## Step 3: Add Environment Variable

The backend code needs your Azure Subscription ID to connect to the Azure SDK.

### Option A: Using Azure Portal (Recommended)

1. **Navigate to Container App**
   - Go to `legis-vue-backend`
   - Click **"Containers"** in left menu
   - Click on your container

2. **Add Environment Variable**
   - Scroll to **"Environment variables"** section
   - Click **"+ Add"**
   - **Name**: `AZURE_SUBSCRIPTION_ID`
   - **Source**: **"Manual entry"**
   - **Value**: Your Azure Subscription ID
     - To find it: Portal home → Subscriptions → Copy the ID

3. **Save Changes**
   - Click **"Save"** at the bottom
   - The container will restart automatically

### Option B: Using Azure CLI

```bash
# Get your subscription ID
SUBSCRIPTION_ID=$(az account show --query id --output tsv)

# Add environment variable (this will create a new revision)
az containerapp update \
  --name legis-vue-backend \
  --resource-group rg-legislation-tracker \
  --set-env-vars AZURE_SUBSCRIPTION_ID=$SUBSCRIPTION_ID
```

---

## Step 4: Deploy Updated Code

Now that Azure is configured, deploy your updated backend code with the new Azure SDK dependencies.

### Check if you need to rebuild

Your Container App likely uses one of these deployment methods:
- **Docker Container Registry** (most common)
- **GitHub Actions**
- **Azure Container Apps deployment**

### Option A: Docker Container Registry

If your app uses a container registry (ACR or Docker Hub):

```bash
# Navigate to backend directory
cd /Users/david.anderson/Downloads/PoliticalVue/backend

# Build new Docker image
docker build -t your-registry.azurecr.io/legis-vue-backend:latest .

# Push to registry
docker push your-registry.azurecr.io/legis-vue-backend:latest

# Update Container App to pull new image
az containerapp update \
  --name legis-vue-backend \
  --resource-group rg-legislation-tracker \
  --image your-registry.azurecr.io/legis-vue-backend:latest
```

### Option B: GitHub Actions

If you have CI/CD set up:

1. Commit and push your changes:
```bash
git add backend/main.py backend/requirements.txt
git commit -m "Implement Managed Identity for Azure job triggering"
git push origin DRKMD05
```

2. Merge your PR to main branch
3. GitHub Actions will automatically deploy

---

## Step 5: Verify the Setup

### Test Job Triggering

1. **Open your application**
   - Navigate to the Settings/Admin page
   - Click **"Run Executive Orders Job"** or **"Run State Bills Job"**

2. **Check the response**
   - ✅ Success: `"Azure Container App Job started successfully"`
   - ❌ Failure: See troubleshooting below

### Check Container Logs

```bash
# View backend logs
az containerapp logs show \
  --name legis-vue-backend \
  --resource-group rg-legislation-tracker \
  --follow

# Look for these messages:
# ✅ "Azure Container App Job execution requested: executive-orders"
# ✅ "Starting Azure Container App Job: job-executive-orders-nightly"
# ✅ "Azure Container App Job job-executive-orders-nightly started with execution: ..."
```

---

## Troubleshooting

### Error: "Azure subscription ID not configured"

**Problem**: `AZURE_SUBSCRIPTION_ID` environment variable not set.

**Solution**:
- Follow Step 3 to add the environment variable
- Restart the Container App

### Error: "ManagedIdentityCredential authentication unavailable"

**Problem**: Managed Identity not enabled or not propagated yet.

**Solution**:
- Verify Step 1 was completed
- Wait 2-3 minutes for Azure to propagate the identity
- Restart the Container App

### Error: "AuthorizationFailed" or "Forbidden"

**Problem**: Managed identity doesn't have permission to start jobs.

**Solution**:
- Verify Step 2 was completed correctly
- Check the principal ID matches between Steps 1 and 2
- Wait 2-3 minutes for permissions to propagate

### Error: "ModuleNotFoundError: No module named 'azure'"

**Problem**: Azure SDK packages not installed in container.

**Solution**:
- Verify Step 4 was completed
- Rebuild and redeploy the Docker image
- Check that requirements.txt includes the Azure packages

### Jobs still fail with "Please run 'az login'"

**Problem**: Old code is still running (cache or old deployment).

**Solution**:
1. Verify your changes were deployed:
```bash
az containerapp revision list \
  --name legis-vue-backend \
  --resource-group rg-legislation-tracker \
  --query "[0].{name:name,created:properties.createdTime,active:properties.active}"
```

2. Force a new revision:
```bash
az containerapp update \
  --name legis-vue-backend \
  --resource-group rg-legislation-tracker \
  --force-restart
```

---

## Verification Checklist

Before testing, verify all these are complete:

- [ ] Managed Identity enabled on `legis-vue-backend` (Step 1)
- [ ] Contributor role assigned to managed identity (Step 2)
- [ ] `AZURE_SUBSCRIPTION_ID` environment variable set (Step 3)
- [ ] Updated code deployed to Azure (Step 4)
- [ ] Container App restarted with new code
- [ ] Wait 2-3 minutes for Azure permissions to propagate

---

## Security Benefits

✅ **No stored credentials**: No client secrets or passwords in environment variables
✅ **Automatic rotation**: Azure manages credential lifecycle
✅ **Audit trail**: All actions logged with managed identity principal
✅ **Least privilege**: Can grant specific permissions only
✅ **Azure-native**: Follows Azure security best practices

---

## Next Steps

After successful deployment:

1. **Test both jobs**
   - Executive Orders job
   - State Bills job

2. **Monitor execution**
   - Check Automation Report page
   - Verify jobs complete successfully

3. **Remove old credentials**
   - If you had any Azure CLI credentials stored, remove them
   - Clean up any temporary authentication methods

---

## Support

If you encounter issues:

1. Check Azure Portal logs for the Container App
2. Review this troubleshooting guide
3. Verify all checklist items are complete
4. Check Azure service health status

---

**Last Updated**: November 5, 2025
**Author**: Claude Code
**Version**: 1.0
