import { OnboardingWizard } from "@/components/app/onboarding-wizard";
import { getCurrentOrg } from "@/lib/auth";
import { isFrameworkSlug, type FrameworkSlug } from "@/lib/compliance";
import {
  DEFAULT_ONBOARDING_FRAMEWORKS,
} from "@/lib/onboarding/questionnaire";
import { redirect } from "next/navigation";

export const metadata = { title: "Onboarding" };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; error?: string }>;
}) {
  const ctx = await getCurrentOrg();
  if (!ctx) redirect("/auth/login");

  const params = await searchParams;
  const editing = params.edit === "1" || params.edit === "true";

  // Already completed → dashboard unless intentionally re-running
  if (ctx.org.onboarding_completed_at && !editing) {
    redirect("/dashboard");
  }

  const stored = (ctx.org.selected_frameworks ?? []).filter(isFrameworkSlug);
  const initialFrameworks: FrameworkSlug[] =
    stored.length > 0 ? stored : [...DEFAULT_ONBOARDING_FRAMEWORKS];

  return (
    <OnboardingWizard
      initialFrameworks={initialFrameworks}
      editing={editing}
      error={params.error ? decodeURIComponent(params.error) : null}
    />
  );
}
