import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { getCurrentOrg } from "@/lib/auth";
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
  _request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const ctx = await getCurrentOrg();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { caseId } = await context.params;
  const pack = await loadPack(caseId, ctx.org);

  if (!pack) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const buffer = await renderToBuffer(
    EvidencePackDocument({
      ...pack,
      generatedAt: new Date().toISOString(),
    }),
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="exitproof-${caseId.slice(0, 8)}.pdf"`,
    },
  });
}

async function loadPack(caseId: string, org: Organization) {
  if (isDemoMode()) {
    const offboardingCase = demoStore.getCase(caseId);
    if (!offboardingCase) return null;
    return {
      org,
      offboardingCase,
      items: demoStore.getItems(caseId),
      evidence: demoStore.getEvidence(caseId),
      audits: demoStore.getAudits(caseId),
    };
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: offboardingCase } = await supabase
    .from("offboarding_cases")
    .select("*")
    .eq("id", caseId)
    .single();
  if (!offboardingCase) return null;

  const [{ data: items }, { data: evidence }, { data: audits }] =
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
    ]);

  return {
    org,
    offboardingCase: offboardingCase as OffboardingCase,
    items: (items ?? []) as ChecklistItem[],
    evidence: (evidence ?? []) as EvidenceFile[],
    audits: (audits ?? []) as AuditEvent[],
  };
}
