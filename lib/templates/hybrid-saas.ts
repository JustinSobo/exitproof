import type { SeedTemplate } from "@/lib/templates/m365-smb";

function step(
  title: string,
  description: string,
  opts: {
    requires_evidence?: boolean;
    is_critical?: boolean;
    category: string;
  },
) {
  return {
    title,
    description,
    sort_order: 0,
    requires_evidence: opts.requires_evidence ?? false,
    is_critical: opts.is_critical ?? false,
    category: opts.category,
  };
}

export const HYBRID_SAAS: SeedTemplate = {
  id: "tpl-hybrid-saas",
  slug: "hybrid-saas",
  name: "Hybrid SaaS Offboarding",
  stack: "hybrid",
  description:
    "Cross-stack offboarding covering IdP, major SaaS apps, and infrastructure — ISO 27001 A.5/A.8 style.",
  steps: [
    step(
      "Disable primary IdP account (Entra / Google / Okta)",
      "Disable the authoritative identity provider account immediately.",
      {
        requires_evidence: true,
        is_critical: true,
        category: "Identity",
      },
    ),
    step(
      "Revoke SSO sessions & MFA recovery codes",
      "Invalidate sessions and remove recovery codes / backup factors.",
      {
        requires_evidence: true,
        is_critical: true,
        category: "Identity",
      },
    ),
    step(
      "Remove from privileged AD / LDAP groups",
      "Remove directory group memberships that gate on-prem or hybrid apps.",
      { requires_evidence: true, is_critical: true, category: "Access" },
    ),
    step(
      "Revoke cloud console access (AWS / Azure / GCP)",
      "Remove IAM users/roles and break-glass if employee held cloud admin.",
      { requires_evidence: true, is_critical: true, category: "Cloud" },
    ),
    step(
      "Disable Git / source control access",
      "Remove from GitHub/GitLab/Bitbucket orgs and revoke PATs/SSH keys.",
      { requires_evidence: true, is_critical: true, category: "Engineering" },
    ),
    step(
      "Revoke SaaS app licenses (CRM, ERP, chat)",
      "Deprovision Salesforce, Slack/Teams, Notion, Jira, etc. as applicable.",
      { requires_evidence: true, is_critical: false, category: "SaaS" },
    ),
    step(
      "Rotate shared secrets employee could access",
      "Rotate vault secrets, API keys, and shared passwords in scope.",
      { requires_evidence: true, is_critical: true, category: "Secrets" },
    ),
    step(
      "Collect badges / physical access",
      "Deactivate badge, building access, and return hardware checklist.",
      { requires_evidence: true, is_critical: false, category: "Physical" },
    ),
    step(
      "Wipe or reclaim endpoints",
      "Confirm laptop/phone wipe or custody transfer with asset tag.",
      { requires_evidence: true, is_critical: false, category: "Devices" },
    ),
    step(
      "Update on-call / escalation rotations",
      "Remove from PagerDuty/Opsgenie and documentation owners.",
      { requires_evidence: false, is_critical: false, category: "Ops" },
    ),
    step(
      "Export Evidence Pack & close case",
      "Generate Evidence Pack PDF/CSV and close with stakeholder sign-off.",
      { requires_evidence: true, is_critical: true, category: "Audit" },
    ),
  ].map((s, i) => ({ ...s, sort_order: i + 1 })),
};
