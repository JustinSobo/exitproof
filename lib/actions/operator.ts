"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { normalizeOrganization } from "@/lib/auth";
import { demoStore } from "@/lib/demo/store";
import { getAppUrl, isDemoMode } from "@/lib/env";
import {
  DEFAULT_ONBOARDING_FRAMEWORKS,
  parseFrameworkSelections,
} from "@/lib/onboarding/questionnaire";
import {
  requireOperator,
  getOperatorOrg,
} from "@/lib/operator/auth";
import {
  assertValidTicketId,
  clampJitHours,
  expiresAtFromNow,
} from "@/lib/operator/jit";
import {
  OPERATOR_ACTIVE_ORG_COOKIE,
  type JitAccessGrant,
} from "@/lib/operator/types";
import { tenantIdOf } from "@/lib/tenancy";
import type { Organization, StackProfile } from "@/lib/types";

function operatorError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

async function writeAudit(input: {
  orgId: string;
  actorId: string;
  actorEmail: string;
  eventType: string;
  payload: Record<string, unknown>;
}) {
  if (isDemoMode()) {
    demoStore.appendOperatorAudit({
      org_id: input.orgId,
      case_id: null,
      actor_id: input.actorId,
      actor_email: input.actorEmail,
      event_type: input.eventType,
      payload: input.payload,
    });
    return;
  }
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  await supabase.from("audit_events").insert({
    org_id: input.orgId,
    case_id: null,
    actor_id: input.actorId,
    actor_email: input.actorEmail,
    event_type: input.eventType,
    payload: input.payload,
  });
}

/** Request + immediately activate time-boxed JIT access (demo/ops self-serve). */
export async function requestJitAccessAction(formData: FormData): Promise<void> {
  let ctx;
  try {
    ctx = await requireOperator();
  } catch (e) {
    operatorError(
      "/operator",
      e instanceof Error ? e.message : "Operator required",
    );
  }

  const orgId = String(formData.get("org_id") || "").trim();
  const ticketRaw = String(formData.get("ticket_id") || "");
  const reason = String(formData.get("reason") || "").trim() || null;
  const hours = clampJitHours(Number(formData.get("hours") || 4));

  const org = await getOperatorOrg(orgId);
  if (!org) operatorError("/operator", "Tenant not found.");

  let ticket: string;
  try {
    ticket = assertValidTicketId(ticketRaw);
  } catch (e) {
    operatorError(
      `/operator/tenants/${orgId}`,
      e instanceof Error ? e.message : "Invalid ticket",
    );
  }

  const expiresAt = expiresAtFromNow(hours);
  const now = new Date().toISOString();

  if (isDemoMode()) {
    demoStore.createJitGrant({
      org,
      staffUserId: ctx.user.id,
      staffEmail: ctx.user.email,
      ticketId: ticket,
      reason,
      expiresAt,
      activate: true,
    });
  } else {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("jit_access_grants")
      .insert({
        org_id: org.id,
        tenant_id: tenantIdOf(org),
        staff_user_id: ctx.user.id,
        staff_email: ctx.user.email,
        ticket_id: ticket,
        reason,
        status: "active",
        requested_at: now,
        activated_at: now,
        expires_at: expiresAt,
      })
      .select("*")
      .single();
    if (error || !data) {
      operatorError(
        `/operator/tenants/${orgId}`,
        error?.message || "Failed to create JIT grant",
      );
    }
    void (data as JitAccessGrant);
  }

  await writeAudit({
    orgId: org.id,
    actorId: ctx.user.id,
    actorEmail: ctx.user.email,
    eventType: "operator.jit_granted",
    payload: {
      ticket_id: ticket,
      expires_at: expiresAt,
      hours,
      reason,
      tenant_id: tenantIdOf(org),
    },
  });

  revalidatePath("/operator");
  revalidatePath(`/operator/tenants/${org.id}`);
  redirect(`/operator/tenants/${org.id}?jit=1`);
}

export async function revokeJitAccessAction(formData: FormData): Promise<void> {
  let ctx;
  try {
    ctx = await requireOperator();
  } catch (e) {
    operatorError(
      "/operator",
      e instanceof Error ? e.message : "Operator required",
    );
  }

  const grantId = String(formData.get("grant_id") || "").trim();
  const orgId = String(formData.get("org_id") || "").trim();
  if (!grantId || !orgId) operatorError("/operator", "Missing grant.");

  if (isDemoMode()) {
    demoStore.revokeJitGrant(grantId, ctx.user.id);
  } else {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase
      .from("jit_access_grants")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        revoked_by: ctx.user.id,
      })
      .eq("id", grantId)
      .eq("staff_user_id", ctx.user.id);
    if (error) {
      operatorError(`/operator/tenants/${orgId}`, error.message);
    }
  }

  await writeAudit({
    orgId,
    actorId: ctx.user.id,
    actorEmail: ctx.user.email,
    eventType: "operator.jit_revoked",
    payload: { grant_id: grantId },
  });

  revalidatePath("/operator");
  revalidatePath(`/operator/tenants/${orgId}`);
  redirect(`/operator/tenants/${orgId}?revoked=1`);
}

