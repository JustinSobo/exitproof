import { notFound, redirect } from "next/navigation";
import { CaseDetailClient } from "@/components/app/case-detail";
import { getCurrentOrg, sessionTenantId } from "@/lib/auth";
import {
  attachGraphAutoEvidence,
  runDirectorySnapshot,
  type DirectorySnapshot,
} from "@/lib/connectors/graph";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";
import type { GraphConsentStatus } from "@/lib/types";

export const metadata = { title: "Case" };

async function loadGraphSnapshotForCase(opts: {
  tenantId: string;
  consentStatus: GraphConsentStatus;
  entraTenantId: string | null;
  leaverEmail: string;
  autoEvidenceEnabled: boolean;
  caseId: string;
  orgId: string;
  sessionOrgId: string;
  user: { id: string; email: string };
  items: ReturnType<typeof demoStore.getItems>;
  evidence: ReturnType<typeof demoStore.getEvidence>;
}): Promise<DirectorySnapshot | null> {
  if (
    opts.consentStatus === "not_started" ||
    opts.consentStatus === "revoked"
  ) {
    return null;
  }

  const snapshot = await runDirectorySnapshot({
    tenantId: opts.tenantId,
    customerEntraTenantId: opts.entraTenantId,
    consentStatus: opts.consentStatus,
    leaverEmail: opts.leaverEmail,
  });

  if (opts.autoEvidenceEnabled && isDemoMode()) {
    await attachGraphAutoEvidence({
      items: opts.items,
      existingEvidence: opts.evidence,
      snapshot,
      autoEvidenceEnabled: true,
      actor: opts.user,
      orgId: opts.orgId,
      caseId: opts.caseId,
      persist: async (input) =>
        demoStore.addAutoCollectedEvidence(
          input.itemId,
          input.fileName,
          input.storagePath,
          opts.user,
          opts.sessionOrgId,
          {
            contentHash: input.contentHash,
            mimeType: input.mimeType,
            byteSize: input.byteSize,
            source: "graph",
          },
        ),
    });
    demoStore.updateOrg(opts.sessionOrgId, {
      graph_last_sync_at: snapshot.capturedAt,
    });
  }

  return snapshot;
}

export default async function CasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getCurrentOrg();
  if (!ctx) redirect("/auth/login");
  const { id } = await params;
  const consentStatus =
    ctx.org.graph_consent_status ?? ("not_started" as GraphConsentStatus);

  if (isDemoMode()) {
    const offboardingCase = demoStore.getCase(id, ctx.org.id);
    if (!offboardingCase) notFound();
    const items = demoStore.getItems(id, ctx.org.id);
    let evidence = demoStore.getEvidence(id, ctx.org.id);
    const graphSnapshot = await loadGraphSnapshotForCase({
      tenantId: sessionTenantId(ctx.org),
      consentStatus,
      entraTenantId: ctx.org.entra_tenant_id ?? null,
      leaverEmail: offboardingCase.employee_email,
      autoEvidenceEnabled: Boolean(ctx.org.auto_evidence_enabled),
      caseId: id,
      orgId: offboardingCase.org_id,
      sessionOrgId: ctx.org.id,
      user: ctx.user,
      items,
      evidence,
    });
    // Re-read evidence after optional auto-attach
    evidence = demoStore.getEvidence(id, ctx.org.id);

    return (
      <CaseDetailClient
        offboardingCase={offboardingCase}
        items={items}
        evidence={evidence}
        audits={demoStore.getAudits(id, ctx.org.id)}
        directoryStatus={demoStore.getCaseDirectoryStatus(id, ctx.org.id)}
        graphSnapshot={graphSnapshot}
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

  // Phase 4: AD snapshot optional — ignore missing table until migration 009
  const snapRes = await supabase
    .from("ad_directory_snapshots")
    .select("*")
    .eq("case_id", id)
    .order("collected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const snap = snapRes.error ? null : snapRes.data;

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

  let directoryStatus = null;
  if (snap) {
    const { detectHybridMismatch, hybridMismatchMessage } = await import(
      "@/lib/connectors/ad"
    );
    const cloud = (snap.cloud_account_enabled as boolean | null) ?? null;
    const ad = Boolean(snap.account_enabled);
    const mismatch = detectHybridMismatch(cloud, ad);
    directoryStatus = {
      employee_email: offboardingCase.employee_email as string,
      cloud: {
        source: "graph" as const,
        account_enabled: cloud,
        label:
          cloud == null
            ? "Cloud status unknown"
            : cloud
              ? "Cloud (Entra): Enabled"
              : "Cloud (Entra): Disabled",
      },
      ad: {
        source: "connector" as const,
        account_enabled: ad,
        sam_account_name: (snap.sam_account_name as string | null) ?? null,
        last_logon_at: (snap.last_logon_at as string | null) ?? null,
        member_of: Array.isArray(snap.member_of)
          ? (snap.member_of as string[])
          : [],
        collected_at: (snap.collected_at as string) ?? null,
        connector_hostname: null,
        label: ad ? "On-prem AD: Enabled" : "On-prem AD: Disabled",
      },
      hybrid_mismatch: mismatch,
      mismatch_message: mismatch
        ? hybridMismatchMessage(offboardingCase.employee_email as string)
        : null,
    };
  }

  let graphSnapshot: DirectorySnapshot | null = null;
  if (consentStatus === "healthy" || consentStatus === "pending") {
    graphSnapshot = await runDirectorySnapshot({
      tenantId: sessionTenantId(ctx.org),
      customerEntraTenantId: ctx.org.entra_tenant_id ?? null,
      consentStatus,
      leaverEmail: offboardingCase.employee_email as string,
    });
  }

  return (
    <CaseDetailClient
      offboardingCase={offboardingCase}
      items={normalizedItems}
      evidence={normalizedEvidence}
      audits={audits ?? []}
      directoryStatus={directoryStatus}
      graphSnapshot={graphSnapshot}
    />
  );
}
