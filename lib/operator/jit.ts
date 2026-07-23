import { DEFAULT_JIT_HOURS, MAX_JIT_HOURS } from "@/lib/operator/types";
import type { JitAccessGrant, JitGrantStatus } from "@/lib/operator/types";

export function clampJitHours(hours: number): number {
  if (!Number.isFinite(hours) || hours <= 0) return DEFAULT_JIT_HOURS;
  return Math.min(MAX_JIT_HOURS, Math.max(1, Math.floor(hours)));
}

export function expiresAtFromNow(hours: number, now = new Date()): string {
  const ms = clampJitHours(hours) * 60 * 60 * 1000;
  return new Date(now.getTime() + ms).toISOString();
}

export function isGrantActive(
  grant: Pick<JitAccessGrant, "status" | "expires_at">,
  now = new Date(),
): boolean {
  if (grant.status !== "active") return false;
  return new Date(grant.expires_at).getTime() > now.getTime();
}

/** Resolve effective status, treating past-expiry active rows as expired. */
export function effectiveJitStatus(
  grant: Pick<JitAccessGrant, "status" | "expires_at">,
  now = new Date(),
): JitGrantStatus {
  if (grant.status === "active" && new Date(grant.expires_at).getTime() <= now.getTime()) {
    return "expired";
  }
  return grant.status;
}

export function normalizeTicketId(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function assertValidTicketId(ticketId: string): string {
  const ticket = normalizeTicketId(ticketId);
  if (ticket.length < 3) {
    throw new Error("Ticket ID is required (min 3 characters).");
  }
  if (ticket.length > 120) {
    throw new Error("Ticket ID is too long.");
  }
  return ticket;
}
