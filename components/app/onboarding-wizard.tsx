"use client";

import { useState } from "react";
import { completeOnboardingAction } from "@/lib/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { FRAMEWORKS, type FrameworkSlug } from "@/lib/compliance/frameworks";
import {
  DEFAULT_ONBOARDING_FRAMEWORKS,
  STACK_QUESTIONS,
  defaultStackAnswers,
  type StackAnswers,
} from "@/lib/onboarding/questionnaire";

type Props = {
  initialFrameworks: FrameworkSlug[];
  initialAnswers?: Partial<StackAnswers>;
  editing?: boolean;
  error?: string | null;
};

export function OnboardingWizard({
  initialFrameworks,
  initialAnswers,
  editing = false,
  error,
}: Props) {
  const [step, setStep] = useState(0);
  const [frameworks, setFrameworks] = useState<FrameworkSlug[]>(
    initialFrameworks.length > 0
      ? initialFrameworks
      : [...DEFAULT_ONBOARDING_FRAMEWORKS],
  );
  const [answers, setAnswers] = useState<StackAnswers>({
    ...defaultStackAnswers(),
    ...initialAnswers,
  });

  const totalSteps = 2;
  const onFrameworks = step === 0;

  function toggleFramework(slug: FrameworkSlug) {
    setFrameworks((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  function canContinue(): boolean {
    if (onFrameworks) return frameworks.length > 0;
    return true;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="text-xs uppercase tracking-wider text-[var(--teal-bright)]">
          {editing ? "Update setup" : "Setup"} · Step {step + 1} of {totalSteps}
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-syne)] text-3xl font-700 text-white">
          {onFrameworks
            ? "Which frameworks are you targeting?"
            : "Tell us about your stack"}
        </h1>
        <p className="mt-2 text-[var(--fog)]">
          {onFrameworks
            ? "ExitProof builds personnel-termination evidence packs that support these frameworks — not a certification guarantee."
            : "A short questionnaire so we recommend the right Entra / M365-centric checklist."}
        </p>
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      <form action={completeOnboardingAction} className="space-y-6">
        {/* Always submit current selections */}
        {frameworks.map((slug) => (
          <input key={slug} type="hidden" name="frameworks" value={slug} />
        ))}
        {STACK_QUESTIONS.map((q) => (
          <input key={q.id} type="hidden" name={q.id} value={answers[q.id]} />
        ))}

        {onFrameworks ? (
          <fieldset className="space-y-3">
            <legend className="sr-only">Frameworks</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {FRAMEWORKS.map((fw) => {
                const checked = frameworks.includes(fw.slug);
                return (
                  <label
                    key={fw.slug}
                    className={`cursor-pointer rounded-xl border px-4 py-3 text-sm transition ${
                      checked
                        ? "border-[var(--teal)] bg-[var(--teal)]/10"
                        : "border-[var(--line)] bg-white/[0.03] hover:border-[var(--fog)]/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => toggleFramework(fw.slug)}
                    />
                    <span className="font-semibold text-white">{fw.name}</span>
                    <span className="mt-0.5 block text-xs text-[var(--fog)]">
                      {fw.version}
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-[var(--fog)]">
              Defaults favor FedRAMP + CMMC L2 + SOC 2 for mid-market Entra
              tenants. Selecting FedRAMP or CMMC escalates evidence requirements
              on mapped checklist steps.
            </p>
          </fieldset>
        ) : (
          <div className="space-y-5">
            {STACK_QUESTIONS.map((q) => (
              <fieldset key={q.id} className="space-y-2">
                <legend className="text-sm font-medium text-white">
                  {q.prompt}
                </legend>
                {q.help ? (
                  <p className="text-xs text-[var(--fog)]">{q.help}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {q.options.map((opt) => {
                    const selected = answers[q.id] === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setAnswers((prev) => ({
                            ...prev,
                            [q.id]: opt.value,
                          }))
                        }
                        className={`rounded-md border px-3 py-2 text-sm ${
                          selected
                            ? "border-[var(--teal)] bg-[var(--teal)]/15 text-white"
                            : "border-[var(--line)] text-[var(--fog)] hover:border-[var(--fog)]/40"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          {step > 0 ? (
            <Button type="button" variant="secondary" onClick={() => setStep(0)}>
              Back
            </Button>
          ) : (
            <span />
          )}

          {onFrameworks ? (
            <Button
              type="button"
              disabled={!canContinue()}
              onClick={() => setStep(1)}
            >
              Continue
            </Button>
          ) : (
            <Button type="submit">
              {editing ? "Save & return" : "Finish setup"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
