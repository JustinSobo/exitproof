import Link from "next/link";
import { signUpAction } from "@/lib/actions/auth";
import { isDemoMode } from "@/lib/env";

export const metadata = { title: "Sign up" };

export default function SignupPage() {
  const demo = isDemoMode();
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
            ? "Demo mode stores data in-memory for this process."
            : "Includes 3 free offboards on the trial gate."}
        </p>

        <form action={signUpAction} className="mt-6 space-y-4">
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
          <button
            type="submit"
            className="w-full rounded-md bg-[var(--teal)] py-2.5 text-sm font-semibold text-[#04201d] hover:bg-[var(--teal-bright)]"
          >
            Create account
          </button>
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
