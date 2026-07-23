/**
 * Unit tests for Phase 2 JIT helpers (no Next runtime).
 */
import { describe, expect, it } from "vitest";
import {
  assertValidTicketId,
  clampJitHours,
  effectiveJitStatus,
  expiresAtFromNow,
  isGrantActive,
} from "@/lib/operator/jit";

describe("clampJitHours", () => {
  it("defaults and clamps", () => {
    expect(clampJitHours(0)).toBe(4);
    expect(clampJitHours(-1)).toBe(4);
    expect(clampJitHours(2.9)).toBe(2);
    expect(clampJitHours(100)).toBe(72);
  });
});

describe("isGrantActive / effectiveJitStatus", () => {
  it("respects expiry", () => {
    const now = new Date("2026-07-23T12:00:00.000Z");
    const active = {
      status: "active" as const,
      expires_at: "2026-07-23T16:00:00.000Z",
    };
    const past = {
      status: "active" as const,
      expires_at: "2026-07-23T11:00:00.000Z",
    };
    expect(isGrantActive(active, now)).toBe(true);
    expect(isGrantActive(past, now)).toBe(false);
    expect(effectiveJitStatus(past, now)).toBe("expired");
    expect(effectiveJitStatus({ status: "revoked", expires_at: active.expires_at }, now)).toBe(
      "revoked",
    );
  });
});

describe("expiresAtFromNow", () => {
  it("adds hours", () => {
    const now = new Date("2026-07-23T12:00:00.000Z");
    expect(expiresAtFromNow(4, now)).toBe("2026-07-23T16:00:00.000Z");
  });
});

describe("assertValidTicketId", () => {
  it("requires a real ticket", () => {
    expect(() => assertValidTicketId("  ")).toThrow(/Ticket/);
    expect(assertValidTicketId("  GL-1234  ")).toBe("GL-1234");
  });
});
