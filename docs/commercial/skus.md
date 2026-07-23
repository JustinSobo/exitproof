# ExitProof commercial SKUs (GridLogic-sold)

**Status:** Draft for sales / product alignment  
**Date:** 2026-07-23  
**Related:** [CHARTER.md](../CHARTER.md), [dpa-notes.md](dpa-notes.md)

> Pricing, discounting, and contract language are owned by GridLogic commercial teams. This sheet defines **package contents** for the product charter—not list prices.

---

## Base packages

### ExitProof Standard

**Tenancy:** Shared Azure platform with **hard logical isolation** (per-tenant schema/prefix + CMK). See [ADR-001](../adr/001-tenancy-and-azure.md).

**Includes:**

- GridLogic-managed provisioning and onboarding
- Compartmentalized customer workspace (`tenant_id`)
- Stack-aware offboarding checklists and frameworks (FedRAMP/CMMC crosswalk as product evolves)
- Evidence attachments + hashed integrity controls
- Evidence Pack export (PDF/CSV)
- Entra SSO for customer users (as platform auth matures)
- Append-only audit events
- GridLogic support under the managed package SOW
- Standard retention (exact days — _TBD commercial_)

**Does not include by default:** Graph directory audit, Hybrid AD connector, auto-evidence policies, Dedicated isolation, Managed Evidence Ops.

---

### ExitProof Dedicated

**Tenancy:** Isolated Azure resource group `rg-exitproof-{customer}` (SQL, storage, Key Vault; optional dedicated Container Apps).

**Includes everything in Standard, plus:**

- Dedicated data plane (and optional dedicated web tier)
- Optional private networking
- Higher retention tier (_TBD commercial_)
- Stronger isolation narrative for CMMC / FedRAMP-sensitive buyers

**Ops note:** Higher Azure cost and provision time; GridLogic runbook uses `modules/tenant-dedicated`.

---

## Add-ons

### Cloud Directory Audit (Microsoft Graph)

**Requires:** Customer admin consent to GridLogic multi-tenant Entra app.

**Includes:**

- Graph **read-only** snapshots (account state, audit signals per ADR-002)
- Case mismatch UI (e.g. Entra still enabled)
- Consent / connector health status
- Optional path to auto-evidence from Graph when Auto-evidence add-on is also enabled

**Excludes:** Graph write, disable, wipe, or session revoke (Phase 7 / future charter).

---

### Hybrid AD Audit (on-prem)

**Requires:** ExitProof Hybrid Connector install (outbound HTTPS / mTLS).

**Includes:**

- Read-only AD account / group / computer signals (scoped OUs)
- Hybrid mismatch alerts (cloud disabled / on-prem still enabled)
- Optional AD export evidence when Auto-evidence add-on is enabled
- GridLogic install/firewall runbook support

**Excludes:** Inbound connectivity to customer DC; password hash collection; AD write.

---

### Auto-evidence

**Requires:** One or both of Cloud Directory Audit / Hybrid AD Audit (signals to collect).

**Includes:**

- Policy flag `auto_evidence_enabled` (or equivalent)
- Scheduled / on-step collection → hashed blob → linked to checklist step
- Audit event `evidence.auto_collected`
- Pack labeling as **system-collected** (never certification claim)
- Phase 5: attest-on-critical policies

---

### Managed Evidence Ops

**Service wrap (people + process), not only software:**

- GridLogic-run monthly access reviews and/or QBR Evidence Packs
- RACI with customer IT (_template TBD_)
- Escalation when hybrid/cloud mismatches persist

Suitable for customers who want GridLogic to operate the evidence rhythm under the managed package.

---

## Packaging matrix (quick view)

| Capability | Standard | Dedicated | + Graph | + AD | + Auto-evidence | + Managed Ops |
|------------|:--------:|:---------:|:-------:|:----:|:---------------:|:-------------:|
| Hard-isolated workspace | ✓ | ✓ | | | | |
| Isolated RG / optional private net | | ✓ | | | | |
| Checklists + Evidence Pack | ✓ | ✓ | | | | |
| Graph RO snapshots / mismatch | | | ✓ | | | |
| Hybrid connector / AD mismatch | | | | ✓ | | |
| System-collected evidence jobs | | | * | * | ✓ | |
| GridLogic monthly reviews / QBR | | | | | | ✓ |

\* Auto-evidence needs Graph and/or AD add-on for signal sources.

---

## Commercial ops (checklist for GridLogic)

- [ ] PSA/CRM ticket templates for provision, consent, connector install
- [ ] SOW language referencing Standard vs Dedicated and add-ons
- [ ] RACI: GridLogic vs customer IT (consent, OU scope, break-glass)
- [ ] Retention defaults per SKU (_TBD_)
- [ ] Align Stripe/self-serve plans in current app with GridLogic billing over time (not blocking Phase 0)

## Non-SKU / non-goals

- Customer self-serve marketplace without GridLogic
- Full IGA / SCIM write automation (Phases 0–6)
- FedRAMP ATO for ExitProof itself
