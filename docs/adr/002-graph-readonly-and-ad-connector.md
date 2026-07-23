# ADR-002: Microsoft Graph read-only and AD Hybrid Connector

**Status:** Accepted  
**Date:** 2026-07-23  
**Deciders:** ExitProof / GridLogic product & security  
**Related:** [CHARTER.md](../CHARTER.md), [ADR-001](001-tenancy-and-azure.md)

## Context

Customers need directory truth for offboarding audit: Entra account state, audit events, and (often) on-prem AD still enabled after cloud disable. GridLogic must connect to customer environments without:

- Broad write/destructive Graph scopes in early phases
- Inbound firewall holes into customer networks
- Silent IdP revoke that customers cannot explain to auditors

Write/disable automation is valuable later but must not undermine trust in the read-only audit path.

## Decision

### 1. Entra: multi-tenant app + admin consent

GridLogic registers a **multi-tenant Entra application**. Each customer grants **admin consent**, creating an Enterprise Application in the customer’s tenant.

- Bind customer Entra **tenant ID** at provision time (required)
- Store per-tenant credentials/certs in Azure Key Vault; workers use managed identity + tenant-scoped secrets
- Refresh via client credentials; handle consent revocation / continuous access evaluation

### 2. Microsoft Graph: read-only until Phase 7

**In scope (Phases 3–6) — application permissions, least privilege for offboarding audit:**

| Permission | Purpose |
|------------|---------|
| `User.Read.All` | Account enabled/disabled, licenses |
| `Directory.Read.All` (or narrower group/role reads) | Group/role membership context |
| `AuditLog.Read.All` / `DirectoryAudits.Read.All` | Disable/delete events |
| `UserAuthenticationMethod.Read.All` | MFA method presence (optional, sensitive) |
| `Device.Read.All` | Device ownership (optional) |

**Explicitly out of scope until Phase 7 (separate charter):**

- `User.ReadWrite.All` and any write/disable/revoke session APIs
- Mailbox wipe, Intune wipe, password reset automation
- Silent checklist auto-complete that implies IdP action occurred

Manual checklist remains the source of truth for revocation actions through Phase 6.

**Product features enabled by RO Graph:**

1. Directory snapshot (scheduled / on-demand)
2. Diff vs checklist (“Entra still Enabled=true”)
3. Optional auto-evidence (Graph JSON/PDF + SHA-256) when add-on enabled
4. Consent health / connector status per tenant

### 3. On-prem AD: outbound Hybrid Connector with mTLS

**Pattern:** Windows service (“ExitProof Connector”) on a domain-joined management server.

| Property | Spec |
|----------|------|
| Direction | **Outbound HTTPS only** to GridLogic endpoint — no inbound holes |
| Auth | Client certificate (**mTLS**); issued at provisioning; rotatable; instant revoke |
| Directory access | **Read-only** LDAP/AD |
| Attributes | Minimal: userAccountControl, memberOf, lastLogon, computer objects; **no password hashes** |
| Scope | Configurable OUs; deny DC replication rights |
| Ops | Heartbeats, auto-update channel, GridLogic cert revoke ≤5 minutes stop sync |

**Product features:** AD account status on case; optional AD auto-evidence (LDIF/CSV + hash); hybrid mismatch alerts (cloud disabled / on-prem still enabled).

### 4. Auto-evidence remains optional and labeled

When `auto_evidence_enabled` (or SKU add-on) is on:

- Jobs snapshot Graph/AD → hashed blob → link to step → audit `evidence.auto_collected`
- Label as **system-collected snapshot** — never claim certification
- Critical steps still require human attest (policy in Phase 5)

### 5. Phase gate for write path

**Phase 7** (future, separate charter) may introduce dual-control Graph disable/revoke **only after** read-only trust is proven (pen test, consent UX, revoke drills, customer runbooks).

## Consequences

### Positive

- Least-privilege Graph story for security reviews and admin consent language
- Customers keep inbound firewall closed (outbound-only connector)
- Clear sales packaging: Cloud Directory Audit / Hybrid AD Audit add-ons
- Avoids premature destructive automation that auditors cannot trust

### Negative / follow-ups

- Hybrid mismatch still requires human action until Phase 7
- Connector install/runbook and cert lifecycle are operational load for GridLogic
- Optional MFA/device Graph scopes need explicit customer justification (sensitive)
- Must document admin consent and DPA subprocessors ([dpa-notes.md](../commercial/dpa-notes.md))

### Non-decisions (deferred)

- Exact Graph SDK and caching/TTL for snapshots — Phase 3 design
- Connector protocol framing (HTTP long-poll vs websocket) — Phase 4 design
- Dual-control UX for write path — Phase 7 charter

## Security notes

Directory snapshots and auto-evidence inherit **Restricted** classification. Connector compromise is a high-impact threat—cert revoke, OU scoping, and no password-hash collection are mandatory ([threat model](../security/threat-model.md)).
