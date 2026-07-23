-- Phase 5: auto-evidence policy flags + evidence provenance for Evidence Pack v3

alter table public.organizations
  add column if not exists require_human_attest_on_critical boolean not null default true;

comment on column public.organizations.require_human_attest_on_critical is
  'When true (default), critical checklist steps cannot be completed with system-collected evidence alone — human-attached file or ticket URL required.';

alter table public.evidence_files
  add column if not exists collection_source text;

comment on column public.evidence_files.collection_source is
  'Provenance for Evidence Pack v3: human | system:graph | system:ad | system. Null = derive from uploaded_by / path.';

-- Soft check: allow known values or null
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'evidence_files_collection_source_check'
  ) then
    alter table public.evidence_files
      add constraint evidence_files_collection_source_check
      check (
        collection_source is null
        or collection_source in ('human', 'system:graph', 'system:ad', 'system')
      );
  end if;
end $$;
