"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ORG_ADMIN_REQUIRED_MESSAGE,
  requireOrgAdmin,
} from "@/lib/auth";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";
import {
  DEFAULT_ONBOARDING_FRAMEWORKS,
  DEFAULT_STACK_PROFILE,
  STACK_QUESTIONS,
  deriveStackProfile,
  parseFrameworkSelections,
  type StackAnswerId,
  type StackAnswers,
} from "@/lib/onboarding/questionnaire";
import type { StackProfile } from "@/lib/types";

function readStackAnswers(formData: FormData): StackAnswers {
  const answers = {} as StackAnswers;
  for (const q of STACK_QUESTIONS) {
    const raw = String(formData.get(q.id) || q.defaultValue);
    const allowed = new Set(q.options.map((o) => o.value));
    answers[q.id as StackAnswerId] = allowed.has(raw) ? raw : q.defaultValue;
  }
  return answers;
}

export async function completeOnboardingAction(
  formData: FormData,
): Promise<void> {
  let ctx;
  try {
    ctx = await requireOrgAdmin();
  } catch (e) {
    redirect(
      `/onboarding?error=${encodeURIComponent(e instanceof Error ? e.message : ORG_ADMIN_REQUIRED_MESSAGE)}`,
    );
  }

  const frameworks = parseFrameworkSelections(formData.getAll("frameworks"));
  const selected =
    frameworks.length > 0 ? frameworks : [...DEFAULT_ONBOARDING_FRAMEWORKS];

  const answers = readStackAnswers(formData);
  const stack: StackProfile = deriveStackProfile(answers);
  const completedAt = new Date().toISOString();

  if (isDemoMode()) {
    demoStore.updateOrg(ctx.org.id, {
      stack_profile: stack,
      selected_frameworks: selected,
      onboarding_completed_at: completedAt,
    });
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      stack_profile: stack || DEFAULT_STACK_PROFILE,
      selected_frameworks: selected,
      onboarding_completed_at: completedAt,
    })
    .eq("id", ctx.org.id);

  if (error) {
    redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
