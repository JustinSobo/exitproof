import type { FrameworkSlug } from "@/lib/compliance/frameworks";
import { isFrameworkSlug } from "@/lib/compliance/frameworks";
import type { TemplateStep } from "@/lib/types";

/** Frameworks that tighten evidence requirements for assessor-ready packs. */
const STRICT_FRAMEWORKS = new Set<FrameworkSlug>([
  "fedramp",
  "cmmc-l1",
  "cmmc-l2",
  "nist-800-53",
  "nist-800-171",
]);

export function needsEvidenceEscalation(
  selectedFrameworks: string[] | null | undefined,
): boolean {
  return (selectedFrameworks ?? []).some(
    (slug) => isFrameworkSlug(slug) && STRICT_FRAMEWORKS.has(slug),
  );
}

/**
 * When FedRAMP / CMMC (or spine NIST) is selected, escalate checklist steps
 * that map to those controls so they require file or ticket evidence.
 */
export function escalateEvidenceForFrameworks<
  T extends Pick<TemplateStep, "requires_evidence" | "controlRefs" | "is_critical">,
>(steps: T[], selectedFrameworks: string[] | null | undefined): T[] {
  if (!needsEvidenceEscalation(selectedFrameworks)) return steps;

  const selected = new Set(
    (selectedFrameworks ?? []).filter(isFrameworkSlug),
  );

  return steps.map((step) => {
    if (step.requires_evidence) return step;

    const citesStrict = (step.controlRefs ?? []).some((ref) => {
      const fw = ref.split(":")[0];
      return isFrameworkSlug(fw) && selected.has(fw) && STRICT_FRAMEWORKS.has(fw);
    });

    if (citesStrict || step.is_critical) {
      return { ...step, requires_evidence: true };
    }
    return step;
  });
}
