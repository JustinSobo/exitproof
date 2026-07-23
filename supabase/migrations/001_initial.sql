-- ExitProof initial schema
-- Run in Supabase SQL editor or via supabase db push

create extension if not exists "pgcrypto";

create type public.stack_profile as enum ('m365', 'google', 'hybrid');
create type public.plan_id as enum ('trial', 'team', 'growth', 'agency');
create type public.member_role as enum ('owner', 'admin', 'member');
create type public.case_status as enum ('open', 'in_progress', 'blocked', 'closed');
create type public.checklist_status as enum ('pending', 'done', 'skipped', 'blocked');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  stack_profile public.stack_profile not null default 'hybrid',
  plan public.plan_id not null default 'trial',
  stripe_customer_id text unique,
  stripe_subscription_id text,
  parent_org_id uuid references public.organizations(id) on delete cascade,
  retention_days integer not null default 90,
  offboards_this_month integer not null default 0,
  offboards_month_key text not null default to_char(timezone('utc', now()), 'YYYY-MM'),
  trial_offboards_used integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index organizations_parent_idx on public.organizations(parent_org_id);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'member',
  email text not null,
  full_name text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (org_id, user_id)
);

create index organization_members_user_idx on public.organization_members(user_id);

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  stack public.stack_profile not null,
  description text not null default '',
  created_at timestamptz not null default timezone('utc', now())
);

create table public.template_steps (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id) on delete cascade,
  title text not null,
  description text not null default '',
  sort_order integer not null default 0,
  requires_evidence boolean not null default false,
  is_critical boolean not null default false,
  category text not null default 'General'
);

create index template_steps_template_idx on public.template_steps(template_id, sort_order);

create table public.offboarding_cases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  employee_name text not null,
  employee_email text not null,
  status public.case_status not null default 'open',
  assignee_email text,
  due_date date,
  template_id uuid references public.templates(id),
  template_name text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  closed_at timestamptz,
  notes text
);

create index offboarding_cases_org_idx on public.offboarding_cases(org_id, created_at desc);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.offboarding_cases(id) on delete cascade,
  template_step_id uuid references public.template_steps(id),
  title text not null,
  description text not null default '',
  requires_evidence boolean not null default false,
  is_critical boolean not null default false,
  status public.checklist_status not null default 'pending',
  notes text,
  ticket_url text,
  completed_at timestamptz,
  completed_by text,
  sort_order integer not null default 0,
  category text not null default 'General'
);

create index checklist_items_case_idx on public.checklist_items(case_id, sort_order);

create table public.evidence_files (
  id uuid primary key default gen_random_uuid(),
  checklist_item_id uuid not null references public.checklist_items(id) on delete cascade,
  case_id uuid not null references public.offboarding_cases(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  uploaded_by text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index evidence_files_case_idx on public.evidence_files(case_id);

-- Append-only audit trail: no UPDATE/DELETE grants for authenticated roles (see RLS migration)
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid references public.offboarding_cases(id) on delete set null,
  actor_id uuid,
  actor_email text,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index audit_events_org_idx on public.audit_events(org_id, created_at);
create index audit_events_case_idx on public.audit_events(case_id, created_at);

-- Storage bucket for evidence (run once; ignore if exists)
insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict (id) do nothing;
