// ExitProof shared Azure platform (Phase 1 skeleton — not production-ready).
// Composes placeholder modules for Container Apps, SQL, Blob, Key Vault, Front Door.
// Deploy with: az deployment sub create --template-file main.bicep --parameters ...

targetScope = 'subscription'

@description('Azure region for shared platform resources')
param location string = 'eastus'

@description('Name prefix for shared resources (e.g. ep-gl-shared)')
param namePrefix string = 'ep-gl-shared'

@description('Environment tag: dev | staging | prod')
param environment string = 'dev'

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: 'rg-${namePrefix}-${environment}'
  location: location
  tags: {
    product: 'exitproof'
    operator: 'gridlogic'
    environment: environment
  }
}

module containerApps 'modules/platform/container-apps.bicep' = {
  name: 'platform-container-apps'
  scope: rg
  params: {
    location: location
    namePrefix: namePrefix
    environment: environment
  }
}

module azureSql 'modules/platform/azure-sql.bicep' = {
  name: 'platform-azure-sql'
  scope: rg
  params: {
    location: location
    namePrefix: namePrefix
    environment: environment
  }
}

module blob 'modules/platform/blob.bicep' = {
  name: 'platform-blob'
  scope: rg
  params: {
    location: location
    namePrefix: namePrefix
    environment: environment
  }
}

module keyVault 'modules/platform/key-vault.bicep' = {
  name: 'platform-key-vault'
  scope: rg
  params: {
    location: location
    namePrefix: namePrefix
    environment: environment
  }
}

module frontDoor 'modules/platform/front-door.bicep' = {
  name: 'platform-front-door'
  scope: rg
  params: {
    namePrefix: namePrefix
    environment: environment
  }
}

output resourceGroupName string = rg.name
output containerAppName string = containerApps.outputs.appName
output sqlServerName string = azureSql.outputs.serverName
output storageAccountName string = blob.outputs.storageAccountName
output keyVaultName string = keyVault.outputs.vaultName
output frontDoorEndpoint string = frontDoor.outputs.endpointHostName
