import Link from "next/link";
import {
  signInAction,
  signInWithMicrosoftAction,
} from "@/lib/actions/auth";
import { isDemoMode } from "@/lib/env";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input } from "@/components/ui/field";
import { MicrosoftIcon } from "@/components/ui/microsoft-icon";

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
      <div className="ep-rise w-full max-w-md rounded-2xl border border-[var(--line)] bg-[#0b2430]/80 p-8 shadow-2xl backdrop-blur">
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
          <p className="mt-2 text-sm leading-relaxed text-[var(--fog)]">
            Demo mode is on. Use{" "}
            <code className="text-[var(--teal-bright)]">demo@exitproof.app</code>{" "}
            / <code className="text-[var(--teal-bright)]">demo1234</code> or any
            new signup. Microsoft Entra SSO is hidden in demo.
          </p>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-[var(--fog)]">
            Sign in with Microsoft Entra ID. Email/password remains available as
            break-glass.
          </p>
        )}
        {error ? (
          <Alert variant="danger" className="mt-4">
            {error}
          </Alert>
        ) : null}
        {message ? (
          <Alert variant="success" className="mt-4">
            {message}
          </Alert>
        ) : null}

        {!demo ? (
          <form action={signInWithMicrosoftAction} className="mt-6">
            <input type="hidden" name="return_to" value="/auth/login" />
            <Button type="submit" className="w-full" size="lg">
              <MicrosoftIcon />
              Continue with Microsoft
            </Button>
          </form>
        ) : null}

        <form action={signInAction} className={demo ? "mt-6 space-y-4" : "mt-4"}>
          {demo ? (
            <>
              <FieldLabel>
                Email
                <Input
                  name="email"
                  type="email"
                  required
                  autoComplete="username"
                  defaultValue="demo@exitproof.app"
                />
              </FieldLabel>
              <FieldLabel>
                Password
                <Input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  defaultValue="demo1234"
                />
              </FieldLabel>
              <Button type="submit" name="mode" value="password" className="w-full">
                Sign in
              </Button>
              <Button
                type="submit"
                name="mode"
                value="magic"
                variant="secondary"
                className="w-full"
              >
                Email magic link
              </Button>
            </>
          ) : (
            <details className="group rounded-md border border-[var(--line)] open:bg-black/10">
              <summary className="cursor-pointer list-none px-3 py-2.5 text-sm text-[var(--fog)] marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-2">
                  Use email instead
                  <span className="text-xs text-[var(--fog)] group-open:hidden">
                    break-glass
                  </span>
                </span>
              </summary>
              <div className="space-y-4 border-t border-[var(--line)] px-3 py-4">
                <FieldLabel>
                  Email
                  <Input
                    name="email"
                    type="email"
                    required
                    autoComplete="username"
                  />
                </FieldLabel>
                <FieldLabel>
                  Password
                  <Input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                  />
                </FieldLabel>
                <Button
                  type="submit"
                  name="mode"
                  value="password"
                  variant="secondary"
                  className="w-full"
                >
                  Sign in with password
                </Button>
                <Button
                  type="submit"
                  name="mode"
                  value="magic"
                  variant="ghost"
                  className="w-full border border-[var(--line)]"
                >
                  Email magic link
                </Button>
              </div>
            </details>
          )}
        </form>

        <p className="mt-6 text-sm text-[var(--fog)]">
          No account?{" "}
          <Link href="/auth/signup" className="text-[var(--teal-bright)] hover:underline">
            Start free
          </Link>
        </p>
      </div>
    </div>
  );
}
