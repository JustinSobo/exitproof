# ADR-001: Tenancy model and Azure platform

**Status:** Accepted  
**Date:** 2026-07-23  
**Deciders:** ExitProof / GridLogic product & security  
**Related:** [CHARTER.md](../CHARTER.md), [ADR-002](002-graph-readonly-and-ad-connector.md)

## Context

ExitProof today runs as a Vercel + Supabase multi-tenant SaaS with Agency parent/child orgs and domain-based JIT join. GridLogic IT will sell ExitProof as a **managed package**. Customers expect:

- Strong isolation of offboarding evidence and directory data
- Alignment with Microsoft Entra / Graph and Azure operations
- A high-assurance option for CMMC / FedRAMP-sensitive buyers

We need a durable decision on **where** the product runs and **how** tenants are isolated before Phase 1 IaC and app migration.

## Decision

### 1. Cloud home: Microsoft Azure

Production GridLogic-sold ExitProof targets **Azure**, not Vercel/Supabase, as the long-term home.

Rationale: Entra/Graph alignment, private networking, Key Vault CMK, Front Door WAF, and GridLogic Azure operational familiarity.

Transitional: existing Next.js app and Supabase path remain for demo/dev until Phase 1 ports the spine.

### 2. Default tenancy: shared platform, hard logical isolation

**Standard SKU:**

- One shared control plane (web, API workers, platform metadata DB)
- Per-customer **data plane** isolation:
  - Immutable `tenant_id` (UUID) on every request from session claims (never client body alone)
  - Dedicated Azure SQL **schema** (or equivalent RLS policies on all tables)
  - Blob prefix `tenants/{tenant_id}/` (or dedicated container)
  - Per-tenant CMK in Key Vault (`cmk-{tenant_id}`)
- No customer may read another customer’s data by architecture

### 3. High-assurance SKU: Dedicated

**Dedicated SKU:** separate resource group `rg-exitproof-{customer}` with isolated:

- Azure Container Apps (or App Service) — optional dedicated web
- Azure SQL server / database
- Storage account
- Key Vault

Optional private networking and higher retention. Sold for CMMC/FedRAMP-sensitive buyers.

### 4. Compute topology (not VM-primary)

| Role | Choice |
|------|--------|
| Web + API | **Azure Container Apps** (preferred) or App Service — Next.js Node 20+ |
| Async / cron / jobs | Container Apps Jobs or Azure Functions |
| Database | Azure SQL |
| Files | Azure Blob + CMK |
| Secrets | Azure Key Vault |
| Edge / WAF | Azure Front Door (or App Gateway) |
| Observability | Application Insights + Log Analytics |

**Rejected as primary design:**

- **Long-lived shared Azure VM** — unacceptable blast radius; ops drift; hard to isolate tenants
- **Azure Functions-only** — awkward for long-lived Next.js UI and connector agent protocol

VMs may exist only as optional jump hosts or connector build agents—not the primary app host.

### 5. Network and ops defaults

- Private endpoints for SQL, Blob, Key Vault; deny public SQL
- Web ingress via WAF
- Structured logs with `tenant_id`; never log tokens, PII dumps, or Graph payloads in cleartext
- GridLogic staff access requires **JIT** (ticket ID + expiry + audit)—not standing global admin
- IaC: Bicep or Terraform modules `tenant-standard` and `tenant-dedicated`

## Consequences

### Positive

- Clear isolation story for sales and security reviews
- Path to Dedicated without rewriting the product model
- Azure-native secrets, encryption, and private networking
- Fits GridLogic managed-ops model (provision workflow, not customer self-host)

### Negative / follow-ups

- Phase 1 migration cost off Supabase Auth, RLS, Storage, and Vercel crons
- Must kill domain JIT and redesign Agency-as-security-boundary (Phase 1–2) — Phase 2 soft-retired Agency as security boundary; `/operator` + JIT is source of truth while Agency plan remains commercially available
- Dual-run period may temporarily increase complexity
- Dedicated SKU increases Azure cost and provisioning complexity (acceptable for premium)

### Non-decisions (deferred)

- Exact Auth stack (Entra External ID / CIAM vs MSAL sessions) — Phase 2–3
- Billing (Stripe vs GridLogic PSA) — commercial, not blocking ADR
- FedRAMP ATO for the platform itself — separate program

## Compliance notes

Evidence and directory exports are classified **Restricted** ([threat model](../security/threat-model.md)). Isolation + CMK + private endpoints are mandatory controls for that classification on the shared platform.
