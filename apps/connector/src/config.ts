/**
 * Connector configuration from environment.
 * Never log registration tokens or private key material.
 */

export type AdMode = "mock" | "ldap";

export interface ConnectorConfig {
  apiBase: string;
  tenantId: string;
  orgId: string;
  connectorId: string;
  certThumbprint: string;
  registrationToken: string;
  adMode: AdMode;
  ouScopes: string[];
  heartbeatSeconds: number;
  hostname: string;
  agentVersion: string;
}

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) {
    throw new Error(`Missing required env ${name}`);
  }
  return v;
}

export function loadConfig(): ConnectorConfig {
  const adMode = (process.env.EXITPROOF_AD_MODE ?? "mock").toLowerCase();
  if (adMode !== "mock" && adMode !== "ldap") {
    throw new Error("EXITPROOF_AD_MODE must be mock|ldap");
  }

  return {
    apiBase: required("EXITPROOF_API_BASE", "http://localhost:3000").replace(
      /\/$/,
      "",
    ),
    tenantId: required("EXITPROOF_TENANT_ID", "demo-org-1"),
    orgId: required("EXITPROOF_ORG_ID", "demo-org-1"),
    connectorId: required("EXITPROOF_CONNECTOR_ID", "demo-ad-connector-1"),
    certThumbprint: required(
      "EXITPROOF_CERT_THUMBPRINT",
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    )
      .replace(/[:\s]/g, "")
      .toLowerCase(),
    registrationToken: required(
      "EXITPROOF_REGISTRATION_TOKEN",
      "demo-connector-token",
    ),
    adMode,
    ouScopes: (process.env.EXITPROOF_OU_SCOPES ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    heartbeatSeconds: Math.max(
      15,
      Number(process.env.EXITPROOF_HEARTBEAT_SECONDS ?? "60") || 60,
    ),
    hostname:
      process.env.EXITPROOF_HOSTNAME ??
      process.env.COMPUTERNAME ??
      "exitproof-connector",
    agentVersion: "0.1.0-phase4",
  };
}
