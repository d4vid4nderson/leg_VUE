@description('Azure Container Jobs for PoliticalVue Nightly Automation')
param location string = resourceGroup().location
param containerAppEnvironmentName string = 'legis-vue'
param acrName string = 'moregroupdev'
param keyVaultName string = 'kv-legislation-tracker'
param backendImageName string = 'legis-vue-backend:latest'

// Get existing Container App Environment
resource containerAppEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' existing = {
  name: containerAppEnvironmentName
}

// Get existing Key Vault for secrets
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

// Executive Order Nightly Job
resource executiveOrderJob 'Microsoft.App/jobs@2024-03-01' = {
  name: 'job-executive-orders-nightly'
  location: location
  properties: {
    environmentId: containerAppEnvironment.id
    configuration: {
      scheduleTriggerConfig: {
        cronExpression: '0 2 * * *' // 2:00 AM UTC daily
        parallelism: 1
        replicaCompletionCount: 1
      }
      triggerType: 'Schedule'
      replicaTimeout: 1800 // 30 minutes
      replicaRetryLimit: 3
      secrets: [
        {
          name: 'azure-endpoint'
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/AZURE-ENDPOINT'
          identity: 'system'
        }
        {
          name: 'azure-key'
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/AZURE-KEY'
          identity: 'system'
        }
        {
          name: 'azure-model-name'
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/AZURE-MODEL-NAME'
          identity: 'system'
        }
        {
          name: 'azure-sql-server'
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/AZURE-SQL-SERVER'
          identity: 'system'
        }
        {
          name: 'azure-sql-database'
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/AZURE-SQL-DATABASE'
          identity: 'system'
        }
        {
          name: 'azure-sql-username'
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/AZURE-SQL-USERNAME'
          identity: 'system'
        }
        {
          name: 'azure-sql-password'
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/AZURE-SQL-PASSWORD'
          identity: 'system'
        }
      ]
      registries: [
        {
          server: '${acrName}.azurecr.io'
          identity: 'system'
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'executive-order-scheduler'
          image: '${acrName}.azurecr.io/${backendImageName}'
          command: ['python']
          args: ['/app/tasks/nightly_executive_orders.py']
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'AZURE_ENDPOINT'
              secretRef: 'azure-endpoint'
            }
            {
              name: 'AZURE_KEY'
              secretRef: 'azure-key'
            }
            {
              name: 'AZURE_MODEL_NAME'
              secretRef: 'azure-model-name'
            }
            {
              name: 'AZURE_SQL_SERVER'
              secretRef: 'azure-sql-server'
            }
            {
              name: 'AZURE_SQL_DATABASE'
              secretRef: 'azure-sql-database'
            }
            {
              name: 'AZURE_SQL_USERNAME'
              secretRef: 'azure-sql-username'
            }
            {
              name: 'AZURE_SQL_PASSWORD'
              secretRef: 'azure-sql-password'
            }
            {
              name: 'ENVIRONMENT'
              value: 'production'
            }
            {
              name: 'PYTHONUNBUFFERED'
              value: '1'
            }
          ]
        }
      ]
    }
  }
  identity: {
    type: 'SystemAssigned'
  }
}

// State Bills Nightly Job
resource stateBillsJob 'Microsoft.App/jobs@2024-03-01' = {
  name: 'job-state-bills-nightly'
  location: location
  properties: {
    environmentId: containerAppEnvironment.id
    configuration: {
      scheduleTriggerConfig: {
        cronExpression: '0 3 * * *' // 3:00 AM UTC daily
        parallelism: 1
        replicaCompletionCount: 1
      }
      triggerType: 'Schedule'
      replicaTimeout: 3600 // 1 hour
      replicaRetryLimit: 3
      secrets: [
        {
          name: 'azure-endpoint'
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/AZURE-ENDPOINT'
          identity: 'system'
        }
        {
          name: 'azure-key'
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/AZURE-KEY'
          identity: 'system'
        }
        {
          name: 'azure-model-name'
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/AZURE-MODEL-NAME'
          identity: 'system'
        }
        {
          name: 'azure-sql-server'
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/AZURE-SQL-SERVER'
          identity: 'system'
        }
        {
          name: 'azure-sql-database'
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/AZURE-SQL-DATABASE'
          identity: 'system'
        }
        {
          name: 'azure-sql-username'
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/AZURE-SQL-USERNAME'
          identity: 'system'
        }
        {
          name: 'azure-sql-password'
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/AZURE-SQL-PASSWORD'
          identity: 'system'
        }
        {
          name: 'legiscan-api-key'
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/LEGISCAN-API-KEY'
          identity: 'system'
        }
      ]
      registries: [
        {
          server: '${acrName}.azurecr.io'
          identity: 'system'
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'state-bills-scheduler'
          image: '${acrName}.azurecr.io/${backendImageName}'
          command: ['python']
          args: ['/app/tasks/enhanced_nightly_state_bills.py', '--production']
          resources: {
            cpu: json('1.0')
            memory: '2Gi'
          }
          env: [
            {
              name: 'AZURE_ENDPOINT'
              secretRef: 'azure-endpoint'
            }
            {
              name: 'AZURE_KEY'
              secretRef: 'azure-key'
            }
            {
              name: 'AZURE_MODEL_NAME'
              secretRef: 'azure-model-name'
            }
            {
              name: 'AZURE_SQL_SERVER'
              secretRef: 'azure-sql-server'
            }
            {
              name: 'AZURE_SQL_DATABASE'
              secretRef: 'azure-sql-database'
            }
            {
              name: 'AZURE_SQL_USERNAME'
              secretRef: 'azure-sql-username'
            }
            {
              name: 'AZURE_SQL_PASSWORD'
              secretRef: 'azure-sql-password'
            }
            {
              name: 'LEGISCAN_API_KEY'
              secretRef: 'legiscan-api-key'
            }
            {
              name: 'ENVIRONMENT'
              value: 'production'
            }
            {
              name: 'PYTHONUNBUFFERED'
              value: '1'
            }
          ]
        }
      ]
    }
  }
  identity: {
    type: 'SystemAssigned'
  }
}

// Grant Key Vault access to the jobs
resource executiveOrderJobKeyVaultAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: keyVault
  name: guid(keyVault.id, executiveOrderJob.id, 'Key Vault Secrets User')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') // Key Vault Secrets User
    principalId: executiveOrderJob.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource stateBillsJobKeyVaultAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: keyVault
  name: guid(keyVault.id, stateBillsJob.id, 'Key Vault Secrets User')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') // Key Vault Secrets User
    principalId: stateBillsJob.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Grant ACR pull access to the jobs
resource executiveOrderJobAcrAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: resourceGroup()
  name: guid(resourceGroup().id, executiveOrderJob.id, 'AcrPull')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d') // AcrPull
    principalId: executiveOrderJob.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource stateBillsJobAcrAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: resourceGroup()
  name: guid(resourceGroup().id, stateBillsJob.id, 'AcrPull')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d') // AcrPull
    principalId: stateBillsJob.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output executiveOrderJobName string = executiveOrderJob.name
output stateBillsJobName string = stateBillsJob.name