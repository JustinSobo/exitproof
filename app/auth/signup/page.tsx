import Link from "next/link";
import {
  signInWithMicrosoftAction,
  signUpAction,
} from "@/lib/actions/auth";
import { isDemoMode } from "@/lib/env";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input } from "@/components/ui/field";
import { MicrosoftIcon } from "@/components/ui/microsoft-icon";

export const metadata = { title: "Sign up" };

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
      <div className="ep-rise w-full max-w-md rounded-2xl border border-[var(--line)] bg-[#0b2430]/80 p-8 shadow-2xl backdrop-blur">
        <Link
          href="/"
          className="font-[family-name:var(--font-syne)] text-2xl font-800 text-white"
        >
          Exit<span className="text-[var(--teal-bright)]">Proof</span>
        </Link>
        <h1 className="mt-6 font-[family-name:var(--font-syne)] text-2xl font-600 text-white">
          Create your workspace
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--fog)]">
          {demo
            ? "Demo mode stores data in-memory for this process. Microsoft Entra SSO is hidden in demo."
            : "Continue with Microsoft Entra ID to create or join your org. Includes 3 free offboards on the trial gate — no credit card required."}
        </p>
        {error ? (
          <Alert variant="danger" className="mt-4">
            {error}
          </Alert>
        ) : null}

        {!demo ? (
          <form action={signInWithMicrosoftAction} className="mt-6">
            <input type="hidden" name="return_to" value="/auth/signup" />
            <Button type="submit" className="w-full" size="lg">
              <MicrosoftIcon />
              Continue with Microsoft
            </Button>
          </form>
        ) : null}

        <form
          action={signUpAction}
          className={demo ? "mt-6 space-y-4" : "mt-4"}
        >
          {demo ? (
            <>
              <SignupFields />
              <Button type="submit" className="w-full">
                Create account
              </Button>
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
                <Button type="submit" variant="secondary" className="w-full">
                  Create account
                </Button>
              </div>
            </details>
          )}
        </form>

        <p className="mt-6 text-sm text-[var(--fog)]">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-[var(--teal-bright)] hover:underline">
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
      <FieldLabel>
        Full name
        <Input name="full_name" required autoComplete="name" />
      </FieldLabel>
      <FieldLabel>
        Work email
        <Input name="email" type="email" required autoComplete="email" />
      </FieldLabel>
      <FieldLabel>
        Password
        <Input
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
        />
      </FieldLabel>
      <FieldLabel>
        Organization name
        <Input name="org_name" required autoComplete="organization" />
      </FieldLabel>
    </>
  );
}
