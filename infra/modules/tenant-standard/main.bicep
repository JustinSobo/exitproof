// Standard SKU: shared platform data plane slice for one customer tenant.
// Allocates logical isolation (schema / blob prefix / CMK name) — no dedicated RG.

param location string = 'eastus'
param namePrefix string = 'ep-gl-shared'

@description('Immutable ExitProof tenant UUID (from provision CLI / platform metadata)')
param tenantId string

@description('Customer display name')
param customerName string

@description('Customer Entra directory (tenant) ID — required for GridLogic mode')
param entraTenantId string

@description('Blob prefix for evidence isolation')
var blobPrefix = 'tenants/${tenantId}/'

@description('CMK name in shared Key Vault')
var cmkName = 'cmk-${tenantId}'

@description('SQL schema name (Azure SQL / Postgres convention)')
var schemaName = 'tenant_${replace(tenantId, '-', '_')}'

output tenantId string = tenantId
output customerName string = customerName
output entraTenantId string = entraTenantId
output blobPrefix string = blobPrefix
output cmkName string = cmkName
output schemaName string = schemaName
output notes string = 'STUB: Standard tenant slice — wire schema create + CMK + blob prefix ACLs from provision CLI.'
