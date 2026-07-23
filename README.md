# ExitProof

Audit-ready IT employee offboarding: stack-aware checklists, evidence attachments, append-only audit events, PDF/CSV Evidence Pack export, and Stripe billing.

Independent SaaS product — no partner branding or playbooks.

## Stack

- Next.js App Router + TypeScript + Tailwind CSS
- Supabase (Postgres + Auth + Storage) with RLS
- Stripe Checkout + Customer Portal + webhooks
- Resend for overdue critical-step emails
- `@react-pdf/renderer` for Evidence Pack PDFs
- Deploy-ready for Vercel

## Quick start (demo mode)

```bash
cd ~/Projects/exitproof
cp .env.example .env.local
# DEMO_MODE=true is already set in .env.example
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- **Try demo** uses `demo@exitproof.app` / `demo1234`
- Demo data lives in-process memory (resets when the server restarts)
- Marketing pages and the full product flow work without Supabase/Stripe keys

## Production setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run SQL migrations in order:
   - `supabase/migrations/001_initial.sql`
   - `supabase/migrations/002_rls.sql`
   - `supabase/migrations/003_seed_templates.sql`
3. Enable Email auth (password + magic link)
4. Confirm Storage bucket `evidence` exists (created in `001_initial.sql`)
5. Set env vars:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
6. Set `DEMO_MODE=false` (or omit it) once Supabase is configured

### 2. Stripe

1. Create products/prices:
   - Team — $79/mo → `STRIPE_PRICE_TEAM`
   - Growth — $149/mo → `STRIPE_PRICE_GROWTH`
   - Agency — $249/mo → `STRIPE_PRICE_AGENCY`
2. Set `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
3. Webhook endpoint: `POST /api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Set `STRIPE_WEBHOOK_SECRET`
4. Enable Customer Portal in Stripe Dashboard

### 3. Resend

1. Create an API key at [resend.com](https://resend.com)
2. Set `RESEND_API_KEY` and optionally `RESEND_FROM_EMAIL`
3. If unset, overdue emails log to the server console and no-op (safe for local/dev)

### 4. Overdue email cron

Route: `GET|POST /api/cron/overdue`

Protect with `CRON_SECRET`:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/overdue
```

`vercel.json` schedules daily `0 14 * * *` (14:00 UTC). On Vercel, also set `CRON_SECRET` and configure the cron Authorization header, or rely on Vercel Cron + your own secret check in the route.

### 5. Deploy (Vercel)

```bash
vercel
# or connect the GitHub repo in the Vercel dashboard
```

Set all env vars from `.env.example`. Set `NEXT_PUBLIC_APP_URL` to your production URL.

## Pricing gates (in-app)

| Plan | Price | Limits |
|------|-------|--------|
| Trial | Free | 3 offboards total while unpaid |
| Team | $79/mo | 1 org, 25 offboards/mo, 90-day retention |
| Growth | $149/mo | Unlimited offboards, 365-day retention |
| Agency | $249/mo | Parent + up to 25 client orgs, unlimited offboards |

## Key routes

| Path | Purpose |
|------|---------|
| `/` | Marketing landing |
| `/auth/login`, `/auth/signup` | Auth |
| `/dashboard` | Org overview |
| `/cases`, `/cases/new`, `/cases/[id]` | Offboarding cases + checklist |
| `/settings` | Stack profile (M365 / Google / hybrid) |
| `/billing` | Stripe Checkout + Customer Portal |
| `/clients` | Agency client orgs |
| `/api/export/[caseId]/pdf` | Evidence Pack PDF |
| `/api/export/[caseId]/csv` | Evidence Pack CSV |
| `/api/stripe/*` | Checkout, portal, webhook |
| `/api/cron/overdue` | Overdue critical-step emails |

## Key files

- `lib/templates/*` — seeded M365 / Google / Hybrid templates
- `lib/pdf/evidence-pack.tsx` — PDF document
- `lib/demo/store.ts` — in-memory demo backend
- `supabase/migrations/*` — schema, RLS, seeds
- `proxy.ts` — Supabase session refresh (Next.js proxy)

## Scripts

```bash
npm run dev      # local development
npm run build    # production build
npm run start    # serve production build
npm run lint     # eslint
```

## Out of scope (MVP)

SCIM/IdP auto-revoke, MDM APIs, HRIS sync, mobile apps.
