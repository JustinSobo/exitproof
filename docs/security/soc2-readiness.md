# SOC 2 readiness checklist (GridLogic hosting)

**Status:** Stub — Phase 6 platform path (not an attestation)  
**Owner:** GridLogic IT leadership + ExitProof eng  
**Audience:** Mid-market buyers asking “is the *platform* SOC 2?”  
**Related:** [CHARTER](../CHARTER.md), [threat model](threat-model.md), [SKUs](../commercial/skus.md), [DPA notes](../commercial/dpa-notes.md)

> This document is a **readiness tracker**, not a SOC 2 report. Do not claim SOC 2 Type I/II for ExitProof/GridLogic hosting until an independent auditor issues a report.

## Scope (intended)

| In scope | Out of scope (customer / separate program) |
|----------|--------------------------------------------|
| GridLogic-operated ExitProof Azure control + data plane | Customer FedRAMP/CMMC ATO |
| Operator JIT, tenancy isolation, evidence handling | Customer IdP / AD operations |
| CI/CD, secret handling, DR drills | Phase 7 Graph write automation |

Trust services criteria typically in play: **Security** (required); Availability + Confidentiality likely; Processing Integrity / Privacy as counsel advises.

## Control mapping stub


| Area | ExitProof / GridLogic artifact | SOC 2-ish control theme | Ready? |
|------|--------------------------------|-------------------------|--------|
| Access control | Entra SSO; MFA for operators; [operator JIT](../../app/operator) | CC6 | Partial |
| Tenant isolation | `tenant_id`, RLS / SQL policies, blob prefix, CMK (ADR-001) | CC6 / C1 | Partial (Azure live pending) |
| Change management | GitHub PR + [CI](../../.github/workflows/ci.yml) | CC8 | In-repo CI shipped |
| Vulnerability mgmt | [secret-scanning.md](secret-scanning.md), Dependabot, `npm audit` | CC7 | Process stub |
| Logging / monitoring | `audit_events`; App Insights (Azure) | CC7 | Partial |
| Incident response | [kill-switch](kill-switch.md), IR placeholders in DPA notes | CC7 | Engineering capability in-repo |
| Encryption | TLS; CMK at rest (charter) | CC6 / C1 | Design locked; Azure apply pending |
| Vendor / subprocessors | DPA notes checklist | CC9 | Counsel TBD |
| Availability / DR | [dr-runbook.md](dr-runbook.md) RPO/RTO | A1 | Targets defined; drills pending live Azure |
| HR / personnel | GridLogic hiring / background (ops-owned) | CC1 | `_TBD GridLogic HR_` |
| Risk assessment | [threat-model.md](threat-model.md) | CC3 | Phase 0 complete |

## Evidence to collect for an auditor (future)

- [ ] Architecture + data-flow diagrams (CHARTER / ADR-001) signed off  
- [ ] Access reviews of operator_staff + JIT grant samples  
- [ ] Quarterly DR drill tickets with actual RPO/RTO  
- [ ] Key rotation / connector revoke drill tickets  
- [ ] CI green history on `main` + branch protections  
- [ ] Secret scanning / Dependabot alert triage log  
- [ ] Pen-test report + remediation (live Azure engagement — out of this repo slice)  
- [ ] Customer-facing DPA / subprocessor list finalized by counsel  
- [ ] Backup encryption + restore screenshots for a synthetic tenant  

## Packaging note

Selling **ExitProof Standard** to mid-market may require a platform SOC 2 path. Dedicated SKU buyers may still ask for SOC 2 *plus* isolation evidence (separate RG). Customer compliance frameworks (FedRAMP/CMMC evidence *inside* packs) are **product features**, not ExitProof’s own ATO.

## Next engineering steps

1. Complete live Azure deploy (BACKLOG H6) so DR/CMK controls are demonstrable  
2. Wire App Insights dashboards with `tenant_id` (no Restricted payloads)  
3. Formalize change + IR policies with GridLogic ops (outside this repo)  
4. Schedule external pen-test after Phase 1–4 controls are live  
5. Engage auditor when evidence folder is ≥80% complete above
