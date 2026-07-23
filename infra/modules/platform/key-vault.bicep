// Placeholder: Azure Key Vault for Graph certs, CMK refs, connector certs.
// Phase 1 stub — per-tenant secrets keyed by tenant_id.

param location string
param namePrefix string
param environment string

var vaultName = take('kv-${namePrefix}-${environment}', 24)

output vaultName string = vaultName
output notes string = 'STUB: Key Vault + purge protection; secrets path tenants/{tenant_id}/*; CMK for blob/SQL.'
