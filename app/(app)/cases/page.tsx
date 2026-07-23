import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/auth";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";

export const metadata = { title: "Cases" };

export default async function CasesPage() {
  const ctx = await getCurrentOrg();
  if (!ctx) redirect("/auth/login");

  let cases = [];
  if (isDemoMode()) {
    cases = demoStore.listCases(ctx.org.id);
  } else {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data } = await supabase
      .from("offboarding_cases")
      .select("*")
      .eq("org_id", ctx.org.id)
      .order("created_at", { ascending: false });
    cases = data ?? [];
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-syne)] text-3xl font-700 text-white">
          Offboarding cases
        </h1>
        <Link
          href="/cases/new"
          className="rounded-md bg-[var(--teal)] px-3 py-2 text-sm font-semibold text-[#04201d]"
        >
          New offboard
        </Link>
      </div>

      <ul className="space-y-3">
        {cases.map((c) => (
          <li
            key={c.id}
            className="rounded-xl border border-[var(--line)] bg-white/[0.03] px-4 py-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Link
                  href={`/cases/${c.id}`}
                  className="text-lg font-medium text-white hover:text-[var(--teal-bright)]"
                >
                  {c.employee_name}
                </Link>
                <p className="text-sm text-[var(--fog)]">
                  {c.employee_email} · {c.template_name}
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="capitalize text-white">{c.status.replace("_", " ")}</p>
                <p className="text-[var(--fog)]">Due {c.due_date || "—"}</p>
              </div>
            </div>
          </li>
        ))}
        {cases.length === 0 ? (
          <li className="text-[var(--fog)]">No cases yet.</li>
        ) : null}
      </ul>
    </div>
  );
}
