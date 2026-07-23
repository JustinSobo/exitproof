# Hybrid Connector — PowerShell install runbook

**Audience:** GridLogic engineers installing on a domain-joined management server.  
**Status:** Phase 4 foundation — MSI packaging comes later; use these steps now.

## Prerequisites

- Windows Server 2019+ (or Windows 10/11 management jump host), domain-joined
- Node.js 20 LTS (x64) — temporary runtime until MSI ships a self-contained build
- Outbound HTTPS (443) to ExitProof platform / Azure Front Door — **no inbound holes**
- Read-only AD bind account (deny DC replication / Domain Admin)
- Client certificate (PFX) issued at customer provision + registration token

## 1. Create service account (read-only)

```powershell
# Run on a DC / with AD rights — example only; adjust OU and naming.
New-ADUser -Name "svc-exitproof-ad" `
  -SamAccountName "svc-exitproof-ad" `
  -UserPrincipalName "svc-exitproof-ad@contoso.local" `
  -AccountPassword (Read-Host -AsSecureString "Password") `
  -Enabled $true `
  -PasswordNeverExpires $true `
  -CannotChangePassword $true

# Grant only: List Contents + Read all properties on scoped OUs (delegate via GUI
# or dsacls). Do NOT add to Domain Admins / Account Operators / replicating groups.
```

## 2. Install Node runtime (until MSI)

```powershell
# Example: winget (admin)
winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
node -v   # expect v20+
```

## 3. Deploy connector files

```powershell
$InstallRoot = "C:\Program Files\ExitProof\HybridConnector"
New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null
# Copy release drop (zip from GridLogic) into $InstallRoot
Set-Location $InstallRoot
npm ci --omit=dev
npm run build
```

## 4. Install client certificate

```powershell
# Import PFX into Local Machine\My (service account needs read on private key)
$pfxPath = "C:\Secure\exitproof-connector.pfx"
$secure = Read-Host -AsSecureString "PFX password"
Import-PfxCertificate -FilePath $pfxPath `
  -CertStoreLocation Cert:\LocalMachine\My `
  -Password $secure

# Note SHA-256 thumbprint (no colons, lowercase) for EXITPROOF_CERT_THUMBPRINT
Get-ChildItem Cert:\LocalMachine\My | Where-Object Subject -Match "ExitProof" |
  Select-Object Subject, Thumbprint
```

## 5. Configure environment

```powershell
$EnvFile = "C:\ProgramData\ExitProof\connector.env"
New-Item -ItemType Directory -Force -Path (Split-Path $EnvFile) | Out-Null
@"
EXITPROOF_API_BASE=https://exitproof.gridlogic.example
EXITPROOF_TENANT_ID=<tenant-uuid>
EXITPROOF_ORG_ID=<org-uuid>
EXITPROOF_CONNECTOR_ID=<connector-uuid>
EXITPROOF_CERT_THUMBPRINT=<sha256-hex>
EXITPROOF_REGISTRATION_TOKEN=<from-provision>
EXITPROOF_AD_MODE=ldap
EXITPROOF_OU_SCOPES=OU=Users,DC=contoso,DC=local
EXITPROOF_HEARTBEAT_SECONDS=60
"@ | Set-Content -Path $EnvFile -Encoding UTF8
# ACL: only Administrators + svc-exitproof-ad
icacls $EnvFile /inheritance:r /grant:r "BUILTIN\Administrators:F" "CONTOSO\svc-exitproof-ad:R"
```

## 6. Register with platform (one-time)

```powershell
# From GridLogic laptop or the host (outbound HTTPS)
$body = @{
  tenant_id           = $env:EXITPROOF_TENANT_ID
  org_id              = $env:EXITPROOF_ORG_ID
  hostname            = $env:COMPUTERNAME
  cert_thumbprint     = $env:EXITPROOF_CERT_THUMBPRINT
  registration_token  = $env:EXITPROOF_REGISTRATION_TOKEN
  ou_scopes           = @($env:EXITPROOF_OU_SCOPES)
  agent_version       = "0.1.0"
} | ConvertTo-Json

Invoke-RestMethod -Method POST `
  -Uri "$($env:EXITPROOF_API_BASE)/api/connectors/ad/register" `
  -Headers @{ Authorization = "Bearer $env:CONNECTOR_PROVISION_SECRET" } `
  -ContentType "application/json" `
  -Body $body
```

## 7. Run under Task Scheduler (interim “service”)

```powershell
$Action = New-ScheduledTaskAction `
  -Execute "C:\Program Files\nodejs\node.exe" `
  -Argument "`"C:\Program Files\ExitProof\HybridConnector\dist\index.js`"" `
  -WorkingDirectory "C:\Program Files\ExitProof\HybridConnector"

$Trigger = New-ScheduledTaskTrigger -AtStartup
$Principal = New-ScheduledTaskPrincipal `
  -UserId "CONTOSO\svc-exitproof-ad" `
  -LogonType Password `
  -RunLevel Highest

Register-ScheduledTask -TaskName "ExitProofHybridConnector" `
  -Action $Action -Trigger $Trigger -Principal $Principal `
  -Description "ExitProof outbound Hybrid AD connector (heartbeat + snapshots)"
```

Load `connector.env` from the process wrapper or set machine-level env vars before start.

## 8. Verify

```powershell
# Heartbeat once
node .\dist\index.js --once heartbeat

# Mock/CI AD snapshot (or ldap when EXITPROOF_AD_MODE=ldap)
node .\dist\index.js --once snapshot
```

Platform case UI should show AD account status; hybrid mismatch when cloud disabled / AD enabled.

## 9. Revoke (incident)

GridLogic marks connector `revoked` (cert thumbprint) in control plane. Agent heartbeats receive `403` + `stop: true` and must exit. Remove PFX from the host:

```powershell
Get-ChildItem Cert:\LocalMachine\My | Where-Object Thumbprint -EQ "<THUMB>" | Remove-Item
Unregister-ScheduledTask -TaskName "ExitProofHybridConnector" -Confirm:$false
```

## Firewall checklist

| Direction | Port | Destination | Required |
|-----------|------|-------------|----------|
| Outbound | 443 | ExitProof API / Front Door | Yes |
| Outbound | 389/636 | Domain controllers (LDAP/LDAPS) | Yes (local) |
| Inbound | * | — | **No** |

## MSI (later)

Future release: signed MSI installs service `ExitProofHybridConnector`, embeds Node runtime or .NET single-file, manages cert ACL + env via GridLogic provision wizard. Until then, this PowerShell runbook is authoritative.
