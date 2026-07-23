import Link from "next/link";
import { signInAction } from "@/lib/actions/auth";
import { isDemoMode } from "@/lib/env";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  const demo = isDemoMode();
  const error =
    params.error === "callback"
      ? "Sign-in link expired or was invalid. Request a new magic link."
      : params.error
        ? decodeURIComponent(params.error)
        : null;
  const message = params.message ? decodeURIComponent(params.message) : null;

  return (
    <div className="ep-atmosphere flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[#0b2430]/80 p-8 shadow-2xl backdrop-blur">
        <Link
          href="/"
          className="font-[family-name:var(--font-syne)] text-2xl font-800 text-white"
        >
          Exit<span className="text-[var(--teal-bright)]">Proof</span>
        </Link>
        <h1 className="mt-6 font-[family-name:var(--font-syne)] text-2xl font-600 text-white">
          Sign in
        </h1>
        {demo ? (
          <p className="mt-2 text-sm text-[var(--fog)]">
            Demo mode is on. Use <code className="text-[var(--teal-bright)]">demo@exitproof.app</code> /{" "}
            <code className="text-[var(--teal-bright)]">demo1234</code> or any new signup.
          </p>
        ) : (
          <p className="mt-2 text-sm text-[var(--fog)]">
            Email/password or magic link via Supabase Auth.
          </p>
        )}
        {error ? (
          <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-3 text-sm text-[var(--teal-bright)]" role="status">
            {message}
          </p>
        ) : null}

        <form action={signInAction} className="mt-6 space-y-4">
          <label className="block text-sm">
            <span className="text-[var(--fog)]">Email</span>
            <input
              name="email"
              type="email"
              required
              defaultValue={demo ? "demo@exitproof.app" : ""}
              className="mt-1 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 py-2 text-white outline-none focus:border-[var(--teal)]"
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--fog)]">Password</span>
            <input
              name="password"
              type="password"
              defaultValue={demo ? "demo1234" : ""}
              className="mt-1 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 py-2 text-white outline-none focus:border-[var(--teal)]"
            />
          </label>
          <button
            type="submit"
            name="mode"
            value="password"
            className="w-full rounded-md bg-[var(--teal)] py-2.5 text-sm font-semibold text-[#04201d] hover:bg-[var(--teal-bright)]"
          >
            Sign in
          </button>
          <button
            type="submit"
            name="mode"
            value="magic"
            className="w-full rounded-md border border-[var(--line)] py-2.5 text-sm hover:bg-white/5"
          >
            Email magic link
          </button>
        </form>

        <p className="mt-6 text-sm text-[var(--fog)]">
          No account?{" "}
          <Link href="/auth/signup" className="text-[var(--teal-bright)]">
            Start free
          </Link>
        </p>
      </div>
    </div>
  );
}
