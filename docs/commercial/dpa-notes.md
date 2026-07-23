# DPA, admin consent, and subprocessor notes

**Status:** Checklist for GridLogic counsel — **not legal advice**  
**Date:** 2026-07-23  
**Audience:** GridLogic legal / privacy counsel + product  
**Related:** [CHARTER.md](../CHARTER.md), [skus.md](skus.md), [threat model](../security/threat-model.md)

> **Disclaimer:** This document is an engineering and product checklist to help counsel draft or update a Data Processing Agreement (DPA), admin-consent disclosures, and subprocessor notices. It is **not** a DPA, **not** legal advice, and **not** a substitute for counsel review. Placeholders marked `_TBD_` must be completed by GridLogic before customer use.

---

## 1. Processing roles (proposed framing — counsel to confirm)

| Party | Proposed role | Notes for counsel |
|-------|---------------|-------------------|
| **Customer** | Controller (typical) | Determines offboarding purposes; owns directory/HR data |
| **GridLogic IT** | Processor (and/or managed-service operator) | Provisions and operates ExitProof for customer |
| **ExitProof platform** | Processing system under GridLogic | Azure-hosted; hard tenant isolation |

_Confirm whether any GridLogic “Managed Evidence Ops” activities change controller/processor analysis._

---

## 2. Categories of personal data (product view)

| Category | Examples | Classification (eng) |
|----------|----------|----------------------|
| Identity | Names, work email, Entra object IDs, employee IDs | Confidential / Restricted when in evidence |
| Employment context | Role, department, manager, leaver dates | Confidential |
| Account / access state | Enabled flags, group membership, MFA method presence, devices | **Restricted** when stored as evidence/exports |
| Evidence files | Screenshots, exports, Graph/AD snapshots, hashes | **Restricted** |
| Auth / ops | Login identifiers, audit of who viewed evidence | Confidential |

**Special / sensitive:** MFA method details and full directory exports — minimize; optional Graph scopes; document in consent UX.

**Explicitly not collected by Hybrid Connector design:** password hashes, DC replication secrets.

---

## 3. Processing purposes (product)

- Provide audit-ready offboarding checklists and Evidence Packs
- Store and retain evidence per SKU / SOW
- Optional: read-only directory snapshots and mismatch alerts (add-ons)
- Optional: system-collected evidence labeled as such
- Platform security, abuse prevention, and GridLogic JIT support access
- Billing / commercial relationship (_TBD_ — Stripe vs GridLogic PSA)

---

## 4. Admin consent language — checklist for counsel

Customer Entra admins will consent to a **GridLogic multi-tenant application** requesting **Microsoft Graph application permissions** that are **read-only** in Phases 0–6 ([ADR-002](../adr/002-graph-readonly-and-ad-connector.md)).

Counsel should ensure customer-facing materials cover:

- [ ] Publisher name: `_TBD — GridLogic IT legal entity_`
- [ ] App display name: `_TBD — e.g. ExitProof by GridLogic_`
- [ ] Exact Graph application permissions list (RO only until Phase 7)
- [ ] Statement that consent allows **reading** directory/audit data for offboarding evidence — **not** disabling users or wiping devices in current charter
- [ ] How to revoke consent (Entra Enterprise Applications) and effect (snapshots stop)
- [ ] Where data is stored (Azure region(s): `_TBD_`)
- [ ] Who at GridLogic may access tenant data (JIT + audit)
- [ ] Link to privacy notice / DPA: `_TBD URL_`

**Do not** promise write/disable capabilities in consent copy until Phase 7 charter is approved.

---

## 5. Subprocessors — checklist

Maintain a public or contractual subprocessor list. Draft inventory for counsel to validate:

| Subprocessor (candidate) | Service | Data involved | Region `_TBD_` |
|--------------------------|---------|---------------|----------------|
| Microsoft Azure | Hosting (Container Apps, SQL, Blob, Key Vault, Front Door, App Insights) | All platform/customer data in scope | `_TBD_` |
| Microsoft Entra / Graph | Auth and optional directory read | Identity; directory attributes when add-on enabled | `_TBD_` |
| `_TBD email provider_` | Transactional email (e.g. overdue notices) | Work email, case metadata | `_TBD_` |
| `_TBD billing_` | Payments (if not invoiced via GridLogic only) | Billing contacts, subscription | `_TBD_` |
| `_TBD support / PSA_` | Ticketing for managed service | Support content as provided by customer | `_TBD_` |

**Legacy / transitional (pre-Azure production):** Supabase, Vercel, Stripe, Resend may appear in current self-serve stack—counsel should clarify which apply to **GridLogic-managed production** vs demo/dev.

- [ ] Customer notification process for subprocessor changes (`_TBD_ days`)
- [ ] SCCs / DPFs / transfer mechanism if cross-border (`_TBD_`)

---

## 6. Security and isolation commitments (engineering facts for DPA schedules)

Safe to describe technically (counsel to wordsmith):

- Hard logical isolation on Standard; Dedicated RG option
- Encryption in transit (TLS 1.2+); CMK at rest for evidence / sensitive fields
- No public evidence blobs; tenant-scoped access
- GridLogic staff access via time-boxed JIT with ticket ID and audit
- Connector: outbound-only mTLS; read-only AD; cert revoke
- Evidence classified **Restricted** in internal threat model

Do **not** claim FedRAMP ATO for ExitProof platform unless a separate program completes.

---

## 7. Retention, deletion, and exit

| Topic | Product intent | Counsel placeholder |
|-------|----------------|---------------------|
| Retention | Per SKU / SOW; Dedicated may offer longer | Default days: `_TBD_` |
| Customer offboard | Kill connectors; freeze logins; wipe/export path | Procedure + timeline: `_TBD_` |
| Backups | Encrypted; per-tenant restore goal | Backup retention: `_TBD_` |
| Evidence export | Customer can export packs during subscription | Format/SLA: `_TBD_` |

---

## 8. Breach / incident notification

- [ ] Notification timeline to customer: `_TBD_` (align with applicable law)
- [ ] GridLogic incident contact: `_TBD_`
- [x] Per-tenant kill switch (disable connectors + freeze logins) — see `docs/security/kill-switch.md` + migration `011`

---

## 9. Customer responsibilities (RACI seeds)

Customer typically must:

- Grant/revoke Entra admin consent knowingly
- Approve OU scope and connector host hardening for Hybrid AD
- Ensure lawful basis for HR/identity data loaded into ExitProof
- Complete human attestation on critical offboarding steps
- Maintain their own IdP/PAM; ExitProof does not replace them

GridLogic typically:

- Provisions tenant and CMK
- Operates Azure platform
- Installs/supports connector when sold
- Provides JIT support under SOW
- Runs Managed Evidence Ops if purchased

---

## 10. Phase 7 write-path caveat

Any future Graph **write** / disable / revoke features require **new** consent language, DPA review, and dual-control design. Current charter **forbids** write scopes until that separate approval.

---

## Document control

| Field | Value |
|-------|-------|
| Owner | GridLogic counsel + ExitProof product |
| Engineering contact | `_TBD_` |
| Next review | Before first GridLogic production customer contract |
