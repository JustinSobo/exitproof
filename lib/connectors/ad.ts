/**
 * Hybrid AD connector domain helpers (Phase 4 foundation).
 * Read-only directory truth + hybrid mismatch (cloud disabled / on-prem enabled).
 */

export type AdConnectorStatus = "pending" | "active" | "revoked" | "error";

export interface AdConnector {
  id: string;
  tenant_id: string;
  org_id: string;
  display_name: string;
  hostname: string | null;
  cert_thumbprint: string;
  status: AdConnectorStatus;
  ou_scopes: string[];
  last_heartbeat_at: string | null;
  agent_version: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface AdDirectorySnapshot {
  id: string;
  tenant_id: string;
  org_id: string;
  connector_id: string;
  case_id: string | null;
  directory_key: string;
  sam_account_name: string | null;
  user_principal_name: string | null;
  object_guid: string | null;
  account_enabled: boolean;
  user_account_control: number | null;
  last_logon_at: string | null;
  member_of: string[];
  distinguished_name: string | null;
  cloud_account_enabled: boolean | null;
  hybrid_mismatch: boolean;
  collected_at: string;
}

/** Case UI view-model for directory status strip. */
export interface CaseDirectoryStatus {
  employee_email: string;
  /** Stub / Graph-fed cloud accountEnabled (Phase 3 fills for real). */
  cloud: {
    source: "demo" | "graph" | "unknown";
    account_enabled: boolean | null;
    label: string;
  };
  ad: {
    source: "demo" | "connector" | "none";
    account_enabled: boolean | null;
    sam_account_name: string | null;
    last_logon_at: string | null;
    member_of: string[];
    collected_at: string | null;
    connector_hostname: string | null;
    label: string;
  };
  /** cloud disabled && on-prem still enabled */
  hybrid_mismatch: boolean;
  mismatch_message: string | null;
}

/** ACCOUNTDISABLE = 0x0002 */
export const AD_UAC_ACCOUNTDISABLE = 0x0002;

export function accountEnabledFromUac(userAccountControl: number): boolean {
  return (userAccountControl & AD_UAC_ACCOUNTDISABLE) === 0;
}

/**
 * Hybrid mismatch: cloud account disabled but on-prem AD still enabled.
 * Null cloud/AD sides → no alert (insufficient data).
 */
export function detectHybridMismatch(
  cloudAccountEnabled: boolean | null | undefined,
  adAccountEnabled: boolean | null | undefined,
): boolean {
  if (cloudAccountEnabled == null || adAccountEnabled == null) return false;
  return cloudAccountEnabled === false && adAccountEnabled === true;
}

export function hybridMismatchMessage(
  employeeEmail: string,
): string {
  return `Hybrid mismatch: cloud (Entra) shows disabled for ${employeeEmail}, but on-prem AD still reports enabled. Complete AD disable / group removal before closing.`;
}

/** Attributes connectors may collect — never password hashes / secrets. */
export const AD_ALLOWED_ATTRIBUTES = [
  "sAMAccountName",
  "userPrincipalName",
  "objectGUID",
  "userAccountControl",
  "lastLogonTimestamp",
  "memberOf",
  "distinguishedName",
  "whenChanged",
  "mail",
] as const;

export const AD_FORBIDDEN_ATTRIBUTES = [
  "unicodePwd",
  "userPassword",
  "ntPwdHistory",
  "lmPwdHistory",
  "supplementalCredentials",
  "msDS-KeyMaterial",
] as const;

export function assertNoForbiddenAttributes(
  attrs: Record<string, unknown>,
): void {
  const keys = Object.keys(attrs);
  const hit = keys.find((k) =>
    AD_FORBIDDEN_ATTRIBUTES.some(
      (f) => f.toLowerCase() === k.toLowerCase(),
    ),
  );
  if (hit) {
    throw new Error(
      `Forbidden AD attribute "${hit}" — connectors must never collect password hashes or secrets.`,
    );
  }
}
