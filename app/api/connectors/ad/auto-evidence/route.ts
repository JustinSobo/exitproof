import { NextResponse } from "next/server";
import { z } from "zod";
import { stubCollectAdAutoEvidence } from "@/lib/connectors/ad-auto-evidence";
import { getCurrentOrg } from "@/lib/auth";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";

/**
 * POST /api/connectors/ad/auto-evidence
 *
 * Optional AD auto-evidence stub (Phase 4). Session-auth (operator/customer),
 * tenant-scoped. Does not claim certification — system-collected label only.
 */

const bodySchema = z.object({
  case_id: z.string().min(1),
  checklist_item_id: z.string().optional(),
});

export async function POST(request: Request) {
  const ctx = await getCurrentOrg();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (isDemoMode()) {
    const offboardingCase = demoStore.getCase(parsed.data.case_id, ctx.org.id);
    if (!offboardingCase) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }
    const snap = demoStore.getLatestAdSnapshotForCase(
      parsed.data.case_id,
      ctx.org.id,
    );
    const enabled = Boolean(ctx.org.ad_auto_evidence_enabled);
    const result = stubCollectAdAutoEvidence(snap, enabled);
    return NextResponse.json({
      mode: "demo",
      tenant_id: ctx.org.tenant_id ?? ctx.org.id,
      case_id: parsed.data.case_id,
      checklist_item_id: parsed.data.checklist_item_id ?? null,
      result,
    });
  }

  // Live stub: require org flag + latest snapshot; do not attach blob yet.
  const enabled = Boolean(
    (ctx.org as { ad_auto_evidence_enabled?: boolean }).ad_auto_evidence_enabled,
  );
  if (!enabled) {
    return NextResponse.json({
      mode: "live",
      result: stubCollectAdAutoEvidence(null, false),
    });
  }

  return NextResponse.json({
    mode: "live",
    result: {
      status: "pending",
      label: "system-collected snapshot",
      content_hash: null,
      file_name: null,
      csv_preview: null,
      message:
        "Live AD auto-evidence attach is stubbed — wire blob + evidence_files in Phase 5.",
    },
  });
}
