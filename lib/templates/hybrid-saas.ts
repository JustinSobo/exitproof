import type { SeedTemplate } from "@/lib/templates/m365-smb";
import { refsFor, type CrosswalkTheme } from "@/lib/compliance/crosswalk";

function step(
  title: string,
  description: string,
  opts: {
    requires_evidence?: boolean;
    is_critical?: boolean;
    category: string;
    themes: CrosswalkTheme[];
    evidenceHint: string;
  },
) {
  return {
    title,
    description,
    requires_evidence: opts.requires_evidence ?? false,
    is_critical: opts.is_critical ?? false,
    category: opts.category,
    controlRefs: refsFor(...opts.themes),
    evidenceHint: opts.evidenceHint,
  };
}

export const HYBRID_SAAS: SeedTemplate = {
  id: "11111111-1111-1111-1111-111111111103",
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
        themes: ["disableAccount"],
        evidenceHint:
          "IdP admin screenshot showing user Disabled/Suspended with timestamp.",
      },
    ),
    step(
      "Revoke SSO sessions & MFA recovery codes",
      "Invalidate sessions and remove recovery codes / backup factors.",
      {
        requires_evidence: true,
        is_critical: true,
        category: "Identity",
        themes: ["revokeSessions", "revokeAuthenticators"],
        evidenceHint:
          "Session revoke confirmation plus MFA/recovery factors cleared.",
      },
    ),
    step(
      "Remove from privileged AD / LDAP groups",
      "Remove directory group memberships that gate on-prem or hybrid apps.",
      {
        requires_evidence: true,
        is_critical: true,
        category: "Access",
        themes: ["removeEntitlements", "revokePrivileges"],
        evidenceHint:
          "AD/LDAP group membership export before/after for privileged groups.",
      },
    ),
    step(
      "Revoke cloud console access (AWS / Azure / GCP)",
      "Remove IAM users/roles and break-glass if employee held cloud admin.",
      {
        requires_evidence: true,
        is_critical: true,
        category: "Cloud",
        themes: ["revokePrivileges", "removeEntitlements"],
        evidenceHint:
          "Cloud IAM console showing user/role removed or access key disabled.",
      },
    ),
    step(
      "Disable Git / source control access",
      "Remove from GitHub/GitLab/Bitbucket orgs and revoke PATs/SSH keys.",
      {
        requires_evidence: true,
        is_critical: true,
        category: "Engineering",
        themes: ["removeEntitlements", "revokeAuthenticators"],
        evidenceHint:
          "Org member removed screenshot; PAT/SSH key list empty or revoked.",
      },
    ),
    step(
      "Revoke SaaS app licenses (CRM, ERP, chat)",
      "Deprovision Salesforce, Slack/Teams, Notion, Jira, etc. as applicable.",
      {
        requires_evidence: true,
        is_critical: false,
        category: "SaaS",
        themes: ["removeEntitlements", "disableAccount"],
        evidenceHint:
          "Per-app deprovision confirmation or license reclaimed screenshot.",
      },
    ),
    step(
      "Rotate shared secrets employee could access",
      "Rotate vault secrets, API keys, and shared passwords in scope.",
      {
        requires_evidence: true,
        is_critical: true,
        category: "Secrets",
        themes: ["rotateSecrets"],
        evidenceHint:
          "Vault/rotation ticket showing secrets rotated with timestamps.",
      },
    ),
    step(
      "Collect badges / physical access",
      "Deactivate badge, building access, and return hardware checklist.",
      {
        requires_evidence: true,
        is_critical: false,
        category: "Physical",
        themes: ["physicalAccess"],
        evidenceHint:
          "Badge system deactivation record or physical access log update.",
      },
    ),
    step(
      "Wipe or reclaim endpoints",
      "Confirm laptop/phone wipe or custody transfer with asset tag.",
      {
        requires_evidence: true,
        is_critical: false,
        category: "Devices",
        themes: ["reclaimDevices"],
        evidenceHint:
          "MDM wipe confirmation or asset custody form with asset tag.",
      },
    ),
    step(
      "Update on-call / escalation rotations",
      "Remove from PagerDuty/Opsgenie and documentation owners.",
      {
        requires_evidence: false,
        is_critical: false,
        category: "Ops",
        themes: ["removeEntitlements", "processClose"],
        evidenceHint:
          "Optional: on-call schedule screenshot showing user removed.",
      },
    ),
    step(
      "Export Evidence Pack & close case",
      "Generate Evidence Pack PDF/CSV and close with stakeholder sign-off.",
      {
        requires_evidence: true,
        is_critical: true,
        category: "Audit",
        themes: ["processClose"],
        evidenceHint:
          "Exported Evidence Pack filename/hash note plus stakeholder ticket URL.",
      },
    ),
  ].map((s, i) => ({ ...s, sort_order: i + 1 })),
};
