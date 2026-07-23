import { redirect } from "next/navigation";
import { updateOrgSettingsAction } from "@/lib/actions/cases";
import { getCurrentOrg } from "@/lib/auth";
import { getTemplatesForStack } from "@/lib/templates";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await getCurrentOrg();
  if (!ctx) redirect("/auth/login");

  const templates = getTemplatesForStack(ctx.org.stack_profile);

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-syne)] text-3xl font-700 text-white">
          Organization settings
        </h1>
        <p className="mt-2 text-[var(--fog)]">
          Stack profile drives which offboarding templates are recommended.
        </p>
      </div>

      <form action={updateOrgSettingsAction} className="space-y-4">
        <label className="block text-sm">
          <span className="text-[var(--fog)]">Organization name</span>
          <input
            name="name"
            defaultValue={ctx.org.name}
            required
            className="mt-1 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 py-2 text-white outline-none focus:border-[var(--teal)]"
          />
        </label>
        <fieldset className="space-y-2 text-sm">
          <legend className="text-[var(--fog)]">Stack profile</legend>
          {(
            [
              ["m365", "Microsoft 365"],
              ["google", "Google Workspace"],
              ["hybrid", "Hybrid SaaS"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2">
              <input
                type="radio"
                name="stack_profile"
                value={value}
                defaultChecked={ctx.org.stack_profile === value}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <button
          type="submit"
          className="rounded-md bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-[#04201d]"
        >
          Save settings
        </button>
      </form>

      <div>
        <h2 className="font-[family-name:var(--font-syne)] text-xl font-600 text-white">
          Available templates
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-[var(--fog)]">
          {templates.map((t) => (
            <li key={t.id} className="border-t border-[var(--line)] pt-2">
              <span className="text-white">{t.name}</span> — {t.steps.length} steps ·{" "}
              {t.steps.filter((s) => s.requires_evidence).length} require evidence
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
