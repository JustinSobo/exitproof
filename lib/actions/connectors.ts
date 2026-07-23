"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  attachGraphAutoEvidence,
  buildAdminConsentUrl,
  graphAppClientId,
  runDirectorySnapshot,
  type DirectorySnapshot,
} from "@/lib/connectors/graph";
import {
  ORG_ADMIN_REQUIRED_MESSAGE,
  requireOrg,
  requireOrgAdmin,
  sessionTenantId,
} from "@/lib/auth";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";
import {
  areConnectorsDisabled,
  CONNECTORS_DISABLED_MESSAGE,
} from "@/lib/security/kill-switch";
import type { GraphConsentStatus } from "@/lib/types";

function revalidateConnectors() {
  revalidatePath("/connectors");
  revalidatePath("/settings");
}

export async function markGraphConsentAction(formData: FormData) {
  const ctx = await requireOrgAdmin();
  const status = String(formData.get("status") || "healthy") as GraphConsentStatus;
  const allowed: GraphConsentStatus[] = [
    "not_started",
    "pending",
    "healthy",
    "revoked",
    "error",
  ];
  if (!allowed.includes(status)) {
    redirect("/connectors?error=Invalid+consent+status");
  }

  const now = new Date().toISOString();
  const patch = {
    graph_consent_status: status,
    graph_consented_at: status === "healthy" ? now : ctx.org.graph_consented_at ?? null,
  };

  if (isDemoMode()) {
    demoStore.updateOrg(ctx.org.id, patch);
    revalidateConnectors();
    redirect(
      status === "healthy"
        ? "/connectors?consented=1"
        : `/connectors?status=${status}`,
    );
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update(patch)
    .eq("id", ctx.org.id);
  if (error) {
    redirect(`/connectors?error=${encodeURIComponent(error.message)}`);
  }
  revalidateConnectors();
  redirect(
    status === "healthy"
      ? "/connectors?consented=1"
      : `/connectors?status=${status}`,
  );
}

export async function setAutoEvidenceAction(formData: FormData) {
  const ctx = await requireOrgAdmin();
  const values = formData.getAll("enabled").map(String);
  const enabled = values.includes("true");

  if (isDemoMode()) {
    demoStore.updateOrg(ctx.org.id, { auto_evidence_enabled: enabled });
    revalidateConnectors();
    redirect("/connectors?saved=1");
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ auto_evidence_enabled: enabled })
    .eq("id", ctx.org.id);
  if (error) {
    redirect(`/connectors?error=${encodeURIComponent(error.message)}`);
  }
  revalidateConnectors();
  redirect("/connectors?saved=1");
}

export async function setAdAutoEvidenceAction(formData: FormData) {
  const ctx = await requireOrgAdmin();
  const values = formData.getAll("enabled").map(String);
  const enabled = values.includes("true");

  if (isDemoMode()) {
    demoStore.updateOrg(ctx.org.id, { ad_auto_evidence_enabled: enabled });
    revalidateConnectors();
    redirect("/connectors?saved=1");
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ ad_auto_evidence_enabled: enabled })
    .eq("id", ctx.org.id);
  if (error) {
    redirect(`/connectors?error=${encodeURIComponent(error.message)}`);
  }
  revalidateConnectors();
  redirect("/connectors?saved=1");
}

export async function setRequireHumanAttestAction(formData: FormData) {
  const ctx = await requireOrgAdmin();
  const values = formData.getAll("enabled").map(String);
  const enabled = values.includes("true");

  if (isDemoMode()) {
    demoStore.updateOrg(ctx.org.id, {
      require_human_attest_on_critical: enabled,
    });
    revalidateConnectors();
    redirect("/connectors?saved=1");
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ require_human_attest_on_critical: enabled })
    .eq("id", ctx.org.id);
  if (error) {
    redirect(`/connectors?error=${encodeURIComponent(error.message)}`);
  }
  revalidateConnectors();
  redirect("/connectors?saved=1");
}

export async function setEntraTenantIdAction(formData: FormData) {
  const ctx = await requireOrgAdmin();
  const tid = String(formData.get("entra_tenant_id") || "").trim();
  if (!tid) {
    redirect("/connectors?error=Entra+tenant+ID+required");
  }

  if (isDemoMode()) {
    demoStore.updateOrg(ctx.org.id, { entra_tenant_id: tid });
    revalidateConnectors();
    redirect("/connectors?saved=1");
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ entra_tenant_id: tid })
    .eq("id", ctx.org.id);
  if (error) {
    redirect(`/connectors?error=${encodeURIComponent(error.message)}`);
  }
  revalidateConnectors();
  redirect("/connectors?saved=1");
}

/** Build admin consent URL for the current org (or null if missing client id / tid). */
export async function getAdminConsentUrlForOrg(): Promise<{
  url: string | null;
  reason?: string;
}> {
  const ctx = await requireOrg();
  const clientId = graphAppClientId();
  const tid = ctx.org.entra_tenant_id?.trim();
  if (!clientId) {
    return {
      url: null,
      reason:
        "Set GRAPH_APP_CLIENT_ID for the GridLogic multi-tenant app (demo can Simulate consent without it).",
    };
  }
  if (!tid) {
    return {
      url: null,
      reason: "Bind the customer Entra directory ID before generating consent URL.",
    };
  }
  try {
    return {
      url: buildAdminConsentUrl({
        clientId,
        customerEntraTenantId: tid,
        state: sessionTenantId(ctx.org),
      }),
    };
  } catch (err) {
    return {
      url: null,
      reason: err instanceof Error ? err.message : "Failed to build consent URL",
    };
  }
}

