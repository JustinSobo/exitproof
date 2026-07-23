import Link from "next/link";
import {
  isFrameworkSlug,
  postureForSelectedFrameworks,
  type CaseCoverageInput,
} from "@/lib/compliance";
import { getCurrentOrg } from "@/lib/auth";
import { canCreateOffboard, normalizeMonthlyUsage } from "@/lib/billing/gates";
import { PLANS } from "@/lib/billing/plans";
import { listCasesForOrg } from "@/lib/cases/list";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";
import type { ChecklistItem, EvidenceFile } from "@/lib/types";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";

export const metadata = { title: "Dashboard" };

async function loadCoverageForCases(
  orgId: string,
  caseIds: string[],
): Promise<CaseCoverageInput[]> {
  if (caseIds.length === 0) return [];
  if (isDemoMode()) {
    return caseIds.map((id) => ({
      items: demoStore.getItems(id, orgId),
      evidence: demoStore.getEvidence(id, orgId),
    }));
  }
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const [{ data: items }, { data: evidence }] = await Promise.all([
    supabase.from("checklist_items").select("*").in("case_id", caseIds),
    supabase.from("evidence_files").select("*").in("case_id", caseIds),
  ]);
  const itemsByCase = new Map<string, ChecklistItem[]>();
  for (const item of (items ?? []) as ChecklistItem[]) {
    const list = itemsByCase.get(item.case_id) ?? [];
    list.push(item);
    itemsByCase.set(item.case_id, list);
  }
  const evidenceByCase = new Map<string, EvidenceFile[]>();
  for (const file of (evidence ?? []) as EvidenceFile[]) {
    const list = evidenceByCase.get(file.case_id) ?? [];
    list.push(file);
    evidenceByCase.set(file.case_id, list);
  }
  return caseIds.map((id) => ({
    items: itemsByCase.get(id) ?? [],
    evidence: evidenceByCase.get(id) ?? [],
  }));
}

export default async function DashboardPage() {
  const ctx = await getCurrentOrg();
  if (!ctx) redirect("/auth/login");

  const org = normalizeMonthlyUsage(ctx.org);
  const plan = PLANS[org.plan];
  const gate = canCreateOffboard(org);
  const cases = await listCasesForOrg(org.id, { limit: 8 });
  const openCount = cases.filter((c) => c.status !== "closed").length;

  const selected = (org.selected_frameworks ?? []).filter(isFrameworkSlug);
  const coverageInputs = await loadCoverageForCases(
    org.id,
    cases.map((c) => c.id),
  );
  const posture = postureForSelectedFrameworks(selected, coverageInputs);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description={
          <>
            Stack profile: <span className="text-white">{org.stack_profile}</span>{" "}
            · Retention {org.retention_days} days
          </>
        }
        actions={
          gate.allowed ? (
            <ButtonLink href="/cases/new">New offboard</ButtonLink>
          ) : null
        }
      />

      {posture.length > 0 ? (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--fog)]">
              Framework posture
            </h2>
            <Link
              href="/compliance"
              className="text-xs text-[var(--teal-bright)] hover:underline"
            >
              View compliance →
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {posture.map((p) => (
              <div key={p.slug} className="ep-panel px-3 py-2 text-sm">
                <span className="text-white">{p.name}</span>
                <span className="ml-2 font-[family-name:var(--font-syne)] text-[var(--teal-bright)]">
                  {p.pct}%
                </span>
                <span className="ml-1.5 text-xs text-[var(--fog)]">
                  {p.covered}/{p.total}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Alert variant="info">
          No frameworks selected.{" "}
          <Link href="/onboarding?edit=1" className="text-[var(--teal-bright)] hover:underline">
            Choose frameworks
          </Link>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Open cases", value: String(openCount) },
          {
            label: "Usage this month",
            value:
              org.plan === "trial"
                ? `${org.trial_offboards_used} / 3 trial`
                : plan.offboardLimit === null
                  ? `${org.offboards_this_month} · unlimited`
                  : `${org.offboards_this_month} / ${plan.offboardLimit}`,
          },
          { label: "Plan", value: org.plan },
        ].map((stat) => (
          <div key={stat.label} className="ep-panel p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--fog)]">
              {stat.label}
            </p>
            <p className="mt-2 font-[family-name:var(--font-syne)] text-3xl capitalize text-white">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {!gate.allowed ? (
        <Alert variant="warning">
          {gate.reason}{" "}
          <Link href="/billing" className="font-semibold text-[var(--amber)] hover:underline">
            Upgrade billing →
          </Link>
        </Alert>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <h2 className="font-[family-name:var(--font-syne)] text-xl font-600 text-white">
          Recent cases
        </h2>
        <Link
          href="/cases"
          className="text-sm text-[var(--teal-bright)] hover:underline"
        >
          View all
        </Link>
      </div>

      {cases.length === 0 ? (
        <EmptyState
          title="No cases yet"
          body="Create your first offboarding to get a stack-aware checklist with control IDs and exportable Evidence Packs."
          actionHref={gate.allowed ? "/cases/new" : "/billing"}
          actionLabel={gate.allowed ? "New offboard" : "View billing"}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--line)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-[var(--fog)]">
              <tr>
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">
                  Assignee
                </th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-[var(--line)] transition-colors hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/cases/${c.id}`}
                      className="text-white hover:text-[var(--teal-bright)]"
                    >
                      {c.employee_name}
                    </Link>
                    <p className="text-xs text-[var(--fog)]">{c.employee_email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3">{c.due_date || "—"}</td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    {c.assignee_email || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
