/**
 * Evidence Pack v3 — classify attachments as system-collected vs human-attached.
 */

import type { EvidenceFile } from "@/lib/types";

export type EvidenceCollectionSource =
  | "human"
  | "system:graph"
  | "system:ad"
  | "system";

export function isSystemCollectedEvidence(
  e: Pick<EvidenceFile, "uploaded_by" | "collection_source" | "file_name" | "storage_path">,
): boolean {
  if (e.collection_source?.startsWith("system")) return true;
  if (e.uploaded_by.startsWith("system:")) return true;
  if (e.file_name.startsWith("graph-snapshot-") || e.file_name.startsWith("ad-snapshot-")) {
    return true;
  }
  if (
    e.storage_path.includes("/graph-auto/") ||
    e.storage_path.includes("/ad-auto/")
  ) {
    return true;
  }
  return false;
}

export function isHumanAttachedEvidence(
  e: Pick<EvidenceFile, "uploaded_by" | "collection_source" | "file_name" | "storage_path">,
): boolean {
  return !isSystemCollectedEvidence(e);
}

export function resolveCollectionSource(
  e: Pick<EvidenceFile, "uploaded_by" | "collection_source" | "file_name" | "storage_path">,
): EvidenceCollectionSource {
  if (e.collection_source === "human") return "human";
  if (e.collection_source === "system:graph") return "system:graph";
  if (e.collection_source === "system:ad") return "system:ad";
  if (e.collection_source === "system") return "system";

  if (e.uploaded_by === "system:graph" || e.file_name.startsWith("graph-snapshot-")) {
    return "system:graph";
  }
  if (e.uploaded_by === "system:ad" || e.file_name.startsWith("ad-snapshot-")) {
    return "system:ad";
  }
  if (e.uploaded_by.startsWith("system:")) return "system";
  return "human";
}

export function partitionEvidenceBySource<
  T extends Pick<
    EvidenceFile,
    "uploaded_by" | "collection_source" | "file_name" | "storage_path"
  >,
>(evidence: T[]): { systemCollected: T[]; humanAttached: T[] } {
  const systemCollected: T[] = [];
  const humanAttached: T[] = [];
  for (const e of evidence) {
    if (isSystemCollectedEvidence(e)) systemCollected.push(e);
    else humanAttached.push(e);
  }
  return { systemCollected, humanAttached };
}

export function collectionSourceLabel(source: EvidenceCollectionSource): string {
  switch (source) {
    case "system:graph":
      return "System-collected (Microsoft Graph)";
    case "system:ad":
      return "System-collected (Hybrid AD)";
    case "system":
      return "System-collected";
    default:
      return "Human-attached";
  }
}
