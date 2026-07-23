/**
 * Mock AD directory for CI / local demo (no domain join).
 * Seeds Jordan Lee as still-enabled to exercise hybrid mismatch UI.
 */

import type { AdAccountRecord, AdDirectoryReader, AdQueryOptions } from "./query.js";

const SEED: AdAccountRecord[] = [
  {
    directoryKey: "jordan.lee@northwind.example",
    samAccountName: "jlee",
    userPrincipalName: "jordan.lee@northwind.example",
    objectGuid: "11111111-2222-3333-4444-555555555555",
    accountEnabled: true,
    userAccountControl: 0x200,
    lastLogonAt: new Date(Date.now() - 86400000).toISOString(),
    memberOf: [
      "CN=Domain Users,CN=Users,DC=northwind,DC=example",
      "CN=VPN-Users,OU=Groups,DC=northwind,DC=example",
    ],
    distinguishedName: "CN=Jordan Lee,OU=Users,DC=northwind,DC=example",
    rawAttributes: {
      sAMAccountName: "jlee",
      userPrincipalName: "jordan.lee@northwind.example",
      userAccountControl: 512,
    },
  },
  {
    directoryKey: "alex.rivera@northwind.example",
    samAccountName: "arivera",
    userPrincipalName: "alex.rivera@northwind.example",
    objectGuid: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    accountEnabled: true,
    userAccountControl: 0x200,
    lastLogonAt: new Date().toISOString(),
    memberOf: ["CN=Domain Users,CN=Users,DC=northwind,DC=example"],
    distinguishedName: "CN=Alex Rivera,OU=Users,DC=northwind,DC=example",
    rawAttributes: {
      sAMAccountName: "arivera",
      userPrincipalName: "alex.rivera@northwind.example",
    },
  },
];

export class MockAdReader implements AdDirectoryReader {
  readonly mode = "mock" as const;

  async queryUsers(options: AdQueryOptions): Promise<AdAccountRecord[]> {
    let rows = [...SEED];
    if (options.identity) {
      const q = options.identity.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.directoryKey.toLowerCase() === q ||
          r.userPrincipalName?.toLowerCase() === q ||
          r.samAccountName?.toLowerCase() === q,
      );
    }
    // OU scope is advisory in mock — filter by DN suffix when provided
    if (options.ouScopes.length > 0) {
      rows = rows.filter((r) =>
        options.ouScopes.some((ou) =>
          (r.distinguishedName ?? "").toUpperCase().includes(ou.toUpperCase()),
        ),
      );
    }
    return rows;
  }
}