export async function refreshCaseDirectorySnapshotAction(
  caseId: string,
): Promise<{
  error?: string;
  snapshot?: DirectorySnapshot;
  autoEvidenceAttached?: boolean;
  mismatch?: boolean;
  message?: string | null;
}> {
  try {
    const ctx = await requireOrg();
    if (areConnectorsDisabled(ctx.org)) {
      return { error: CONNECTORS_DISABLED_MESSAGE };
    }
    const tenantId = sessionTenantId(ctx.org);
    const consent =
      ctx.org.graph_consent_status ?? ("not_started" as GraphConsentStatus);

    let offboardingCase = null as {
      id: string;
      org_id: string;
      employee_email: string;
    } | null;
    let items = [] as Awaited<ReturnType<typeof demoStore.getItems>>;
    let evidence = [] as Awaited<ReturnType<typeof demoStore.getEvidence>>;

    if (isDemoMode()) {
      offboardingCase = demoStore.getCase(caseId, ctx.org.id);
      if (!offboardingCase) return { error: "Case not found" };
      items = demoStore.getItems(caseId, ctx.org.id);
      evidence = demoStore.getEvidence(caseId, ctx.org.id);
    } else {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const { data: c } = await supabase
        .from("offboarding_cases")
        .select("id, org_id, employee_email")
        .eq("id", caseId)
        .maybeSingle();
      if (!c) return { error: "Case not found" };
      if (c.org_id !== ctx.org.id) {
        const { data: child } = await supabase
          .from("organizations")
          .select("id")
          .eq("id", c.org_id)
          .eq("parent_org_id", ctx.org.id)
          .maybeSingle();
        if (!child) return { error: "Case not found" };
      }
      offboardingCase = c;
      const [{ data: itemRows }, { data: evidenceRows }] = await Promise.all([
        supabase
          .from("checklist_items")
          .select("*")
          .eq("case_id", caseId)
          .order("sort_order"),
        supabase.from("evidence_files").select("*").eq("case_id", caseId),
      ]);
      items = (itemRows ?? []) as typeof items;
      evidence = (evidenceRows ?? []) as typeof evidence;
    }

    const snapshot = await runDirectorySnapshot({
      tenantId,
      customerEntraTenantId: ctx.org.entra_tenant_id ?? null,
      consentStatus: consent,
      leaverEmail: offboardingCase.employee_email,
    });

    const now = new Date().toISOString();
    if (isDemoMode()) {
      demoStore.updateOrg(ctx.org.id, { graph_last_sync_at: now });
    } else {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      await supabase
        .from("organizations")
        .update({ graph_last_sync_at: now })
        .eq("id", ctx.org.id);
    }

    let autoEvidenceAttached = false;
    if (ctx.org.auto_evidence_enabled) {
      const result = await attachGraphAutoEvidence({
        items,
        existingEvidence: evidence,
        snapshot,
        autoEvidenceEnabled: true,
        selectedFrameworks: ctx.org.selected_frameworks,
        actor: ctx.user,
        orgId: offboardingCase.org_id,
        caseId,
        persist: async (input) => {
          if (isDemoMode()) {
            return demoStore.addAutoCollectedEvidence(
              input.itemId,
              input.fileName,
              input.storagePath,
              ctx.user,
              ctx.org.id,
              {
                contentHash: input.contentHash,
                mimeType: input.mimeType,
                byteSize: input.byteSize,
                source: "graph",
              },
            );
          }
          const { createClient } = await import("@/lib/supabase/server");
          const supabase = await createClient();
          // JSON evidence is small; store as empty blob path + hash in DB for now.
          const { data: row, error } = await supabase
            .from("evidence_files")
            .insert({
              checklist_item_id: input.itemId,
              case_id: caseId,
              org_id: offboardingCase!.org_id,
              file_name: input.fileName,
              storage_path: input.storagePath,
              uploaded_by: `system:graph`,
              mime_type: input.mimeType,
              byte_size: input.byteSize,
              content_hash: input.contentHash,
              collection_source: "system:graph",
            })
            .select("*")
            .single();
          if (error || !row) {
            throw new Error(error?.message ?? "Failed to attach auto-evidence");
          }
          await supabase.from("audit_events").insert({
            org_id: offboardingCase!.org_id,
            case_id: caseId,
            actor_id: ctx.user.id,
            actor_email: ctx.user.email,
            event_type: "evidence.auto_collected",
            payload: {
              item_id: input.itemId,
              file_name: input.fileName,
              content_hash: input.contentHash,
              source: "graph",
              label: "system-collected snapshot",
            },
          });
          return row;
        },
      });
      autoEvidenceAttached = result.attached;
    }

    revalidatePath(`/cases/${caseId}`);
    revalidatePath("/connectors");

    return {
      snapshot,
      autoEvidenceAttached,
      mismatch: snapshot.accountStillEnabled,
      message: snapshot.accountStillEnabled
        ? `Entra account still enabled for ${snapshot.user?.userPrincipalName ?? snapshot.queriedEmail}.`
        : snapshot.user
          ? "Entra account is disabled in the latest snapshot."
          : snapshot.note ?? null,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Snapshot refresh failed";
    if (message === ORG_ADMIN_REQUIRED_MESSAGE) {
      return { error: message };
    }
    return { error: message };
  }
}
