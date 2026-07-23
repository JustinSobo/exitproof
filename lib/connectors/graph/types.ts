/**
 * Microsoft Graph read-only connector types (Phase 3).
 * No write/disable APIs — see ADR-002.
 */

export type GraphConsentStatus =
  | "not_started"
  | "pending"
  | "healthy"
  | "revoked"
  | "error";

/** Minimal user account state from User.Read.All (read-only). */
export interface GraphUserAccountState {
  id: string;
  userPrincipalName: string;
  mail: string | null;
  displayName: string | null;
  accountEnabled: boolean;
  /** ISO timestamp from Graph when available. */
  deletedDateTime?: string | null;
}

/** Optional audit-log signal (AuditLog.Read.All) — stubbed when mock. */
export interface GraphDirectoryAuditHint {
  id: string;
  activityDisplayName: string;
  activityDateTime: string;
  result: string | null;
}

export interface DirectorySnapshot {
  tenantId: string;
  customerEntraTenantId: string | null;
  queriedEmail: string;
  capturedAt: string;
  source: "graph" | "demo_mock";
  user: GraphUserAccountState | null;
  /** True when user was found and accountEnabled === true. */
  accountStillEnabled: boolean;
  recentAudits: GraphDirectoryAuditHint[];
  /** Human-readable note (e.g. mock / missing consent). */
  note?: string;
}

export interface GraphConsentHealth {
  status: GraphConsentStatus;
  consentedAt: string | null;
  lastSyncAt: string | null;
  autoEvidenceEnabled: boolean;
  customerEntraTenantId: string | null;
}

/** Key Vault secret reference — never the secret value itself. */
export interface GraphKeyVaultSecretRef {
  /** e.g. https://kv-exitproof-dev.vault.azure.net/ */
  vaultUri: string;
  /** Secret name pattern: graph-creds-{tenantId} */
  secretName: string;
  /** Optional version pin. */
  version?: string | null;
}

export interface GraphClientCredentials {
  clientId: string;
  /** Customer Entra directory ID (tid). */
  customerTenantId: string;
  /**
   * Opaque handle to Key Vault — workers resolve via managed identity.
   * Never pass raw client secrets through app request bodies.
   */
  secretRef: GraphKeyVaultSecretRef;
}
