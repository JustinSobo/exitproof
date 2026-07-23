import {
  getControl,
  resolveControlRefs,
  type ControlDef,
} from "@/lib/compliance/controls";
import { filterRefsByFramework } from "@/lib/compliance/crosswalk";
import type { ExportFrameworkFilter } from "@/lib/compliance/frameworks";
import type { ChecklistItem, EvidenceFile } from "@/lib/types";

export type ControlCoverageRow = {
  control: ControlDef;
  status: "covered" | "partial" | "open";
  /** Checklist items that cite this control */
  itemIds: string[];
  evidenceCount: number;
  doneCount: number;
  totalItems: number;
};

export type CoverageSummary = {
  framework: ExportFrameworkFilter;
  rows: ControlCoverageRow[];
  covered: number;
  partial: number;
  open: number;
  total: number;
};

function itemRefs(item: ChecklistItem): string[] {
  return item.control_refs ?? [];
}

/**
 * Compute control coverage for a case, optionally filtered to one framework.
 * A control is covered when every citing item is done and (if requires_evidence)
 * has at least one evidence file or ticket URL.
 */
export function computeCoverage(input: {
  items: ChecklistItem[];
  evidence: EvidenceFile[];
  framework?: ExportFrameworkFilter;
}): CoverageSummary {
  const framework = input.framework ?? "all";
  const evidenceByItem = new Map<string, number>();
  for (const e of input.evidence) {
    evidenceByItem.set(
      e.checklist_item_id,
      (evidenceByItem.get(e.checklist_item_id) ?? 0) + 1,
    );
  }

  const byControl = new Map<
    string,
    { itemIds: string[]; evidenceCount: number; doneCount: number }
  >();

  for (const item of input.items) {
    const refs = filterRefsByFramework(itemRefs(item), framework);
    const evCount = evidenceByItem.get(item.id) ?? 0;
    const ticketOk = Boolean(item.ticket_url?.trim());
    const hasProof = evCount > 0 || ticketOk;
    const countsAsDone =
      item.status === "done" && (!item.requires_evidence || hasProof);

    for (const ref of refs) {
      const cur = byControl.get(ref) ?? {
        itemIds: [],
        evidenceCount: 0,
        doneCount: 0,
      };
      cur.itemIds.push(item.id);
      cur.evidenceCount += evCount;
      if (countsAsDone) cur.doneCount += 1;
      byControl.set(ref, cur);
    }
  }

  const rows: ControlCoverageRow[] = [];
  for (const [key, agg] of byControl) {
    const control = getControl(key);
    if (!control) continue;
    const totalItems = agg.itemIds.length;
    let status: ControlCoverageRow["status"] = "open";
    if (agg.doneCount === totalItems && totalItems > 0) status = "covered";
    else if (agg.doneCount > 0) status = "partial";

    rows.push({
      control,
      status,
      itemIds: agg.itemIds,
      evidenceCount: agg.evidenceCount,
      doneCount: agg.doneCount,
      totalItems,
    });
  }

  rows.sort((a, b) => {
    const fw = a.control.framework.localeCompare(b.control.framework);
    if (fw !== 0) return fw;
    return a.control.controlId.localeCompare(b.control.controlId);
  });

  return {
    framework,
    rows,
    covered: rows.filter((r) => r.status === "covered").length,
    partial: rows.filter((r) => r.status === "partial").length,
    open: rows.filter((r) => r.status === "open").length,
    total: rows.length,
  };
}

/** Items that have at least one control ref matching the framework filter. */
export function filterItemsByFramework(
  items: ChecklistItem[],
  framework: ExportFrameworkFilter,
): ChecklistItem[] {
  if (framework === "all") return items;
  return items.filter((item) =>
    itemRefs(item).some((ref) => ref.startsWith(`${framework}:`)),
  );
}

export function controlsOnItem(item: ChecklistItem): ControlDef[] {
  return resolveControlRefs(itemRefs(item));
}
