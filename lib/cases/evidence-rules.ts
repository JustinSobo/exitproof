import type { ChecklistItem, EvidenceFile } from "@/lib/types";

export function itemHasEvidenceProof(
  item: Pick<ChecklistItem, "id" | "ticket_url">,
  evidence: Pick<EvidenceFile, "checklist_item_id">[],
): boolean {
  const hasTicket = Boolean(item.ticket_url?.trim());
  const hasFile = evidence.some((e) => e.checklist_item_id === item.id);
  return hasTicket || hasFile;
}

/** Block completing steps that require evidence without a file or ticket URL. */
export function assertCanCompleteItem(
  item: Pick<ChecklistItem, "id" | "requires_evidence" | "ticket_url" | "title">,
  evidence: Pick<EvidenceFile, "checklist_item_id">[],
  ticketUrlOverride?: string,
): void {
  if (!item.requires_evidence) return;
  const ticket =
    ticketUrlOverride !== undefined ? ticketUrlOverride : item.ticket_url;
  if (
    itemHasEvidenceProof(
      { id: item.id, ticket_url: ticket },
      evidence,
    )
  ) {
    return;
  }
  throw new Error(
    `"${item.title}" requires evidence: attach a file or add a ticket URL before marking done.`,
  );
}

/** Block closing a case while any critical step is not done. */
export function assertCanCloseCase(
  items: Pick<ChecklistItem, "is_critical" | "status" | "title">[],
): void {
  const openCritical = items.filter(
    (i) => i.is_critical && i.status !== "done",
  );
  if (openCritical.length === 0) return;
  const titles = openCritical.map((i) => i.title).slice(0, 3).join("; ");
  const more =
    openCritical.length > 3 ? ` (+${openCritical.length - 3} more)` : "";
  throw new Error(
    `Cannot close case while critical steps are open: ${titles}${more}`,
  );
}
