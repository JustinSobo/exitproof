-- Seed stack-aware templates (SOC 2 / ISO 27001 / NIST-style access revocation)

insert into public.templates (id, slug, name, stack, description) values
  ('11111111-1111-1111-1111-111111111101', 'm365-smb', 'Microsoft 365 SMB Offboarding', 'm365',
   'SOC 2 / ISO 27001-aligned access revocation for Microsoft 365 small-business tenants.'),
  ('11111111-1111-1111-1111-111111111102', 'google-workspace-smb', 'Google Workspace SMB Offboarding', 'google',
   'NIST-style access revocation checklist for Google Workspace small-business domains.'),
  ('11111111-1111-1111-1111-111111111103', 'hybrid-saas', 'Hybrid SaaS Offboarding', 'hybrid',
   'Cross-stack offboarding covering IdP, major SaaS apps, and infrastructure.')
on conflict (slug) do nothing;

-- M365 steps
insert into public.template_steps (template_id, title, description, sort_order, requires_evidence, is_critical, category) values
  ('11111111-1111-1111-1111-111111111101', 'Disable Entra ID / Microsoft 365 sign-in', 'Block interactive sign-in for the user principal. Capture screenshot or admin audit export as evidence.', 1, true, true, 'Identity'),
  ('11111111-1111-1111-1111-111111111101', 'Revoke active sessions & refresh tokens', 'Force sign-out across devices (Revoke sessions / invalidate refresh tokens).', 2, true, true, 'Identity'),
  ('11111111-1111-1111-1111-111111111101', 'Reset / rotate password & remove MFA methods', 'Reset password and remove registered MFA factors to prevent recovery attacks.', 3, true, true, 'Identity'),
  ('11111111-1111-1111-1111-111111111101', 'Remove from security & distribution groups', 'Remove from Entra ID groups that grant application or data access.', 4, true, true, 'Access'),
  ('11111111-1111-1111-1111-111111111101', 'Convert mailbox / set forwarding per policy', 'Convert to shared mailbox or apply legal hold / forwarding per retention policy.', 5, true, false, 'Email'),
  ('11111111-1111-1111-1111-111111111101', 'Transfer OneDrive ownership', 'Reassign OneDrive contents to manager or archive account.', 6, true, false, 'Data'),
  ('11111111-1111-1111-1111-111111111101', 'Remove from SharePoint / Teams sites', 'Remove direct and group memberships from sensitive sites and Teams.', 7, false, false, 'Collaboration'),
  ('11111111-1111-1111-1111-111111111101', 'Revoke app consent & admin roles', 'Remove directory roles and review OAuth app consents granted by the user.', 8, true, true, 'Privileges'),
  ('11111111-1111-1111-1111-111111111101', 'Collect / wipe managed devices (Intune)', 'Initiate selective wipe or retire for company-managed devices if applicable.', 9, true, false, 'Devices'),
  ('11111111-1111-1111-1111-111111111101', 'Disable VPN / remote access accounts', 'Disable VPN, RDP, and bastion accounts tied to the employee.', 10, true, true, 'Network'),
  ('11111111-1111-1111-1111-111111111101', 'Notify stakeholders & close HR ticket', 'Confirm completion with HR/manager and attach ticket URL.', 11, false, false, 'Process');

