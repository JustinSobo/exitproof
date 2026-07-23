import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CONTROLS,
  FRAMEWORKS,
  controlChipLabel,
  getControlsByFramework,
  isFrameworkSlug,
  postureForSelectedFrameworks,
  type CaseCoverageInput,
} from "@/lib/compliance";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentOrg } from "@/lib/auth";
import { listCasesForOrg } from "@/lib/cases/list";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";
import type { ChecklistItem, EvidenceFile } from "@/lib/types";

export const metadata = { title: "Compliance" };

async function loadCaseCoverage(
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

export default async function CompliancePage() {
  const ctx = await getCurrentOrg();
  if (!ctx) redirect("/auth/login");

  const selected = (ctx.org.selected_frameworks ?? []).filter(isFrameworkSlug);
  const cases = await listCasesForOrg(ctx.org.id, { limit: 40 });
  const coverageInputs = await loadCaseCoverage(
    ctx.org.id,
    cases.map((c) => c.id),
  );
  const posture = postureForSelectedFrameworks(selected, coverageInputs);

  const glossaryFrameworks =
    selected.length > 0
      ? FRAMEWORKS.filter((f) => selected.includes(f.slug))
      : FRAMEWORKS;

  return (
    <div className="space-y-10">
      <PageHeader
        title="Compliance posture"
        description={
          <>
            Coverage from sampled offboarding cases mapped to your selected
            frameworks. ExitProof{" "}
            <span className="text-white">supports evidence for</span> these
            controls — it does not guarantee certification, attestation, or
            FedRAMP authorization.
          </>
        }
      />

      {selected.length === 0 ? (
        <Alert variant="warning">
          No frameworks selected yet.{" "}
          <Link
            href="/onboarding?edit=1"
            className="font-semibold text-[var(--amber)] hover:underline"
          >
            Run onboarding →
          </Link>
        </Alert>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {posture.map((p) => (
            <div key={p.slug} className="ep-panel p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--fog)]">
                {p.name}
              </p>
              <p className="mt-2 font-[family-name:var(--font-syne)] text-3xl text-white">
                {p.pct}%
              </p>
              <p className="mt-1 text-xs text-[var(--fog)]">
                {p.covered} covered · {p.partial} partial · {p.open} open
                {p.caseCount > 0
                  ? ` · ${p.caseCount} case${p.caseCount === 1 ? "" : "s"}`
                  : " · no cases yet"}
              </p>
            </div>
          ))}
        </div>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="font-[family-name:var(--font-syne)] text-xl font-600 text-white">
            Control glossary
          </h2>
          <p className="mt-1 text-sm text-[var(--fog)]">
            Curated offboarding controls ({CONTROLS.length} total). Assessor
            language is plain-English guidance for evidence packs.
          </p>
        </div>

        {glossaryFrameworks.map((fw) => {
          const controls = getControlsByFramework(fw.slug);
          if (controls.length === 0) return null;
          return (
            <div key={fw.slug} className="space-y-2">
              <h3 className="text-sm font-semibold text-white">
                {fw.name}{" "}
                <span className="font-normal text-[var(--fog)]">
                  · {fw.version}
                </span>
              </h3>
              <ul className="divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">
                {controls.map((ctrl) => (
                  <li key={ctrl.key} className="px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <Badge
                        variant="control"
                        className="normal-case tracking-normal"
                      >
                        {controlChipLabel(ctrl)}
                      </Badge>
                      <span className="font-medium text-white">{ctrl.title}</span>
                    </div>
                    <p className="mt-1 text-[var(--fog)]">{ctrl.guidance}</p>
                    {ctrl.evidenceExamples.length > 0 ? (
                      <p className="mt-1 text-xs text-[var(--fog)]">
                        Acceptable evidence: {ctrl.evidenceExamples.join("; ")}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>
    </div>
  );
}
