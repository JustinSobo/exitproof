import { cookies } from "next/headers";
import {
  isOrgAdminRole,
  ORG_ADMIN_REQUIRED_MESSAGE,
} from "@/lib/auth/roles";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";
import { tenantIdOf } from "@/lib/tenancy";
import type { Organization, OrgMember, SessionUser } from "@/lib/types";

export { isOrgAdminRole, ORG_ADMIN_REQUIRED_MESSAGE } from "@/lib/auth/roles";
export { tenantIdOf, assertSessionTenant } from "@/lib/tenancy";

export const DEMO_SESSION_COOKIE = "ep_demo_session";

export async function getSessionUser(): Promise<SessionUser | null> {
  if (isDemoMode()) {
    const cookieStore = await cookies();
    const token = cookieStore.get(DEMO_SESSION_COOKIE)?.value;
    return demoStore.getUserByToken(token);
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return {
    id: data.user.id,
    email: data.user.email ?? "",
    full_name:
      (data.user.user_metadata?.full_name as string | undefined) ?? null,
  };
}

export async function getCurrentOrg(): Promise<{
  user: SessionUser;
  org: Organization;
  member: OrgMember;
} | null> {
  const user = await getSessionUser();
  if (!user) return null;

  if (isDemoMode()) {
    const membership = demoStore.getMembership(user.id);
    if (!membership) return null;
    return { user, ...membership };
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("organization_members")
    .select("*")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!member) return null;

  const { data: org } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", member.org_id)
    .single();

  if (!org) return null;

  return {
    user,
    org: normalizeOrganization(org),
    member: member as OrgMember,
  };
}

/** Fill Phase A/1 columns when reading orgs created before migrations 005/006. */
export function normalizeOrganization(raw: Record<string, unknown>): Organization {
  const id = String(raw.id ?? "");
  const tenantId =
    typeof raw.tenant_id === "string" && raw.tenant_id
      ? raw.tenant_id
      : id;
  return {
    ...(raw as unknown as Organization),
    id,
    tenant_id: tenantId,
    selected_frameworks: Array.isArray(raw.selected_frameworks)
      ? (raw.selected_frameworks as string[])
      : [],
    entra_tenant_id: (raw.entra_tenant_id as string | null) ?? null,
    sso_enforced: Boolean(raw.sso_enforced),
    onboarding_completed_at:
      (raw.onboarding_completed_at as string | null) ?? null,
    graph_consent_status: normalizeGraphConsentStatus(
      raw.graph_consent_status,
    ),
    graph_consented_at: (raw.graph_consented_at as string | null) ?? null,
    graph_last_sync_at: (raw.graph_last_sync_at as string | null) ?? null,
    auto_evidence_enabled: Boolean(raw.auto_evidence_enabled),
    hybrid_ad_enabled: Boolean(raw.hybrid_ad_enabled),
    ad_auto_evidence_enabled: Boolean(raw.ad_auto_evidence_enabled),
    // Default ON when column absent (Phase 5 attest-on-critical).
    require_human_attest_on_critical:
      raw.require_human_attest_on_critical !== false,
    login_frozen: Boolean(raw.login_frozen),
    connectors_disabled: Boolean(raw.connectors_disabled),
  };
}

function normalizeGraphConsentStatus(
  value: unknown,
): Organization["graph_consent_status"] {
  const allowed = new Set([
    "not_started",
    "pending",
    "healthy",
    "revoked",
    "error",
  ]);
  if (typeof value === "string" && allowed.has(value)) {
    return value as Organization["graph_consent_status"];
  }
  return "not_started";
}

/** Session-scoped tenant_id — never accept this from client body alone. */
export function sessionTenantId(org: Organization): string {
  return tenantIdOf(org);
}

export async function requireOrg() {
  const ctx = await getCurrentOrg();
  if (!ctx) {
    throw new Error("Unauthorized");
  }
  return ctx;
}

/** Require owner/admin membership for settings, billing, clients, invites. */
export async function requireOrgAdmin() {
  const ctx = await requireOrg();
  if (!isOrgAdminRole(ctx.member.role)) {
    throw new Error(ORG_ADMIN_REQUIRED_MESSAGE);
  }
  return ctx;
}
