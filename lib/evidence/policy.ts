/**
 * Phase 5 — tenant auto-evidence policy helpers + GridLogic retention notes.
 */

import type { Organization, PlanId } from "@/lib/types";

export type AutoEvidencePolicy = {
  /** Graph snapshots may attach system-collected evidence. */
  autoEvidenceEnabled: boolean;
  /** AD connector snapshots may attach system-collected evidence. */
  adAutoEvidenceEnabled: boolean;
  /**
   * Critical steps cannot be marked done on system-collected evidence alone —
   * human-attached file or ticket URL required (default true).
   */
  requireHumanAttestOnCritical: boolean;
};

export function resolveAutoEvidencePolicy(
  org: Pick<
    Organization,
    | "auto_evidence_enabled"
    | "ad_auto_evidence_enabled"
    | "require_human_attest_on_critical"
  >,
): AutoEvidencePolicy {
  return {
    autoEvidenceEnabled: Boolean(org.auto_evidence_enabled),
    adAutoEvidenceEnabled: Boolean(org.ad_auto_evidence_enabled),
    // Default ON — only explicit false disables attest requirement.
    requireHumanAttestOnCritical: org.require_human_attest_on_critical !== false,
  };
}

/**
 * GridLogic package retention alignment (docs/commercial/skus.md):
 * Standard ≈ 90 days; Dedicated / higher tier ≈ 365 days.
 */
export function gridLogicRetentionTier(): {
  standardDays: number;
  dedicatedDays: number;
} {
  return { standardDays: 90, dedicatedDays: 365 };
}

export function retentionPolicyNote(
  org: Pick<Organization, "retention_days" | "plan">,
): string {
  const { standardDays, dedicatedDays } = gridLogicRetentionTier();
  const days = org.retention_days || standardDays;
  const tier =
    days >= dedicatedDays
      ? `Aligned with GridLogic Dedicated / higher-tier retention (${dedicatedDays} days).`
      : `Aligned with GridLogic Standard package default (${standardDays} days).`;
  return `Evidence retention: ${days} days. ${tier} See docs/commercial/skus.md.`;
}

export function suggestedRetentionDaysForSku(
  sku: "standard" | "dedicated",
): number {
  const { standardDays, dedicatedDays } = gridLogicRetentionTier();
  return sku === "dedicated" ? dedicatedDays : standardDays;
}

/** Map legacy Stripe plan → GridLogic-ish retention narrative. */
export function retentionTierLabel(plan: PlanId, retentionDays: number): string {
  if (retentionDays >= 365 || plan === "growth" || plan === "agency") {
    return "Dedicated-tier retention";
  }
  return "Standard retention";
}
