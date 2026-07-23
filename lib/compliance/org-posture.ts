import {
  computeCoverage,
  type CoverageSummary,
} from "@/lib/compliance/coverage";
import { getControlsByFramework } from "@/lib/compliance/controls";
import {
  getFramework,
  isFrameworkSlug,
  type FrameworkSlug,
} from "@/lib/compliance/frameworks";
import type { ChecklistItem, EvidenceFile } from "@/lib/types";

export type FrameworkPosture = {
  slug: FrameworkSlug;
  name: string;
  covered: number;
  partial: number;
  open: number;
  total: number;
  /** 0–100 integer percent of covered / total (0 when total is 0). */
  pct: number;
  caseCount: number;
};

export type CaseCoverageInput = {
  items: ChecklistItem[];
  evidence: EvidenceFile[];
};

/**
 * Org-level posture for one framework: best status per control across cases,
 * then covered / total. With no cases, total = curated control count for the
 * framework and covered = 0.
 */
export function postureForFramework(
  slug: FrameworkSlug,
  cases: CaseCoverageInput[],
): FrameworkPosture {
  const fw = getFramework(slug);
  const name = fw?.name ?? slug;

  if (cases.length === 0) {
    const catalog = getControlsByFramework(slug);
    return {
      slug,
      name,
      covered: 0,
      partial: 0,
      open: catalog.length,
      total: catalog.length,
      pct: 0,
      caseCount: 0,
    };
  }

  const best = new Map<
    string,
    { status: "covered" | "partial" | "open" }
  >();

  for (const c of cases) {
    const summary: CoverageSummary = computeCoverage({
      items: c.items,
      evidence: c.evidence,
      framework: slug,
    });
    for (const row of summary.rows) {
      const key = row.control.key;
      const prev = best.get(key);
      if (!prev) {
        best.set(key, { status: row.status });
        continue;
      }
      const rank = { covered: 2, partial: 1, open: 0 };
      if (rank[row.status] > rank[prev.status]) {
        best.set(key, { status: row.status });
      }
    }
  }

  let covered = 0;
  let partial = 0;
  let open = 0;
  for (const { status } of best.values()) {
    if (status === "covered") covered += 1;
    else if (status === "partial") partial += 1;
    else open += 1;
  }
  const total = best.size;
  const pct = total === 0 ? 0 : Math.round((covered / total) * 100);

  return {
    slug,
    name,
    covered,
    partial,
    open,
    total,
    pct,
    caseCount: cases.length,
  };
}

export function postureForSelectedFrameworks(
  selectedFrameworks: string[] | null | undefined,
  cases: CaseCoverageInput[],
): FrameworkPosture[] {
  const slugs = (selectedFrameworks ?? []).filter(isFrameworkSlug);
  return slugs.map((slug) => postureForFramework(slug, cases));
}
