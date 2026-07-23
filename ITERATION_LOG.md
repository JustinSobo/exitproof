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
