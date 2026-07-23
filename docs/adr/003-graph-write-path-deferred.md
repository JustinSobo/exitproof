# ADR-003: Graph write-path deferred (future charter)

**Status:** Accepted (deferral)  
**Date:** 2026-07-23  
**Deciders:** ExitProof / GridLogic product & security  
**Related:** [CHARTER.md](../CHARTER.md), [ADR-002](002-graph-readonly-and-ad-connector.md), [dpa-notes.md](../commercial/dpa-notes.md)

## Context

Phases 0–6 deliver audit-ready offboarding evidence via **read-only** Microsoft Graph and Hybrid AD. Customers and auditors need to trust that ExitProof observes directory state without silently changing it.

Graph **write** / disable / revoke (e.g. disable user, revoke sessions, mailbox/Intune wipe) is commercially attractive but raises:

- Destructive IdP blast radius and dual-control / four-eyes requirements
- New admin-consent scopes and DPA / subprocessor language
- Risk of checklist auto-complete implying an IdP action that did not occur—or that occurred without human accountability

This ADR records the **deferral**: write-path work is **not** in the current charter and must not be implemented under Phases 0–6.

## Decision

### 1. Out of scope for Phases 0–6

**Forbidden until a separate Phase 7 charter is opened and approved:**

- Graph application permissions such as `User.ReadWrite.All` (or any write/disable/revoke scopes)
- Disable user, revoke sessions, password reset, mailbox wipe, Intune wipe, or similar IdP mutations from ExitProof
- Silent or single-operator IdP revoke automation
- Consent UX, DPA copy, or SKU language that promises write/disable capabilities

Manual checklist remains the source of truth for revocation actions through Phase 6. Read-only mismatch alerts and system-collected evidence do **not** perform IdP writes.

### 2. Future Phase 7 shape (intent only — not implemented)

When (and only when) a new charter is approved, Phase 7 should target:

- **Dual-control** Graph disable/revoke (two authorized actors, or equivalent four-eyes)
- Explicit new admin consent + customer runbooks
- Immutable audit of who requested, who approved, and Graph outcome
- No silent auto-complete of critical checklist steps from write jobs alone

Exact UX, scopes, and kill-switch design belong in that future charter—not here.

### 3. Gate: open a new charter only after RO trust

Do **not** start Phase 7 design or implementation until **all** acceptance criteria below are met (or explicitly waived in writing by product + security).

## Acceptance criteria — when to open a Phase 7 charter

A new Graph write-path charter may be opened only when:

| # | Criterion |
|---|-----------|
| 1 | **Read-only Graph path proven in production-like lab or live:** consent → snapshot → hashed evidence for ≥1 Standard customer (or lab equivalent signed off by GridLogic security) |
| 2 | **Pen test / isolation review** of Phases 1–6 shows no critical cross-tenant or connector findings that would amplify write-path risk (or findings accepted with compensating controls) |
| 3 | **Consent UX and DPA** for current RO scopes are accurate; counsel has a draft path for *future* write-scope language (no production promise yet) |
| 4 | **Connector / Graph revoke drills** documented: Graph consent revoke and Hybrid AD cert revoke stop sync within stated SLOs (charter: ≤5 minutes for AD cert revoke) |
| 5 | **Customer runbooks** exist for mismatch handling (cloud disabled / AD still enabled) without relying on ExitProof write |
| 6 | **Product + security sign-off** that dual-control write is required for a named SKU/add-on and that RO trust metrics (charter success metrics 1–5) are on track |

Until then: Phase 7 remains **deferred future charter**; engineering must not add write Graph clients, scopes, or disable APIs “ahead of charter.”

## Consequences

### Positive

- Protects RO trust story for sales, pen tests, and admin consent
- Keeps Phases 0–6 shippable without destructive automation debt
- Clear gate so Phase 7 is not opened under schedule pressure alone

### Negative / follow-ups

- Hybrid mismatch and revoke still require human IdP action until a future charter
- Sales must not oversell disable automation; point to Managed Evidence Ops / runbooks
- When criteria are met, draft a **new** charter + update DPA/consent before any code

### Non-decisions (remain with future charter)

- Dual-control UI (in-app vs ticket + JIT)
- Exact Graph write APIs and least-privilege scope set
- Whether wipe/reset ever enter product vs disable/revoke only
- Billing SKU packaging for write-path add-on

## Security notes

Write scopes expand blast radius if a tenant credential or GridLogic operator session is compromised. Dual-control, short-lived elevation, per-action audit, and instant consent/kill-switch are mandatory design inputs for any future charter—not optional polish.
