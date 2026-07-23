import Link from "next/link";
import {
  signInWithMicrosoftAction,
  signUpAction,
} from "@/lib/actions/auth";
import { isDemoMode } from "@/lib/env";

export const metadata = { title: "Sign up" };

function MicrosoftIcon() {
  return (
    <svg
      aria-hidden
      className="h-4 w-4 shrink-0"
      viewBox="0 0 21 21"
      fill="none"
    >
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const demo = isDemoMode();
  const error = params.error ? decodeURIComponent(params.error) : null;

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
          Create your workspace
        </h1>
        <p className="mt-2 text-sm text-[var(--fog)]">
          {demo
            ? "Demo mode stores data in-memory for this process. Microsoft Entra SSO is hidden in demo."
            : "Continue with Microsoft Entra ID to create or join your org. Includes 3 free offboards on the trial gate."}
        </p>
        {error ? (
          <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : null}

        {!demo ? (
          <form action={signInWithMicrosoftAction} className="mt-6">
            <input type="hidden" name="return_to" value="/auth/signup" />
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--teal)] py-2.5 text-sm font-semibold text-[#04201d] hover:bg-[var(--teal-bright)]"
            >
              <MicrosoftIcon />
              Continue with Microsoft
            </button>
          </form>
        ) : null}

        <form
          action={signUpAction}
          className={demo ? "mt-6 space-y-4" : "mt-4"}
        >
          {demo ? (
            <>
              <SignupFields />
              <button
                type="submit"
                className="w-full rounded-md bg-[var(--teal)] py-2.5 text-sm font-semibold text-[#04201d] hover:bg-[var(--teal-bright)]"
              >
                Create account
              </button>
            </>
          ) : (
            <details className="group rounded-md border border-[var(--line)] open:bg-black/10">
              <summary className="cursor-pointer list-none px-3 py-2.5 text-sm text-[var(--fog)] marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-2">
                  Create with email instead
                  <span className="text-xs text-[var(--fog)] group-open:hidden">
                    break-glass
                  </span>
                </span>
              </summary>
              <div className="space-y-4 border-t border-[var(--line)] px-3 py-4">
                <SignupFields />
                <button
                  type="submit"
                  className="w-full rounded-md border border-[var(--line)] py-2.5 text-sm font-semibold hover:bg-white/5"
                >
                  Create account
                </button>
              </div>
            </details>
          )}
        </form>

        <p className="mt-6 text-sm text-[var(--fog)]">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-[var(--teal-bright)]">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

function SignupFields() {
  return (
    <>
      <label className="block text-sm">
        <span className="text-[var(--fog)]">Full name</span>
        <input
          name="full_name"
          required
          className="mt-1 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 py-2 text-white outline-none focus:border-[var(--teal)]"
        />
      </label>
      <label className="block text-sm">
        <span className="text-[var(--fog)]">Work email</span>
        <input
          name="email"
          type="email"
          required
          className="mt-1 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 py-2 text-white outline-none focus:border-[var(--teal)]"
        />
      </label>
      <label className="block text-sm">
        <span className="text-[var(--fog)]">Password</span>
        <input
          name="password"
          type="password"
          required
          minLength={6}
          className="mt-1 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 py-2 text-white outline-none focus:border-[var(--teal)]"
        />
      </label>
      <label className="block text-sm">
        <span className="text-[var(--fog)]">Organization name</span>
        <input
          name="org_name"
          required
          className="mt-1 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 py-2 text-white outline-none focus:border-[var(--teal)]"
        />
      </label>
    </>
  );
}
