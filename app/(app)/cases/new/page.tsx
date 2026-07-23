import { redirect } from "next/navigation";
import { createCaseAction } from "@/lib/actions/cases";
import { getCurrentOrg } from "@/lib/auth";
import { canCreateOffboard, normalizeMonthlyUsage } from "@/lib/billing/gates";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";
import { getTemplatesForStack } from "@/lib/templates";

export const metadata = { title: "New offboard" };

export default async function NewCasePage() {
  const ctx = await getCurrentOrg();
  if (!ctx) redirect("/auth/login");

  const org = normalizeMonthlyUsage(ctx.org);
  const gate = canCreateOffboard(org);
  const templates = getTemplatesForStack(org.stack_profile);

  let clientOrgs: Array<{ id: string; name: string }> = [];
  if (org.plan === "agency") {
    if (isDemoMode()) {
      clientOrgs = demoStore.listClientOrgs(org.id);
    } else {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const { data } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("parent_org_id", org.id);
      clientOrgs = data ?? [];
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="font-[family-name:var(--font-syne)] text-3xl font-700 text-white">
        New offboarding case
      </h1>

      {!gate.allowed ? (
        <div className="rounded-xl border border-[var(--amber)]/40 bg-[var(--amber)]/10 px-4 py-3 text-sm">
          {gate.reason}
        </div>
      ) : null}

      <form action={createCaseAction} className="space-y-4">
        {org.plan === "agency" && clientOrgs.length > 0 ? (
          <label className="block text-sm">
            <span className="text-[var(--fog)]">Organization</span>
            <select
              name="org_id"
              defaultValue={org.id}
              className="mt-1 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 py-2 text-white"
            >
              <option value={org.id}>{org.name} (parent)</option>
              {clientOrgs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="org_id" value={org.id} />
        )}

        <label className="block text-sm">
          <span className="text-[var(--fog)]">Employee name</span>
          <input
            name="employee_name"
            required
            disabled={!gate.allowed}
            className="mt-1 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 py-2 text-white outline-none focus:border-[var(--teal)] disabled:opacity-50"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--fog)]">Employee email</span>
          <input
            name="employee_email"
            type="email"
            required
            disabled={!gate.allowed}
            className="mt-1 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 py-2 text-white outline-none focus:border-[var(--teal)] disabled:opacity-50"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--fog)]">Template</span>
          <select
            name="template_id"
            disabled={!gate.allowed}
            className="mt-1 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 py-2 text-white disabled:opacity-50"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-[var(--fog)]">Assignee email</span>
          <input
            name="assignee_email"
            type="email"
            defaultValue={ctx.user.email}
            disabled={!gate.allowed}
            className="mt-1 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 py-2 text-white outline-none focus:border-[var(--teal)] disabled:opacity-50"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--fog)]">Due date</span>
          <input
            name="due_date"
            type="date"
            disabled={!gate.allowed}
            className="mt-1 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 py-2 text-white outline-none focus:border-[var(--teal)] disabled:opacity-50"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--fog)]">Notes</span>
          <textarea
            name="notes"
            rows={3}
            disabled={!gate.allowed}
            className="mt-1 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 py-2 text-white outline-none focus:border-[var(--teal)] disabled:opacity-50"
          />
        </label>
        <button
          type="submit"
          disabled={!gate.allowed}
          className="rounded-md bg-[var(--teal)] px-4 py-2.5 text-sm font-semibold text-[#04201d] hover:bg-[var(--teal-bright)] disabled:opacity-50"
        >
          Create case
        </button>
      </form>
    </div>
  );
}
