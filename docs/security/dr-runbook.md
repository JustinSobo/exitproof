# Disaster recovery runbook

**Status:** Phase 6 stub (procedure + targets; live Azure restore drills pending deploy)  
**Owner:** GridLogic NOC / platform  
**Related:** [CHARTER](../CHARTER.md), [ADR-001](../adr/001-tenancy-and-azure.md), [kill-switch](kill-switch.md), [key-rotation](key-rotation.md)

## Objectives

| Metric | Target (Standard SKU) | Target (Dedicated SKU) | Notes |
|--------|----------------------|------------------------|-------|
| **RPO** | ≤ 24 hours | ≤ 4 hours | Point-in-time restore of Azure SQL + blob soft-delete window |
| **RTO** | ≤ 8 hours | ≤ 4 hours | Restore tenant data plane + verify app reachability |
| Drill cadence | Quarterly | Quarterly | Document results in IR / change ticket |

RPO/RTO apply to **platform-controlled** data (cases, evidence metadata, blobs, audit_events). Customer IdP / on-prem AD recovery is **out of scope** for ExitProof DR.

## Scope

**In scope**

- Platform metadata DB / Azure SQL (tenant rows, cases, checklist, audit)
- Evidence blobs (CMK-encrypted)
- Key Vault key material (CMK + connector/Graph secrets) — restore access, not plaintext export
- App config / Container Apps revision rollback

**Out of scope**

- Customer Entra / AD itself
- GridLogic PSA / CRM
- Local `DEMO_MODE` in-memory store

## Roles

| Role | Responsibility |
|------|----------------|
| Incident commander (GridLogic) | Declare DR event; approve restore vs failover |
| Platform eng | Execute SQL/blob/KV restore steps |
| Operator (JIT) | Customer comms; verify tenant isolation post-restore |
| Customer admin | Confirm Evidence Pack / case spot-checks |

## Standard restore path (shared platform)

> Live Azure commands land with Phase 1 deploy. Until then, treat this as the checklist shape.

1. **Declare** — Ticket ID, affected `tenant_id`(s), RPO cutoff time (UTC).  
2. **Freeze (optional)** — Enable [kill switch](kill-switch.md): `login_frozen` + `connectors_disabled` for impacted tenants to stop writes during restore.  
3. **Database** — Point-in-time restore Azure SQL (or schema restore for Standard) to a staging database; verify row counts for `organizations`, `offboarding_cases`, `evidence_files`, `audit_events` filtered by `tenant_id`.  
4. **Blobs** — Restore container prefix `tenants/{tenant_id}/` from soft-delete / backup vault; verify sample object SHA-256 against `evidence_files.content_hash`.  
5. **Keys** — Confirm CMK `cmk-{tenant_id}` is available; if key was soft-deleted, recover before decrypting blobs.  
6. **Cutover** — Swap connection / promote restored schema; clear kill switch only after smoke tests.  
7. **Verify isolation** — Confirm restored tenant cannot read another tenant’s cases (crafted IDs).  
8. **Audit** — Append operator audit: `platform.dr_restore` with ticket, RPO timestamp, objects restored.  
9. **Customer notice** — Share RPO/RTO actuals and any evidence re-upload asks.

## Dedicated SKU restore

Restore the customer resource group from Azure Backup / site recovery:

1. Restore SQL server + storage account + Key Vault into a recovery RG  
2. Point Container App (or dedicated web) at restored endpoints  
3. Re-bind Front Door / private endpoints  
4. Same kill-switch → verify → unfreeze sequence as Standard

## Tenant wipe / offboard

When a customer exits the GridLogic package (contract end or IR wipe):

1. **Export window** — Customer downloads Evidence Packs / CSV while subscription active (see DPA notes).  
2. **Kill switch** — Freeze logins + disable connectors ([kill-switch.md](kill-switch.md)).  
3. **Revoke connectors** — Graph consent health → `revoked`; AD cert revoke ([hybrid-ad.md](../connectors/hybrid-ad.md) § Certificate lifecycle).  
4. **Revoke secrets** — Delete/disable Key Vault secrets for Graph + AD; rotate CMK if required by SOW.  
5. **Data wipe** — Soft-delete then purge blobs under `tenants/{id}/`; delete or anonymize SQL rows per retention / legal hold.  
6. **Backups** — Schedule backup expiry past legal hold; do not leave indefinitely restorable copies unless contract requires.  
7. **Platform metadata** — Mark org offboarded; remove operator JIT; keep minimal billing/audit per counsel.  
8. **Confirm** — Written confirmation to customer with wipe completion time (UTC).

## Chaos / drill checklist (quarterly)

- [ ] Restore a **non-production** synthetic tenant from backup to staging  
- [ ] Verify evidence hash match for ≥1 file  
- [ ] Confirm cross-tenant isolation still holds  
- [ ] Practice kill-switch on / off with ticket ID  
- [ ] Practice AD cert revoke → agent stops within ≤5 minutes  
- [ ] Record actual RPO/RTO in the ticket; update this doc if targets miss

## Escalation

- Platform outage spanning multiple tenants → Front Door / Container Apps rollback first; DB restore only if data loss confirmed  
- Suspected cross-tenant exposure → kill-switch **all** suspect tenants; treat as security incident (not DR-only)
