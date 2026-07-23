import Link from "next/link";
import type { Organization } from "@/lib/types";

export function OnboardingBanner({ org }: { org: Organization }) {
  if (org.onboarding_completed_at) return null;

  return (
    <div className="mb-6 rounded-xl border border-[var(--teal)]/35 bg-[var(--teal)]/10 px-4 py-3 text-sm">
      <p className="font-medium text-white">Finish org setup</p>
      <p className="mt-1 text-[var(--fog)]">
        Pick FedRAMP / CMMC / SOC targets and your stack so checklists and
        Evidence Packs match what auditors sample.
      </p>
      <Link
        href="/onboarding"
        className="mt-2 inline-block font-semibold text-[var(--teal-bright)] hover:underline"
      >
        Continue onboarding →
      </Link>
    </div>
  );
}
