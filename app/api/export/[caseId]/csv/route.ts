import { NextResponse } from "next/server";
import { getCurrentOrg } from "@/lib/auth";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";

function csvEscape(value: string | null | undefined): string {
  const v = value ?? "";
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const ctx = await getCurrentOrg();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { caseId } = await context.params;

  let employee = "";
  let rows: Array<Record<string, string>> = [];

  if (isDemoMode()) {
    const c = demoStore.getCase(caseId, ctx.org.id);
    if (!c) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    employee = c.employee_name;
    const evidence = demoStore.getEvidence(caseId, ctx.org.id);
    rows = demoStore.getItems(caseId, ctx.org.id).map((item) => ({
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
      completed_at: item.completed_at ?? "",
      completed_by: item.completed_by ?? "",
      evidence_files: evidence
        .filter((e) => e.checklist_item_id === item.id)
        .map((e) => e.file_name)
        .join("; "),
    }));
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

    rows = (items ?? []).map((item) => ({
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
      completed_at: item.completed_at ?? "",
      completed_by: item.completed_by ?? "",
      evidence_files: (evidence ?? [])
        .filter((e) => e.checklist_item_id === item.id)
        .map((e) => e.file_name)
        .join("; "),
    }));
  }

  const headers = Object.keys(rows[0] ?? {
    employee_name: "",
    step: "",
    status: "",
  });

  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(",")),
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="exitproof-${employee.replace(/\s+/g, "-").toLowerCase() || caseId.slice(0, 8)}.csv"`,
    },
  });
}
