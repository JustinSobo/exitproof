import type { ChecklistItem, EvidenceFile } from "@/lib/types";
import {
  isHumanAttachedEvidence,
  isSystemCollectedEvidence,
} from "@/lib/evidence/collection-source";

export function itemHasEvidenceProof(
  item: Pick<ChecklistItem, "id" | "ticket_url">,
  evidence: Pick<EvidenceFile, "checklist_item_id">[],
): boolean {
  const hasTicket = Boolean(item.ticket_url?.trim());
  const hasFile = evidence.some((e) => e.checklist_item_id === item.id);
  return hasTicket || hasFile;
}

/** Human-attached file or ticket URL — excludes system-collected snapshots. */
export function itemHasHumanAttestProof(
  item: Pick<ChecklistItem, "id" | "ticket_url">,
  evidence: Pick<
    EvidenceFile,
    "checklist_item_id" | "uploaded_by" | "collection_source" | "file_name" | "storage_path"
  >[],
  ticketUrlOverride?: string,
): boolean {
  const ticket =
    ticketUrlOverride !== undefined ? ticketUrlOverride : item.ticket_url;
  if (ticket?.trim()) return true;
  return evidence.some(
    (e) =>
      e.checklist_item_id === item.id && isHumanAttachedEvidence(e),
  );
}

export type AssertCanCompleteOptions = {
  ticketUrlOverride?: string;
  /**
   * When true (default), critical steps cannot be completed with
   * system-collected evidence alone — human file or ticket required.
   */
  requireHumanAttestOnCritical?: boolean;
};

/** Block completing steps that require evidence without a file or ticket URL. */
export function assertCanCompleteItem(
  item: Pick<
    ChecklistItem,
    "id" | "requires_evidence" | "is_critical" | "ticket_url" | "title"
  >,
  evidence: Pick<
    EvidenceFile,
    | "checklist_item_id"
    | "uploaded_by"
    | "collection_source"
    | "file_name"
    | "storage_path"
  >[],
  ticketUrlOverrideOrOpts?: string | AssertCanCompleteOptions,
): void {
  const opts: AssertCanCompleteOptions =
    typeof ticketUrlOverrideOrOpts === "string"
      ? { ticketUrlOverride: ticketUrlOverrideOrOpts }
      : (ticketUrlOverrideOrOpts ?? {});

  const requireHumanAttest = opts.requireHumanAttestOnCritical !== false;
  const ticket =
    opts.ticketUrlOverride !== undefined
      ? opts.ticketUrlOverride
      : item.ticket_url;

  const itemEvidence = evidence.filter((e) => e.checklist_item_id === item.id);
  const hasAnyProof = itemHasEvidenceProof(
    { id: item.id, ticket_url: ticket },
    itemEvidence,
  );
  const hasHumanProof = itemHasHumanAttestProof(
    { id: item.id, ticket_url: ticket },
    itemEvidence,
    ticket ?? undefined,
  );
  const hasOnlySystem =
    !hasHumanProof &&
    itemEvidence.some((e) => isSystemCollectedEvidence(e));

  // Critical + attest policy: system-collected alone cannot close the step.
  if (item.is_critical && requireHumanAttest) {
    if (hasHumanProof) return;
    if (hasOnlySystem || (item.requires_evidence && !hasAnyProof)) {
      throw new Error(
        `"${item.title}" is critical and requires human attestation: attach a human evidence file or add a ticket URL. System-collected snapshots alone cannot close this step.`,
      );
    }
    // Critical without requires_evidence and without system evidence: allow mark done (human click is attest).
    if (!item.requires_evidence) return;
  }

  if (!item.requires_evidence) return;

  if (hasAnyProof) return;

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
