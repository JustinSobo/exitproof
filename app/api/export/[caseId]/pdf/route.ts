import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { getCurrentOrg, normalizeOrganization } from "@/lib/auth";
import { parseExportFramework } from "@/lib/compliance";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";
import { EvidencePackDocument } from "@/lib/pdf/evidence-pack";
import type {
  AuditEvent,
  ChecklistItem,
  EvidenceFile,
  OffboardingCase,
  Organization,
} from "@/lib/types";

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
  const pack = await loadPack(caseId, ctx.org);

  if (!pack) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const buffer = await renderToBuffer(
    EvidencePackDocument({
      ...pack,
      framework,
      generatedAt: new Date().toISOString(),
    }),
  );

  const fwSuffix = framework === "all" ? "" : `-${framework}`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="exitproof-${caseId.slice(0, 8)}${fwSuffix}.pdf"`,
    },
  });
}

async function loadPack(caseId: string, org: Organization) {
  if (isDemoMode()) {
    const offboardingCase = demoStore.getCase(caseId, org.id);
    if (!offboardingCase) return null;
    return {
      org,
      offboardingCase,
      items: demoStore.getItems(caseId, org.id),
      evidence: demoStore.getEvidence(caseId, org.id),
      audits: demoStore.getAudits(caseId, org.id),
    };
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: offboardingCase } = await supabase
    .from("offboarding_cases")
    .select("*")
    .eq("id", caseId)
    .maybeSingle();
  if (!offboardingCase) return null;

  const caseOrgId = offboardingCase.org_id as string;
  if (caseOrgId !== org.id) {
    const { data: child } = await supabase
      .from("organizations")
      .select("id")
      .eq("id", caseOrgId)
      .eq("parent_org_id", org.id)
      .maybeSingle();
    if (!child) return null;
  }

  const [{ data: items }, { data: evidence }, { data: audits }, { data: caseOrg }] =
    await Promise.all([
      supabase
        .from("checklist_items")
        .select("*")
        .eq("case_id", caseId)
        .order("sort_order"),
      supabase.from("evidence_files").select("*").eq("case_id", caseId),
      supabase
        .from("audit_events")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at"),
      supabase.from("organizations").select("*").eq("id", caseOrgId).maybeSingle(),
    ]);

  return {
    org: caseOrg ? normalizeOrganization(caseOrg) : org,
    offboardingCase: offboardingCase as OffboardingCase,
    items: normalizeItems(items ?? []),
    evidence: normalizeEvidence(evidence ?? []),
    audits: (audits ?? []) as AuditEvent[],
  };
}

function normalizeItems(
  rows: Record<string, unknown>[],
): ChecklistItem[] {
  return rows.map((row) => ({
    ...(row as unknown as ChecklistItem),
    control_refs: Array.isArray(row.control_refs)
      ? (row.control_refs as string[])
      : [],
    evidence_hint: (row.evidence_hint as string | null) ?? null,
    notified_at: (row.notified_at as string | null) ?? null,
  }));
}

function normalizeEvidence(
  rows: Record<string, unknown>[],
): EvidenceFile[] {
  return rows.map((row) => ({
    ...(row as unknown as EvidenceFile),
    content_hash: (row.content_hash as string | null) ?? null,
    mime_type: (row.mime_type as string | null) ?? null,
    byte_size: (row.byte_size as number | null) ?? null,
  }));
}
