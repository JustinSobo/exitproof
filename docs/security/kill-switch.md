# Per-tenant kill switch

**Status:** Phase 6 — documented + in-app flags  
**Owner:** GridLogic NOC / operators  
**Related:** [DR runbook](dr-runbook.md), [key-rotation](key-rotation.md), [Hybrid AD](../connectors/hybrid-ad.md), [threat model](threat-model.md)

## Purpose

Incident response control from the charter security matrix:

> Per-tenant kill switch (disable connectors + freeze logins)

Use when a tenant is compromised, under legal hold freeze, or mid wipe/offboard — **without** taking down the whole shared platform.

## Flags (organizations)

| Column | Effect |
|--------|--------|
| `login_frozen` | Customer members cannot use the app workspace; redirected to login with a freeze message. GridLogic **operators** still reach `/operator`. |
| `connectors_disabled` | Graph sync / auto-evidence and Hybrid AD register/heartbeat/snapshot/auto-evidence return stop / forbidden. Prefer also revoking AD certs for host compromise. |

Defaults: both `false`. Migration: `supabase/migrations/011_kill_switch.sql`.

Helpers: `lib/security/kill-switch.ts`.

## Operator UI

On `/operator/tenants/[id]`:

1. Toggle **Freeze customer logins** and/or **Disable connectors**  
2. Provide a ticket ID (audited)  
3. Confirm banners after save  

Audit events:

- `operator.kill_switch` — payload includes flag names + ticket (never secrets)

## CLI / SQL (break-glass)

```sql
-- Freeze + stop connectors
update public.organizations
set login_frozen = true,
    connectors_disabled = true
where tenant_id = '<tenant_uuid>';

-- Clear after IR
update public.organizations
set login_frozen = false,
    connectors_disabled = false
where tenant_id = '<tenant_uuid>';
```

Demo mode: operator action updates the in-memory org via `demoStore.updateOrg`.

## Recommended IR sequence

1. Open ticket; set kill-switch flags for the tenant.  
2. If AD host suspect: **revoke connector cert** ([hybrid-ad certificate lifecycle](../connectors/hybrid-ad.md#certificate-lifecycle)) — target agent stop ≤ 5 minutes.  
3. Mark Graph consent `revoked` / stop jobs if consent or secret leaked.  
4. Rotate secrets ([key-rotation.md](key-rotation.md)).  
5. Investigate; restore from backup if needed ([dr-runbook.md](dr-runbook.md)).  
6. Clear kill switch only after smoke tests; notify customer.

## What kill switch does *not* do

- Does not wipe data (see tenant wipe in DR runbook)  
- Does not revoke Entra admin consent in the customer tenant (customer / Graph admin must)  
- Does not disable GridLogic operator console access  
- Does not replace Front Door / WAF platform-wide blocks
