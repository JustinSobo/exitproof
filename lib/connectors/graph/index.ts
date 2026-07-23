/**
 * Phase 3 — Microsoft Graph read-only connector.
 *
 * - Admin consent URL builder
 * - Directory snapshots (User.Read.All / AuditLog.Read.All interfaces)
 * - Key Vault secret reference pattern (no secrets in DB)
 * - Optional hashed auto-evidence
 *
 * Demo works without real Graph credentials via DemoGraphClient.
 */

export {
  GRAPH_ADMIN_CONSENT_SCOPES,
  buildAdminConsentUrl,
  graphAppClientId,
} from "@/lib/connectors/graph/consent";
export {
  DemoGraphClient,
  GraphClientStub,
  createGraphClient,
  hasGraphLiveConfig,
  type GraphDirectoryClient,
} from "@/lib/connectors/graph/client";
export {
  graphCredsSecretId,
  graphCredsSecretName,
  graphCredsSecretRef,
} from "@/lib/connectors/graph/secrets";
export {
  entraAccountMismatch,
  runDirectorySnapshot,
  type SnapshotJobInput,
} from "@/lib/connectors/graph/snapshot";
export {
  attachGraphAutoEvidence,
  buildGraphSnapshotEvidencePayload,
  pickAutoEvidenceTarget,
  type AutoEvidenceAttachResult,
} from "@/lib/connectors/graph/auto-evidence";
export type {
  DirectorySnapshot,
  GraphClientCredentials,
  GraphConsentHealth,
  GraphConsentStatus,
  GraphDirectoryAuditHint,
  GraphKeyVaultSecretRef,
  GraphUserAccountState,
} from "@/lib/connectors/graph/types";
