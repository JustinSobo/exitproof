import Link from "next/link";
import { getCurrentOrg } from "@/lib/auth";
import { canCreateOffboard, normalizeMonthlyUsage } from "@/lib/billing/gates";
import { PLANS } from "@/lib/billing/plans";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";
import { redirect } from "next/navigation";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const ctx = await getCurrentOrg();
  if (!ctx) redirect("/auth/login");

  const org = normalizeMonthlyUsage(ctx.org);
  const plan = PLANS[org.plan];
  const gate = canCreateOffboard(org);

  let cases = [];
  if (isDemoMode()) {
    cases = demoStore.listCases(org.id);
  } else {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data } = await supabase
      .from("offboarding_cases")
      .select("*")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false })
      .limit(8);
    cases = data ?? [];
  }

  const openCount = cases.filter((c) => c.status !== "closed").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-syne)] text-3xl font-700 text-white">
          Dashboard
        </h1>
        <p className="mt-2 text-[var(--fog)]">
          Stack profile: <span className="text-white">{org.stack_profile}</span> ·
          Retention {org.retention_days} days
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--line)] bg-white/[0.04] p-5">
          <p className="text-xs uppercase tracking-wider text-[var(--fog)]">Open cases</p>
          <p className="mt-2 font-[family-name:var(--font-syne)] text-3xl text-white">
            {openCount}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-white/[0.04] p-5">
          <p className="text-xs uppercase tracking-wider text-[var(--fog)]">
            Usage this month
          </p>
          <p className="mt-2 font-[family-name:var(--font-syne)] text-3xl text-white">
            {org.plan === "trial"
              ? `${org.trial_offboards_used} / 3 trial`
              : plan.offboardLimit === null
                ? `${org.offboards_this_month} · unlimited`
                : `${org.offboards_this_month} / ${plan.offboardLimit}`}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-white/[0.04] p-5">
          <p className="text-xs uppercase tracking-wider text-[var(--fog)]">Plan</p>
          <p className="mt-2 font-[family-name:var(--font-syne)] text-3xl capitalize text-white">
            {org.plan}
          </p>
        </div>
      </div>

      {!gate.allowed ? (
        <div className="rounded-xl border border-[var(--amber)]/40 bg-[var(--amber)]/10 px-4 py-3 text-sm">
          {gate.reason}{" "}
          <Link href="/billing" className="font-semibold text-[var(--amber)]">
            Upgrade billing →
          </Link>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-syne)] text-xl font-600 text-white">
          Recent cases
        </h2>
        <Link
          href="/cases/new"
          className="rounded-md bg-[var(--teal)] px-3 py-2 text-sm font-semibold text-[#04201d]"
        >
          New offboard
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--line)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-[var(--fog)]">
            <tr>
              <th className="px-4 py-3 font-medium">Employee</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Due</th>
              <th className="px-4 py-3 font-medium">Assignee</th>
            </tr>
          </thead>
          <tbody>
            {cases.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-[var(--fog)]">
                  No cases yet. Create your first offboarding.
                </td>
              </tr>
            ) : (
              cases.map((c) => (
                <tr key={c.id} className="border-t border-[var(--line)]">
                  <td className="px-4 py-3">
                    <Link href={`/cases/${c.id}`} className="text-white hover:text-[var(--teal-bright)]">
                      {c.employee_name}
                    </Link>
                    <p className="text-xs text-[var(--fog)]">{c.employee_email}</p>
                  </td>
                  <td className="px-4 py-3 capitalize">{c.status.replace("_", " ")}</td>
                  <td className="px-4 py-3">{c.due_date || "—"}</td>
                  <td className="px-4 py-3">{c.assignee_email || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
