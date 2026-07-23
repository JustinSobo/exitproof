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

export const GOOGLE_SMB: SeedTemplate = {
  id: "11111111-1111-1111-1111-111111111102",
  slug: "google-workspace-smb",
  name: "Google Workspace SMB Offboarding",
  stack: "google",
  description:
    "NIST-style access revocation checklist for Google Workspace small-business domains.",
  steps: [
    step(
      "Suspend Google Workspace user",
      "Suspend the account immediately to block sign-in while preserving data.",
      {
        requires_evidence: true,
        is_critical: true,
        category: "Identity",
      },
    ),
    step(
      "Sign out of all sessions",
      "Reset sign-in cookies / force logout from Admin console.",
      {
        requires_evidence: true,
        is_critical: true,
        category: "Identity",
      },
    ),
    step(
      "Change password & remove 2-Step Verification",
      "Reset password and remove 2SV methods before any temporary access.",
      { requires_evidence: true, is_critical: true, category: "Identity" },
    ),
    step(
      "Remove from groups & organizational units",
      "Remove group memberships that grant Drive, Calendar, or app access.",
      { requires_evidence: true, is_critical: true, category: "Access" },
    ),
    step(
      "Transfer Drive file ownership",
      "Transfer ownership of critical Drive files to manager or shared drive.",
      { requires_evidence: true, is_critical: true, category: "Data" },
    ),
    step(
      "Set Gmail forwarding / vacation / archive",
      "Apply forwarding or vault retention per policy; document destination.",
      { requires_evidence: true, is_critical: false, category: "Email" },
    ),
    step(
      "Revoke third-party OAuth app access",
      "Review and revoke connected apps with offline access.",
      { requires_evidence: true, is_critical: true, category: "Privileges" },
    ),
    step(
      "Remove admin roles & privileged access",
      "Strip Super Admin / delegated admin roles if present.",
      { requires_evidence: true, is_critical: true, category: "Privileges" },
    ),
    step(
      "Deprovision Chrome / endpoint devices",
      "Deprovision managed ChromeOS / mobile endpoints if used.",
      { requires_evidence: false, is_critical: false, category: "Devices" },
    ),
    step(
      "Disable SSO / VPN secondary accounts",
      "Disable linked IdP, VPN, and SaaS accounts outside Workspace.",
      { requires_evidence: true, is_critical: true, category: "Network" },
    ),
    step(
      "Confirm ticket closure with HR",
      "Attach HR/IT ticket URL and notify manager.",
      { requires_evidence: false, is_critical: false, category: "Process" },
    ),
  ].map((s, i) => ({ ...s, sort_order: i + 1 })),
};
