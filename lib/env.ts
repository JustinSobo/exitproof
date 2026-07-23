/**
 * Env helpers that never throw at import time so `next build` succeeds
 * without credentials. Runtime paths check these before calling vendors.
 *
 * Production / GridLogic footgun guard: never silently fall into DEMO_MODE
 * when keys are missing — see assertManagedRuntimeEnv() + instrumentation.ts.
 */

/** True during `next build` (instrumentation may also run in this phase). */
function isNextProductionBuild(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

/** True when GridLogic operates this deployment (managed package). */
export function isGridLogicManaged(): boolean {
  return process.env.GRIDLOGIC_MANAGED === "true";
}

/**
 * Production-oriented deploy: NODE_ENV=production or GridLogic managed flag.
 * Used to refuse demo-if-missing-keys and silent domain JIT.
 */
export function isProductionOriented(): boolean {
  return (
    process.env.NODE_ENV === "production" || isGridLogicManaged()
  );
}

/**
 * Domain email JIT org join. Default OFF.
 * Only enable explicitly for legacy SaaS self-serve (not GridLogic).
 */
export function isDomainJitAllowed(): boolean {
  if (isGridLogicManaged()) return false;
  return process.env.ALLOW_DOMAIN_JIT === "true";
}

/**
 * Demo mode: explicit DEMO_MODE=true, or (dev / build only) missing Supabase keys.
 * Never auto-enables from missing keys when production-oriented at runtime.
 */
export function isDemoMode(): boolean {
  if (process.env.DEMO_MODE === "true") return true;

  // Ambiguous "demo if missing keys" — local/dev + build convenience only.
  // At production/GridLogic runtime, missing keys are refused by assertManagedRuntimeEnv.
  if (isProductionOriented() && !isNextProductionBuild()) {
    return false;
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return true;
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return true;
  return false;
}

/**
 * Call at process start (instrumentation) for managed/production deploys.
 * Refuses DEMO_MODE and refuses missing Supabase when not in demo.
 * Skipped during `next build` so CI can compile without secrets.
 */
export function assertManagedRuntimeEnv(): void {
  if (isNextProductionBuild()) return;
  if (!isProductionOriented()) return;

  if (process.env.DEMO_MODE === "true") {
    throw new Error(
      "[env] DEMO_MODE=true is forbidden under NODE_ENV=production or GRIDLOGIC_MANAGED=true.",
    );
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    throw new Error(
      "[env] Production/GridLogic deploy requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. Refusing ambiguous demo-if-missing-keys.",
    );
  }

  if (isGridLogicManaged() && process.env.ALLOW_DOMAIN_JIT === "true") {
    throw new Error(
      "[env] ALLOW_DOMAIN_JIT cannot be true when GRIDLOGIC_MANAGED=true. Provision tenants explicitly and bind entra_tenant_id.",
    );
  }
}

export function hasSupabase(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function hasStripe(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function hasResend(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
