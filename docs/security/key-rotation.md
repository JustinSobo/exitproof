# Key rotation & connector revoke drills

**Status:** Phase 6 ops checklist  
**Owner:** GridLogic platform  
**Related:** [DR runbook](dr-runbook.md), [kill-switch](kill-switch.md), [Hybrid AD connector](../connectors/hybrid-ad.md), [ADR-002](../adr/002-graph-readonly-and-ad-connector.md)

## Cadence

| Material | Rotate | Drill |
|----------|--------|-------|
| Graph app client secret / cert (multi-tenant app) | ≤ 90 days | Quarterly |
| Per-tenant Graph credential in Key Vault | On incident or ≤ 180 days | With Graph consent health check |
| Hybrid AD connector client cert | ≤ 365 days or on host compromise | Quarterly revoke drill |
| Azure SQL / storage access keys (prefer MI) | Prefer MI — no standing keys | N/A if MI-only |
| CMK (per-tenant) | Per SOW / HSM policy | Annual restore-with-key drill |
| Supabase / transitional secrets (pre-Azure) | On staff change + ≤ 90 days | Document in change ticket |
| CI / deploy tokens | On staff change | Verify least privilege |

## Graph (Entra) credential rotation

1. Issue new cert or secret on the GridLogic multi-tenant app registration.  
2. Store new value in Key Vault under the platform secret name; keep previous version soft-deleted briefly.  
3. Restart workers / Container Apps Jobs so they pick up the new version.  
4. Confirm `/connectors` health stays `healthy` for a pilot tenant (snapshot job).  
5. Disable old secret version after soak (24h).  
6. Audit: `platform.key_rotated` with material type `graph` (no secret values in payload).

If a customer **revokes admin consent**, set `graph_consent_status = revoked`, stop auto-evidence jobs, and notify customer — do not silently keep tokens.

## Hybrid AD connector certificate revoke

**Primary procedure:** follow [Certificate lifecycle](../connectors/hybrid-ad.md#certificate-lifecycle) in the Hybrid AD docs.

Quick IR path:

1. Identify `tenant_id` + connector `cert_thumbprint`.  
2. Set `ad_connectors.status = revoked` and `revoked_at = now()` (demo: `demoStore.revokeAdConnector`).  
3. Optionally revoke/disable the cert in Key Vault / issuing CA.  
4. Confirm next heartbeat returns `403` with `{ "stop": true }` — agent must exit within the heartbeat interval (**target ≤ 5 minutes**).  
5. If the host may be compromised: [kill-switch](kill-switch.md) `connectors_disabled` for the tenant, reimage connector host, issue **new** cert + registration token.  
6. Audit: `connector.cert_revoked` with thumbprint prefix only.

### Rotate (non-emergency)

1. Issue new client cert + registration token bound to same `tenant_id`.  
2. Register new thumbprint (`POST /api/connectors/ad/register`).  
3. Point agent config at new cert; confirm heartbeats.  
4. Revoke old thumbprint as above.

## Platform / app secrets (transitional Supabase + Stripe)

| Secret | Where | Rotate steps |
|--------|-------|--------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Hosting env | Rotate in Supabase dashboard → update Container App / Vercel env → restart → verify cron + invites |
| `STRIPE_WEBHOOK_SECRET` | Stripe + env | Roll endpoint secret → update env → verify fail-closed webhook still accepts signed events |
| `CRON_SECRET` | Env + scheduler | Generate new → update job headers + env together |
| Resend API key | Resend + env | Rotate → update env → send test overdue email in staging |

Never commit rotated values. If leaked via git, treat as incident: rotate, [secret-scanning](secret-scanning.md) push protection review, purge history if required by counsel.

## Chaos drill checklist

- [ ] Rotate Graph secret in staging; snapshot still works  
- [ ] Revoke AD cert; agent stops ≤ 5 min  
- [ ] Enable tenant kill switch; customer login blocked; connectors return stop  
- [ ] Clear kill switch; services resume  
- [ ] Document duration and gaps in quarterly ticket  

## Success metric (charter)

> Connector revoke stops AD sync within 5 minutes.
