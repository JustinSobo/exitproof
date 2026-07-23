/**
 * Optional AD auto-evidence stub (Phase 4 foundation).
 * Full framework mapping + human-attest policy lands in Phase 5.
 *
 * System-collected snapshots are labeled — never claim certification.
 */

import { createHash } from "crypto";
import type { AdDirectorySnapshot } from "@/lib/connectors/ad";

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
}

/** Build a minimal CSV export + SHA-256 (no password material). */
export function buildAdEvidenceCsv(snapshot: AdDirectorySnapshot): {
  csv: string;
  content_hash: string;
  file_name: string;
} {
  const rows = [
    ["attribute", "value"],
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
  const content_hash = createHash("sha256").update(csv, "utf8").digest("hex");
  const safeKey = snapshot.directory_key.replace(/[^a-zA-Z0-9._-]/g, "_");
  return {
    csv,
    content_hash,
    file_name: `ad-snapshot-${safeKey}.csv`,
  };
}

/**
 * Stub: if org has ad_auto_evidence_enabled and a snapshot exists,
 * produce a system-collected evidence artifact (not attached to storage yet).
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
      "System-collected AD snapshot ready (stub). Human attest still required on critical steps.",
  };
}
