/**
 * Optional auto-evidence from a Graph directory snapshot (hashed JSON).
 * Labeled system-collected — never claims certification / IdP revoke.
 * Targets checklist steps via Phase 5 per-framework auto-map.
 */

import { mapSignalToChecklistItem } from "@/lib/evidence/auto-map";
import { sha256Hex } from "@/lib/evidence/hash";
import type { DirectorySnapshot } from "@/lib/connectors/graph/types";
import type { ChecklistItem, EvidenceFile, SessionUser } from "@/lib/types";

export interface AutoEvidenceAttachResult {
  attached: boolean;
  skippedReason?: string;
  evidence?: EvidenceFile;
  contentHash?: string;
  targetItemId?: string;
  fileName?: string;
  storagePath?: string;
  bytes?: Buffer;
  mimeType?: string;
}

/**
 * Map Graph snapshot → FedRAMP/CMMC disable-account step (and peers).
 * Falls back to legacy Identity "Disable …" heuristics when auto-map misses.
 */
export function pickAutoEvidenceTarget(
  items: ChecklistItem[],
  opts?: { selectedFrameworks?: string[] },
): ChecklistItem | null {
  const mapped = mapSignalToChecklistItem(
    "graph_directory_snapshot",
    items,
    opts,
  );
  if (mapped) return mapped;

  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const disableStep = sorted.find(
    (i) =>
      i.is_critical &&
      /disable/i.test(i.title) &&
      (i.category === "Identity" || /entra|idp|account|sign-?in/i.test(i.title)),
  );
  if (disableStep) return disableStep;

  return (
    sorted.find((i) => i.is_critical && i.requires_evidence) ??
    sorted.find((i) => i.is_critical) ??
    null
  );
}

export function buildGraphSnapshotEvidencePayload(
  snapshot: DirectorySnapshot,
): {
  bytes: Buffer;
  fileName: string;
  mimeType: string;
  contentHash: string;
} {
  const body = {
    kind: "system_collected_graph_snapshot",
    label: "System-collected directory snapshot (Microsoft Graph read-only)",
    disclaimer:
      "This evidence is a point-in-time read of directory state. It does not certify that access was revoked.",
    capturedAt: snapshot.capturedAt,
    source: snapshot.source,
    queriedEmail: snapshot.queriedEmail,
    accountStillEnabled: snapshot.accountStillEnabled,
    user: snapshot.user
      ? {
          id: snapshot.user.id,
          userPrincipalName: snapshot.user.userPrincipalName,
          mail: snapshot.user.mail,
          displayName: snapshot.user.displayName,
          accountEnabled: snapshot.user.accountEnabled,
        }
      : null,
    recentAudits: snapshot.recentAudits,
    note: snapshot.note ?? null,
  };
  const bytes = Buffer.from(JSON.stringify(body, null, 2), "utf8");
  const stamp = snapshot.capturedAt.replace(/[:.]/g, "-");
  return {
    bytes,
    fileName: `graph-snapshot-${stamp}.json`,
    mimeType: "application/json",
    contentHash: sha256Hex(bytes),
  };
}

export interface AttachGraphAutoEvidenceDeps {
  items: ChecklistItem[];
  existingEvidence: EvidenceFile[];
  snapshot: DirectorySnapshot;
  autoEvidenceEnabled: boolean;
  selectedFrameworks?: string[];
  /** Persist evidence; demo or live upload path. */
  persist: (input: {
    itemId: string;
    fileName: string;
    storagePath: string;
    contentHash: string;
    mimeType: string;
    byteSize: number;
    bytes: Buffer;
  }) => Promise<EvidenceFile>;
  actor: SessionUser;
  orgId: string;
  caseId: string;
}

/**
 * Attach hashed Graph snapshot JSON when tenant flag is on and no prior
 * system-collected graph evidence exists on the mapped step.
 * Does not mark the step done — critical steps still need human attest.
 */
export async function attachGraphAutoEvidence(
  deps: AttachGraphAutoEvidenceDeps,
): Promise<AutoEvidenceAttachResult> {
  if (!deps.autoEvidenceEnabled) {
    return { attached: false, skippedReason: "auto_evidence_enabled is false" };
  }

  const target = pickAutoEvidenceTarget(deps.items, {
    selectedFrameworks: deps.selectedFrameworks,
  });
  if (!target) {
    return { attached: false, skippedReason: "no suitable checklist step" };
  }

  const already = deps.existingEvidence.some(
    (e) =>
      e.checklist_item_id === target.id &&
      (e.file_name.startsWith("graph-snapshot-") ||
        e.storage_path.includes("graph-auto/")),
  );
  if (already) {
    return {
      attached: false,
      skippedReason: "graph auto-evidence already attached",
      targetItemId: target.id,
    };
  }

  const payload = buildGraphSnapshotEvidencePayload(deps.snapshot);
  const storagePath = `tenants/${deps.orgId}/graph-auto/${deps.caseId}/${payload.fileName}`;

  const evidence = await deps.persist({
    itemId: target.id,
    fileName: payload.fileName,
    storagePath,
    contentHash: payload.contentHash,
    mimeType: payload.mimeType,
    byteSize: payload.bytes.byteLength,
    bytes: payload.bytes,
  });

  return {
    attached: true,
    evidence,
    contentHash: payload.contentHash,
    targetItemId: target.id,
    fileName: payload.fileName,
    storagePath,
    bytes: payload.bytes,
    mimeType: payload.mimeType,
  };
}
