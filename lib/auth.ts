import { cookies } from "next/headers";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";
import type { Organization, OrgMember, SessionUser } from "@/lib/types";

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

/** Fill Phase A columns when reading orgs created before migration 005. */
export function normalizeOrganization(raw: Record<string, unknown>): Organization {
  return {
    ...(raw as unknown as Organization),
    selected_frameworks: Array.isArray(raw.selected_frameworks)
      ? (raw.selected_frameworks as string[])
      : [],
    entra_tenant_id: (raw.entra_tenant_id as string | null) ?? null,
    onboarding_completed_at:
      (raw.onboarding_completed_at as string | null) ?? null,
  };
}

export async function requireOrg() {
  const ctx = await getCurrentOrg();
  if (!ctx) {
    throw new Error("Unauthorized");
  }
  return ctx;
}
