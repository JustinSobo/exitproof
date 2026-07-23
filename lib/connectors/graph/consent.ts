/**
 * Multi-tenant Entra admin consent URL builder (Phase 3).
 *
 * Customer Global Admin opens this URL → consents to GridLogic's multi-tenant
 * app with Graph **application** read-only permissions → Enterprise Application
 * appears in their tenant.
 *
 * Docs: https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/grant-admin-consent
 */

import { getAppUrl } from "@/lib/env";

/** Application (RO) scopes requested at admin consent — never write scopes. */
export const GRAPH_ADMIN_CONSENT_SCOPES = [
  "https://graph.microsoft.com/User.Read.All",
  "https://graph.microsoft.com/AuditLog.Read.All",
  "https://graph.microsoft.com/Directory.Read.All",
] as const;

export interface BuildAdminConsentUrlInput {
  /** GridLogic multi-tenant app (client) ID. */
  clientId: string;
  /** Customer Entra directory ID — scopes consent to that tenant. */
  customerEntraTenantId: string;
  /** Post-consent redirect (defaults to /connectors?consent=1). */
  redirectUri?: string;
  /** Opaque state for CSRF (include tenant_id; verify on return). */
  state?: string;
}

/**
 * Build the admin-consent endpoint URL.
 * Uses `/adminconsent` (application permissions), not delegated authorize.
 */
export function buildAdminConsentUrl(input: BuildAdminConsentUrlInput): string {
  const clientId = input.clientId.trim();
  const tid = input.customerEntraTenantId.trim();
  if (!clientId) {
    throw new Error("clientId is required for admin consent URL");
  }
  if (!tid) {
    throw new Error("customerEntraTenantId is required for admin consent URL");
  }

  const redirectUri =
    input.redirectUri ?? `${getAppUrl()}/connectors?consent=1`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state: input.state ?? tid,
  });

  return `https://login.microsoftonline.com/${encodeURIComponent(tid)}/adminconsent?${params.toString()}`;
}

/** Env-backed client id for the GridLogic Graph RO multi-tenant app. */
export function graphAppClientId(): string | null {
  const id = process.env.GRAPH_APP_CLIENT_ID?.trim();
  return id || null;
}
