/**
 * Windows LDAP/AD read stub.
 *
 * Real implementation will use ldapjs or Windows System.DirectoryServices
 * from a .NET companion. This Node stub refuses to run unless explicitly
 * enabled and documents the intended bind pattern — CI always uses mock.
 */

import type { AdAccountRecord, AdDirectoryReader, AdQueryOptions } from "./query.js";

export class LdapAdReader implements AdDirectoryReader {
  readonly mode = "ldap" as const;

  async queryUsers(options: AdQueryOptions): Promise<AdAccountRecord[]> {
    void options;
    throw new Error(
      "LDAP reader is a Phase 4 stub. Set EXITPROOF_AD_MODE=mock for CI/demo, " +
        "or implement LDAPS bind with read-only credentials + OU base DNs. " +
        "Never request unicodePwd / password hash attributes.",
    );
  }
}
