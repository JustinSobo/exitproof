/**
 * Read-only AD account query interface.
 * Implementations: mock (CI/demo) and ldap stub (Windows).
 */

export interface AdAccountRecord {
  directoryKey: string;
  samAccountName: string | null;
  userPrincipalName: string | null;
  objectGuid: string | null;
  accountEnabled: boolean;
  userAccountControl: number | null;
  lastLogonAt: string | null;
  memberOf: string[];
  distinguishedName: string | null;
  /** Safe attributes only — never password hashes. */
  rawAttributes: Record<string, unknown>;
}

export interface AdQueryOptions {
  ouScopes: string[];
  /** Filter by UPN / mail / sAMAccountName */
  identity?: string;
}

export interface AdDirectoryReader {
  readonly mode: "mock" | "ldap";
  queryUsers(options: AdQueryOptions): Promise<AdAccountRecord[]>;
}

export const FORBIDDEN_AD_ATTRS = [
  "unicodePwd",
  "userPassword",
  "ntPwdHistory",
  "lmPwdHistory",
  "supplementalCredentials",
] as const;
