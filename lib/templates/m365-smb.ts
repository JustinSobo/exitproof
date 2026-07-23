import type { StackProfile } from "@/lib/types";
import { refsFor, type CrosswalkTheme } from "@/lib/compliance/crosswalk";

export type SeedTemplate = {
  id: string;
  slug: string;
  name: string;
  stack: StackProfile;
  description: string;
  steps: SeedStep[];
};

export type SeedStep = {
  title: string;
  description: string;
  sort_order: number;
  requires_evidence: boolean;
  is_critical: boolean;
  category: string;
  controlRefs: string[];
  evidenceHint: string;
};

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
): Omit<SeedStep, "sort_order"> {
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

export const M365_SMB: SeedTemplate = {
  id: "11111111-1111-1111-1111-111111111101",
  slug: "m365-smb",
  name: "Microsoft 365 SMB Offboarding",
  stack: "m365",
  description:
    "SOC 2 / ISO 27001-aligned access revocation for Microsoft 365 small-business tenants.",
  steps: [
    step(
      "Disable Entra ID / Microsoft 365 sign-in",
      "Block interactive sign-in for the user principal. Capture screenshot or admin audit export as evidence.",
      {
        requires_evidence: true,
        is_critical: true,
        category: "Identity",
        themes: ["disableAccount"],
        evidenceHint:
          "Entra admin center screenshot showing Account enabled = No, or Sign-in logs / audit export with disable timestamp.",
      },
    ),
    step(
      "Revoke active sessions & refresh tokens",
      "Force sign-out across devices (Revoke sessions / invalidate refresh tokens).",
      {
        requires_evidence: true,
        is_critical: true,
        category: "Identity",
        themes: ["revokeSessions"],
        evidenceHint:
          "Screenshot of Revoke sessions confirmation or Graph/audit event showing refresh token invalidation.",
      },
    ),
    step(
      "Reset / rotate password & remove MFA methods",
      "Reset password and remove registered MFA factors to prevent recovery attacks.",
      {
        requires_evidence: true,
        is_critical: true,
        category: "Identity",
        themes: ["revokeAuthenticators"],
        evidenceHint:
          "Authentication methods blade showing zero MFA methods, plus password reset audit event.",
      },
    ),
    step(
      "Remove from security & distribution groups",
      "Remove from Entra ID groups that grant application or data access.",
      {
        requires_evidence: true,
        is_critical: true,
        category: "Access",
        themes: ["removeEntitlements"],
        evidenceHint:
          "Group membership export before/after, or screenshot of empty Groups list for the user.",
      },
    ),
    step(
      "Convert mailbox / set forwarding per policy",
      "Convert to shared mailbox or apply legal hold / forwarding per retention policy.",
      {
        requires_evidence: true,
        is_critical: false,
        category: "Email",
        themes: ["transferData"],
        evidenceHint:
          "Exchange admin screenshot of shared mailbox conversion or forwarding/litigation hold settings.",
      },
    ),
    step(
      "Transfer OneDrive ownership",
      "Reassign OneDrive contents to manager or archive account.",
      {
        requires_evidence: true,
        is_critical: false,
        category: "Data",
        themes: ["transferData"],
        evidenceHint:
          "OneDrive access delegation / ownership transfer confirmation or SharePoint admin export.",
      },
    ),
    step(
      "Remove from SharePoint / Teams sites",
      "Remove direct and group memberships from sensitive sites and Teams.",
      {
        requires_evidence: false,
        is_critical: false,
        category: "Collaboration",
        themes: ["removeEntitlements"],
        evidenceHint:
          "Optional: site permissions export showing user removed from sensitive sites/Teams.",
      },
    ),
    step(
      "Revoke app consent & admin roles",
      "Remove directory roles and review OAuth app consents granted by the user.",
      {
        requires_evidence: true,
        is_critical: true,
        category: "Privileges",
        themes: ["revokePrivileges"],
        evidenceHint:
          "Directory roles list empty for user; app consent / enterprise apps review screenshot.",
      },
    ),
    step(
      "Collect / wipe managed devices (Intune)",
      "Initiate selective wipe or retire for company-managed devices if applicable.",
      {
        requires_evidence: true,
        is_critical: false,
        category: "Devices",
        themes: ["reclaimDevices"],
        evidenceHint:
          "Intune retire/wipe action confirmation or device compliance status showing Retire pending/complete.",
      },
    ),
    step(
      "Disable VPN / remote access accounts",
      "Disable VPN, RDP, and bastion accounts tied to the employee.",
      {
        requires_evidence: true,
        is_critical: true,
        category: "Network",
        themes: ["remoteAccess"],
        evidenceHint:
          "VPN/NAC admin console showing account disabled, or remote access group membership removed.",
      },
    ),
    step(
      "Notify stakeholders & close HR ticket",
      "Confirm completion with HR/manager and attach ticket URL.",
      {
        requires_evidence: false,
        is_critical: false,
        category: "Process",
        themes: ["processClose"],
        evidenceHint:
          "HR/IT ticket URL in the step notes confirming stakeholder sign-off.",
      },
    ),
  ].map((s, i) => ({ ...s, sort_order: i + 1 })),
};
