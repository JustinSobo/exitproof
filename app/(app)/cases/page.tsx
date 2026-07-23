import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { getCurrentOrg } from "@/lib/auth";
import { listCasesForOrg } from "@/lib/cases/list";
import Link from "next/link";

export const metadata = { title: "Cases" };

export default async function CasesPage() {
  const ctx = await getCurrentOrg();
  if (!ctx) redirect("/auth/login");

  const cases = await listCasesForOrg(ctx.org.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offboarding cases"
        description="Stack-aware checklists with control IDs, evidence, and auditor exports."
        actions={<ButtonLink href="/cases/new">New offboard</ButtonLink>}
      />

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
            <li key={c.id} className="ep-panel px-4 py-4 transition-colors hover:bg-white/[0.06]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/cases/${c.id}`}
                    className="text-lg font-medium text-white hover:text-[var(--teal-bright)]"
                  >
                    {c.employee_name}
                  </Link>
                  <p className="truncate text-sm text-[var(--fog)]">
                    {c.employee_email} · {c.template_name}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <StatusBadge status={c.status} />
                  <p className="mt-1.5 text-[var(--fog)]">
                    Due {c.due_date || "—"}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
