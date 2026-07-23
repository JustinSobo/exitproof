import { CONTROLS } from "@/lib/compliance/controls";

/**
 * Stable UUIDs matching `005_frameworks_and_evidence_integrity.sql` seeds.
 * Index order must match CONTROLS array order.
 */
export const CONTROL_UUIDS: Record<string, string> = Object.fromEntries(
  CONTROLS.map((c, i) => [
    c.key,
    `b0000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  ]),
);

export const FRAMEWORK_UUIDS: Record<string, string> = {
  fedramp: "a0000000-0000-4000-8000-000000000001",
  "nist-800-53": "a0000000-0000-4000-8000-000000000002",
  "cmmc-l1": "a0000000-0000-4000-8000-000000000003",
  "cmmc-l2": "a0000000-0000-4000-8000-000000000004",
  "nist-800-171": "a0000000-0000-4000-8000-000000000005",
  soc2: "a0000000-0000-4000-8000-000000000006",
  soc1: "a0000000-0000-4000-8000-000000000007",
  "iso-27001": "a0000000-0000-4000-8000-000000000008",
  hipaa: "a0000000-0000-4000-8000-000000000009",
  "nist-csf": "a0000000-0000-4000-8000-000000000010",
};

export function controlUuid(key: string): string | undefined {
  return CONTROL_UUIDS[key];
}
