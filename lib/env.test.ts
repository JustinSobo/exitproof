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

function setEnv(key: (typeof KEYS)[number], value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env[key];
  else env[key] = value;
}

function restore() {
  for (const k of KEYS) {
    setEnv(k, saved[k]);
  }
}

afterEach(() => {
  restore();
});

describe("isDemoMode footgun", () => {
  it("uses missing keys as demo in development", () => {
    stash();
    setEnv("NODE_ENV", "development");
    setEnv("DEMO_MODE", undefined);
    setEnv("GRIDLOGIC_MANAGED", undefined);
    setEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    setEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined);
    setEnv("NEXT_PHASE", undefined);
    expect(isDemoMode()).toBe(true);
  });

  it("does not auto-demo from missing keys at production runtime", () => {
    stash();
    setEnv("NODE_ENV", "production");
    setEnv("DEMO_MODE", undefined);
    setEnv("GRIDLOGIC_MANAGED", undefined);
    setEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    setEnv("NEXT_PHASE", undefined);
    expect(isDemoMode()).toBe(false);
  });

  it("still allows missing-keys demo during next build phase", () => {
    stash();
    setEnv("NODE_ENV", "production");
    setEnv("NEXT_PHASE", "phase-production-build");
    setEnv("DEMO_MODE", undefined);
    setEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    expect(isDemoMode()).toBe(true);
  });
});

describe("assertManagedRuntimeEnv", () => {
  it("refuses DEMO_MODE under GRIDLOGIC_MANAGED", () => {
    stash();
    setEnv("NEXT_PHASE", undefined);
    setEnv("GRIDLOGIC_MANAGED", "true");
    setEnv("DEMO_MODE", "true");
    setEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    setEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    expect(() => assertManagedRuntimeEnv()).toThrow(/DEMO_MODE/);
  });

  it("refuses missing supabase under production", () => {
    stash();
    setEnv("NEXT_PHASE", undefined);
    setEnv("NODE_ENV", "production");
    setEnv("DEMO_MODE", undefined);
    setEnv("GRIDLOGIC_MANAGED", undefined);
    setEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    setEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined);
    expect(() => assertManagedRuntimeEnv()).toThrow(/SUPABASE|demo-if-missing/i);
  });

  it("no-ops during production build", () => {
    stash();
    setEnv("NEXT_PHASE", "phase-production-build");
    setEnv("NODE_ENV", "production");
    setEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    expect(() => assertManagedRuntimeEnv()).not.toThrow();
  });
});

describe("domain JIT", () => {
  it("defaults off and stays off under GridLogic", () => {
    stash();
    setEnv("ALLOW_DOMAIN_JIT", undefined);
    setEnv("GRIDLOGIC_MANAGED", undefined);
    expect(isDomainJitAllowed()).toBe(false);

    setEnv("ALLOW_DOMAIN_JIT", "true");
    setEnv("GRIDLOGIC_MANAGED", "true");
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
