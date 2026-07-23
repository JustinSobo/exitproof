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
- [ ] **B2** Signed-URL evidence download + image thumbnails in case detail
- [ ] **B3** SHA-256 hash per evidence file stored on `evidence_files`; embed images + hash manifest in PDF pack (`lib/pdf/evidence-pack.tsx`) — columns exist (migration 005); hash-on-upload + PDF manifest still open (Phase E)
- [ ] **B4** Retention enforcement: purge job honoring plan `retention_days`, audit event on purge
- [x] **B5** Control mapping: curated FedRAMP/CMMC/800-53/800-171/SOC/ISO/HIPAA/CSF catalog; template `controlRefs` + `evidenceHint`; case snapshot; chips; framework-filtered PDF/CSV (`lib/compliance/`, migration `005`)
- [ ] **B6** Audit completeness: events for case close, evidence download, settings changes, plan changes
- [ ] **B7** Overdue notification dedupe (`notified_at`) — column added in 005; cron dedupe still open (Phase E)
- [ ] **B8** Compliance posture page: per-org readiness summary (sampled-leaver evidence coverage %, avg time-to-revoke) — coverage helper ready; UI is Phase C

## Pillar C — Evidence questionnaire + customization (score 2)

- [ ] **C1** Onboarding questionnaire wizard (~8 questions → tailored org template)
- [ ] **C2** Template customizer: org-scoped editor (add/remove/reorder, critical + requires_evidence, due offsets)
- [ ] **C3** Template versioning: record `template_version` on case snapshot
- [ ] **C4** Re-run questionnaire from settings when stack changes; diff preview before applying
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
- [ ] **E1** Role enforcement (owner/admin vs member) on settings, billing, clients, deletions — server actions + RLS
- [ ] **E2** Member invite flow + member list/remove UI in settings
- [ ] **E3** Org switcher (multi-membership; `getCurrentOrg` takes first membership only)
- [ ] **E4** Manager read-only case status link (tokenized share)

## Pillar F — UX/UI (score 1)

- [ ] **F1** Mobile nav (sidebar shows only first 4 links) + responsive case detail
- [ ] **F2** Empty states with guidance (dashboard, cases, clients)
- [ ] **F3** New-org onboarding checklist banner
- [ ] **F4** Case detail evidence UX: previews, drag-drop upload, per-step progress
- [ ] **F5** Dashboard insight cards: overdue criticals, evidence coverage, days-to-close trend
- [ ] **F6** Landing: downloadable sample Evidence Pack PDF
- [ ] **F7** Accessibility pass: focus states, contrast, aria labels on checklist controls

## Pillar G — Tests, CI, hygiene (score 1–2)

- [ ] **G1** Vitest: billing gates, demo store org-scoping, webhook plan parsing, upload validation, questionnaire → template generation
- [ ] **G2** Integration: export/cron auth, Stripe fixture round-trip
- [ ] **G3** GitHub Actions: lint + typecheck + test + build on PR
- [ ] **G4** Cleanup: unused `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, default Next SVGs, empty component dirs; wire `zod`
- [ ] **G5** Hide marketing “Try demo” CTAs when `isDemoMode()` is false (action already guarded by D5)
