-- A6: Role-aware RLS — admin/owner for privileged ops; block free top-level org INSERT;
-- add scoped DELETE policies. Signup uses bootstrap_organization().

create or replace function public.org_member_role(target uuid)
returns public.member_role
language sql
stable
security definer
set search_path = public
as $$
  select m.role
  from public.organization_members m
  where m.org_id = target
    and m.user_id = auth.uid()
  limit 1;
$$;

-- Owner or admin of the target org, or of its parent (agency operators on client orgs).
create or replace function public.is_org_admin(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
      and (
        m.org_id = target
        or m.org_id = (
          select o.parent_org_id from public.organizations o where o.id = target
        )
      )
  );
$$;

-- Bootstrap a top-level org + owner membership (only way to create parent_org_id IS NULL).
create or replace function public.bootstrap_organization(
  p_name text,
  p_stack public.stack_profile default 'hybrid',
  p_full_name text default null,
  p_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_uid uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  v_email := coalesce(
    nullif(trim(p_email), ''),
    (select u.email from auth.users u where u.id = v_uid)
  );

  if v_email is null or length(trim(p_name)) = 0 then
    raise exception 'Organization name and email are required';
  end if;

  insert into public.organizations (name, stack_profile, plan)
  values (trim(p_name), p_stack, 'trial')
  returning id into v_org_id;

  insert into public.organization_members (org_id, user_id, role, email, full_name)
  values (v_org_id, v_uid, 'owner', v_email, nullif(trim(p_full_name), ''));

  return v_org_id;
end;
$$;

revoke all on function public.bootstrap_organization(text, public.stack_profile, text, text) from public;
grant execute on function public.bootstrap_organization(text, public.stack_profile, text, text) to authenticated;

-- Organizations: no free top-level INSERT; only agency admins create children
drop policy if exists org_insert on public.organizations;
create policy org_insert on public.organizations
  for insert with check (
    parent_org_id is not null
    and public.is_org_admin(parent_org_id)
  );

drop policy if exists org_update on public.organizations;
create policy org_update on public.organizations
  for update using (public.is_org_admin(id));

drop policy if exists org_delete on public.organizations;
create policy org_delete on public.organizations
  for delete using (
    parent_org_id is not null
    and public.is_org_admin(parent_org_id)
  );

-- Members: only admins invite/update/remove (self-read still via is_org_member)
drop policy if exists members_insert on public.organization_members;
create policy members_insert on public.organization_members
  for insert with check (public.is_org_admin(org_id));

drop policy if exists members_update on public.organization_members;
create policy members_update on public.organization_members
  for update using (public.is_org_admin(org_id));

drop policy if exists members_delete on public.organization_members;
create policy members_delete on public.organization_members
  for delete using (public.is_org_admin(org_id));

-- Cases: members can work cases; only admins delete
drop policy if exists cases_delete on public.offboarding_cases;
create policy cases_delete on public.offboarding_cases
  for delete using (public.is_org_admin(org_id));

drop policy if exists checklist_delete on public.checklist_items;
create policy checklist_delete on public.checklist_items
  for delete using (
    exists (
      select 1 from public.offboarding_cases c
      where c.id = case_id and public.is_org_admin(c.org_id)
    )
  );

drop policy if exists evidence_delete on public.evidence_files;
create policy evidence_delete on public.evidence_files
  for delete using (public.is_org_admin(org_id));

-- Storage delete for evidence (admins)
drop policy if exists evidence_storage_delete on storage.objects;
create policy evidence_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'evidence'
    and public.is_org_admin((storage.foldername(name))[1]::uuid)
  );

-- Audit remains append-only: no UPDATE/DELETE policies
