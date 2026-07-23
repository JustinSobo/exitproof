import type { TemplateStep } from "@/lib/types";

export type SeedTemplate = {
  id: string;
  slug: string;
  name: string;
  stack: "m365" | "google" | "hybrid";
  description: string;
  steps: Omit<TemplateStep, "id">[];
};

function step(
  title: string,
  description: string,
  opts: {
    requires_evidence?: boolean;
    is_critical?: boolean;
    category: string;
  },
): Omit<TemplateStep, "id"> {
  return {
    title,
    description,
    sort_order: 0,
    requires_evidence: opts.requires_evidence ?? false,
    is_critical: opts.is_critical ?? false,
    category: opts.category,
  };
}

export const M365_SMB: SeedTemplate = {
  id: "tpl-m365-smb",
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
      },
    ),
    step(
      "Revoke active sessions & refresh tokens",
      "Force sign-out across devices (Revoke sessions / invalidate refresh tokens).",
      {
        requires_evidence: true,
        is_critical: true,
        category: "Identity",
      },
    ),
    step(
      "Reset / rotate password & remove MFA methods",
      "Reset password and remove registered MFA factors to prevent recovery attacks.",
      { requires_evidence: true, is_critical: true, category: "Identity" },
    ),
    step(
      "Remove from security & distribution groups",
      "Remove from Entra ID groups that grant application or data access.",
      { requires_evidence: true, is_critical: true, category: "Access" },
    ),
    step(
      "Convert mailbox / set forwarding per policy",
      "Convert to shared mailbox or apply legal hold / forwarding per retention policy.",
      { requires_evidence: true, is_critical: false, category: "Email" },
    ),
    step(
      "Transfer OneDrive ownership",
      "Reassign OneDrive contents to manager or archive account.",
      { requires_evidence: true, is_critical: false, category: "Data" },
    ),
    step(
      "Remove from SharePoint / Teams sites",
      "Remove direct and group memberships from sensitive sites and Teams.",
      { requires_evidence: false, is_critical: false, category: "Collaboration" },
    ),
    step(
      "Revoke app consent & admin roles",
      "Remove directory roles and review OAuth app consents granted by the user.",
      { requires_evidence: true, is_critical: true, category: "Privileges" },
    ),
    step(
      "Collect / wipe managed devices (Intune)",
      "Initiate selective wipe or retire for company-managed devices if applicable.",
      { requires_evidence: true, is_critical: false, category: "Devices" },
    ),
    step(
      "Disable VPN / remote access accounts",
      "Disable VPN, RDP, and bastion accounts tied to the employee.",
      { requires_evidence: true, is_critical: true, category: "Network" },
    ),
    step(
      "Notify stakeholders & close HR ticket",
      "Confirm completion with HR/manager and attach ticket URL.",
      { requires_evidence: false, is_critical: false, category: "Process" },
    ),
  ].map((s, i) => ({ ...s, sort_order: i + 1 })),
};
