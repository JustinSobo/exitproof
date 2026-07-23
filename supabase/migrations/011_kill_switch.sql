-- Phase 6: per-tenant kill switch (freeze logins + disable connectors)

alter table public.organizations
  add column if not exists login_frozen boolean not null default false;

alter table public.organizations
  add column if not exists connectors_disabled boolean not null default false;

comment on column public.organizations.login_frozen is
  'When true, customer members cannot access the app workspace; GridLogic operators may still use /operator.';

comment on column public.organizations.connectors_disabled is
  'When true, Graph sync/auto-evidence and Hybrid AD agent APIs refuse work (incident kill switch).';
