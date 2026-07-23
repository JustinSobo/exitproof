/**
 * Optional AD auto-evidence (Phase 4 foundation + Phase 5 attach/policy).
 *
 * System-collected snapshots are labeled — never claim certification.
 * Critical steps still require human attest (see lib/cases/evidence-rules).
 */

import { createHash } from "crypto";
import type { AdDirectorySnapshot } from "@/lib/connectors/ad";
import { mapAdAutoEvidenceTarget } from "@/lib/evidence/auto-map";
import type { ChecklistItem, EvidenceFile, SessionUser } from "@/lib/types";

export type AdAutoEvidenceStatus =
  | "pending"
  | "collected"
  | "attached"
  | "failed"
  | "skipped";

export interface AdAutoEvidenceResult {
  status: AdAutoEvidenceStatus;
  label: "system-collected snapshot";
  content_hash: string | null;
  file_name: string | null;
  csv_preview: string | null;
  message: string;
  target_item_id?: string | null;
  evidence?: EvidenceFile;
}

/** Build a minimal CSV export + SHA-256 (no password material). */
export function buildAdEvidenceCsv(snapshot: AdDirectorySnapshot): {
  csv: string;
  content_hash: string;
  file_name: string;
  bytes: Buffer;
  mimeType: string;
} {
  const rows = [
    ["attribute", "value"],
    ["kind", "system_collected_ad_snapshot"],
    ["label", "System-collected directory snapshot (Hybrid AD read-only)"],
    [
      "disclaimer",
      "Point-in-time AD read. Does not certify that access was revoked.",
    ],
    ["directory_key", snapshot.directory_key],
    ["sAMAccountName", snapshot.sam_account_name ?? ""],
    ["userPrincipalName", snapshot.user_principal_name ?? ""],
    ["account_enabled", String(snapshot.account_enabled)],
    ["userAccountControl", String(snapshot.user_account_control ?? "")],
    ["last_logon_at", snapshot.last_logon_at ?? ""],
    ["distinguished_name", snapshot.distinguished_name ?? ""],
    ["memberOf", snapshot.member_of.join(";")],
    ["hybrid_mismatch", String(snapshot.hybrid_mismatch)],
    ["collected_at", snapshot.collected_at],
  ];
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const bytes = Buffer.from(csv, "utf8");
  const content_hash = createHash("sha256").update(bytes).digest("hex");
  const safeKey = snapshot.directory_key.replace(/[^a-zA-Z0-9._-]/g, "_");
  return {
    csv,
    content_hash,
    file_name: `ad-snapshot-${safeKey}.csv`,
    bytes,
    mimeType: "text/csv",
  };
}

/**
 * If org has ad_auto_evidence_enabled and a snapshot exists,
 * produce a system-collected evidence artifact (may not attach yet).
 */
export function stubCollectAdAutoEvidence(
  snapshot: AdDirectorySnapshot | null,
  autoEvidenceEnabled: boolean,
): AdAutoEvidenceResult {
  if (!autoEvidenceEnabled) {
    return {
      status: "skipped",
      label: "system-collected snapshot",
      content_hash: null,
      file_name: null,
      csv_preview: null,
      message: "AD auto-evidence disabled for tenant.",
    };
  }
  if (!snapshot) {
    return {
      status: "failed",
      label: "system-collected snapshot",
      content_hash: null,
      file_name: null,
      csv_preview: null,
      message: "No AD snapshot available to collect.",
    };
  }
  const built = buildAdEvidenceCsv(snapshot);
  return {
    status: "collected",
    label: "system-collected snapshot",
    content_hash: built.content_hash,
    file_name: built.file_name,
    csv_preview: built.csv.slice(0, 500),
    message:
      "System-collected AD snapshot ready. Human attest still required on critical steps.",
  };
}

export interface AttachAdAutoEvidenceDeps {
  items: ChecklistItem[];
  existingEvidence: EvidenceFile[];
  snapshot: AdDirectorySnapshot;
  autoEvidenceEnabled: boolean;
  selectedFrameworks?: string[];
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
 * Attach hashed AD CSV to the auto-mapped checklist step (group membership /
 * account disable). Does not mark the step done.
 */
export async function attachAdAutoEvidence(
  deps: AttachAdAutoEvidenceDeps,
): Promise<AdAutoEvidenceResult> {
  if (!deps.autoEvidenceEnabled) {
    return stubCollectAdAutoEvidence(null, false);
  }

  const target = mapAdAutoEvidenceTarget(deps.items, {
    selectedFrameworks: deps.selectedFrameworks,
  });
  if (!target) {
    return {
      status: "skipped",
      label: "system-collected snapshot",
      content_hash: null,
      file_name: null,
      csv_preview: null,
      message: "No suitable AD-mapped checklist step.",
    };
  }

  const already = deps.existingEvidence.some(
    (e) =>
      e.checklist_item_id === target.id &&
      (e.file_name.startsWith("ad-snapshot-") ||
        e.storage_path.includes("ad-auto/") ||
        e.collection_source === "system:ad"),
  );
  if (already) {
    return {
      status: "skipped",
      label: "system-collected snapshot",
      content_hash: null,
      file_name: null,
      csv_preview: null,
      target_item_id: target.id,
      message: "AD auto-evidence already attached to mapped step.",
    };
  }

  const built = buildAdEvidenceCsv(deps.snapshot);
  const storagePath = `tenants/${deps.orgId}/ad-auto/${deps.caseId}/${built.file_name}`;

  const evidence = await deps.persist({
    itemId: target.id,
    fileName: built.file_name,
    storagePath,
    contentHash: built.content_hash,
    mimeType: built.mimeType,
    byteSize: built.bytes.byteLength,
    bytes: built.bytes,
  });

  return {
    status: "attached",
    label: "system-collected snapshot",
    content_hash: built.content_hash,
    file_name: built.file_name,
    csv_preview: built.csv.slice(0, 500),
    target_item_id: target.id,
    evidence,
    message:
      "System-collected AD snapshot attached. Critical steps still require human attest.",
  };
}
