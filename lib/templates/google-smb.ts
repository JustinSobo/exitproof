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
        themes: ["disableAccount"],
        evidenceHint:
          "Admin console Users page showing Suspended, or Admin audit log with SUSPEND_USER event.",
      },
    ),
    step(
      "Sign out of all sessions",
      "Reset sign-in cookies / force logout from Admin console.",
      {
        requires_evidence: true,
        is_critical: true,
        category: "Identity",
        themes: ["revokeSessions"],
        evidenceHint:
          "Screenshot of Sign out of all sessions / reset cookies confirmation.",
      },
    ),
    step(
      "Change password & remove 2-Step Verification",
      "Reset password and remove 2SV methods before any temporary access.",
      {
        requires_evidence: true,
        is_critical: true,
        category: "Identity",
        themes: ["revokeAuthenticators"],
        evidenceHint:
          "Security settings showing 2SV off / methods removed, plus password reset audit event.",
      },
    ),
    step(
      "Remove from groups & organizational units",
      "Remove group memberships that grant Drive, Calendar, or app access.",
      {
        requires_evidence: true,
        is_critical: true,
        category: "Access",
        themes: ["removeEntitlements"],
        evidenceHint:
          "Groups membership list empty (or export before/after) and OU placement documented.",
      },
    ),
    step(
      "Transfer Drive file ownership",
      "Transfer ownership of critical Drive files to manager or shared drive.",
      {
        requires_evidence: true,
        is_critical: true,
        category: "Data",
        themes: ["transferData"],
        evidenceHint:
          "Data transfer tool confirmation or Drive ownership transfer receipt.",
      },
    ),
    step(
      "Set Gmail forwarding / vacation / archive",
      "Apply forwarding or vault retention per policy; document destination.",
      {
        requires_evidence: true,
        is_critical: false,
        category: "Email",
        themes: ["transferData"],
        evidenceHint:
          "Gmail routing/forwarding settings screenshot or Vault retention confirmation.",
      },
    ),
    step(
      "Revoke third-party OAuth app access",
      "Review and revoke connected apps with offline access.",
      {
        requires_evidence: true,
        is_critical: true,
        category: "Privileges",
        themes: ["revokePrivileges", "revokeAuthenticators"],
        evidenceHint:
          "Security > Third-party access list showing apps revoked for the user.",
      },
    ),
    step(
      "Remove admin roles & privileged access",
      "Strip Super Admin / delegated admin roles if present.",
      {
        requires_evidence: true,
        is_critical: true,
        category: "Privileges",
        themes: ["revokePrivileges"],
        evidenceHint:
          "Admin roles page showing user removed from Super Admin / delegated roles.",
      },
    ),
    step(
      "Deprovision Chrome / endpoint devices",
      "Deprovision managed ChromeOS / mobile endpoints if used.",
      {
        requires_evidence: false,
        is_critical: false,
        category: "Devices",
        themes: ["reclaimDevices"],
        evidenceHint:
          "Optional: device management console showing deprovision/wipe initiated.",
      },
    ),
    step(
      "Disable SSO / VPN secondary accounts",
      "Disable linked IdP, VPN, and SaaS accounts outside Workspace.",
      {
        requires_evidence: true,
        is_critical: true,
        category: "Network",
        themes: ["remoteAccess", "disableAccount"],
        evidenceHint:
          "Secondary IdP/VPN admin screenshot showing account disabled.",
      },
    ),
    step(
      "Confirm ticket closure with HR",
      "Attach HR/IT ticket URL and notify manager.",
      {
        requires_evidence: false,
        is_critical: false,
        category: "Process",
        themes: ["processClose"],
        evidenceHint: "HR/IT ticket URL confirming closure and manager notify.",
      },
    ),
  ].map((s, i) => ({ ...s, sort_order: i + 1 })),
};
