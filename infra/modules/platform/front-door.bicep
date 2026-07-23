// Placeholder: Azure Front Door (WAF) in front of Container Apps.
// Phase 1 stub — no origin or WAF policy yet.

param namePrefix string
param environment string

var profileName = 'afd-${namePrefix}-${environment}'
var endpointHostName = '${namePrefix}-${environment}.z01.azurefd.net'

output profileName string = profileName
output endpointHostName string = endpointHostName
output notes string = 'STUB: Front Door + WAF policy; origin = Container Apps FQDN; TLS + rate limits.'
