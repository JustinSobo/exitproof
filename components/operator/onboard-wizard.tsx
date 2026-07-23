"use client";

import { useState } from "react";
import { onboardCustomerAction } from "@/lib/actions/operator";
import { FRAMEWORKS, type FrameworkSlug } from "@/lib/compliance/frameworks";
import { DEFAULT_ONBOARDING_FRAMEWORKS } from "@/lib/onboarding/questionnaire";

type Props = {
  error?: string | null;
};

export function OperatorOnboardWizard({ error }: Props) {
  const [frameworks, setFrameworks] = useState<FrameworkSlug[]>([
    ...DEFAULT_ONBOARDING_FRAMEWORKS,
  ]);

  function toggleFramework(slug: FrameworkSlug) {
    setFrameworks((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  return (
    <form action={onboardCustomerAction} className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="text-xs uppercase tracking-wider text-[var(--amber)]">
          GridLogic onboard
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-syne)] text-3xl font-700 text-white">
          Onboard customer
        </h1>
        <p className="mt-2 text-[var(--fog)]">
          Provisions a hard-isolated tenant, binds Entra directory ID, sets SSO
          / frameworks, and invites the customer owner — no SQL required.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      {frameworks.map((slug) => (
        <input key={slug} type="hidden" name="frameworks" value={slug} />
      ))}

      <label className="block text-sm">
        <span className="text-[var(--fog)]">Customer name</span>
        <input
          name="name"
          required
          className="mt-1 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 py-2 text-white"
        />
      </label>

      <label className="block text-sm">
        <span className="text-[var(--fog)]">Entra tenant ID</span>
        <input
          name="entra_tenant_id"
          required
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          className="mt-1 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 py-2 font-mono text-sm text-white"
        />
      </label>

      <label className="block text-sm">
        <span className="text-[var(--fog)]">Customer owner email</span>
        <input
          name="owner_email"
          type="email"
          required
          className="mt-1 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 py-2 text-white"
        />
      </label>

      <label className="block text-sm">
        <span className="text-[var(--fog)]">Stack profile</span>
        <select
          name="stack_profile"
          defaultValue="m365"
          className="mt-1 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 py-2 text-white"
        >
          <option value="m365">Microsoft 365 / Entra</option>
          <option value="hybrid">Hybrid</option>
          <option value="google">Google Workspace</option>
        </select>
      </label>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="sso_enforced"
          defaultChecked
          className="mt-1"
        />
        <span>
          <span className="text-white">Enforce Entra SSO</span>
          <span className="mt-0.5 block text-[var(--fog)]">
            Prefer Microsoft sign-in for this tenant; password remains
            break-glass until fully locked down.
          </span>
        </span>
      </label>

      <fieldset className="space-y-3">
        <legend className="text-sm text-white">Target frameworks</legend>
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
                <span className="font-medium text-white">{fw.name}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={frameworks.length === 0}
        className="rounded-md bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-[#04201d] disabled:opacity-40"
      >
        Provision + invite owner
      </button>
    </form>
  );
}
