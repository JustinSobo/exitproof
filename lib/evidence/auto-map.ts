/**
 * Phase 5 — per-framework auto-map: Graph/AD signals → checklist steps.
 *
 * Maps directory signals onto FedRAMP/CMMC (and other) controls via template
 * themes / control_refs, with title/category fallbacks for older cases.
 */

import { THEME_REFS, type CrosswalkTheme } from "@/lib/compliance/crosswalk";
import type { FrameworkSlug } from "@/lib/compliance/frameworks";
import type { ChecklistItem } from "@/lib/types";

/** Directory / connector signals that can produce system-collected evidence. */
export type AutoEvidenceSignal =
  | "graph_directory_snapshot"
  | "ad_directory_snapshot"
  | "ad_group_membership";

export type AutoMapRule = {
  signal: AutoEvidenceSignal;
  /** Operational themes whose control refs should match the step. */
  themes: CrosswalkTheme[];
  titlePatterns: RegExp[];
  categories?: string[];
  /** Representative FedRAMP / CMMC (and peer) control keys this signal supports. */
  controlHints: string[];
  /** Frameworks primarily illustrated by this mapping. */
  frameworks: FrameworkSlug[];
};

export const AUTO_MAP_RULES: Record<AutoEvidenceSignal, AutoMapRule> = {
  graph_directory_snapshot: {
    signal: "graph_directory_snapshot",
    themes: ["disableAccount"],
    titlePatterns: [
      /disable.*(entra|idp|account|sign-?in)/i,
      /disable primary/i,
      /suspend.*(account|user)/i,
    ],
    categories: ["Identity"],
    controlHints: [
      "fedramp:AC-2",
      "fedramp:AC-2(3)",
      "fedramp:PS-4",
      "cmmc-l2:AC.L2-3.1.1",
      "cmmc-l1:AC.L1-3.1.1",
      "nist-800-53:AC-2",
      "soc2:CC6.2",
    ],
    frameworks: ["fedramp", "cmmc-l2", "cmmc-l1", "nist-800-53", "soc2"],
  },
  ad_directory_snapshot: {
    signal: "ad_directory_snapshot",
    themes: ["disableAccount", "removeEntitlements"],
    titlePatterns: [
      /active directory|on-?prem|ad \/ ldap|ldap/i,
      /disable.*(account|user)/i,
      /disable primary/i,
    ],
    categories: ["Identity", "Access"],
    controlHints: [
      "fedramp:AC-2",
      "fedramp:PS-4",
      "cmmc-l2:AC.L2-3.1.1",
      "nist-800-171:3.1.1",
    ],
    frameworks: ["fedramp", "cmmc-l2", "nist-800-171"],
  },
  ad_group_membership: {
    signal: "ad_group_membership",
    themes: ["removeEntitlements", "revokePrivileges"],
    titlePatterns: [
      /privileged.*(ad|ldap)/i,
      /ad \/ ldap groups/i,
      /directory group/i,
      /remove from privileged/i,
    ],
    categories: ["Access"],
    controlHints: [
      "fedramp:AC-3",
      "fedramp:AC-6",
      "cmmc-l2:AC.L2-3.1.2",
      "cmmc-l2:AC.L2-3.1.5",
      "nist-800-171:3.1.5",
    ],
    frameworks: ["fedramp", "cmmc-l2", "nist-800-171"],
  },
};

function themeKeysFor(themes: CrosswalkTheme[]): Set<string> {
  const keys = new Set<string>();
  for (const theme of themes) {
    for (const ref of THEME_REFS[theme] ?? []) keys.add(ref);
  }
  return keys;
}

function scoreItem(
  item: ChecklistItem,
  rule: AutoMapRule,
  orgFrameworks: string[],
): number {
  let score = 0;
  const refs = item.control_refs ?? [];
  const themeKeys = themeKeysFor(rule.themes);

  const themeHits = refs.filter((r) => themeKeys.has(r)).length;
  if (themeHits > 0) score += 40 + Math.min(themeHits, 8);

  const hintHits = refs.filter((r) => rule.controlHints.includes(r)).length;
  if (hintHits > 0) score += 25 + hintHits * 2;

  if (rule.titlePatterns.some((p) => p.test(item.title))) score += 35;

  if (
    rule.categories?.some(
      (c) => c.toLowerCase() === (item.category || "").toLowerCase(),
    )
  ) {
    score += 10;
  }

  if (item.is_critical) score += 8;
  if (item.requires_evidence) score += 5;

  // Prefer steps that cite org-selected frameworks when provided.
  if (orgFrameworks.length > 0) {
    const fwHit = refs.some((r) =>
      orgFrameworks.some((fw) => r.startsWith(`${fw}:`)),
    );
    if (fwHit) score += 12;
  }

  return score;
}

/**
 * Pick the best checklist step for a directory signal.
 * Returns null when no step scores above the minimum threshold.
 */
export function mapSignalToChecklistItem(
  signal: AutoEvidenceSignal,
  items: ChecklistItem[],
  opts?: { selectedFrameworks?: string[] },
): ChecklistItem | null {
  const rule = AUTO_MAP_RULES[signal];
  const frameworks = opts?.selectedFrameworks ?? [];
  let best: ChecklistItem | null = null;
  let bestScore = 0;

  for (const item of items) {
    const score = scoreItem(item, rule, frameworks);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  // Require a meaningful match (title or theme/control), not just critical bonus.
  if (!best || bestScore < 30) return null;
  return best;
}

/**
 * Controls this signal can auto-map toward (for docs / connectors UI).
 */
export function controlsSupportedBySignal(
  signal: AutoEvidenceSignal,
  frameworkFilter?: string,
): string[] {
  const hints = AUTO_MAP_RULES[signal].controlHints;
  if (!frameworkFilter || frameworkFilter === "all") return [...hints];
  return hints.filter((h) => h.startsWith(`${frameworkFilter}:`));
}

/** Prefer AD group membership step; fall back to AD account snapshot mapping. */
export function mapAdAutoEvidenceTarget(
  items: ChecklistItem[],
  opts?: { selectedFrameworks?: string[] },
): ChecklistItem | null {
  return (
    mapSignalToChecklistItem("ad_group_membership", items, opts) ??
    mapSignalToChecklistItem("ad_directory_snapshot", items, opts)
  );
}
