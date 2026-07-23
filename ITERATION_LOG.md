# ExitProof Iteration Log

| Date | Item | Summary | Verification | Follow-ups |
| --- | --- | --- | --- | --- |
| 2026-07-22 | setup | Seeded `BACKLOG.md` + `ITERATION_LOG.md` from continuous-improvement plan | n/a | Run iteration 1: A1 + A2 |
| 2026-07-22 | A1 + A2 | Fail-closed Stripe webhook (require `STRIPE_WEBHOOK_SECRET` + signature) and cron auth (require `CRON_SECRET` in non-demo; demo still enforces when set) | `npm run build` + `npm run lint` green | Next: A3 demo IDOR |
| 2026-07-22 | A3 | Org-scope demo case accessors/mutations; reject cross-org create/export/detail; live create/export/detail verify session org or agency child | `npm run build` + `npm run lint` green | Next: A4 evidence upload limits |
