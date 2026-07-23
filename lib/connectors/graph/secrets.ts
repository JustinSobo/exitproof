/**
 * Key Vault secret reference pattern for per-tenant Graph credentials.
 *
 * HARD RULES:
 * - Never store Graph client secrets or certificates in Postgres / org rows.
 * - Workers resolve secrets with managed identity: getSecret(secretName).
 * - Secret name is deterministic per ExitProof tenant_id.
 *
 * Example Azure secret payload (JSON, Restricted):
 * {
 *   "clientId": "<multi-tenant-app-id>",
 *   "clientSecret": "<rotated-secret>",   // or certificate thumbprint + PEM
 *   "customerEntraTenantId": "<tid>"
 * }
 *
 * Bicep / ops: create secret `graph-creds-{tenantId}` in the platform or
 * tenant Key Vault; grant the Container Apps / Jobs managed identity get.
 */

import type { GraphKeyVaultSecretRef } from "@/lib/connectors/graph/types";

const DEFAULT_VAULT_URI =
  process.env.AZURE_KEY_VAULT_URI?.replace(/\/$/, "") ??
  "https://kv-exitproof-platform.vault.azure.net";

/** Deterministic Key Vault secret name for a tenant's Graph app credentials. */
export function graphCredsSecretName(tenantId: string): string {
  const safe = tenantId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 36);
  return `graph-creds-${safe}`;
}

/** Build a Key Vault reference (URI + name) — store this shape in config, not secrets. */
export function graphCredsSecretRef(
  tenantId: string,
  opts?: { vaultUri?: string; version?: string | null },
): GraphKeyVaultSecretRef {
  return {
    vaultUri: (opts?.vaultUri ?? DEFAULT_VAULT_URI).replace(/\/$/, ""),
    secretName: graphCredsSecretName(tenantId),
    version: opts?.version ?? null,
  };
}

/** Full secret identifier URL (documentation / diagnostics only). */
export function graphCredsSecretId(ref: GraphKeyVaultSecretRef): string {
  const base = `${ref.vaultUri}/secrets/${ref.secretName}`;
  return ref.version ? `${base}/${ref.version}` : base;
}
