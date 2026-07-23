import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/app/empty-state";
import { getCurrentOrg } from "@/lib/auth";
import { listCasesForOrg } from "@/lib/cases/list";

export const metadata = { title: "Cases" };

export default async function CasesPage() {
  const ctx = await getCurrentOrg();
  if (!ctx) redirect("/auth/login");

  const cases = await listCasesForOrg(ctx.org.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
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

      {cases.length === 0 ? (
        <EmptyState
          title="No cases yet"
          body="Start an offboard to get a stack-aware checklist with control IDs, evidence hints, and exportable auditor packs."
          actionHref="/cases/new"
          actionLabel="New offboard"
        />
      ) : (
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
                  <p className="capitalize text-white">
                    {c.status.replace("_", " ")}
                  </p>
                  <p className="text-[var(--fog)]">Due {c.due_date || "—"}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
