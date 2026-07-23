-- Phase 2: GridLogic operator console — JIT staff access + SSO enforce
--
-- Agency parent/child remains commercially available but is NOT the security
-- boundary for GridLogic managed tenants. Staff access requires explicit
-- JIT grants (ticket_id + expiry) with append-only audit_events.

-- Customer SSO enforcement (GridLogic onboard wizard)
alter table public.organizations
  add column if not exists sso_enforced boolean not null default false;

comment on column public.organizations.sso_enforced is
  'When true, customer workspace expects Entra SSO (password login discouraged). Set by GridLogic onboard wizard.';

-- GridLogic operator registry (standing staff — NOT standing tenant access)
create table if not exists public.operator_staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists operator_staff_email_idx
  on public.operator_staff (lower(email));

create index if not exists operator_staff_active_idx
  on public.operator_staff (active)
  where active = true;

comment on table public.operator_staff is
  'GridLogic staff allowed to use /operator. Tenant data access still requires an active jit_access_grants row.';

-- Time-boxed, ticketed staff access to a customer tenant
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'jit_grant_status' and n.nspname = 'public'
  ) then
    create type public.jit_grant_status as enum (
      'requested',
      'active',
      'revoked',
      'expired'
    );
  end if;
end $$;

create table if not exists public.jit_access_grants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  tenant_id uuid not null,
  staff_user_id uuid not null references auth.users(id) on delete cascade,
  staff_email text not null,
  ticket_id text not null,
  reason text,
  status public.jit_grant_status not null default 'requested',
  requested_at timestamptz not null default timezone('utc', now()),
  activated_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint jit_access_grants_ticket_nonempty check (length(trim(ticket_id)) > 0),
  constraint jit_access_grants_expires_after_request check (expires_at > requested_at)
);

create index if not exists jit_access_grants_org_idx
  on public.jit_access_grants (org_id, status, expires_at);

create index if not exists jit_access_grants_staff_idx
  on public.jit_access_grants (staff_user_id, status, expires_at);

create index if not exists jit_access_grants_tenant_idx
  on public.jit_access_grants (tenant_id);

comment on table public.jit_access_grants is
  'Time-boxed GridLogic staff access. ticket_id + expires_at required. Mirrored in audit_events.';

-- Helpers
create or replace function public.is_operator_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.operator_staff s
    where s.user_id = auth.uid()
      and s.active = true
  );
$$;

create or replace function public.has_active_jit_for_org(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.jit_access_grants g
    where g.org_id = p_org_id
      and g.staff_user_id = auth.uid()
      and g.status = 'active'
      and g.expires_at > timezone('utc', now())
  );
$$;

-- Expire stale active grants (call from app / cron; also enforced in app reads)
create or replace function public.expire_stale_jit_grants()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.jit_access_grants
  set status = 'expired'
  where status = 'active'
    and expires_at <= timezone('utc', now());
  get diagnostics n = row_count;
  return n;
end;
$$;

-- RLS
alter table public.operator_staff enable row level security;
alter table public.jit_access_grants enable row level security;

drop policy if exists operator_staff_select_self on public.operator_staff;
create policy operator_staff_select_self on public.operator_staff
  for select to authenticated
  using (user_id = auth.uid() or public.is_operator_staff());

drop policy if exists jit_grants_select on public.jit_access_grants;
create policy jit_grants_select on public.jit_access_grants
  for select to authenticated
  using (
    public.is_operator_staff()
    or staff_user_id = auth.uid()
    or public.is_org_admin(org_id)
  );

drop policy if exists jit_grants_insert on public.jit_access_grants;
create policy jit_grants_insert on public.jit_access_grants
  for insert to authenticated
  with check (
    public.is_operator_staff()
    and staff_user_id = auth.uid()
  );

drop policy if exists jit_grants_update on public.jit_access_grants;
create policy jit_grants_update on public.jit_access_grants
  for update to authenticated
  using (public.is_operator_staff() and staff_user_id = auth.uid())
  with check (public.is_operator_staff() and staff_user_id = auth.uid());

-- Operators may read org metadata (list tenants) but not evidence via this alone.
-- Evidence/case RLS still requires membership or a future JIT-aware policy (Phase 2 UI uses service/admin for provision paths).
drop policy if exists organizations_operator_select on public.organizations;
create policy organizations_operator_select on public.organizations
  for select to authenticated
  using (public.is_operator_staff());
