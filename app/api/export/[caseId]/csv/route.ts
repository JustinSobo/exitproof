import { NextResponse } from "next/server";
import { getCurrentOrg } from "@/lib/auth";
import {
  filterRefsByFramework,
  parseExportFramework,
  resolveControlRefs,
} from "@/lib/compliance";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";
import type { ChecklistItem, EvidenceFile, OffboardingCase } from "@/lib/types";

function csvEscape(value: string | null | undefined): string {
  const v = value ?? "";
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const ctx = await getCurrentOrg();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { caseId } = await context.params;
  const framework = parseExportFramework(
    new URL(request.url).searchParams.get("framework"),
  );

  let employee = "";
  let rows: Array<Record<string, string>> = [];

  if (isDemoMode()) {
    const c = demoStore.getCase(caseId, ctx.org.id);
    if (!c) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    employee = c.employee_name;
    const evidence = demoStore.getEvidence(caseId, ctx.org.id);
    rows = expandRows(
      c,
      demoStore.getItems(caseId, ctx.org.id),
      evidence,
      framework,
    );
  } else {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: c } = await supabase
      .from("offboarding_cases")
      .select("*")
      .eq("id", caseId)
      .maybeSingle();
    if (!c) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (c.org_id !== ctx.org.id) {
      const { data: child } = await supabase
        .from("organizations")
        .select("id")
        .eq("id", c.org_id)
        .eq("parent_org_id", ctx.org.id)
        .maybeSingle();
      if (!child) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    employee = c.employee_name;
    const { data: items } = await supabase
      .from("checklist_items")
      .select("*")
      .eq("case_id", caseId)
      .order("sort_order");
    const { data: evidence } = await supabase
      .from("evidence_files")
      .select("*")
      .eq("case_id", caseId);

    rows = expandRows(
      c as OffboardingCase,
      (items ?? []).map((item) => ({
        ...(item as ChecklistItem),
        control_refs: Array.isArray(item.control_refs)
          ? item.control_refs
          : [],
        evidence_hint: item.evidence_hint ?? null,
        notified_at: item.notified_at ?? null,
      })),
      (evidence ?? []) as EvidenceFile[],
      framework,
    );
  }

  const headers = Object.keys(
    rows[0] ?? {
      employee_name: "",
      step: "",
      framework: "",
      control_id: "",
      status: "",
    },
  );

  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(",")),
  ];

  const fwSuffix = framework === "all" ? "" : `-${framework}`;
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="exitproof-${employee.replace(/\s+/g, "-").toLowerCase() || caseId.slice(0, 8)}${fwSuffix}.csv"`,
    },
  });
}

/** One row per checklist item × control (normalized for assessors). */
function expandRows(
  c: OffboardingCase,
  items: ChecklistItem[],
  evidence: EvidenceFile[],
  framework: ReturnType<typeof parseExportFramework>,
): Array<Record<string, string>> {
  const rows: Array<Record<string, string>> = [];

  for (const item of items) {
    const refs = filterRefsByFramework(item.control_refs ?? [], framework);
    const controls = resolveControlRefs(refs);
    const files = evidence
      .filter((e) => e.checklist_item_id === item.id)
      .map((e) => e.file_name)
      .join("; ");

    const base = {
      employee_name: c.employee_name,
      employee_email: c.employee_email,
      status_case: c.status,
      step: item.title,
      category: item.category,
      critical: item.is_critical ? "yes" : "no",
      requires_evidence: item.requires_evidence ? "yes" : "no",
      status: item.status,
      notes: item.notes ?? "",
      ticket_url: item.ticket_url ?? "",
      evidence_hint: item.evidence_hint ?? "",
      completed_at: item.completed_at ?? "",
      completed_by: item.completed_by ?? "",
      evidence_files: files,
    };

    if (controls.length === 0) {
      if (framework === "all") {
        rows.push({
          ...base,
          framework: "",
          control_id: "",
          control_title: "",
        });
      }
      continue;
    }

    for (const ctrl of controls) {
      rows.push({
        ...base,
        framework: ctrl.framework,
        control_id: ctrl.controlId,
        control_title: ctrl.title,
      });
    }
  }

  return rows;
}
