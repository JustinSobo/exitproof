-- Phase 4: Hybrid AD connector foundation
--
-- Tables for outbound Windows connector registration, heartbeats, and
-- read-only directory snapshots. Connector API auth is mTLS (client cert);
-- tenant_id MUST match the registered connector's tenant — never accept
-- tenant_id from an unauthenticated body alone.
-- Leave migrations 007/008 for other agents.

-- Optional add-on flags on organizations
alter table public.organizations
  add column if not exists hybrid_ad_enabled boolean not null default false;

alter table public.organizations
  add column if not exists ad_auto_evidence_enabled boolean not null default false;

comment on column public.organizations.hybrid_ad_enabled is
  'SKU add-on: Hybrid AD Audit — connector + snapshots + mismatch alerts.';

comment on column public.organizations.ad_auto_evidence_enabled is
  'When true, optional jobs may attach system-collected AD exports as evidence.';

-- Registered Hybrid Connectors (one or more per tenant)
create table if not exists public.ad_connectors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations (tenant_id),
  org_id uuid not null references public.organizations (id) on delete cascade,
  display_name text not null default 'ExitProof Hybrid Connector',
  hostname text,
  -- SHA-256 thumbprint of client cert (hex, lowercase). Revoke by setting revoked_at.
  cert_thumbprint text not null,
  -- Opaque registration secret hash (bcrypt/argon preferred in prod; stub stores sha256 hex).
  registration_token_hash text not null,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'revoked', 'error')),
  ou_scopes text[] not null default '{}',
  last_heartbeat_at timestamptz,
  last_heartbeat_payload jsonb,
  agent_version text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (tenant_id, cert_thumbprint)
);

create index if not exists ad_connectors_tenant_id_idx
  on public.ad_connectors (tenant_id);

create index if not exists ad_connectors_org_id_idx
  on public.ad_connectors (org_id);

comment on table public.ad_connectors is
  'Outbound Hybrid AD connectors. Auth = client cert mTLS; revoke sets revoked_at + status.';

-- Directory account snapshots from connector (minimal attributes; no password hashes)
create table if not exists public.ad_directory_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations (tenant_id),
  org_id uuid not null references public.organizations (id) on delete cascade,
  connector_id uuid not null references public.ad_connectors (id) on delete cascade,
  case_id uuid references public.offboarding_cases (id) on delete set null,
  -- Correlation key (usually UPN / sAMAccountName / objectGUID)
  directory_key text not null,
  sam_account_name text,
  user_principal_name text,
  object_guid text,
  -- Derived from userAccountControl ACCOUNTDISABLE bit (read-only)
  account_enabled boolean not null,
  user_account_control integer,
  last_logon_at timestamptz,
  member_of text[] not null default '{}',
  distinguished_name text,
  -- Optional cloud side for hybrid mismatch (Phase 3 Graph fills this; demo may stub)
  cloud_account_enabled boolean,
  hybrid_mismatch boolean not null default false,
  raw_attributes jsonb not null default '{}'::jsonb,
  collected_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists ad_directory_snapshots_tenant_case_idx
  on public.ad_directory_snapshots (tenant_id, case_id);

create index if not exists ad_directory_snapshots_org_key_idx
  on public.ad_directory_snapshots (org_id, directory_key);

comment on table public.ad_directory_snapshots is
  'Read-only AD account snapshots. Never store password hashes or secrets.';

comment on column public.ad_directory_snapshots.hybrid_mismatch is
  'True when cloud_account_enabled = false AND account_enabled = true (on-prem still live).';

-- Optional auto-evidence job stub (Phase 4 foundation; full policy in Phase 5)
create table if not exists public.ad_auto_evidence_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations (tenant_id),
  org_id uuid not null references public.organizations (id) on delete cascade,
  case_id uuid not null references public.offboarding_cases (id) on delete cascade,
  checklist_item_id uuid references public.checklist_items (id) on delete set null,
  snapshot_id uuid references public.ad_directory_snapshots (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'collected', 'attached', 'failed', 'skipped')),
  content_hash text,
  storage_path text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ad_auto_evidence_jobs_tenant_case_idx
  on public.ad_auto_evidence_jobs (tenant_id, case_id);

-- RLS
alter table public.ad_connectors enable row level security;
alter table public.ad_directory_snapshots enable row level security;
alter table public.ad_auto_evidence_jobs enable row level security;

create policy ad_connectors_select on public.ad_connectors
  for select using (public.is_org_member(org_id));

create policy ad_connectors_admin_write on public.ad_connectors
  for all using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));

create policy ad_snapshots_select on public.ad_directory_snapshots
  for select using (public.is_org_member(org_id));

create policy ad_snapshots_admin_write on public.ad_directory_snapshots
  for all using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));

create policy ad_auto_evidence_select on public.ad_auto_evidence_jobs
  for select using (public.is_org_member(org_id));

create policy ad_auto_evidence_admin_write on public.ad_auto_evidence_jobs
  for all using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));
