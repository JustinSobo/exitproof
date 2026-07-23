/**
 * Tenant isolation helpers (Phase 1 / GridLogic charter).
 *
 * HARD RULE: `tenant_id` must come from the authenticated session
 * (membership → organizations.tenant_id), never from client request body alone.
 * API routes and server actions that accept org/tenant identifiers must still
 * verify the value equals `ctx.org.tenant_id` (or accessible agency child).
 */

import type { Organization } from "@/lib/types";

/** Resolve immutable tenant_id for an org (falls back to id for pre-migration rows). */
export function tenantIdOf(org: Pick<Organization, "id" | "tenant_id">): string {
  return org.tenant_id ?? org.id;
}

/**
 * Assert a client-supplied id matches the session tenant.
 * Call after requireOrg() — never trust body.tenant_id / body.org_id alone.
 */
export function assertSessionTenant(
  sessionOrg: Pick<Organization, "id" | "tenant_id">,
  candidateTenantId: string | null | undefined,
): void {
  const expected = tenantIdOf(sessionOrg);
  if (!candidateTenantId || candidateTenantId !== expected) {
    throw new Error(
      "tenant_id mismatch: value must match the authenticated session tenant.",
    );
  }
}

/** Blob / storage prefix for evidence isolation (matches infra Standard SKU). */
export function tenantBlobPrefix(tenantId: string): string {
  return `tenants/${tenantId}/`;
}
