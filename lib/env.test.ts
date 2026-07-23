/**
 * Unit tests for Phase 1 env / tenancy footguns (no Next runtime).
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  assertManagedRuntimeEnv,
  isDemoMode,
  isDomainJitAllowed,
  isGridLogicManaged,
} from "@/lib/env";
import { assertSessionTenant, tenantIdOf } from "@/lib/tenancy";

const KEYS = [
  "DEMO_MODE",
  "GRIDLOGIC_MANAGED",
  "ALLOW_DOMAIN_JIT",
  "NODE_ENV",
  "NEXT_PHASE",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

const saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};

function stash() {
  for (const k of KEYS) saved[k] = process.env[k];
}

function restore() {
  for (const k of KEYS) {
    const v = saved[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

afterEach(() => {
  restore();
});

describe("isDemoMode footgun", () => {
  it("uses missing keys as demo in development", () => {
    stash();
    process.env.NODE_ENV = "development";
    delete process.env.DEMO_MODE;
    delete process.env.GRIDLOGIC_MANAGED;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PHASE;
    expect(isDemoMode()).toBe(true);
  });

  it("does not auto-demo from missing keys at production runtime", () => {
    stash();
    process.env.NODE_ENV = "production";
    delete process.env.DEMO_MODE;
    delete process.env.GRIDLOGIC_MANAGED;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PHASE;
    expect(isDemoMode()).toBe(false);
  });

  it("still allows missing-keys demo during next build phase", () => {
    stash();
    process.env.NODE_ENV = "production";
    process.env.NEXT_PHASE = "phase-production-build";
    delete process.env.DEMO_MODE;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(isDemoMode()).toBe(true);
  });
});

describe("assertManagedRuntimeEnv", () => {
  it("refuses DEMO_MODE under GRIDLOGIC_MANAGED", () => {
    stash();
    delete process.env.NEXT_PHASE;
    process.env.GRIDLOGIC_MANAGED = "true";
    process.env.DEMO_MODE = "true";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    expect(() => assertManagedRuntimeEnv()).toThrow(/DEMO_MODE/);
  });

  it("refuses missing supabase under production", () => {
    stash();
    delete process.env.NEXT_PHASE;
    process.env.NODE_ENV = "production";
    delete process.env.DEMO_MODE;
    delete process.env.GRIDLOGIC_MANAGED;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(() => assertManagedRuntimeEnv()).toThrow(/SUPABASE|demo-if-missing/i);
  });

  it("no-ops during production build", () => {
    stash();
    process.env.NEXT_PHASE = "phase-production-build";
    process.env.NODE_ENV = "production";
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(() => assertManagedRuntimeEnv()).not.toThrow();
  });
});

describe("domain JIT", () => {
  it("defaults off and stays off under GridLogic", () => {
    stash();
    delete process.env.ALLOW_DOMAIN_JIT;
    delete process.env.GRIDLOGIC_MANAGED;
    expect(isDomainJitAllowed()).toBe(false);

    process.env.ALLOW_DOMAIN_JIT = "true";
    process.env.GRIDLOGIC_MANAGED = "true";
    expect(isGridLogicManaged()).toBe(true);
    expect(isDomainJitAllowed()).toBe(false);
  });
});

describe("tenancy", () => {
  it("tenantIdOf falls back to id", () => {
    expect(tenantIdOf({ id: "a", tenant_id: "b" })).toBe("b");
    expect(tenantIdOf({ id: "a" })).toBe("a");
  });

  it("assertSessionTenant rejects body spoofing", () => {
    expect(() =>
      assertSessionTenant({ id: "a", tenant_id: "a" }, "evil"),
    ).toThrow(/mismatch/);
    expect(() =>
      assertSessionTenant({ id: "a", tenant_id: "a" }, "a"),
    ).not.toThrow();
  });
});
