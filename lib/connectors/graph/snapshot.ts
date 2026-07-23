/**
 * Directory snapshot job — read account enabled state for a leaver email.
 * Uses Graph when wired; otherwise DemoGraphClient (no network).
 */

import {
  createGraphClient,
  hasGraphLiveConfig,
  type GraphDirectoryClient,
} from "@/lib/connectors/graph/client";
import { graphCredsSecretRef } from "@/lib/connectors/graph/secrets";
import type {
  DirectorySnapshot,
  GraphClientCredentials,
  GraphConsentStatus,
} from "@/lib/connectors/graph/types";

export interface SnapshotJobInput {
  /** ExitProof tenant_id (session). */
  tenantId: string;
  customerEntraTenantId: string | null;
  consentStatus: GraphConsentStatus;
  leaverEmail: string;
  /** Inject for tests. */
  client?: GraphDirectoryClient;
}

export async function runDirectorySnapshot(
  input: SnapshotJobInput,
): Promise<DirectorySnapshot> {
  const email = input.leaverEmail.trim().toLowerCase();
  const capturedAt = new Date().toISOString();

  if (
    input.consentStatus === "not_started" ||
    input.consentStatus === "revoked"
  ) {
    return {
      tenantId: input.tenantId,
      customerEntraTenantId: input.customerEntraTenantId,
      queriedEmail: email,
      capturedAt,
      source: "demo_mock",
      user: null,
      accountStillEnabled: false,
      recentAudits: [],
      note:
        input.consentStatus === "revoked"
          ? "Graph consent revoked — snapshots paused. Re-consent from Connectors."
          : "Graph consent not started — run admin consent from Connectors (demo uses mock when healthy).",
    };
  }

  const client =
    input.client ??
    createGraphClient(resolveCreds(input.tenantId, input.customerEntraTenantId));

  let user = null;
  let recentAudits: DirectorySnapshot["recentAudits"] = [];
  let source: DirectorySnapshot["source"] = "demo_mock";
  let note: string | undefined;

  try {
    user = await client.getUserByEmail(email);
    recentAudits = await client.listRecentUserAudits(email, 5);
    source =
      hasGraphLiveConfig() && input.client === undefined ? "graph" : "demo_mock";
    if (source === "demo_mock") {
      note =
        "Demo / mock Graph snapshot (no live credentials). Leaver emails stay enabled unless they contain \"disabled\".";
    }
  } catch (err) {
    note =
      err instanceof Error
        ? `Graph snapshot failed: ${err.message}`
        : "Graph snapshot failed";
    // Fall back to demo mock so product paths stay usable.
    const mock = createGraphClient(null);
    user = await mock.getUserByEmail(email);
    recentAudits = await mock.listRecentUserAudits(email, 5);
    source = "demo_mock";
  }

  return {
    tenantId: input.tenantId,
    customerEntraTenantId: input.customerEntraTenantId,
    queriedEmail: email,
    capturedAt,
    source,
    user,
    accountStillEnabled: Boolean(user?.accountEnabled),
    recentAudits,
    note:
      user === null && !note
        ? "No Entra user found for this email in the directory snapshot."
        : note,
  };
}

function resolveCreds(
  tenantId: string,
  customerEntraTenantId: string | null,
): GraphClientCredentials | null {
  const clientId = process.env.GRAPH_APP_CLIENT_ID?.trim();
  if (!clientId || !customerEntraTenantId || !hasGraphLiveConfig()) {
    return null;
  }
  return {
    clientId,
    customerTenantId: customerEntraTenantId,
    secretRef: graphCredsSecretRef(tenantId),
  };
}

/** Case-detail mismatch: checklist implies revoke but Entra still enabled. */
export function entraAccountMismatch(
  snapshot: DirectorySnapshot,
): { mismatch: boolean; message: string | null } {
  if (!snapshot.user) {
    return { mismatch: false, message: null };
  }
  if (!snapshot.accountStillEnabled) {
    return { mismatch: false, message: null };
  }
  return {
    mismatch: true,
    message: `Entra account still enabled for ${snapshot.user.userPrincipalName}. Disable sign-in in the customer directory, then refresh the snapshot.`,
  };
}
