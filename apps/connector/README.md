# ExitProof Hybrid Connector

Windows-oriented **outbound-only** agent that reads on-prem Active Directory
(read-only LDAP/AD) and posts heartbeats + directory snapshots to the ExitProof
platform over HTTPS with **client-certificate (mTLS)** authentication.

This package is a **Phase 4 foundation skeleton**. It does not ship an MSI yet;
see [INSTALL.md](./INSTALL.md) for PowerShell install steps and
[`docs/connectors/hybrid-ad.md`](../../docs/connectors/hybrid-ad.md) for the agent protocol.

## Layout

```
apps/connector/
  src/
    index.ts           # service entry / CLI (--once heartbeat|snapshot)
    config.ts          # env configuration
    auth/client-cert.ts# mTLS client stub (PFX / thumbprint headers for demo)
    heartbeat.ts       # outbound heartbeat loop
    protocol.ts        # HTTPS register / heartbeat / snapshot client
    ad/
      query.ts         # read-only AD query interface
      mock.ts          # CI / demo mock directory (no domain join required)
      ldap.ts          # Windows LDAP stub (not wired in CI)
  INSTALL.md           # PowerShell runbook (MSI later)
  package.json
```

## Security invariants

- **Outbound HTTPS only** — no inbound listener
- **Client cert auth** — platform can revoke thumbprint instantly
- **Read-only AD** — no password hashes; OU-scoped queries
- **Tenant-scoped** — `tenant_id` must match registered connector

## Quick start (demo / CI)

```bash
cd apps/connector
npm install
npm run dev -- --once heartbeat
```

Environment (see `.env.example`):

| Variable | Purpose |
|----------|---------|
| `EXITPROOF_API_BASE` | Platform URL (e.g. `http://localhost:3000`) |
| `EXITPROOF_TENANT_ID` | Immutable tenant UUID |
| `EXITPROOF_CONNECTOR_ID` | Registered connector id |
| `EXITPROOF_CERT_THUMBPRINT` | Client cert SHA-256 thumbprint (hex) |
| `EXITPROOF_REGISTRATION_TOKEN` | Bearer token from provision |
| `EXITPROOF_AD_MODE` | `mock` (default/CI) or `ldap` (Windows) |
| `EXITPROOF_OU_SCOPES` | Comma-separated DN bases |

Demo credentials match the Next.js demo store:

- Connector ID: `demo-ad-connector-1`
- Token: `demo-connector-token`
- Thumbprint: `aaaaaaaa…` (64 hex a's)

## Windows service (later)

MSI + `sc.exe` / NSSM packaging is deferred. Use `INSTALL.md` PowerShell
steps to run under Task Scheduler or as a temporary service wrapper.
