/**
 * Env helpers that never throw at import time so `next build` succeeds
 * without credentials. Runtime paths check these before calling vendors.
 */

export function isDemoMode(): boolean {
  if (process.env.DEMO_MODE === "true") return true;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return true;
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return true;
  return false;
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
