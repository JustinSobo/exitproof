/**
 * Microsoft Graph client stub — User.Read.All / AuditLog.Read.All only.
 *
 * Live path: client-credentials against customer tenant using Key Vault secret.
 * Demo / missing creds: DemoGraphClient returns deterministic mock data.
 *
 * FORBIDDEN until Phase 7: disable user, revoke sessions, wipe, write scopes.
 */

import { createHash } from "crypto";
import type {
  GraphClientCredentials,
  GraphDirectoryAuditHint,
  GraphUserAccountState,
} from "@/lib/connectors/graph/types";
import { isDemoMode } from "@/lib/env";

export interface GraphDirectoryClient {
  /** Lookup user by mail / UPN (User.Read.All). */
  getUserByEmail(email: string): Promise<GraphUserAccountState | null>;
  /** Recent directory audits mentioning the user (AuditLog.Read.All). */
  listRecentUserAudits(
    email: string,
    limit?: number,
  ): Promise<GraphDirectoryAuditHint[]>;
}

/**
 * Live Graph client stub.
 * Resolves credentials via Key Vault reference at call time (not implemented
 * until Azure wiring). Throws a clear error so callers fall back to mock.
 */
export class GraphClientStub implements GraphDirectoryClient {
  constructor(private readonly creds: GraphClientCredentials) {}

  async getUserByEmail(email: string): Promise<GraphUserAccountState | null> {
    void email;
    void this.creds;
    throw new Error(
      "GraphClientStub: live Graph calls require Azure Key Vault credential resolution (not wired in this phase). Use demo mock or inject a client.",
    );
  }

  async listRecentUserAudits(
    email: string,
    limit = 5,
  ): Promise<GraphDirectoryAuditHint[]> {
    void email;
    void limit;
    void this.creds;
    throw new Error(
      "GraphClientStub: live AuditLog.Read.All not wired — use demo mock.",
    );
  }
}

/**
 * Deterministic demo mock — no network.
 * Seeded demo leaver jordan.lee@northwind.example stays accountEnabled=true
 * so case mismatch UI is visible. Emails containing "disabled" return enabled=false.
 */
export class DemoGraphClient implements GraphDirectoryClient {
  async getUserByEmail(email: string): Promise<GraphUserAccountState | null> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return null;

    // Synthetic "not found"
    if (normalized.includes("missing@") || normalized.endsWith(".gone")) {
      return null;
    }

    const id = createHash("sha256")
      .update(`demo-graph-user:${normalized}`)
      .digest("hex")
      .slice(0, 32);

    const disabled =
      normalized.includes("disabled") ||
      normalized.startsWith("offboarded.");

    return {
      id: `demo-${id}`,
      userPrincipalName: normalized,
      mail: normalized,
      displayName: displayNameFromEmail(normalized),
      accountEnabled: !disabled,
      deletedDateTime: null,
    };
  }

  async listRecentUserAudits(
    email: string,
    limit = 5,
  ): Promise<GraphDirectoryAuditHint[]> {
    const user = await this.getUserByEmail(email);
    if (!user) return [];
    if (user.accountEnabled) {
      // Still enabled — no disable audit yet.
      return [
        {
          id: "demo-audit-signin-1",
          activityDisplayName: "User logged in",
          activityDateTime: new Date(Date.now() - 86_400_000).toISOString(),
          result: "success",
        },
      ].slice(0, limit);
    }
    return [
      {
        id: "demo-audit-disable-1",
        activityDisplayName: "Disable account",
        activityDateTime: new Date(Date.now() - 3_600_000).toISOString(),
        result: "success",
      },
    ].slice(0, limit);
  }
}

function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

/**
 * Prefer demo mock when DEMO_MODE or when no Graph app client id / secret path.
 * Live stub is only constructed when callers pass credentials explicitly.
 */
export function createGraphClient(
  creds?: GraphClientCredentials | null,
): GraphDirectoryClient {
  if (isDemoMode() || !creds) {
    return new DemoGraphClient();
  }
  return new GraphClientStub(creds);
}

/** True when live Graph credentials are configured enough to attempt calls. */
export function hasGraphLiveConfig(): boolean {
  return Boolean(
    process.env.GRAPH_APP_CLIENT_ID?.trim() &&
      process.env.AZURE_KEY_VAULT_URI?.trim(),
  );
}
