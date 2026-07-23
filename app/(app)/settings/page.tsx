import Link from "next/link";
import { redirect } from "next/navigation";
import { updateOrgSettingsAction } from "@/lib/actions/cases";
import { getCurrentOrg } from "@/lib/auth";
import { FRAMEWORKS } from "@/lib/compliance/frameworks";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";
import { getTemplatesForStack } from "@/lib/templates";
import type { OrgMember } from "@/lib/types";

export const metadata = { title: "Settings" };

async function listOrgMembers(orgId: string): Promise<OrgMember[]> {
  if (isDemoMode()) {
    return demoStore.listMembers(orgId);
  }
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_members")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  return (data ?? []) as OrgMember[];
}

export default async function SettingsPage() {
  const ctx = await getCurrentOrg();
  if (!ctx) redirect("/auth/login");

  const templates = getTemplatesForStack(ctx.org.stack_profile);
  const members = await listOrgMembers(ctx.org.id);
  const selected = new Set(ctx.org.selected_frameworks ?? []);
  const selectedLabels = FRAMEWORKS.filter((f) => selected.has(f.slug)).map(
    (f) => f.name,
  );

  const ssoStatus = isDemoMode()
    ? {
        label: "Demo mode",
        detail:
          "Microsoft Entra SSO is hidden in demo. Live apps use Continue with Microsoft via Supabase Azure.",
      }
    : ctx.org.entra_tenant_id
      ? {
          label: "Entra tenant linked",
          detail: `Tenant ID: ${ctx.org.entra_tenant_id}`,
        }
      : {
          label: "Microsoft Entra available",
          detail:
            "Members can sign in with Microsoft. Optional tenant lock is not set yet.",
        };

  return (
    <div className="mx-auto max-w-xl space-y-10">
      <div>
        <h1 className="font-[family-name:var(--font-syne)] text-3xl font-700 text-white">
          Organization settings
        </h1>
        <p className="mt-2 text-[var(--fog)]">
          Stack profile, SSO status, and members. Re-run the questionnaire when
          your frameworks or tools change.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-syne)] text-xl font-600 text-white">
          SSO status
        </h2>
        <div className="rounded-xl border border-[var(--line)] bg-white/[0.03] px-4 py-3 text-sm">
          <p className="font-medium text-white">{ssoStatus.label}</p>
          <p className="mt-1 text-[var(--fog)]">{ssoStatus.detail}</p>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-[family-name:var(--font-syne)] text-xl font-600 text-white">
            Frameworks & onboarding
          </h2>
          <Link
            href="/onboarding?edit=1"
            className="text-sm font-medium text-[var(--teal-bright)] hover:underline"
          >
            Re-run questionnaire
          </Link>
        </div>
        <p className="text-sm text-[var(--fog)]">
          {selectedLabels.length > 0
            ? `Selected: ${selectedLabels.join(", ")}`
            : "No frameworks selected yet — complete onboarding to target FedRAMP, CMMC, SOC, and more."}
        </p>
        {selected.has("fedramp") ||
        selected.has("cmmc-l1") ||
        selected.has("cmmc-l2") ? (
          <p className="text-xs text-[var(--amber)]">
            FedRAMP/CMMC selected — new cases escalate evidence-required on
            mapped checklist steps.
          </p>
        ) : null}
        {ctx.org.onboarding_completed_at ? (
          <p className="text-xs text-[var(--fog)]">
            Onboarding completed{" "}
            {new Date(ctx.org.onboarding_completed_at).toLocaleDateString()}.
          </p>
        ) : (
          <p className="text-xs text-[var(--amber)]">
            Onboarding incomplete — checklist templates may be generic until you
            finish the wizard.
          </p>
        )}
      </section>

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

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-syne)] text-xl font-600 text-white">
          Members
        </h2>
        <ul className="space-y-2 text-sm">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 border-t border-[var(--line)] pt-2"
            >
              <div>
                <p className="text-white">{m.full_name || m.email}</p>
                {m.full_name ? (
                  <p className="text-xs text-[var(--fog)]">{m.email}</p>
                ) : null}
              </div>
              <span className="text-xs uppercase tracking-wide text-[var(--fog)]">
                {m.role}
              </span>
            </li>
          ))}
          {members.length === 0 ? (
            <li className="text-[var(--fog)]">No members found.</li>
          ) : null}
        </ul>
        <div className="rounded-xl border border-dashed border-[var(--line)] px-4 py-4 text-sm">
          <p className="font-medium text-white">Invite teammates</p>
          <p className="mt-1 text-[var(--fog)]">
            Email invites land in a later release (Phase E). For now, share your
            org login path — Microsoft Entra SSO or break-glass email.
          </p>
          <form className="mt-3 flex flex-wrap gap-2">
            <input
              type="email"
              placeholder="colleague@company.com"
              disabled
              className="min-w-[14rem] flex-1 rounded-md border border-[var(--line)] bg-black/20 px-3 py-2 text-white opacity-60"
            />
            <button
              type="button"
              disabled
              className="rounded-md border border-[var(--line)] px-3 py-2 text-[var(--fog)] opacity-60"
            >
              Invite (soon)
            </button>
          </form>
        </div>
      </section>

      <div>
        <h2 className="font-[family-name:var(--font-syne)] text-xl font-600 text-white">
          Available templates
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-[var(--fog)]">
          {templates.map((t) => (
            <li key={t.id} className="border-t border-[var(--line)] pt-2">
              <span className="text-white">{t.name}</span> — {t.steps.length}{" "}
              steps · {t.steps.filter((s) => s.requires_evidence).length} require
              evidence
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
