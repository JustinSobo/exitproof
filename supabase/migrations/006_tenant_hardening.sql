-- Phase 1: tenant hardening — immutable tenant_id + GridLogic Entra bind helpers
--
-- SECURITY: tenant_id MUST be resolved from the authenticated session / membership
-- (organizations.tenant_id via getCurrentOrg), NEVER from client request body alone.
-- See lib/tenancy.ts.

-- Immutable tenant identifier (aligned with organizations.id for existing rows)
alter table public.organizations
  add column if not exists tenant_id uuid;

update public.organizations
set tenant_id = id
where tenant_id is null;

alter table public.organizations
  alter column tenant_id set not null;

alter table public.organizations
  alter column tenant_id set default gen_random_uuid();

create unique index if not exists organizations_tenant_id_uidx
  on public.organizations (tenant_id);

-- Keep tenant_id = id for newly bootstrapped orgs (unless provision CLI sets both)
create or replace function public.organizations_set_tenant_id()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.tenant_id is null then
      new.tenant_id := new.id;
    end if;
    return new;
  end if;

  -- Immutable after insert
  if new.tenant_id is distinct from old.tenant_id then
    raise exception 'organizations.tenant_id is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_tenant_id_immutable on public.organizations;
create trigger organizations_tenant_id_immutable
  before insert or update on public.organizations
  for each row
  execute function public.organizations_set_tenant_id();

-- Lookup helper for GridLogic / Entra-bound join (service role / provisioned path)
create index if not exists organizations_entra_tenant_id_idx
  on public.organizations (entra_tenant_id)
  where entra_tenant_id is not null;

comment on column public.organizations.tenant_id is
  'Immutable ExitProof tenant UUID. Source of truth for isolation; always from session, never client body.';

comment on column public.organizations.entra_tenant_id is
  'Customer Microsoft Entra directory ID. Required for GRIDLOGIC_MANAGED provisioning; replaces domain JIT.';
