import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";
import type { OffboardingCase } from "@/lib/types";

/** Current org + agency child org ids (demo + live). */
export async function listAccessibleOrgIds(orgId: string): Promise<string[]> {
  if (isDemoMode()) {
    return [...demoStore.accessibleOrgIds(orgId)];
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: children } = await supabase
    .from("organizations")
    .select("id")
    .eq("parent_org_id", orgId);

  return [orgId, ...(children ?? []).map((c) => c.id)];
}

export async function listCasesForOrg(
  orgId: string,
  options?: { limit?: number },
): Promise<OffboardingCase[]> {
  if (isDemoMode()) {
    const cases = demoStore.listCases(orgId);
    return options?.limit ? cases.slice(0, options.limit) : cases;
  }

  const orgIds = await listAccessibleOrgIds(orgId);
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  let query = supabase
    .from("offboarding_cases")
    .select("*")
    .in("org_id", orgIds)
    .order("created_at", { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data } = await query;
  return (data ?? []) as OffboardingCase[];
}
