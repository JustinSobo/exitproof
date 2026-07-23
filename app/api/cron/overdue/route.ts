import { NextResponse } from "next/server";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";
import { sendOverdueEmail } from "@/lib/resend";

/**
 * Cron-friendly overdue critical-step notifier.
 *
 * Secure with CRON_SECRET:
 *   Authorization: Bearer $CRON_SECRET
 *
 * Vercel Cron example (vercel.json):
 *   { "crons": [{ "path": "/api/cron/overdue", "schedule": "0 14 * * *" }] }
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Array<{ caseId: string; step: string; sent: boolean; reason?: string }> =
    [];

  if (isDemoMode()) {
    for (const row of demoStore.listOverdueCritical()) {
      const to = row.case.assignee_email || "demo@exitproof.app";
      const res = await sendOverdueEmail({
        to,
        employeeName: row.case.employee_name,
        stepTitle: row.item.title,
        caseId: row.case.id,
        dueDate: row.case.due_date || "",
      });
      results.push({
        caseId: row.case.id,
        step: row.item.title,
        sent: res.sent,
        reason: res.reason,
      });
    }
    return NextResponse.json({ mode: "demo", count: results.length, results });
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: cases } = await admin
    .from("offboarding_cases")
    .select("*")
    .neq("status", "closed")
    .lt("due_date", today);

  for (const c of cases ?? []) {
    const { data: items } = await admin
      .from("checklist_items")
      .select("*")
      .eq("case_id", c.id)
      .eq("is_critical", true)
      .neq("status", "done");

    for (const item of items ?? []) {
      const to = c.assignee_email;
      if (!to) continue;
      const res = await sendOverdueEmail({
        to,
        employeeName: c.employee_name,
        stepTitle: item.title,
        caseId: c.id,
        dueDate: c.due_date,
      });
      results.push({
        caseId: c.id,
        step: item.title,
        sent: res.sent,
        reason: res.reason,
      });
    }
  }

  return NextResponse.json({ mode: "live", count: results.length, results });
}

export async function POST(request: Request) {
  return GET(request);
}
