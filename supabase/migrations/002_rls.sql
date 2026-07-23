-- Row Level Security: org isolation + Agency parent/child access

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.templates enable row level security;
alter table public.template_steps enable row level security;
alter table public.offboarding_cases enable row level security;
alter table public.checklist_items enable row level security;
alter table public.evidence_files enable row level security;
alter table public.audit_events enable row level security;

-- Helper: orgs the current user can access (own membership + agency children)
create or replace function public.user_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.org_id
  from public.organization_members m
  where m.user_id = auth.uid()
  union
  select c.id
  from public.organizations c
  join public.organization_members m on m.org_id = c.parent_org_id
  where m.user_id = auth.uid();
$$;

create or replace function public.is_org_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_org_ids() ids where ids = target
  );
$$;

-- Organizations
create policy org_select on public.organizations
  for select using (public.is_org_member(id) or public.is_org_member(parent_org_id));

create policy org_insert on public.organizations
  for insert with check (
    parent_org_id is null
    or public.is_org_member(parent_org_id)
  );

create policy org_update on public.organizations
  for update using (public.is_org_member(id));

-- Members
create policy members_select on public.organization_members
  for select using (public.is_org_member(org_id));

create policy members_insert on public.organization_members
  for insert with check (
    user_id = auth.uid()
    or public.is_org_member(org_id)
  );

create policy members_update on public.organization_members
  for update using (public.is_org_member(org_id));

-- Templates are readable by authenticated users
create policy templates_select on public.templates
  for select to authenticated using (true);

create policy template_steps_select on public.template_steps
  for select to authenticated using (true);

-- Cases
create policy cases_select on public.offboarding_cases
  for select using (public.is_org_member(org_id));

create policy cases_insert on public.offboarding_cases
  for insert with check (public.is_org_member(org_id));

create policy cases_update on public.offboarding_cases
  for update using (public.is_org_member(org_id));

-- Checklist
create policy checklist_select on public.checklist_items
  for select using (
    exists (
      select 1 from public.offboarding_cases c
      where c.id = case_id and public.is_org_member(c.org_id)
    )
  );

create policy checklist_insert on public.checklist_items
  for insert with check (
    exists (
      select 1 from public.offboarding_cases c
      where c.id = case_id and public.is_org_member(c.org_id)
    )
  );

create policy checklist_update on public.checklist_items
  for update using (
    exists (
      select 1 from public.offboarding_cases c
      where c.id = case_id and public.is_org_member(c.org_id)
    )
  );

-- Evidence
create policy evidence_select on public.evidence_files
  for select using (public.is_org_member(org_id));

create policy evidence_insert on public.evidence_files
  for insert with check (public.is_org_member(org_id));

-- Audit events: SELECT + INSERT only (append-only)
create policy audit_select on public.audit_events
  for select using (public.is_org_member(org_id));

create policy audit_insert on public.audit_events
  for insert with check (public.is_org_member(org_id));

-- Explicitly no UPDATE/DELETE policies for audit_events

-- Storage policies for evidence bucket
create policy evidence_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'evidence'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );

create policy evidence_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'evidence'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );
