# ExitProof

Audit-ready IT employee offboarding: stack-aware checklists, evidence attachments, append-only audit events, PDF/CSV Evidence Pack export, and Stripe billing.

Independent SaaS product — evolving toward **GridLogic IT managed package** on Azure (see `infra/`, Phase 1 tenancy).

## Stack

- Next.js App Router + TypeScript + Tailwind CSS
- Supabase (Postgres + Auth + Storage) with RLS — production target migrating to Azure SQL over charter phases
- Stripe Checkout + Customer Portal + webhooks
- Resend for overdue critical-step emails
- `@react-pdf/renderer` for Evidence Pack PDFs
- Azure IaC stubs under `infra/` (Bicep) for GridLogic deploy

## Quick start (demo mode)

```bash
cd ~/Projects/exitproof
cp .env.example .env.local
# DEMO_MODE=true is already set in .env.example — local only
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- **Try demo** uses `demo@exitproof.app` / `demo1234`
- Demo data lives in-process memory (resets when the server restarts)
- Marketing pages and the full product flow work without Supabase/Stripe keys

### DEMO_MODE production checklist (footgun)

| Context | Behavior |
|---------|----------|
| Local `next dev` | `DEMO_MODE=true` **or** missing Supabase keys → demo store |
| `next build` | Missing keys still compile (build-phase exception) |
| `NODE_ENV=production` **or** `GRIDLOGIC_MANAGED=true` | **Refuse** `DEMO_MODE=true`; **refuse** missing Supabase keys (no silent demo) |

Set for GridLogic / production:

```bash
DEMO_MODE=false
GRIDLOGIC_MANAGED=true   # optional; forces Entra-tenant provision path
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
ALLOW_DOMAIN_JIT=false   # default; never enable with GRIDLOGIC_MANAGED
```

## Production setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run SQL migrations in order:
   - `supabase/migrations/001_initial.sql`
   - `supabase/migrations/002_rls.sql`
   - `supabase/migrations/003_seed_templates.sql`
   - `supabase/migrations/004_roles.sql`
   - `supabase/migrations/005_frameworks_and_evidence_integrity.sql`
   - `supabase/migrations/006_tenant_hardening.sql` ← immutable `tenant_id`
   - `supabase/migrations/007_graph_connector.sql` ← Graph consent (Phase 3)
   - `supabase/migrations/008_operator_jit.sql` ← operator staff + JIT grants (Phase 2)
   - `supabase/migrations/009_ad_connector.sql` ← Hybrid AD (Phase 4)
3. Enable Email auth (password + magic link) for break-glass / demo fallback
4. Confirm Storage bucket `evidence` exists (created in `001_initial.sql`)
5. Set env vars:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (Entra-tenant join + Stripe/cron)
6. Under **Authentication → URL configuration**, add redirect URL:
   - `https://<your-app>/auth/callback` (and `http://localhost:3000/auth/callback` for local)
7. Set `DEMO_MODE=false` once Supabase is configured

**Tenancy rule:** `tenant_id` is immutable and must come from the authenticated session (`getCurrentOrg` → `organizations.tenant_id`), never from client request body alone. See `lib/tenancy.ts`.

### 2. Microsoft Entra SSO (Azure provider)

Primary production login is **Continue with Microsoft** (`signInWithOAuth({ provider: 'azure' })`). Email/password and magic link stay as break-glass. Entra UI is hidden when `isDemoMode()` is true.

**A. Register an app in Microsoft Entra ID**