/** Audited operator tenant switcher (session cookie preference). */
export async function switchOperatorTenantAction(
  formData: FormData,
): Promise<void> {
  let ctx;
  try {
    ctx = await requireOperator();
  } catch (e) {
    operatorError(
      "/operator",
      e instanceof Error ? e.message : "Operator required",
    );
  }

  const orgId = String(formData.get("org_id") || "").trim();
  const returnTo = String(formData.get("return_to") || "/operator").trim();
  const org = await getOperatorOrg(orgId);
  if (!org) operatorError("/operator", "Tenant not found.");

  const cookieStore = await cookies();
  cookieStore.set(OPERATOR_ACTIVE_ORG_COOKIE, org.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  await writeAudit({
    orgId: org.id,
    actorId: ctx.user.id,
    actorEmail: ctx.user.email,
    eventType: "operator.tenant_switched",
    payload: {
      tenant_id: tenantIdOf(org),
      org_name: org.name,
    },
  });

  revalidatePath("/operator", "layout");
  redirect(returnTo.startsWith("/operator") ? returnTo : `/operator/tenants/${org.id}`);
}

export async function clearOperatorTenantAction(): Promise<void> {
  try {
    await requireOperator();
  } catch {
    redirect("/auth/login");
  }
  const cookieStore = await cookies();
  cookieStore.delete(OPERATOR_ACTIVE_ORG_COOKIE);
  revalidatePath("/operator", "layout");
  redirect("/operator");
}

/**
 * GridLogic-driven customer onboard: create tenant, SSO flag, frameworks, invite owner.
 */
export async function onboardCustomerAction(formData: FormData): Promise<void> {
  let ctx;
  try {
    ctx = await requireOperator();
  } catch (e) {
    operatorError(
      "/operator/onboard",
      e instanceof Error ? e.message : "Operator required",
    );
  }

  const name = String(formData.get("name") || "").trim();
  const entraTenantId = String(formData.get("entra_tenant_id") || "").trim();
  const ownerEmail = String(formData.get("owner_email") || "")
    .trim()
    .toLowerCase();
  const stackRaw = String(formData.get("stack_profile") || "m365");
  const stack: StackProfile =
    stackRaw === "google" || stackRaw === "hybrid" || stackRaw === "m365"
      ? stackRaw
      : "m365";
  const ssoEnforced = formData.get("sso_enforced") === "on";
  const frameworks = parseFrameworkSelections(formData.getAll("frameworks"));
  const selected =
    frameworks.length > 0 ? frameworks : [...DEFAULT_ONBOARDING_FRAMEWORKS];

  if (!name) operatorError("/operator/onboard", "Customer name is required.");
  if (!entraTenantId || entraTenantId.length < 8) {
    operatorError(
      "/operator/onboard",
      "Customer Entra tenant ID is required (replaces domain JIT).",
    );
  }
  if (!ownerEmail.includes("@")) {
    operatorError("/operator/onboard", "Owner invite email is required.");
  }

  let org: Organization;

  if (isDemoMode()) {
    org = demoStore.provisionCustomer({
      name,
      entraTenantId,
      stack,
      ssoEnforced,
      frameworks: selected,
      ownerEmail,
      actor: ctx.user,
    });
  } else {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    let admin;
    try {
      admin = createAdminClient();
    } catch {
      operatorError(
        "/operator/onboard",
        "Onboard requires SUPABASE_SERVICE_ROLE_KEY on the server.",
      );
    }

    const { data: created, error: orgError } = await admin
      .from("organizations")
      .insert({
        name,
        stack_profile: stack,
        plan: "growth",
        entra_tenant_id: entraTenantId,
        sso_enforced: ssoEnforced,
        selected_frameworks: selected,
        onboarding_completed_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (orgError || !created) {
      operatorError(
        "/operator/onboard",
        orgError?.message || "Failed to create organization",
      );
    }

    org = normalizeOrganization(created as Record<string, unknown>);

    // Ensure tenant_id is set (trigger usually sets = id)
    if (!org.tenant_id) {
      await admin
        .from("organizations")
        .update({ tenant_id: org.id })
        .eq("id", org.id);
      org.tenant_id = org.id;
    }

    const redirectTo = `${getAppUrl()}/auth/callback`;
    const { data: invited, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(ownerEmail, {
        redirectTo,
        data: { invited_org_id: org.id, role: "owner" },
      });

    if (inviteError || !invited.user) {
      operatorError(
        "/operator/onboard",
        inviteError?.message || "Owner invite failed",
      );
    }

    const { error: memberError } = await admin
      .from("organization_members")
      .insert({
        org_id: org.id,
        user_id: invited.user.id,
        role: "owner",
        email: ownerEmail,
        full_name: null,
      });

    if (memberError) {
      operatorError("/operator/onboard", memberError.message);
    }
  }

  await writeAudit({
    orgId: org.id,
    actorId: ctx.user.id,
    actorEmail: ctx.user.email,
    eventType: "operator.customer_onboarded",
    payload: {
      tenant_id: tenantIdOf(org),
      entra_tenant_id: entraTenantId,
      sso_enforced: ssoEnforced,
      frameworks: selected,
      owner_email: ownerEmail,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(OPERATOR_ACTIVE_ORG_COOKIE, org.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  revalidatePath("/operator");
  redirect(`/operator/tenants/${org.id}?onboarded=1`);
}
