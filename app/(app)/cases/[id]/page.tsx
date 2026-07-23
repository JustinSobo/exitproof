import { notFound, redirect } from "next/navigation";
import { CaseDetailClient } from "@/components/app/case-detail";
import { getCurrentOrg } from "@/lib/auth";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";

export const metadata = { title: "Case" };

export default async function CasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getCurrentOrg();
  if (!ctx) redirect("/auth/login");
  const { id } = await params;

  if (isDemoMode()) {
    const offboardingCase = demoStore.getCase(id, ctx.org.id);
    if (!offboardingCase) notFound();
    return (
      <CaseDetailClient
        offboardingCase={offboardingCase}
        items={demoStore.getItems(id, ctx.org.id)}
        evidence={demoStore.getEvidence(id, ctx.org.id)}
        audits={demoStore.getAudits(id, ctx.org.id)}
      />
    );
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: offboardingCase } = await supabase
    .from("offboarding_cases")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!offboardingCase) notFound();

  if (offboardingCase.org_id !== ctx.org.id) {
    const { data: child } = await supabase
      .from("organizations")
      .select("id")
      .eq("id", offboardingCase.org_id)
      .eq("parent_org_id", ctx.org.id)
      .maybeSingle();
    if (!child) notFound();
  }

  const [{ data: items }, { data: evidence }, { data: audits }] =
    await Promise.all([
      supabase
        .from("checklist_items")
        .select("*")
        .eq("case_id", id)
        .order("sort_order"),
      supabase.from("evidence_files").select("*").eq("case_id", id),
      supabase
        .from("audit_events")
        .select("*")
        .eq("case_id", id)
        .order("created_at"),
    ]);

  const normalizedItems = (items ?? []).map((item) => ({
    ...item,
    control_refs: Array.isArray(item.control_refs) ? item.control_refs : [],
    evidence_hint: item.evidence_hint ?? null,
    notified_at: item.notified_at ?? null,
  }));

  const normalizedEvidence = (evidence ?? []).map((e) => ({
    ...e,
    content_hash: e.content_hash ?? null,
    mime_type: e.mime_type ?? null,
    byte_size: e.byte_size ?? null,
  }));

  return (
    <CaseDetailClient
      offboardingCase={offboardingCase}
      items={normalizedItems}
      evidence={normalizedEvidence}
      audits={audits ?? []}
    />
  );
}