1. [Entra admin center](https://entra.microsoft.com) → **App registrations** → **New registration**
2. Name: `ExitProof` (or your deployment name)
3. Supported account types:
   - Multi-tenant (`accounts in any organizational directory`) for SaaS signup across customer tenants, **or**
   - Single-tenant if ExitProof is only for one Entra tenant
4. Redirect URI (Web): `https://<project-ref>.supabase.co/auth/v1/callback`  
   (Supabase completes the IdP handshake; the app then lands on `/auth/callback`)
5. **Certificates & secrets** → create a client secret; copy the **Value** once
6. Note **Application (client) ID** and **Directory (tenant) ID**
7. **API permissions** → Microsoft Graph delegated: `openid`, `email`, `profile` (and `User.Read` if prompted). Grant admin consent if required
8. Optional (recommended): **Token configuration** → add optional claim `email` on the ID token so Supabase always receives a verified email

**B. Enable Azure in Supabase Auth**

1. Supabase Dashboard → **Authentication** → **Providers** → **Azure**
2. Enable the provider
3. Paste **Client ID** and **Client Secret** from Entra (secrets live only here — not in `.env`)
4. Tenant URL:
   - Single-tenant: `https://login.microsoftonline.com/<tenant-id>`
   - Multi-tenant SaaS: `https://login.microsoftonline.com/common` (or `/organizations`)
5. Save

**C. App behavior (membership after sign-in)**

- Scopes: `email openid profile`
- After `exchangeCodeForSession` on `/auth/callback`:
  1. **Entra tenant bind** — if token has `tid` and exactly one org has matching `entra_tenant_id`, join as `member` (GridLogic path)
  2. **Domain JIT** — only when `ALLOW_DOMAIN_JIT=true` (default **off**; disabled under `GRIDLOGIC_MANAGED`)
  3. **Self-serve bootstrap** — new trial org via `bootstrap_organization` (refused when `GRIDLOGIC_MANAGED=true`)
- Consumer domains (gmail, outlook, etc.) never auto-join via domain JIT

**GridLogic provision (dry-run CLI):**

```bash
npm run provision -- --dry-run \
  --name "Acme Corp" \
  --sku standard \
  --entra-tenant-id "<customer-entra-directory-guid>"
```

**Out of scope for this phase:** SCIM, custom SAML apps, Entra group → ExitProof role sync.

### 2b. Microsoft Graph read-only connector (Phase 3)

GridLogic registers a **multi-tenant** Entra application. Each customer admin grants **admin consent**, creating an Enterprise Application in their tenant. ExitProof then reads directory state (no write/disable).

**Application permissions (read-only — grant admin consent):**

| Permission | Purpose |
|------------|---------|
| `User.Read.All` | Account enabled/disabled, UPN, mail |
| `AuditLog.Read.All` | Disable / directory audit events |
| `Directory.Read.All` | Group/role context as needed |

**Explicitly forbidden until Phase 7:** `User.ReadWrite.All`, disable user, revoke sessions, mailbox/Intune wipe.

**App registration checklist**

1. Entra admin center → **App registrations** → **New registration**
2. Name: `ExitProof Graph Audit` (GridLogic multi-tenant)
3. Supported account types: **Accounts in any organizational directory** (multi-tenant)
4. No redirect URI required for client-credentials workers; for in-product admin consent, add Web redirect: `https://<app-host>/connectors?consent=1`
5. **API permissions** → Microsoft Graph → **Application** permissions above → **Grant admin consent** for the GridLogic home tenant (customers consent via in-app URL)
6. **Certificates & secrets** (or federated credential) → store per-customer material in Azure Key Vault as `graph-creds-{tenantId}` — never in Postgres
7. Set env: `GRAPH_APP_CLIENT_ID=<application-client-id>`, `AZURE_KEY_VAULT_URI=https://….vault.azure.net`

**In-product flow**

1. Bind customer Entra directory ID (`entra_tenant_id`) at provision / **Connectors**
2. Customer Global Admin opens **Open admin consent** on `/connectors`
3. Consent health → `healthy`; directory snapshots run for leaver emails on case detail
4. Optional: enable **Graph / AD auto-evidence** to attach hashed snapshots to auto-mapped FedRAMP/CMMC steps (`evidence.auto_collected`). Critical steps still require human attest (`require_human_attest_on_critical`).

**DEMO_MODE:** no Graph credentials required. Seed org has healthy consent + auto-evidence; case `jordan.lee@northwind.example` shows **Entra still enabled** via `DemoGraphClient`, hybrid AD mismatch, and **Phase 5** pre-seeded system-collected Graph/AD evidence on critical steps that remain pending until human attest (ticket or upload). Evidence Pack PDF is **v3** (System-collected vs Human-attached). Use **Simulate consent** / **Refresh Graph snapshot** on Connectors and case detail.

See `lib/connectors/graph/`, migration `007_graph_connector.sql`, [ADR-002](docs/adr/002-graph-readonly-and-ad-connector.md).

### 3. Stripe

1. Create products/prices:
   - Team — $79/mo → `STRIPE_PRICE_TEAM`
   - Growth — $149/mo → `STRIPE_PRICE_GROWTH`
   - Agency — $249/mo → `STRIPE_PRICE_AGENCY`
2. Set `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
3. Webhook endpoint: `POST /api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Set `STRIPE_WEBHOOK_SECRET`
4. Enable Customer Portal in Stripe Dashboard

### 4. Resend

1. Create an API key at [resend.com](https://resend.com)
2. Set `RESEND_API_KEY` and optionally `RESEND_FROM_EMAIL`
3. If unset, overdue emails log to the server console and no-op (safe for local/dev)

### 5. Overdue email cron

Route: `GET|POST /api/cron/overdue`

Protect with `CRON_SECRET`:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/overdue
```

`vercel.json` schedules daily `0 14 * * *` (14:00 UTC). On Vercel, also set `CRON_SECRET` and configure the cron Authorization header, or rely on Vercel Cron + your own secret check in the route.

### 6. Deploy

**Current:** Vercel (existing path).

**GridLogic target:** Azure Container Apps + SQL + Blob + Key Vault — see [`infra/README.md`](infra/README.md) (Bicep stubs; deploy not wired without credentials).

```bash
vercel
# or connect the GitHub repo in the Vercel dashboard
```

Set all env vars from `.env.example`. Set `NEXT_PUBLIC_APP_URL` to your production URL. Confirm `DEMO_MODE=false`.

## Pricing gates (in-app)

| Plan | Price | Limits |
|------|-------|--------|
| Trial | Free | 3 offboards total while unpaid |
| Team | $79/mo | 1 org, 25 offboards/mo, 90-day retention |
| Growth | $149/mo | Unlimited offboards, 365-day retention |
| Agency | $249/mo | Legacy parent + up to 25 client orgs (still sold). GridLogic operator console is preferred for managed isolation. |

## Key routes

| Path | Purpose |
|------|---------|
| `/` | Marketing landing |
| `/auth/login`, `/auth/signup` | Auth |
| `/dashboard` | Org overview |
| `/cases`, `/cases/new`, `/cases/[id]` | Offboarding cases + checklist |
| `/settings` | Stack profile (M365 / Google / hybrid) |
| `/billing` | Stripe Checkout + Customer Portal |
| `/clients` | Legacy Agency client orgs (not GridLogic security boundary) |
| `/operator` | GridLogic operator console (tenants, JIT, onboard) |
| `/operator/onboard` | GridLogic customer onboard wizard |
| `/operator/docs` | Provision CLI / infra runbook links |
| `/api/export/[caseId]/pdf` | Evidence Pack PDF |
| `/api/export/[caseId]/csv` | Evidence Pack CSV |
| `/api/stripe/*` | Checkout, portal, webhook |
| `/api/cron/overdue` | Overdue critical-step emails |

## Key files

- `lib/templates/*` — seeded M365 / Google / Hybrid templates
- `lib/pdf/evidence-pack.tsx` — PDF document
- `lib/demo/store.ts` — in-memory demo backend
- `lib/tenancy.ts` / `lib/org-bootstrap.ts` — tenant_id + JIT harden
- `lib/connectors/ad.ts` — Hybrid AD mismatch + snapshot helpers (Phase 4)
- `apps/connector/` — outbound Hybrid Connector skeleton (mock AD for CI)
- `docs/connectors/hybrid-ad.md` — mTLS / OU / revoke protocol
- `supabase/migrations/*` — schema, RLS, seeds
- `infra/*` — Azure Bicep spine (Phase 1 stubs)
- `scripts/provision-customer.ts` — GridLogic provision checklist CLI
- `proxy.ts` — Supabase session refresh (Next.js proxy)

## Scripts

```bash
npm run dev        # local development
npm run build      # production build
npm run start      # serve production build
npm run lint       # eslint
npm test           # vitest
npm run provision  # GridLogic tenant provision dry-run
```

## Hybrid AD connector (Phase 4)

See [`docs/connectors/hybrid-ad.md`](docs/connectors/hybrid-ad.md) and [`apps/connector/README.md`](apps/connector/README.md). Demo case shows cloud disabled / on-prem AD still enabled mismatch.

## Out of scope (MVP)

SCIM/IdP auto-revoke, MDM APIs, HRIS sync, mobile apps. Graph connector is charter Phase 3; AD connector foundation is Phase 4 (this repo).
