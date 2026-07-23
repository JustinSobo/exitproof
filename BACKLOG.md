# ExitProof Continuous Improvement Backlog

Scored by leverage. Prefer unresolved security > broken/false advertising > compliance depth > flagship features > UX > cleanup.

**Scores:** 5 = exploitable security / data leak · 4 = paying-customer correctness or advertised-but-missing · 3 = compliance/evidence depth · 2 = flagship feature · 1 = UX/cleanup

---

## Pillar A — Security (score 5)

- [x] **A1** Stripe webhook accepts unsigned JSON when `STRIPE_WEBHOOK_SECRET` unset — fail closed (`app/api/stripe/webhook/route.ts`)
- [x] **A2** Cron route open when `CRON_SECRET` unset — require in non-demo (`app/api/cron/overdue/route.ts`)
- [x] **A3** Demo IDOR: export routes + case detail don't verify case ∈ caller's org; demo `createCase` accepts arbitrary `org_id` (`lib/demo/store.ts`, `lib/actions/cases.ts`)
- [x] **A4** Evidence upload: no size/MIME limits — 10 MB cap, png/jpg/webp/pdf allowlist, zod validation (`app/api/evidence/upload/route.ts`)
- [x] **A5** Unescaped HTML interpolation in overdue emails (`lib/resend.ts`)
- [x] **A6** RLS: any member = admin; free top-level org INSERT; no DELETE policies (migration `004_roles.sql`)

## Pillar B — Compliance standards depth (score 3–4)

- [x] **B1** Enforce `requires_evidence` server-side: critical steps can't complete without evidence/ticket URL; cases can't close with open critical steps
- [x] **B2** Signed-URL evidence download (`/api/evidence/[id]/download`) + image thumbnails via signed URL (`/url`); demo graceful stub
- [x] **B3** SHA-256 on upload → `content_hash`; PDF Evidence Pack hash manifest (`lib/pdf/evidence-pack.tsx`, upload route)
- [x] **B4** Retention enforcement: `/api/cron/retention` honors `retention_days`, `retention.purged` audit (demo + live)
- [x] **B5** Control mapping: curated FedRAMP/CMMC/800-53/800-171/SOC/ISO/HIPAA/CSF catalog; template `controlRefs` + `evidenceHint`; case snapshot; chips; framework-filtered PDF/CSV (`lib/compliance/`, migration `005`)
- [ ] **B6** Audit completeness: events for case close, evidence download, settings changes, plan changes
- [x] **B7** Overdue notification dedupe via `checklist_items.notified_at` in `/api/cron/overdue`
- [x] **B8** Compliance posture page: per-org readiness summary via `computeCoverage` / `org-posture` + control glossary + “supports evidence for” disclaimer (`/compliance`); avg time-to-revoke still open

## Pillar C — Evidence questionnaire + customization (score 2)

- [x] **C1** Onboarding questionnaire wizard (~8 stack Qs + frameworks multi-select → `selected_frameworks` + stack_profile; Entra/M365 defaults; FedRAMP/CMMC evidence escalation on case create)
- [ ] **C2** Template customizer: org-scoped editor (add/remove/reorder, critical + requires_evidence, due offsets)
- [ ] **C3** Template versioning: record `template_version` on case snapshot
- [x] **C4** Re-run questionnaire from settings (`/onboarding?edit=1`); diff preview before applying still open
- [x] **C5** Per-step evidence type hints shown in checklist (template `evidenceHint` → `checklist_items.evidence_hint`); required-evidence validation still B1
- [ ] **C6** Template import from CSV

## Pillar D — Live-mode correctness (score 4)

- [x] **D1** Template ID unification: SQL UUIDs as source of truth; live create persists `template_id` + resolves `template_step_id` by sort_order
- [x] **D2** Agency child-org cases missing from live dashboard/cases queries
- [ ] **D3** Monthly usage counter persistence for gating (`lib/billing/gates.ts`)
- [x] **D4** Trial copy honesty: landing says "14 days", product gates 3 offboards — align
- [x] **D5** `enterDemoAction` writes demo cookie even when live-configured — guard with `isDemoMode()`
- [x] **D6** Webhook plan resolution normalization across event types
- [x] **D7** Login error surfacing (currently generic)

## Pillar E — Roles, membership, tenancy (score 3–4)

