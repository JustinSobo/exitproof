# Secret scanning & dependency audit

**Status:** Phase 6 platform hardening (in-repo)  
**Owner:** GridLogic platform / ExitProof eng  
**Related:** [CHARTER](../CHARTER.md), [threat model](threat-model.md), [SOC 2 readiness](soc2-readiness.md)

## Goals

- Prevent credentials, tokens, and private keys from landing in git history
- Keep npm / Actions supply chain reviewable before merge
- Document what GridLogic operators run out-of-band (Azure Defender, Key Vault)

## In-repo controls

| Control | Where | Notes |
|---------|-------|-------|
| CI lint + typecheck + test + build | [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) | Runs on PR and push to `main` |
| Dependabot (optional) | [`.github/dependabot.yml`](../../.github/dependabot.yml) | Weekly npm + Actions PRs |
| Env footgun guards | `lib/env.ts` | Refuse `DEMO_MODE` / missing keys in production-oriented runtime |
| No secrets in IaC samples | `infra/`, `.env.example` | Placeholders only |

## Recommended GitHub settings (org / repo)

Enable on the ExitProof GitHub repository (Settings → Code security):

1. **Secret scanning** — alert on known secret patterns in pushes and PRs  
2. **Push protection** — block commits that contain high-confidence secrets  
3. **Dependabot alerts** + **Dependabot security updates** — CVE-driven PRs  
4. **CodeQL** (optional) — JS/TS default queries for injection / XSS classes  

These are platform toggles, not code. Confirm with GridLogic GitHub admins during Azure cutover.

## Local / CI dependency audit

```bash
# Advisory report (does not fail the build by default)
npm audit

# Prefer Dependabot PRs for routine bumps; use audit for incident triage
npm audit --omit=dev
```

**Policy (stub):** Critical/High advisories affecting runtime auth, crypto, or HTTP clients must be triaged within **7 days**; Medium within **30 days**. Document exceptions in the IR ticket.

## What must never be committed

- Supabase service role / anon keys (beyond local `.env.local`, gitignored)
- Stripe secret / webhook signing secret
- Graph client secrets or cert private keys
- Hybrid AD connector registration tokens or client cert PEMs
- Azure Key Vault connection strings / SP passwords
- Customer evidence blobs or directory exports

Rotate immediately if any of the above appear in git history (see [key-rotation.md](key-rotation.md)).

## Azure-side (out of repo)

When production lands on Azure:

- Prefer **managed identity** over long-lived secrets
- Store per-tenant Graph/AD material in **Key Vault**; enable soft-delete + purge protection
- Enable Microsoft Defender for Cloud / DevOps secret scanning on the Azure DevOps or GitHub connection used for deploy
- Restrict who can read Key Vault secrets (operator JIT + break-glass only)

## Pen-test note

Live Azure / Entra pen-test engagement is **out of band** for this in-repo Phase 6 slice. Track findings against the [threat model](threat-model.md) and remediate before Standard SKU GA.
