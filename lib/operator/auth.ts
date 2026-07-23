import { cookies } from "next/headers";
import { getSessionUser, normalizeOrganization } from "@/lib/auth";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";
import { tenantIdOf } from "@/lib/tenancy";
import { isGrantActive } from "@/lib/operator/jit";
import {
  OPERATOR_ACTIVE_ORG_COOKIE,
  type JitAccessGrant,
  type OperatorContext,
  type OperatorStaff,
  type OperatorTenantSummary,
} from "@/lib/operator/types";
import { tenantHealthFromOrg } from "@/lib/operator/health";
import type { Organization, SessionUser } from "@/lib/types";

export async function getOperatorStaff(
  user: SessionUser,
): Promise<OperatorStaff | null> {
  if (isDemoMode()) {
    return demoStore.getOperatorStaff(user.id);
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase
    .from("operator_staff")
    .select("*")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  return (data as OperatorStaff | null) ?? null;
}

export async function isOperatorUser(user: SessionUser): Promise<boolean> {
  const staff = await getOperatorStaff(user);
  return Boolean(staff?.active);
}

export async function requireOperator(): Promise<{
  user: SessionUser;
  staff: OperatorStaff;
}> {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  const staff = await getOperatorStaff(user);
  if (!staff?.active) {
    throw new Error("GridLogic operator access required.");
  }
  return { user, staff };
}

async function listOrgsForOperator(): Promise<Organization[]> {
  if (isDemoMode()) {
    return demoStore.listAllOrgs();
  }
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  try {
    await supabase.rpc("expire_stale_jit_grants");
  } catch {
    // RPC may be unavailable before migration 008 — ignore
  }
  const { data } = await supabase
    .from("organizations")
    .select("*")
    .is("parent_org_id", null)
    .order("created_at", { ascending: false });
  return (data ?? []).map((row) =>
    normalizeOrganization(row as Record<string, unknown>),
  );
}

export async function listOperatorTenants(
  staffUserId: string,
): Promise<OperatorTenantSummary[]> {
  const orgs = await listOrgsForOperator();
  const grants = await listJitGrantsForStaff(staffUserId);

  return orgs.map((org) => {
    const active =
      grants.find(
        (g) => g.org_id === org.id && isGrantActive(g),
      ) ?? null;
    return {
      org,
      health: tenantHealthFromOrg(org),
      active_jit: active,
    };
  });
}

export async function listJitGrantsForStaff(
  staffUserId: string,
): Promise<JitAccessGrant[]> {
  if (isDemoMode()) {
    return demoStore.listJitGrantsForStaff(staffUserId);
  }
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase
    .from("jit_access_grants")
    .select("*")
    .eq("staff_user_id", staffUserId)
    .order("created_at", { ascending: false });
  return (data as JitAccessGrant[]) ?? [];
}

export async function listJitGrantsForOrg(
  orgId: string,
): Promise<JitAccessGrant[]> {
  if (isDemoMode()) {
    return demoStore.listJitGrantsForOrg(orgId);
  }
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase
    .from("jit_access_grants")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  return (data as JitAccessGrant[]) ?? [];
}

export async function getOperatorOrg(
  orgId: string,
): Promise<Organization | null> {
  if (isDemoMode()) {
    return demoStore.getOrgById(orgId);
  }
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .maybeSingle();
  if (!data) return null;
  return normalizeOrganization(data as Record<string, unknown>);
}

export async function getOperatorContext(): Promise<OperatorContext | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const staff = await getOperatorStaff(user);
  if (!staff?.active) return null;

  const cookieStore = await cookies();
  const activeOrgId = cookieStore.get(OPERATOR_ACTIVE_ORG_COOKIE)?.value ?? null;
  let activeOrg: Organization | null = null;
  let activeGrant: JitAccessGrant | null = null;

  if (activeOrgId) {
    activeOrg = await getOperatorOrg(activeOrgId);
    if (activeOrg) {
      const grants = await listJitGrantsForOrg(activeOrg.id);
      activeGrant =
        grants.find(
          (g) => g.staff_user_id === user.id && isGrantActive(g),
        ) ?? null;
    }
  }

  return {
    user,
    staff,
    activeOrgId: activeOrg?.id ?? null,
    activeOrg,
    activeGrant,
  };
}

/** True when staff may treat this tenant as in-scope (active JIT). */
export function operatorCanAccessTenant(
  grant: JitAccessGrant | null | undefined,
): boolean {
  return Boolean(grant && isGrantActive(grant));
}

export function operatorTenantLabel(org: Organization): string {
  const tid = tenantIdOf(org);
  return `${org.name} (${tid.slice(0, 8)}…)`;
}