- [x] **E0** Microsoft Entra SSO via Supabase Azure provider; Microsoft-primary login/signup; callback org bootstrap / domain JIT join; demo hides Entra
- [x] **E1** Role enforcement (owner/admin vs member) on settings, billing, clients, onboarding, Stripe checkout/portal — server actions + UI
- [x] **E2** Member invite send/remove (demo + live Supabase `inviteUserByEmail`) in settings
- [ ] **E3** Org switcher (customer multi-membership; `getCurrentOrg` takes first membership only) — operator audited switcher shipped in Phase 2 (`/operator`)
- [ ] **E4** Manager read-only case status link (tokenized share)
- [x] **E5** Phase 1 tenancy spine: immutable `tenant_id` (migration 006), domain JIT off by default / GridLogic Entra bind, DEMO_MODE prod footgun, provision CLI dry-run, Azure Bicep stubs (`infra/`)

## Pillar H — GridLogic / Azure charter (score 4–5)

- [x] **H1** Phase 1 foundation: IaC stubs, tenant_id, kill silent domain JIT, provision checklist CLI, DEMO_MODE harden (this iteration)
- [x] **H2** Phase 2: GridLogic operator console (`/operator`), JIT staff access (migration `008`), onboard wizard, audited org switcher; Agency soft-retired as security boundary
- [x] **H3** Phase 3: Graph read-only connector + consent (`lib/connectors/graph/`, `/connectors`, migration `007_graph_connector.sql`, case Entra mismatch + optional auto-evidence)
- [x] **H4** Phase 4 foundation: Hybrid AD connector skeleton (`apps/connector`), protocol docs, register/heartbeat/snapshot APIs, case AD status + mismatch UI, migration `009_ad_connector.sql`
- [x] **H5** Phase 5: auto-evidence policies (`lib/evidence/`), Graph/AD → FedRAMP/CMMC auto-map, attest-on-critical, Evidence Pack v3 system vs human sections, migration `010_auto_evidence_policy.sql`, DEMO Jordan Lee
- [ ] **H6** Live Azure deploy (Container Apps + SQL + Blob + KV) beyond Bicep stubs
- [~] **H7** Phase 7 Graph write/disable — **deferred** to future charter ([ADR-003](docs/adr/003-graph-write-path-deferred.md)); dual-control only after RO trust; out of scope for Phases 0–6 (do not implement)

## Pillar F — UX/UI (score 1)

- [x] **F1** Mobile nav (sidebar shows only first 4 links) + responsive case detail — Phase D: all links scrollable on mobile; New offboard is Cases CTA
- [x] **F2** Empty states with guidance (dashboard, cases, clients)
- [x] **F3** New-org onboarding checklist banner
- [x] **F4** Case detail evidence UX: signed download + image thumbnails/previews (Phase E); drag-drop upload still open
- [x] **F5** Dashboard insight cards: overdue criticals, evidence coverage, days-to-close trend — Phase C: framework posture strip on dashboard; overdue/trend cards still open
- [ ] **F6** Landing: downloadable sample Evidence Pack PDF
- [x] **F7** Accessibility pass: focus states, contrast, aria labels on checklist controls — design-system focus rings + labeled case controls (2026-07-23 UX pass); deeper audit still open
- [x] **F8** Case detail progressive UI: group by category, collapse done, sticky progress, control chips + framework export (Phase D)
- [x] **F9** Landing rewrite: mid-market + FedRAMP/CMMC/SOC + Entra SSO; trial = 3 free offboards (Phase D)
- [x] **F10** Settings: SSO status, members invite/remove, re-run questionnaire (Phase D+E)
- [x] **F11** Design system + shell polish: `components/ui/*`, grouped nav + mobile drawer, auth/marketing/core-flow hierarchy (2026-07-23)

## Pillar G — Tests, CI, hygiene (score 1–2)

- [x] **G1** Vitest for crosswalk/coverage/hash/roles (`lib/compliance/coverage.test.ts`); broader gate/webhook coverage still open
- [ ] **G2** Integration: export/cron auth, Stripe fixture round-trip
- [ ] **G3** GitHub Actions: lint + typecheck + test + build on PR
- [ ] **G4** Cleanup: unused `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, default Next SVGs, empty component dirs; wire `zod`
- [x] **G5** Hide marketing “Try demo” CTAs when `isDemoMode()` is false (gated in marketing layout + landing; action already guarded by D5)
