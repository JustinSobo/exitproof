// Placeholder: Azure SQL for shared platform / Standard SKU tenancy.
// Phase 1 stub — private endpoint + RLS-equivalent policies come later.

param location string
param namePrefix string
param environment string

var serverName = 'sql-${namePrefix}-${environment}'
var databaseName = 'exitproof'

output serverName string = serverName
output databaseName string = databaseName
output notes string = 'STUB: Azure SQL logical server + DB; deny public access; tenant_id column isolation.'
