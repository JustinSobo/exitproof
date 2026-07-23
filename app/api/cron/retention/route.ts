import { NextResponse } from "next/server";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";

/**
 * Retention purge: delete closed cases older than org.retention_days.
 * Writes retention.purged audit events.
 *
 * Secure with CRON_SECRET (same rules as /api/cron/overdue).
 * Vercel Cron: { "path": "/api/cron/retention", "schedule": "0 5 * * *" }
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!isDemoMode()) {
    if (!secret || auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isDemoMode()) {
    const purged = demoStore.purgeExpiredCases();
    return NextResponse.json({
      mode: "demo",
      purged: purged.length,
      results: purged,
    });
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const results: Array<{
    orgId: string;
    caseId: string;
    closedAt: string;
    retentionDays: number;
  }> = [];

  const { data: orgs } = await admin
    .from("organizations")
    .select("id, retention_days");

  for (const org of orgs ?? []) {
    const retentionDays = Number(org.retention_days) || 90;
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
    const cutoffIso = cutoff.toISOString();

    const { data: expired } = await admin
      .from("offboarding_cases")
      .select("id, closed_at")
      .eq("org_id", org.id)
      .eq("status", "closed")
      .lt("closed_at", cutoffIso);

    for (const c of expired ?? []) {
      if (!c.closed_at) continue;

      const { data: files } = await admin
        .from("evidence_files")
        .select("storage_path")
        .eq("case_id", c.id);

      const paths = (files ?? [])
        .map((f) => f.storage_path as string)
        .filter(Boolean);
      if (paths.length > 0) {
        await admin.storage.from("evidence").remove(paths);
      }

      // Cascades: checklist_items, evidence_files, checklist_item_controls
      // (FK on delete). Audit events are append-only — leave historical rows.
      const { error: delError } = await admin
        .from("offboarding_cases")
        .delete()
        .eq("id", c.id);

      if (delError) {
        console.error("[retention] delete failed", c.id, delError.message);
        continue;
      }

      await admin.from("audit_events").insert({
        org_id: org.id,
        case_id: null,
        actor_id: null,
        actor_email: "system",
        event_type: "retention.purged",
        payload: {
          case_id: c.id,
          closed_at: c.closed_at,
          retention_days: retentionDays,
        },
      });

      results.push({
        orgId: org.id as string,
        caseId: c.id as string,
        closedAt: c.closed_at as string,
        retentionDays,
      });
    }
  }

  return NextResponse.json({
    mode: "live",
    purged: results.length,
    results,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
