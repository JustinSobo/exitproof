/**
 * Next.js instrumentation — runs once at server start.
 * Enforces production / GridLogic env footgun guards before serving traffic.
 * @see https://nextjs.org/docs/app/guides/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  const { assertManagedRuntimeEnv } = await import("@/lib/env");
  assertManagedRuntimeEnv();
}
