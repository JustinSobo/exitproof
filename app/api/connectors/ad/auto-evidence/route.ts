import { NextResponse } from "next/server";
import { z } from "zod";
import { attachAdAutoEvidence } from "@/lib/connectors/ad-auto-evidence";
import { getCurrentOrg } from "@/lib/auth";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";

/**
 * POST /api/connectors/ad/auto-evidence
 *
 * Optional AD auto-evidence (Phase 4/5). Session-auth, tenant-scoped.
 * Attaches hashed CSV to auto-mapped checklist step. Does not mark done —
 * critical steps still need human attest.
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
    if (!snap || !enabled) {
      const { stubCollectAdAutoEvidence } = await import(
        "@/lib/connectors/ad-auto-evidence"
      );
      return NextResponse.json({
        mode: "demo",
        tenant_id: ctx.org.tenant_id ?? ctx.org.id,
        case_id: parsed.data.case_id,
        result: stubCollectAdAutoEvidence(snap, enabled),
      });
    }

    const items = demoStore.getItems(parsed.data.case_id, ctx.org.id);
    const evidence = demoStore.getEvidence(parsed.data.case_id, ctx.org.id);
    const result = await attachAdAutoEvidence({
      items,
      existingEvidence: evidence,
      snapshot: snap,
      autoEvidenceEnabled: enabled,
      selectedFrameworks: ctx.org.selected_frameworks,
      actor: ctx.user,
      orgId: offboardingCase.org_id,
      caseId: parsed.data.case_id,
      persist: async (input) =>
        demoStore.addAutoCollectedEvidence(
          input.itemId,
          input.fileName,
          input.storagePath,
          ctx.user,
          ctx.org.id,
          {
            contentHash: input.contentHash,
            mimeType: input.mimeType,
            byteSize: input.byteSize,
            source: "ad",
          },
        ),
    });

    return NextResponse.json({
      mode: "demo",
      tenant_id: ctx.org.tenant_id ?? ctx.org.id,
      case_id: parsed.data.case_id,
      checklist_item_id:
        parsed.data.checklist_item_id ?? result.target_item_id ?? null,
      result,
      policy: {
        require_human_attest_on_critical:
          ctx.org.require_human_attest_on_critical !== false,
      },
    });
  }

  // Live: require org flag; attach when snapshot available (Phase 5).
  const enabled = Boolean(ctx.org.ad_auto_evidence_enabled);
  if (!enabled) {
    const { stubCollectAdAutoEvidence } = await import(
      "@/lib/connectors/ad-auto-evidence"
    );
    return NextResponse.json({
      mode: "live",
      result: stubCollectAdAutoEvidence(null, false),
    });
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("offboarding_cases")
    .select("id, org_id")
    .eq("id", parsed.data.case_id)
    .maybeSingle();
  if (!c || c.org_id !== ctx.org.id) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const { data: snapRow } = await supabase
    .from("ad_directory_snapshots")
    .select("*")
    .eq("case_id", parsed.data.case_id)
    .eq("tenant_id", ctx.org.tenant_id ?? ctx.org.id)
    .order("collected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!snapRow) {
    const { stubCollectAdAutoEvidence } = await import(
      "@/lib/connectors/ad-auto-evidence"
    );
    return NextResponse.json({
      mode: "live",
      result: stubCollectAdAutoEvidence(null, true),
    });
  }

  const [{ data: itemRows }, { data: evidenceRows }] = await Promise.all([
    supabase
      .from("checklist_items")
      .select("*")
      .eq("case_id", parsed.data.case_id)
      .order("sort_order"),
    supabase.from("evidence_files").select("*").eq("case_id", parsed.data.case_id),
  ]);

  const result = await attachAdAutoEvidence({
    items: (itemRows ?? []) as Parameters<typeof attachAdAutoEvidence>[0]["items"],
    existingEvidence: (evidenceRows ?? []) as Parameters<
      typeof attachAdAutoEvidence
    >[0]["existingEvidence"],
    snapshot: {
      id: snapRow.id,
      tenant_id: snapRow.tenant_id,
      org_id: snapRow.org_id,
      connector_id: snapRow.connector_id,
      case_id: snapRow.case_id,
      directory_key: snapRow.directory_key,
      sam_account_name: snapRow.sam_account_name,
      user_principal_name: snapRow.user_principal_name,
      object_guid: snapRow.object_guid,
      account_enabled: snapRow.account_enabled,
      user_account_control: snapRow.user_account_control,
      last_logon_at: snapRow.last_logon_at,
      member_of: Array.isArray(snapRow.member_of) ? snapRow.member_of : [],
      distinguished_name: snapRow.distinguished_name,
      cloud_account_enabled: snapRow.cloud_account_enabled,
      hybrid_mismatch: snapRow.hybrid_mismatch,
      collected_at: snapRow.collected_at,
    },
    autoEvidenceEnabled: true,
    selectedFrameworks: ctx.org.selected_frameworks,
    actor: ctx.user,
    orgId: c.org_id,
    caseId: parsed.data.case_id,
    persist: async (input) => {
      const { data: row, error } = await supabase
        .from("evidence_files")
        .insert({
          checklist_item_id: input.itemId,
          case_id: parsed.data.case_id,
          org_id: c.org_id,
          file_name: input.fileName,
          storage_path: input.storagePath,
          uploaded_by: "system:ad",
          mime_type: input.mimeType,
          byte_size: input.byteSize,
          content_hash: input.contentHash,
          collection_source: "system:ad",
        })
        .select("*")
        .single();
      if (error || !row) {
        throw new Error(error?.message ?? "Failed to attach AD auto-evidence");
      }
      await supabase.from("audit_events").insert({
        org_id: c.org_id,
        case_id: parsed.data.case_id,
        actor_id: ctx.user.id,
        actor_email: ctx.user.email,
        event_type: "evidence.auto_collected",
        payload: {
          item_id: input.itemId,
          file_name: input.fileName,
          content_hash: input.contentHash,
          source: "ad",
          label: "system-collected snapshot",
        },
      });
      return row;
    },
  });

  return NextResponse.json({
    mode: "live",
    case_id: parsed.data.case_id,
    result,
    policy: {
      require_human_attest_on_critical:
        ctx.org.require_human_attest_on_critical !== false,
    },
  });
}
