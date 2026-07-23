import type { ConnectorConfig } from "./config.js";
import { LdapAdReader } from "./ad/ldap.js";
import { MockAdReader } from "./ad/mock.js";
import type { AdDirectoryReader } from "./ad/query.js";
import { loadClientCert, mTlsStubHeaders } from "./auth/client-cert.js";

export function createAdReader(config: ConnectorConfig): AdDirectoryReader {
  return config.adMode === "ldap" ? new LdapAdReader() : new MockAdReader();
}

async function postJson(
  config: ConnectorConfig,
  path: string,
  body: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const cert = loadClientCert(config);
  void cert; // PFX used when undici/agent mTLS is wired
  const res = await fetch(`${config.apiBase}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...mTlsStubHeaders(config),
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, json };
}

export async function sendHeartbeat(config: ConnectorConfig): Promise<void> {
  const { status, json } = await postJson(config, "/api/connectors/ad/heartbeat", {
    tenant_id: config.tenantId,
    agent_version: config.agentVersion,
    hostname: config.hostname,
    metrics: { ad_mode: config.adMode },
  });
  if (status === 403 && json.stop) {
    throw new Error("Connector revoked by platform — stopping.");
  }
  if (status >= 400) {
    throw new Error(`Heartbeat failed (${status}): ${JSON.stringify(json)}`);
  }
  console.log("[heartbeat] ok", json.last_heartbeat_at ?? json);
}

export async function sendSnapshots(
  config: ConnectorConfig,
  caseId?: string,
): Promise<void> {
  const reader = createAdReader(config);
  const users = await reader.queryUsers({
    ouScopes: config.ouScopes,
    identity: process.env.EXITPROOF_LOOKUP_IDENTITY,
  });

  const snapshots = users.map((u) => ({
    case_id: caseId ?? process.env.EXITPROOF_CASE_ID ?? null,
    directory_key: u.directoryKey,
    sam_account_name: u.samAccountName,
    user_principal_name: u.userPrincipalName,
    object_guid: u.objectGuid,
    account_enabled: u.accountEnabled,
    user_account_control: u.userAccountControl,
    last_logon_at: u.lastLogonAt,
    member_of: u.memberOf,
    distinguished_name: u.distinguishedName,
    // Demo hybrid mismatch: cloud disabled while AD enabled for jordan.lee
    cloud_account_enabled:
      u.directoryKey === "jordan.lee@northwind.example" ? false : null,
    raw_attributes: u.rawAttributes,
  }));

  const { status, json } = await postJson(config, "/api/connectors/ad/snapshots", {
    tenant_id: config.tenantId,
    snapshots,
  });
  if (status === 403 && json.stop) {
    throw new Error("Connector revoked by platform — stopping.");
  }
  if (status >= 400) {
    throw new Error(`Snapshot ingest failed (${status}): ${JSON.stringify(json)}`);
  }
  console.log("[snapshot] ingested", json.count, "records");
}
