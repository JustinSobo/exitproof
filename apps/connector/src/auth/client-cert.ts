/**
 * Client-certificate (mTLS) stubs.
 *
 * Production Windows: load PFX / LocalMachine\My by thumbprint and present
 * on the TLS socket. Demo/CI: send thumbprint via trusted header that the
 * platform API accepts as an mTLS stand-in until Front Door terminates mTLS.
 */

import { readFileSync } from "fs";
import type { ConnectorConfig } from "../config.js";

export interface ClientCertMaterial {
  /** Hex SHA-256 thumbprint (no colons). */
  thumbprint: string;
  /** Optional PEM/PFX bytes for real mTLS (unused in mock HTTP). */
  pfx?: Buffer;
  passphrase?: string;
}

export function loadClientCert(config: ConnectorConfig): ClientCertMaterial {
  const pfxPath = process.env.EXITPROOF_CLIENT_PFX_PATH;
  const passphrase = process.env.EXITPROOF_CLIENT_PFX_PASSWORD;
  if (pfxPath) {
    return {
      thumbprint: config.certThumbprint,
      pfx: readFileSync(pfxPath),
      passphrase,
    };
  }
  return { thumbprint: config.certThumbprint };
}

/** Headers simulating verified client cert after Front Door mTLS. */
export function mTlsStubHeaders(
  config: ConnectorConfig,
): Record<string, string> {
  return {
    "X-ExitProof-Connector-Id": config.connectorId,
    "X-ExitProof-Cert-Thumbprint": config.certThumbprint,
    Authorization: `Bearer ${config.registrationToken}`,
  };
}
