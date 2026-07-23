# ExitProof threat model (Phase 0)

**Status:** Draft for GridLogic security sign-off  
**Date:** 2026-07-23  
**Method:** STRIDE (multi-tenant platform + Graph/AD connectors)  
**Related:** [CHARTER.md](../CHARTER.md), [ADR-001](../adr/001-tenancy-and-azure.md), [ADR-002](../adr/002-graph-readonly-and-ad-connector.md)

> This document is an engineering threat model, not a penetration-test report. Controls marked “Phase N” are planned; Phase 0 exit expects review and acceptance of this model.

---

## 1. Assets and data classification

| Asset | Classification | Notes |
|-------|----------------|-------|
| Evidence attachments (files, Graph/AD exports, hashes) | **Restricted** | Primary crown jewels; CMK + tenant-scoped storage |
| Case / checklist content (leaver PII, tickets, notes) | Confidential | Tenant-scoped; minimize in logs |
| Directory snapshots (Entra / AD attributes) | **Restricted** | No password hashes; redact where possible |
| Audit events | Confidential / integrity-critical | Append-only; operator JIT must appear here |
| Tenant secrets (Graph certs, connector client certs) | Restricted | Key Vault only; managed identity access |
| Platform metadata (tenant list, SKU, consent status) | Internal | Control plane; GridLogic operator only |
| Session tokens / JWT claims | Restricted | Never logged |

**Rule:** Evidence = **Restricted**. Any path that stores, lists, downloads, or exports evidence must enforce `tenant_id` from trusted session claims and use tenant CMK / scoped SAS.

---

## 2. Trust boundaries

```text
┌─────────────────────────────────────────────────────────────┐
│ GridLogic Azure control plane (operators, hub DB, jobs)     │
│   Trust: GridLogic MFA + JIT; managed identities            │
└───────────────┬─────────────────────────────┬───────────────┘
                │ WAF / private endpoints     │ mTLS (outbound)
┌───────────────▼───────────────┐   ┌─────────▼────────────────┐
│ Customer A data plane         │   │ Customer network         │
│ SQL schema / Blob / CMK_A     │   │ Hybrid Connector → AD RO │
└───────────────────────────────┘   └──────────────────────────┘
                │
┌───────────────▼───────────────┐
│ Customer Entra tenant         │
│ Enterprise App → Graph RO     │
└───────────────────────────────┘
```

Actors:

- **Customer user** — members of one tenant only
- **Customer admin** — consents Graph app; may install connector with GridLogic
- **GridLogic operator** — JIT tenant access; provision customers
- **Background worker** — Graph/AD jobs with tenant-scoped secrets
- **Attacker** — internet, malicious insider, compromised connector host, confused-deputy API client

---

## 3. STRIDE summary

### 3.1 Spoofing

| Threat | Impact | Mitigations |
|--------|--------|-------------|
| Attacker forges session / steals cookie | Cross-tenant or privilege abuse | Entra SSO + MFA for operators; secure cookies; short sessions; no `tenant_id` from client body |
| Fake Hybrid Connector | Inject false AD evidence | Provisioned client certs (mTLS); cert pinning to tenant; instant revoke; heartbeat monitoring |
| Domain JIT join (legacy) | Join wrong org | **Eliminate** in Phase 1; bind Entra tenant ID at provision |
| Stolen Graph client secret | Read customer directory | Per-tenant KV secrets; cert auth preferred; rotation drills (Phase 6) |

### 3.2 Tampering

| Threat | Impact | Mitigations |
|--------|--------|-------------|
| Modify evidence blob undetected | False audit trail | SHA-256 on upload; signed URLs; CMK; immutable audit event on collect/attach |
| Alter audit_events | Cover tracks | Append-only store; separate privileges; monitor deletes |
| Connector binary trojan | Exfil AD / lie about state | Signed builds; auto-update channel integrity; supply-chain scanning |
| SQL injection / IDOR case IDs | Cross-tenant read/write | Parameterized queries; RLS / `tenant_id` on all queries; pen test Phase 1 exit |

