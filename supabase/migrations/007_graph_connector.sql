-- Phase 3: Microsoft Graph read-only connector status + optional auto-evidence flag
--
-- Consent health and auto-evidence are per-tenant (organizations row).
-- Graph tokens/certs stay in Azure Key Vault — never store secrets here.
-- See lib/connectors/graph/ and docs/adr/002-graph-readonly-and-ad-connector.md.

alter table public.organizations
  add column if not exists graph_consent_status text not null default 'not_started',
  add column if not exists graph_consented_at timestamptz,
  add column if not exists graph_last_sync_at timestamptz,
  add column if not exists auto_evidence_enabled boolean not null default false;

alter table public.organizations
  drop constraint if exists organizations_graph_consent_status_check;

alter table public.organizations
  add constraint organizations_graph_consent_status_check
  check (
    graph_consent_status in (
      'not_started',
      'pending',
      'healthy',
      'revoked',
      'error'
    )
  );

comment on column public.organizations.graph_consent_status is
  'Entra admin consent health for GridLogic multi-tenant Graph RO app (Phase 3).';

comment on column public.organizations.graph_consented_at is
  'When customer admin consent was recorded as healthy.';

comment on column public.organizations.graph_last_sync_at is
  'Last successful Graph directory snapshot for this tenant.';

comment on column public.organizations.auto_evidence_enabled is
  'When true, Graph snapshots may attach hashed system-collected evidence to mapped checklist steps.';
