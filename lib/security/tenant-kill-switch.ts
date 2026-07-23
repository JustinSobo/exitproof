/**
 * Resolve kill-switch flags for connector / sync paths by tenant_id.
 * Never trust client-supplied flags — load from org row.
 */

import { normalizeOrganization } from "@/lib/auth";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";
import {
  areConnectorsDisabled,
  CONNECTORS_DISABLED_MESSAGE,
  type KillSwitchFlags,
} from "@/lib/security/kill-switch";
import type { Organization } from "@/lib/types";

export async function loadOrgByTenantId(
  tenantId: string,
): Promise<Organization | null> {
  if (isDemoMode()) {
    return demoStore.getOrgByTenantId(tenantId);
  }
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data } = await admin
    .from("organizations")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) return null;
  return normalizeOrganization(data as Record<string, unknown>);
}

export async function loadKillSwitchByTenantId(
  tenantId: string,
): Promise<KillSwitchFlags | null> {
  const org = await loadOrgByTenantId(tenantId);
  if (!org) return null;
  return {
    login_frozen: Boolean(org.login_frozen),
    connectors_disabled: Boolean(org.connectors_disabled),
  };
}

/** 403 JSON body when connectors_disabled for the tenant. */
export function connectorsDisabledResponse() {
  return {
    error: CONNECTORS_DISABLED_MESSAGE,
    stop: true,
    kill_switch: "connectors_disabled",
  };
}

export async function assertConnectorsEnabledForTenant(
  tenantId: string,
): Promise<{ ok: true } | { ok: false; body: ReturnType<typeof connectorsDisabledResponse> }> {
  const org = await loadOrgByTenantId(tenantId);
  if (org && areConnectorsDisabled(org)) {
    return { ok: false, body: connectorsDisabledResponse() };
  }
  return { ok: true };
}
