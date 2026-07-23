// Placeholder: Azure Container Apps (or App Service) for Next.js web + API.
// Phase 1 stub — no real container image / env wiring yet.

param location string
param namePrefix string
param environment string

@description('Container Apps environment stub name')
var envName = 'cae-${namePrefix}-${environment}'
var appName = 'ca-${namePrefix}-web-${environment}'

// Intentionally empty stub: real Microsoft.App resources land when Azure deploy is wired.
output appName string = appName
output environmentName string = envName
output notes string = 'STUB: provision Container Apps env + Next.js revision; wire managed identity to Key Vault/SQL/Blob.'
