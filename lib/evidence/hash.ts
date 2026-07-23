import { createHash } from "crypto";

/** SHA-256 hex digest of file bytes (evidence integrity). */
export function sha256Hex(bytes: Buffer | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