-- Google steps
insert into public.template_steps (template_id, title, description, sort_order, requires_evidence, is_critical, category) values
  ('11111111-1111-1111-1111-111111111102', 'Suspend Google Workspace user', 'Suspend the account immediately to block sign-in while preserving data.', 1, true, true, 'Identity'),
  ('11111111-1111-1111-1111-111111111102', 'Sign out of all sessions', 'Reset sign-in cookies / force logout from Admin console.', 2, true, true, 'Identity'),
  ('11111111-1111-1111-1111-111111111102', 'Change password & remove 2-Step Verification', 'Reset password and remove 2SV methods before any temporary access.', 3, true, true, 'Identity'),
  ('11111111-1111-1111-1111-111111111102', 'Remove from groups & organizational units', 'Remove group memberships that grant Drive, Calendar, or app access.', 4, true, true, 'Access'),
  ('11111111-1111-1111-1111-111111111102', 'Transfer Drive file ownership', 'Transfer ownership of critical Drive files to manager or shared drive.', 5, true, true, 'Data'),
  ('11111111-1111-1111-1111-111111111102', 'Set Gmail forwarding / vacation / archive', 'Apply forwarding or vault retention per policy; document destination.', 6, true, false, 'Email'),
  ('11111111-1111-1111-1111-111111111102', 'Revoke third-party OAuth app access', 'Review and revoke connected apps with offline access.', 7, true, true, 'Privileges'),
  ('11111111-1111-1111-1111-111111111102', 'Remove admin roles & privileged access', 'Strip Super Admin / delegated admin roles if present.', 8, true, true, 'Privileges'),
  ('11111111-1111-1111-1111-111111111102', 'Deprovision Chrome / endpoint devices', 'Deprovision managed ChromeOS / mobile endpoints if used.', 9, false, false, 'Devices'),
  ('11111111-1111-1111-1111-111111111102', 'Disable SSO / VPN secondary accounts', 'Disable linked IdP, VPN, and SaaS accounts outside Workspace.', 10, true, true, 'Network'),
  ('11111111-1111-1111-1111-111111111102', 'Confirm ticket closure with HR', 'Attach HR/IT ticket URL and notify manager.', 11, false, false, 'Process');

-- Hybrid steps
insert into public.template_steps (template_id, title, description, sort_order, requires_evidence, is_critical, category) values
  ('11111111-1111-1111-1111-111111111103', 'Disable primary IdP account (Entra / Google / Okta)', 'Disable the authoritative identity provider account immediately.', 1, true, true, 'Identity'),
  ('11111111-1111-1111-1111-111111111103', 'Revoke SSO sessions & MFA recovery codes', 'Invalidate sessions and remove recovery codes / backup factors.', 2, true, true, 'Identity'),
  ('11111111-1111-1111-1111-111111111103', 'Remove from privileged AD / LDAP groups', 'Remove directory group memberships that gate on-prem or hybrid apps.', 3, true, true, 'Access'),
  ('11111111-1111-1111-1111-111111111103', 'Revoke cloud console access (AWS / Azure / GCP)', 'Remove IAM users/roles and break-glass if employee held cloud admin.', 4, true, true, 'Cloud'),
  ('11111111-1111-1111-1111-111111111103', 'Disable Git / source control access', 'Remove from GitHub/GitLab/Bitbucket orgs and revoke PATs/SSH keys.', 5, true, true, 'Engineering'),
  ('11111111-1111-1111-1111-111111111103', 'Revoke SaaS app licenses (CRM, ERP, chat)', 'Deprovision Salesforce, Slack/Teams, Notion, Jira, etc. as applicable.', 6, true, false, 'SaaS'),
  ('11111111-1111-1111-1111-111111111103', 'Rotate shared secrets employee could access', 'Rotate vault secrets, API keys, and shared passwords in scope.', 7, true, true, 'Secrets'),
  ('11111111-1111-1111-1111-111111111103', 'Collect badges / physical access', 'Deactivate badge, building access, and return hardware checklist.', 8, true, false, 'Physical'),
  ('11111111-1111-1111-1111-111111111103', 'Wipe or reclaim endpoints', 'Confirm laptop/phone wipe or custody transfer with asset tag.', 9, true, false, 'Devices'),
  ('11111111-1111-1111-1111-111111111103', 'Update on-call / escalation rotations', 'Remove from PagerDuty/Opsgenie and documentation owners.', 10, false, false, 'Ops'),
  ('11111111-1111-1111-1111-111111111103', 'Export Evidence Pack & close case', 'Generate Evidence Pack PDF/CSV and close with stakeholder sign-off.', 11, true, true, 'Audit');
