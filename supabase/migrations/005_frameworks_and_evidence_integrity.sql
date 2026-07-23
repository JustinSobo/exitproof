-- Phase A: frameworks/controls catalog, evidence integrity columns, org onboarding fields

-- Organizations: framework targeting + Entra/onboarding state
alter table public.organizations
  add column if not exists selected_frameworks text[] not null default '{}',
  add column if not exists entra_tenant_id text,
  add column if not exists onboarding_completed_at timestamptz;

-- Checklist: evidence hints, overdue dedupe, denormalized control snapshot
alter table public.checklist_items
  add column if not exists evidence_hint text,
  add column if not exists notified_at timestamptz,
  add column if not exists control_refs text[] not null default '{}';

-- Evidence integrity (hash populated in Phase E upload path)
alter table public.evidence_files
  add column if not exists content_hash text,
  add column if not exists mime_type text,
  add column if not exists byte_size bigint;

create table if not exists public.frameworks (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  version text not null default '',
  description text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.controls (
  id uuid primary key default gen_random_uuid(),
  framework_id uuid not null references public.frameworks(id) on delete cascade,
  control_id text not null,
  title text not null,
  guidance text not null default '',
  evidence_examples jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (framework_id, control_id)
);

create index if not exists controls_framework_idx on public.controls(framework_id);

create table if not exists public.template_step_controls (
  template_step_id uuid not null references public.template_steps(id) on delete cascade,
  control_id uuid not null references public.controls(id) on delete cascade,
  primary key (template_step_id, control_id)
);

create index if not exists template_step_controls_control_idx
  on public.template_step_controls(control_id);

create table if not exists public.checklist_item_controls (
  checklist_item_id uuid not null references public.checklist_items(id) on delete cascade,
  control_id uuid not null references public.controls(id) on delete cascade,
  primary key (checklist_item_id, control_id)
);

create index if not exists checklist_item_controls_control_idx
  on public.checklist_item_controls(control_id);

alter table public.frameworks enable row level security;
alter table public.controls enable row level security;
alter table public.template_step_controls enable row level security;
alter table public.checklist_item_controls enable row level security;

-- Global catalog: readable by authenticated users; writes via migrations/service role only
drop policy if exists frameworks_select on public.frameworks;
create policy frameworks_select on public.frameworks
  for select to authenticated using (true);

drop policy if exists controls_select on public.controls;
create policy controls_select on public.controls
  for select to authenticated using (true);

drop policy if exists template_step_controls_select on public.template_step_controls;
create policy template_step_controls_select on public.template_step_controls
  for select to authenticated using (true);

-- Case control snapshots: org-scoped via checklist → case
drop policy if exists checklist_item_controls_select on public.checklist_item_controls;
create policy checklist_item_controls_select on public.checklist_item_controls
  for select using (
    exists (
      select 1
      from public.checklist_items ci
      join public.offboarding_cases c on c.id = ci.case_id
      where ci.id = checklist_item_id
        and public.is_org_member(c.org_id)
    )
  );

drop policy if exists checklist_item_controls_insert on public.checklist_item_controls;
create policy checklist_item_controls_insert on public.checklist_item_controls
  for insert with check (
    exists (
      select 1
      from public.checklist_items ci
      join public.offboarding_cases c on c.id = ci.case_id
      where ci.id = checklist_item_id
        and public.is_org_member(c.org_id)
    )
  );

-- Org selected_frameworks / entra / onboarding already gated by org_update (admin)

-- Seed frameworks
insert into public.frameworks (id, slug, name, version, description, sort_order) values
  ('a0000000-0000-4000-8000-000000000001', 'fedramp', 'FedRAMP', 'Rev 5 (via NIST SP 800-53)', 'Personnel termination and account management evidence supporting FedRAMP Moderate/High baselines (AC/IA/PS family).', 10),
  ('a0000000-0000-4000-8000-000000000002', 'nist-800-53', 'NIST SP 800-53', 'Rev 5', 'Access control, identification/authentication, and personnel security controls relevant to offboarding.', 20),
  ('a0000000-0000-4000-8000-000000000003', 'cmmc-l1', 'CMMC Level 1', '2.0', 'Foundational FCI practices: authorized users and basic access control evidence for leavers.', 30),
  ('a0000000-0000-4000-8000-000000000004', 'cmmc-l2', 'CMMC Level 2', '2.0', 'CUI access practices mapped from NIST SP 800-171 for account disable, authenticator revoke, and device recovery.', 40),
  ('a0000000-0000-4000-8000-000000000005', 'nist-800-171', 'NIST SP 800-171', 'Rev 2', 'Protecting CUI in nonfederal systems — AC/IA practices used as the CMMC L2 spine.', 50),
  ('a0000000-0000-4000-8000-000000000006', 'soc2', 'SOC 2', 'TSC 2017', 'Trust Services Criteria CC6 logical access — provisioning, modification, and removal.', 60),
  ('a0000000-0000-4000-8000-000000000007', 'soc1', 'SOC 1', 'Org-defined CCOs', 'User provisioning/deprovisioning and privileged access removal control objectives.', 70),
  ('a0000000-0000-4000-8000-000000000008', 'iso-27001', 'ISO/IEC 27001', '2022 Annex A', 'Access control, identity, authentication, and termination-or-change-of-employment controls.', 80),
  ('a0000000-0000-4000-8000-000000000009', 'hipaa', 'HIPAA Security Rule', '45 CFR 164', 'Workforce clearance/termination and access control safeguards for ePHI environments.', 90),
  ('a0000000-0000-4000-8000-000000000010', 'nist-csf', 'NIST CSF', '2.0', 'PR.AA identity, authentication, and access control outcomes for executive evidence packs.', 100)
on conflict (slug) do nothing;

-- Seed controls
insert into public.controls (id, framework_id, control_id, title, guidance, evidence_examples) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'AC-2', 'Account Management', 'Disable or remove accounts aligned with termination; FedRAMP notify windows commonly expect prompt disable (e.g. 8h terminate / 24h unused where baseline applies).', '["Admin screenshot of disabled/blocked sign-in","Directory audit log export showing disable timestamp"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'AC-2(3)', 'Disable Accounts', 'Accounts are disabled after a defined period of inactivity or upon termination per organizational policy.', '["Account status export showing Disabled","Ticket noting disable time"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'AC-3', 'Access Enforcement', 'Enforce approved authorizations for logical access; removing group/role grants on exit supports enforcement.', '["Group membership before/after export","RBAC role removal screenshot"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'AC-6', 'Least Privilege', 'Revoke excess privileges on exit so remaining access reflects least privilege for active workforce only.', '["Privileged role removal evidence","Admin role audit export"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'IA-4', 'Identifier Management', 'Manage identifiers for users; disable or reclaim identifiers so former employees cannot authenticate.', '["User principal status screenshot","Identifier disable audit event"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'IA-5', 'Authenticator Management', 'Revoke or reset authenticators (passwords, MFA factors, tokens) on termination.', '["MFA method removal screenshot","Password reset / authenticator revoke log"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001', 'PS-4', 'Personnel Termination', 'Disable system access, revoke authenticators, recover property, and retain organizational access to former employee data as required.', '["Completed offboarding checklist with timestamps","Device return / wipe record","Mailbox/drive ownership transfer evidence"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001', 'PS-5', 'Personnel Transfer', 'When role changes (not full exit), modify access promptly to match the new position.', '["Access change ticket","Before/after group membership export"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000001', 'PS-7', 'External Personnel Security', 'Apply equivalent termination/access revocation for contractors and external personnel.', '["Contractor offboarding ticket","Vendor account disable evidence"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000002', 'AC-2', 'Account Management', 'Manage system accounts including establishing, enabling, modifying, disabling, and removing accounts.', '["Disabled account screenshot","Account lifecycle audit export"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000002', 'AC-2(3)', 'Disable Accounts', 'Disable accounts within a defined time period after inactivity or termination.', '["Disable timestamp evidence","Policy citation + completion record"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000002', 'AC-3', 'Access Enforcement', 'Enforce approved authorizations for logical access to information and system resources.', '["Access removal evidence","Authorization matrix update"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000013', 'a0000000-0000-4000-8000-000000000002', 'AC-6', 'Least Privilege', 'Employ least privilege; remove unnecessary privileges when employment ends.', '["Privileged access removal log","Role assignment export"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000014', 'a0000000-0000-4000-8000-000000000002', 'IA-4', 'Identifier Management', 'Manage identifiers by receiving authorization, selecting, assigning, preventing reuse, and disabling.', '["Identifier disable record","Directory object status"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000015', 'a0000000-0000-4000-8000-000000000002', 'IA-5', 'Authenticator Management', 'Manage authenticators including initial distribution, lost/compromised handling, and revocation.', '["MFA revoke evidence","Credential rotation record"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000016', 'a0000000-0000-4000-8000-000000000002', 'PS-4', 'Personnel Termination', 'Upon termination: disable access, terminate/revoke authenticators, retrieve property, retain access to organizational information.', '["Termination checklist pack","Property recovery form","Access disable evidence"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000017', 'a0000000-0000-4000-8000-000000000002', 'PS-5', 'Personnel Transfer', 'Review and modify logical and physical access following personnel transfers.', '["Transfer access review ticket"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000018', 'a0000000-0000-4000-8000-000000000002', 'PS-7', 'External Personnel Security', 'Establish personnel security requirements for third-party providers including termination procedures.', '["Third-party offboarding evidence"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000019', 'a0000000-0000-4000-8000-000000000003', 'AC.L1-3.1.1', 'Authorized Access Control', 'Limit information system access to authorized users — offboarding log and account export show access was removed.', '["Offboarding case export","Account status list excluding leaver"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000020', 'a0000000-0000-4000-8000-000000000003', 'AC.L1-b.1.i', 'Authorized Users (FAR 52.204-21)', 'Limit access to authorized users; termination evidence supports that unauthorized users are excluded.', '["User access roster","Disable confirmation"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000021', 'a0000000-0000-4000-8000-000000000003', 'IA.L1-3.5.1', 'Identification', 'Identify information system users — identifiers for leavers are disabled or removed.', '["User identifier disable screenshot"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000022', 'a0000000-0000-4000-8000-000000000003', 'IA.L1-3.5.2', 'Authentication', 'Authenticate users before allowing access — revoke authenticators so leavers cannot authenticate.', '["Session revoke + MFA removal evidence"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000023', 'a0000000-0000-4000-8000-000000000004', 'AC.L2-3.1.1', 'Limit System Access', 'Limit system access to authorized users, processes, and devices — disable leaver accounts promptly.', '["Account disable evidence","Access control list export"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000024', 'a0000000-0000-4000-8000-000000000004', 'AC.L2-3.1.2', 'Transaction & Function Control', 'Limit system access to types of transactions and functions authorized — remove role/group grants on exit.', '["Role/group removal evidence"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000025', 'a0000000-0000-4000-8000-000000000004', 'AC.L2-3.1.5', 'Least Privilege', 'Employ least privilege — strip elevated roles on termination.', '["Privileged role removal screenshot"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000026', 'a0000000-0000-4000-8000-000000000004', 'AC.L2-3.1.6', 'Non-Privileged Account Use', 'Use non-privileged accounts when accessing nonsecurity functions — ensure admin accounts for leavers are disabled.', '["Admin account disable evidence"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000027', 'a0000000-0000-4000-8000-000000000004', 'AC.L2-3.1.20', 'External Connections / Remote Access', 'Verify and control remote access connections — disable VPN/remote accounts on exit.', '["VPN account disable evidence","Remote access roster update"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000028', 'a0000000-0000-4000-8000-000000000004', 'IA.L2-3.5.1', 'Identify System Users', 'Identify information system users, processes, and devices.', '["Directory user status export"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000029', 'a0000000-0000-4000-8000-000000000004', 'IA.L2-3.5.2', 'Authenticate Users', 'Authenticate identity of users before allowing access.', '["Authenticator revoke evidence"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000030', 'a0000000-0000-4000-8000-000000000004', 'IA.L2-3.5.3', 'Multifactor Authentication', 'Use multifactor authentication for local and network access to privileged accounts and network access to non-privileged accounts — remove MFA enrollments on exit.', '["MFA method removal screenshot"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000031', 'a0000000-0000-4000-8000-000000000004', 'MP.L2-3.8.3', 'Sanitize / Media Control', 'Sanitize or destroy media containing CUI before disposal or reuse — reclaim/wipe endpoints on exit.', '["Device wipe confirmation","Asset return checklist"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000032', 'a0000000-0000-4000-8000-000000000004', 'PE.L2-3.10.1', 'Limit Physical Access', 'Limit physical access to organizational systems — deactivate badges and recover access tokens.', '["Badge deactivation record","Physical access log update"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000033', 'a0000000-0000-4000-8000-000000000005', '3.1.1', 'Limit System Access', 'Limit information system access to authorized users, processes acting on behalf of authorized users, or devices.', '["Account disable evidence"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000034', 'a0000000-0000-4000-8000-000000000005', '3.1.2', 'Limit Transaction Types', 'Limit information system access to the types of transactions and functions that authorized users are permitted to execute.', '["Permission/group removal evidence"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000035', 'a0000000-0000-4000-8000-000000000005', '3.1.5', 'Least Privilege', 'Employ the principle of least privilege, including for specific security functions and privileged accounts.', '["Privileged access removal"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000036', 'a0000000-0000-4000-8000-000000000005', '3.1.6', 'Non-Privileged Accounts', 'Use non-privileged accounts or roles when accessing nonsecurity functions.', '["Admin account disable"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000037', 'a0000000-0000-4000-8000-000000000005', '3.1.20', 'Control Remote Access', 'Verify and control/limit connections to and use of external information systems / remote access.', '["VPN/remote disable evidence"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000038', 'a0000000-0000-4000-8000-000000000005', '3.5.1', 'Identify Users', 'Identify information system users, processes acting on behalf of users, or devices.', '["User identification disable record"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000039', 'a0000000-0000-4000-8000-000000000005', '3.5.2', 'Authenticate Users', 'Authenticate (or verify) the identities of those users, processes, or devices as a prerequisite to allowing access.', '["Session/authenticator revoke"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000040', 'a0000000-0000-4000-8000-000000000005', '3.5.3', 'Multifactor Authentication', 'Use multifactor authentication for local and network access to privileged accounts and for network access to non-privileged accounts.', '["MFA enrollment removal"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000041', 'a0000000-0000-4000-8000-000000000005', '3.8.3', 'Sanitize Media', 'Sanitize or destroy information system media containing CUI before disposal or release for reuse.', '["Endpoint wipe / media sanitize record"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000042', 'a0000000-0000-4000-8000-000000000005', '3.10.1', 'Limit Physical Access', 'Limit physical access to organizational information systems, equipment, and the respective operating environments to authorized individuals.', '["Badge/access token recovery"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000043', 'a0000000-0000-4000-8000-000000000006', 'CC6.1', 'Logical Access Security', 'The entity implements logical access security software, infrastructure, and architectures over protected information assets.', '["IdP disable evidence","Access control configuration screenshot"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000044', 'a0000000-0000-4000-8000-000000000006', 'CC6.2', 'Access Provisioning / Removal', 'Prior to issuing credentials, and upon modification or removal of access, the entity registers and authorizes new access / removes access for terminations.', '["Termination access removal ticket + evidence","Checklist completion timestamps"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000045', 'a0000000-0000-4000-8000-000000000006', 'CC6.3', 'Role Change / Access Removal', 'The entity authorizes, modifies, or removes access to data, software, functions, and other protected information assets based on roles and responsibilities.', '["Group/role membership before/after","Privileged access removal"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000046', 'a0000000-0000-4000-8000-000000000007', 'CCO-UP-1', 'User Provisioning / Deprovisioning', 'Controls provide reasonable assurance that user accounts are provisioned and deprovisioned based on authorized requests (termination triggers disable).', '["Authorized offboarding request","Account disable confirmation"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000047', 'a0000000-0000-4000-8000-000000000007', 'CCO-PA-1', 'Privileged Access Removal', 'Controls provide reasonable assurance that privileged access is removed or modified when job responsibilities change or employment ends.', '["Privileged role removal evidence","Admin audit export"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000048', 'a0000000-0000-4000-8000-000000000008', 'A.5.15', 'Access Control', 'Rules to control physical and logical access to information and other associated assets are established and implemented.', '["Access removal evidence pack"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000049', 'a0000000-0000-4000-8000-000000000008', 'A.5.16', 'Identity Management', 'The full life cycle of identities is managed — including deactivation on termination.', '["Identity disable record"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000050', 'a0000000-0000-4000-8000-000000000008', 'A.5.17', 'Authentication Information', 'Allocation and management of authentication information is controlled — revoke secrets/MFA on exit.', '["Authenticator revoke evidence"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000051', 'a0000000-0000-4000-8000-000000000008', 'A.5.18', 'Access Rights', 'Access rights to information and assets are provisioned, reviewed, modified and removed.', '["Access rights removal evidence"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000052', 'a0000000-0000-4000-8000-000000000008', 'A.6.5', 'Responsibilities After Termination', 'Information security responsibilities and duties that remain valid after termination or change of employment are defined and enforced.', '["Termination checklist","NDA/continuing obligations note if applicable"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000053', 'a0000000-0000-4000-8000-000000000008', 'A.6.1', 'Screening', 'Background verification of candidates is carried out (context for workforce trust; offboarding closes the lifecycle).', '["HR ticket linking hire→exit lifecycle"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000054', 'a0000000-0000-4000-8000-000000000008', 'A.6.2', 'Terms and Conditions of Employment', 'Employment agreements state information security responsibilities — exit confirms revocation of access granted under those terms.', '["Exit confirmation / ticket"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000055', 'a0000000-0000-4000-8000-000000000008', 'A.6.3', 'Information Security Awareness', 'Personnel and relevant interested parties receive awareness — exit process is part of operational security practice.', '["Completed offboarding process record"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000056', 'a0000000-0000-4000-8000-000000000008', 'A.8.2', 'Privileged Access Rights', 'The allocation and use of privileged access rights is restricted and managed — revoke on exit.', '["Privileged access removal"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000057', 'a0000000-0000-4000-8000-000000000008', 'A.8.3', 'Information Access Restriction', 'Access to information and other associated assets is restricted in accordance with the access control policy.', '["Data repository access removal","Drive/mailbox transfer evidence"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000058', 'a0000000-0000-4000-8000-000000000009', '164.308(a)(3)(ii)(C)', 'Termination Procedures', 'Implement procedures for terminating access to electronic protected health information when employment ends.', '["Workforce termination access checklist","Account disable timestamp"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000059', 'a0000000-0000-4000-8000-000000000009', '164.308(a)(3)(ii)(A)', 'Authorization and/or Supervision', 'Implement procedures for authorization and/or supervision of workforce members who work with ePHI.', '["Access authorization record closed on exit"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000060', 'a0000000-0000-4000-8000-000000000009', '164.312(a)(2)(i)', 'Unique User Identification', 'Assign a unique name and/or number for identifying and tracking user identity — disable unique IDs on exit.', '["Unique user ID disable evidence"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000061', 'a0000000-0000-4000-8000-000000000009', '164.312(d)', 'Person or Entity Authentication', 'Implement procedures to verify that a person or entity seeking access is the one claimed — revoke authenticators.', '["MFA/password revoke evidence"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000062', 'a0000000-0000-4000-8000-000000000010', 'PR.AA-01', 'Identities Managed', 'Identities and credentials for authorized users are managed — including revocation on departure.', '["Identity lifecycle evidence"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000063', 'a0000000-0000-4000-8000-000000000010', 'PR.AA-02', 'Identities Proofed / Asserted', 'Identities are proofed and bound to credentials based on risk — revoke asserted credentials on exit.', '["Credential revoke evidence"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000064', 'a0000000-0000-4000-8000-000000000010', 'PR.AA-03', 'Users Authenticated', 'Users are authenticated commensurate with risk — prevent authentication after termination.', '["Session revoke + account disable"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000065', 'a0000000-0000-4000-8000-000000000010', 'PR.AA-04', 'Identity Assertions Protected', 'Identity assertions are protected, conveyed, and verified — invalidate sessions/tokens.', '["Token/session invalidation evidence"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000066', 'a0000000-0000-4000-8000-000000000010', 'PR.AA-05', 'Access Permissions Managed', 'Access permissions, entitlements, and authorizations are defined and managed — remove on exit.', '["Entitlement removal evidence"]'::jsonb),
  ('b0000000-0000-4000-8000-000000000067', 'a0000000-0000-4000-8000-000000000010', 'PR.AA-06', 'Physical Access Managed', 'Physical access to assets is managed — recover badges and deactivate physical access.', '["Badge deactivation evidence"]'::jsonb)
on conflict (framework_id, control_id) do nothing;

-- Link template steps → controls (by template_id + sort_order)
insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000001'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000002'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000007'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000010'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000011'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000016'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000019'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000020'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000021'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000023'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000028'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000033'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000038'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000043'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000044'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000046'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000048'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000049'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000052'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000058'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000060'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000062'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000006'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000007'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000015'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000016'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000022'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000029'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000039'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000044'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000050'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000061'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000064'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000065'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000006'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000007'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000015'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000016'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000022'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000029'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000030'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000039'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000040'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000044'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000050'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000061'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000063'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000003'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000004'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000012'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000013'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000024'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000025'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000034'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000035'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000045'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000051'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000057'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000066'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000007'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000016'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000044'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000052'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000057'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000058'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000007'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000016'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000044'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000052'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000057'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000058'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000003'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000004'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000012'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000013'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000024'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000025'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000034'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000035'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000045'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000051'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000057'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000066'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000004'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 8
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000013'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 8
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000025'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 8
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000026'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 8
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000035'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 8
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000036'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 8
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000045'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 8
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000047'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 8
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000056'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 8
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000066'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 8
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000007'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 9
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000016'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 9
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000031'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 9
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000041'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 9
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000052'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 9
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000067'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 9
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000003'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000012'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000027'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000037'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000043'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000048'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000007'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 11
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000016'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 11
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000044'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 11
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000046'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 11
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000052'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 11
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000058'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 11
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000059'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111101' and ts.sort_order = 11
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000001'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000002'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000007'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000010'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000011'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000016'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000019'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000020'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000021'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000023'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000028'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000033'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000038'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000043'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000044'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000046'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000048'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000049'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000052'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000058'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000060'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000062'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000006'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000007'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000015'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000016'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000022'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000029'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000039'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000044'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000050'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000061'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000064'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000065'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000006'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000007'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000015'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000016'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000022'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000029'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000030'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000039'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000040'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000044'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000050'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000061'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000063'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000003'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000004'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000012'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000013'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000024'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000025'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000034'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000035'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000045'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000051'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000057'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000066'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000007'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000016'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000044'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000052'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000057'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000058'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000007'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000016'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000044'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000052'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000057'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000058'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000004'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000013'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000025'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000026'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000035'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000036'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000045'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000047'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000056'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000066'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000006'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000007'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000015'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000016'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000022'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000029'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000030'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000039'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000040'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000044'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000050'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000061'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000063'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000004'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 8
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000013'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 8
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000025'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 8
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000026'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 8
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000035'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 8
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000036'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 8
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000045'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 8
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000047'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 8
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000056'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 8
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000066'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 8
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000007'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 9
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000016'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 9
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000031'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 9
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000041'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 9
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000052'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 9
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000067'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 9
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000003'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000012'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000027'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000037'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000043'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000048'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000001'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000002'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000007'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000010'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000011'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000016'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000019'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000020'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000021'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000023'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000028'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000033'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000038'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000044'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000046'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000049'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000052'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000058'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000060'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000062'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000007'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 11
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000016'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 11
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000044'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 11
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000046'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 11
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000052'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 11
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000058'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 11
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000059'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111102' and ts.sort_order = 11
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000001'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000002'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000007'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000010'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000011'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000016'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000019'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000020'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000021'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000023'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000028'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000033'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000038'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000043'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000044'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000046'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000048'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000049'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000052'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000058'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000060'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000062'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 1
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000006'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000007'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000015'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000016'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000022'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000029'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000039'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000044'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000050'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000061'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000064'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000065'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000030'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000040'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000063'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 2
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000003'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000004'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000012'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000013'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000024'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000025'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000034'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000035'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000045'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000051'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000057'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000066'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000026'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000036'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000047'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000056'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 3
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000004'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000013'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000025'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000026'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000035'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000036'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000045'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000047'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000056'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000066'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000003'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000012'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000024'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000034'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000051'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000057'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 4
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000003'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000004'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000012'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000013'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000024'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000025'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000034'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000035'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000045'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000051'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000057'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000066'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000006'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000007'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000015'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000016'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000022'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000029'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000030'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000039'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000040'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000044'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000050'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000061'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000063'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 5
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000003'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000004'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000012'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000013'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000024'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000025'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000034'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000035'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000045'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000051'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000057'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000066'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000001'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000002'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000007'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000010'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000011'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000016'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000019'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000020'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000021'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000023'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000028'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000033'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000038'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000043'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000044'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000046'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000048'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000049'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000052'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000058'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000060'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000062'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 6
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000006'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000015'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000043'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000047'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000050'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000056'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 7
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000007'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 8
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000016'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 8
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000032'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 8
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000042'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 8
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000048'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 8
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000067'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 8
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000007'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 9
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000016'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 9
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000031'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 9
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000041'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 9
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000052'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 9
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000067'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 9
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000003'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000004'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000012'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000013'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000024'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000025'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000034'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000035'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000045'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000051'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000057'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000066'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000007'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000016'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000044'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000046'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000052'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000058'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000059'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 10
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000007'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 11
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000016'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 11
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000044'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 11
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000046'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 11
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000052'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 11
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000058'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 11
on conflict do nothing;

insert into public.template_step_controls (template_step_id, control_id)
select ts.id, 'b0000000-0000-4000-8000-000000000059'::uuid
from public.template_steps ts
where ts.template_id = '11111111-1111-1111-1111-111111111103' and ts.sort_order = 11
on conflict do nothing;

