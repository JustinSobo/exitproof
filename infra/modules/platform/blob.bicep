// Placeholder: Azure Blob storage for evidence (per-tenant prefix tenants/{tenant_id}/).
// Phase 1 stub — CMK + private endpoint TBD.

param location string
param namePrefix string
param environment string

// Storage account names: 3–24 lowercase alphanumeric
var storageAccountName = take(replace('st${namePrefix}${environment}', '-', ''), 24)

output storageAccountName string = storageAccountName
output evidenceContainerName string = 'evidence'
output notes string = 'STUB: storage account + evidence container; SAS/user-delegation scoped by tenant_id prefix.'
