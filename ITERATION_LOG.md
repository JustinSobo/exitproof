# ExitProof Iteration Log

| Date | Item | Summary | Verification | Follow-ups |
| --- | --- | --- | --- | --- |
| 2026-07-22 | setup | Seeded `BACKLOG.md` + `ITERATION_LOG.md` from continuous-improvement plan | n/a | Run iteration 1: A1 + A2 |
| 2026-07-22 | A1 + A2 | Fail-closed Stripe webhook (require `STRIPE_WEBHOOK_SECRET` + signature) and cron auth (require `CRON_SECRET` in non-demo; demo still enforces when set) | `npm run build` + `npm run lint` green | Next: A3 demo IDOR |
| 2026-07-22 | A3 | Org-scope demo case accessors/mutations; reject cross-org create/export/detail; live create/export/detail verify session org or agency child | `npm run build` + `npm run lint` green | Next: A4 evidence upload limits |
| 2026-07-22 | A4 | Evidence upload: zod validation, 10 MB cap, PNG/JPG/WebP/PDF MIME+extension allowlist (demo + live) | `npm run build` + `npm run lint` green | Next: A5 overdue email HTML escape |
| 2026-07-22 | A5 | Escape HTML (and strip subject newlines) in overdue critical-step emails | `npm run build` + `npm run lint` green | Next: A6 RLS roles |
| 2026-07-22 | A6 | Migration `004_roles.sql`: `is_org_admin`, block free top-level org insert, admin-scoped updates/deletes; signup via `bootstrap_organization` | `npm run build` + `npm run lint` green | Next: D5 enterDemo guard |
| 2026-07-22 | D5 | Guard `enterDemoAction` with `isDemoMode()` so live deployments cannot mint demo cookies | `npm run build` + `npm run lint` green | Next: D4 trial copy |
| 2026-07-22 | D4 | Align landing trial copy to 3 free offboards (remove misleading 14-day claim) | `npm run build` + `npm run lint` green | Next: D7 login errors |
| 2026-07-22 | D7 | Surface real login/signup error and success messages from query params | `npm run build` + `npm run lint` green | Next: D2 agency child cases |
| 2026-07-22 | D2 | Live dashboard/cases list parent + agency child org cases via shared `listCasesForOrg` | `npm run build` + `npm run lint` green | Next: D1 template IDs |
| 2026-07-22 | D1 | Align TS template IDs with SQL seed UUIDs; live createCaseAction persists `template_id` | `npm run build` + `npm run lint` green | Next: B1 requires_evidence |
| 2026-07-22 | B1 | Server-side evidence rules: block done without file/ticket when required; block close with open criticals (demo + live) | `npm run build` + `npm run lint` green | Next: D6 webhook plan normalize |
| 2026-07-22 | D6 | Normalize Stripe plan resolution across checkout/subscription events (metadata + price IDs + customer fallback on delete) | `npm run build` + `npm run lint` green | Next: D3 usage reset or C1 questionnaire |
| 2026-07-23 | Phase A / B5 | Frameworks+controls migration 005; curated ~67 offboarding controls; template controlRefs/evidenceHint; case create snapshots (demo+live); fix live template_step_id; control chips; `?framework=` PDF/CSV | `npm run lint` + `npm run build` | Phase B Entra; Phase C onboarding/compliance UI; Phase E hash-on-upload |
| 2026-07-23 | Phase D / F1–F3+F8–F10 | Case detail progressive UI (category groups, collapse done, sticky progress); nav IA + mobile all-links; empty states; onboarding banner; landing mid-market/Entra/FedRAMP rewrite; settings SSO + members stub; demo listMembers | `npm run lint` + `npm run build` | Phase C routes if missing; Phase E invites/hash/signed URLs |
| 2026-07-23 | Phase C / C1+B8 | `/onboarding` wizard (frameworks + ≤8 stack Qs); FedRAMP/CMMC evidence escalation; `/compliance` posture+glossary+disclaimer; dashboard posture strip; gate new orgs until `onboarding_completed_at`; demo parity | `npm run lint` + `npm run build` | Phase E: hash/signed URLs, invites, roles; C4 diff preview |
| 2026-07-23 | E0 | Entra SSO: Azure OAuth (`email openid profile`), Microsoft-primary login/signup, callback domain JIT join / org bootstrap; demo hides Entra; README + `.env.example` runbook | `npm run build` + `npm run lint` green | Next: Phase A taxonomy / C1 onboarding |