### 3.3 Repudiation

| Threat | Impact | Mitigations |
|--------|--------|-------------|
| Operator denies viewing customer evidence | Compliance failure | JIT ticket ID + expiry logged; every staff access audited |
| “System” evidence claimed as human | Misleading packs | Label system-collected; Evidence Pack v3 System-collected vs Human-attached sections; `evidence.auto_collected` events; attest-on-critical |
| Consent unclear | Legal / trust | Admin consent URL + recorded consent health; DPA notes for counsel |

### 3.4 Information disclosure

| Threat | Impact | Mitigations |
|--------|--------|-------------|
| Cross-tenant evidence/case leak | Critical | Hard isolation (ADR-001); ban global service-role evidence reads; synthetic-tenant pen tests |
| Agency parent sees child without consent | Critical | Soft-retired as security boundary (Phase 2): GridLogic `/operator` + JIT is source of truth; Agency plan still works commercially |
| Logs contain Graph payloads / tokens | Restricted data leak | Structured logs with `tenant_id` only; redact PII; never log tokens |
| Public blob URLs | Evidence leak | No public containers; user-delegation / SAS scoped to tenant + short TTL |
| Over-broad Graph scopes | Excess directory access | RO least privilege (ADR-002); no write until Phase 7 |
| Connector collects password hashes | Catastrophic | Explicitly forbidden; attribute allow-list |

### 3.5 Denial of service

| Threat | Impact | Mitigations |
|--------|--------|-------------|
| Exhaust Graph / AD sync jobs | Blind audit windows | Rate limits; per-tenant quotas; backoff; kill switch |
| WAF / app flood | Service outage | Front Door WAF; autoscaling Container Apps |
| Connector spam or cert flood | Control-plane load | mTLS + enrollment only via provision; anomaly alerts |

### 3.6 Elevation of privilege

| Threat | Impact | Mitigations |
|--------|--------|-------------|
| Customer user → admin / other tenant | Data breach | RBAC; session claims; no client-supplied role/tenant |
| GridLogic standing global admin | Insider blast radius | JIT access only; MFA; ticket binding |
| Worker MI reads all KV secrets | Lateral movement | Per-tenant secret naming + RBAC; least-privilege MI |
| Graph write scopes granted early | Destructive IdP actions | **Forbidden until Phase 7**; consent UX lists RO only |
| DEMO_MODE / missing keys in prod | Auth bypass | Fail closed; eliminate production footguns (Phase 1) |

---

## 4. Connector-specific threats

| Scenario | Severity | Response |
|----------|----------|----------|
| Compromised domain-joined host running connector | High | Revoke cert (&lt;5 min stop sync); reimage; rotate; review OU scope |
| Customer admin consents then revokes Graph app | Medium | Consent health = unhealthy; stop jobs; notify GridLogic + customer |
| Hybrid mismatch ignored (cloud off / AD on) | High (business) | Product alerts; Managed Evidence Ops add-on; not silent auto-disable |
| Insider exports Restricted evidence | High | Download audit; DLP/retention; CMK; least privilege roles |

---

## 5. Residual risks (accepted for now)

- Human checklist still required for actual revoke until Phase 7 — residual “account left enabled” risk is a **process** risk, mitigated by mismatch alerts and Managed Evidence Ops.
- Dedicated SKU reduces shared-fate risk but does not remove application bugs—same secure coding bar.
- FedRAMP ATO for ExitProof platform is **out of charter** (separate program).

---

## 6. Phase 0 exit criteria (this document)

- [ ] GridLogic security / product reviews and signs this threat model
- [ ] Evidence = Restricted communicated in SKUs / DPA notes
- [ ] ADR-001 and ADR-002 accepted (isolation + Graph RO / connector)
- [ ] Known legacy threats (domain JIT, Agency boundary, service-role abuse, DEMO_MODE) tracked into Phase 1–2 backlog

**Sign-off**

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product | _TBD_ | | |
| Security | _TBD_ | | |
| GridLogic engineering lead | _TBD_ | | |
