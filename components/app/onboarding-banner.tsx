import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import type { Organization } from "@/lib/types";

export function OnboardingBanner({ org }: { org: Organization }) {
  if (org.onboarding_completed_at) return null;

  return (
    <Alert variant="success" className="mb-6">
      <p className="font-medium text-white">Finish org setup</p>
      <p className="mt-1 text-[var(--fog)]">
        Pick FedRAMP / CMMC / SOC targets and your stack so checklists and
        Evidence Packs match what auditors sample.
      </p>
      <ButtonLink href="/onboarding" size="sm" className="mt-3">
        Continue onboarding
      </ButtonLink>
    </Alert>
  );
}
