import { CONTROLS, getControl, type ControlDef } from "@/lib/compliance/controls";
import type { FrameworkSlug } from "@/lib/compliance/frameworks";

/**
 * Operational themes used when tagging template steps.
 * Completing a step with these refs increments coverage across mapped frameworks.
 */
export const THEME_REFS = {
  /** Disable IdP / primary account sign-in */
  disableAccount: [
    "fedramp:AC-2",
    "fedramp:AC-2(3)",
    "fedramp:PS-4",
    "nist-800-53:AC-2",
    "nist-800-53:AC-2(3)",
    "nist-800-53:PS-4",
    "cmmc-l1:AC.L1-3.1.1",
    "cmmc-l1:AC.L1-b.1.i",
    "cmmc-l1:IA.L1-3.5.1",
    "cmmc-l2:AC.L2-3.1.1",
    "cmmc-l2:IA.L2-3.5.1",
    "nist-800-171:3.1.1",
    "nist-800-171:3.5.1",
    "soc2:CC6.1",
    "soc2:CC6.2",
    "soc1:CCO-UP-1",
    "iso-27001:A.5.15",
    "iso-27001:A.5.16",
    "iso-27001:A.6.5",
    "hipaa:164.308(a)(3)(ii)(C)",
    "hipaa:164.312(a)(2)(i)",
    "nist-csf:PR.AA-01",
  ],
  /** Revoke sessions / tokens */
  revokeSessions: [
    "fedramp:IA-5",
    "fedramp:PS-4",
    "nist-800-53:IA-5",
    "nist-800-53:PS-4",
    "cmmc-l1:IA.L1-3.5.2",
    "cmmc-l2:IA.L2-3.5.2",
    "nist-800-171:3.5.2",
    "soc2:CC6.2",
    "iso-27001:A.5.17",
    "hipaa:164.312(d)",
    "nist-csf:PR.AA-03",
    "nist-csf:PR.AA-04",
  ],
  /** Password / MFA / authenticator revoke */
  revokeAuthenticators: [
    "fedramp:IA-5",
    "fedramp:PS-4",
    "nist-800-53:IA-5",
    "nist-800-53:PS-4",
    "cmmc-l1:IA.L1-3.5.2",
    "cmmc-l2:IA.L2-3.5.2",
    "cmmc-l2:IA.L2-3.5.3",
    "nist-800-171:3.5.2",
    "nist-800-171:3.5.3",
    "soc2:CC6.2",
    "iso-27001:A.5.17",
    "hipaa:164.312(d)",
    "nist-csf:PR.AA-02",
  ],
  /** Remove groups / entitlements */
  removeEntitlements: [
    "fedramp:AC-3",
    "fedramp:AC-6",
    "nist-800-53:AC-3",
    "nist-800-53:AC-6",
    "cmmc-l2:AC.L2-3.1.2",
    "cmmc-l2:AC.L2-3.1.5",
    "nist-800-171:3.1.2",
    "nist-800-171:3.1.5",
    "soc2:CC6.3",
    "iso-27001:A.5.18",
    "iso-27001:A.8.3",
    "nist-csf:PR.AA-05",
  ],
  /** Privileged / admin role removal */
  revokePrivileges: [
    "fedramp:AC-6",
    "nist-800-53:AC-6",
    "cmmc-l2:AC.L2-3.1.5",
    "cmmc-l2:AC.L2-3.1.6",
    "nist-800-171:3.1.5",
    "nist-800-171:3.1.6",
    "soc2:CC6.3",
    "soc1:CCO-PA-1",
    "iso-27001:A.8.2",
    "nist-csf:PR.AA-05",
  ],
  /** Mailbox / data ownership transfer */
  transferData: [
    "fedramp:PS-4",
    "nist-800-53:PS-4",
    "soc2:CC6.2",
    "iso-27001:A.6.5",
    "iso-27001:A.8.3",
    "hipaa:164.308(a)(3)(ii)(C)",
  ],
  /** Device wipe / reclaim */
  reclaimDevices: [
    "fedramp:PS-4",
    "nist-800-53:PS-4",
    "cmmc-l2:MP.L2-3.8.3",
    "nist-800-171:3.8.3",
    "iso-27001:A.6.5",
    "nist-csf:PR.AA-06",
  ],
  /** Physical / badge */
  physicalAccess: [
    "fedramp:PS-4",
    "nist-800-53:PS-4",
    "cmmc-l2:PE.L2-3.10.1",
    "nist-800-171:3.10.1",
    "iso-27001:A.5.15",
    "nist-csf:PR.AA-06",
  ],
  /** VPN / remote / network */
  remoteAccess: [
    "fedramp:AC-3",
    "nist-800-53:AC-3",
    "cmmc-l2:AC.L2-3.1.20",
    "nist-800-171:3.1.20",
    "soc2:CC6.1",
    "iso-27001:A.5.15",
  ],
  /** Process / HR ticket / audit close */
  processClose: [
    "fedramp:PS-4",
    "nist-800-53:PS-4",
    "soc2:CC6.2",
    "soc1:CCO-UP-1",
    "iso-27001:A.6.5",
    "hipaa:164.308(a)(3)(ii)(C)",
    "hipaa:164.308(a)(3)(ii)(A)",
  ],
  /** Secrets / shared credentials rotation */
  rotateSecrets: [
    "fedramp:IA-5",
    "nist-800-53:IA-5",
    "soc2:CC6.1",
    "soc1:CCO-PA-1",
    "iso-27001:A.5.17",
    "iso-27001:A.8.2",
  ],
} as const satisfies Record<string, readonly string[]>;

export type CrosswalkTheme = keyof typeof THEME_REFS;

/** Deduped control refs for a theme (or merge of themes). */
export function refsFor(...themes: CrosswalkTheme[]): string[] {
  const set = new Set<string>();
  for (const theme of themes) {
    for (const ref of THEME_REFS[theme]) set.add(ref);
  }
  return [...set];
}

/** Filter control refs to a single framework (for export views). */
export function filterRefsByFramework(
  refs: string[],
  framework: FrameworkSlug | "all",
): string[] {
  if (framework === "all") return refs;
  return refs.filter((ref) => ref.startsWith(`${framework}:`));
}

export function controlsForThemes(
  ...themes: CrosswalkTheme[]
): ControlDef[] {
  return refsFor(...themes)
    .map((ref) => getControl(ref))
    .filter((c): c is ControlDef => Boolean(c));
}

/** Sanity: every theme ref resolves to a seeded control. */
export function validateCrosswalk(): string[] {
  const missing: string[] = [];
  for (const [theme, refs] of Object.entries(THEME_REFS)) {
    for (const ref of refs) {
      if (!getControl(ref)) missing.push(`${theme}:${ref}`);
    }
  }
  for (const ctrl of CONTROLS) {
    if (ctrl.key !== `${ctrl.framework}:${ctrl.controlId}`) {
      missing.push(`key-mismatch:${ctrl.key}`);
    }
  }
  return missing;
}
