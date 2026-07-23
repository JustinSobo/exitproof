// Dedicated SKU: per-customer resource group (high-assurance / CMMC-sensitive).
// Phase 1 stub — full isolation of app (optional), SQL, storage, Key Vault.

param location string = 'eastus'

@description('Immutable ExitProof tenant UUID')
param tenantId string

@description('Short customer slug for resource names (alphanumeric)')
param customerSlug string

@description('Customer Entra directory (tenant) ID')
param entraTenantId string

@description('Whether to deploy an isolated Container App (vs shared web)')
param deployIsolatedApp bool = false

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: 'rg-exitproof-${customerSlug}'
  location: location
  tags: {
    product: 'exitproof'
    operator: 'gridlogic'
    sku: 'dedicated'
    tenant_id: tenantId
    entra_tenant_id: entraTenantId
  }
}

var sqlServerName = 'sql-ep-${customerSlug}'
var storageAccountName = take(replace('step${customerSlug}', '-', ''), 24)
var vaultName = take('kv-ep-${customerSlug}', 24)
var appName = deployIsolatedApp ? 'ca-ep-${customerSlug}' : ''

output resourceGroupName string = rg.name
output tenantId string = tenantId
output entraTenantId string = entraTenantId
output sqlServerName string = sqlServerName
output storageAccountName string = storageAccountName
output keyVaultName string = vaultName
output containerAppName string = appName
output notes string = 'STUB: Dedicated RG placeholders only — expand to real SQL/Blob/KV/App modules before deploy.'
