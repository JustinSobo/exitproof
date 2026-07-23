/**
 * Connector mTLS auth stubs for platform API routes.
 *
 * Production: Azure Front Door / App Gateway terminates mTLS; app receives
 * verified client cert thumbprint via trusted header / connection metadata.
 * This module validates registration token + thumbprint against tenant-scoped
 * connector rows — never trust body.tenant_id alone.
 */

import { createHash, timingSafeEqual } from "crypto";

export const CONNECTOR_ID_HEADER = "x-exitproof-connector-id";
export const CERT_THUMBPRINT_HEADER = "x-exitproof-cert-thumbprint";

export interface ConnectorAuthClaims {
  connectorId: string;
  certThumbprint: string;
  registrationToken: string;
}

export function hashRegistrationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function normalizeThumbprint(thumbprint: string): string {
  return thumbprint.replace(/[:\s]/g, "").toLowerCase();
}

export function parseConnectorAuth(request: Request): ConnectorAuthClaims | null {
  const connectorId = request.headers.get(CONNECTOR_ID_HEADER)?.trim();
  const certThumbprint = request.headers
    .get(CERT_THUMBPRINT_HEADER)
    ?.trim();
  const auth = request.headers.get("authorization");
  const registrationToken =
    auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;

  if (!connectorId || !certThumbprint || !registrationToken) {
    return null;
  }

  return {
    connectorId,
    certThumbprint: normalizeThumbprint(certThumbprint),
    registrationToken,
  };
}

export function tokensEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function verifyTokenHash(
  plaintextToken: string,
  expectedHash: string,
): boolean {
  const actual = hashRegistrationToken(plaintextToken);
  return tokensEqual(actual, expectedHash);
}
