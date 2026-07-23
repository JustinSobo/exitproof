import Link from "next/link";
import { enterDemoAction } from "@/lib/actions/auth";
import { isDemoMode } from "@/lib/env";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const demo = isDemoMode();

  return (
    <div className="ep-atmosphere relative min-h-screen text-[var(--mist)]">
      <div className="ep-grid pointer-events-none absolute inset-0" />
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="font-[family-name:var(--font-syne)] text-2xl font-800 tracking-tight">
          Exit<span className="text-[var(--teal-bright)]">Proof</span>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/#how" className="hidden text-[var(--fog)] hover:text-white sm:inline">
            How it works
          </Link>
          <Link href="/#pricing" className="hidden text-[var(--fog)] hover:text-white sm:inline">
            Pricing
          </Link>
          <Link
            href="/auth/login"
            className="rounded-md px-3 py-2 text-[var(--fog)] hover:text-white"
          >
            Sign in
          </Link>
          {demo ? (
            <form action={enterDemoAction}>
              <button
                type="submit"
                className="rounded-md border border-[var(--line)] bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
              >
                Try demo
              </button>
            </form>
          ) : null}
          <Link
            href="/auth/signup"
            className="rounded-md bg-[var(--teal)] px-3.5 py-2 font-medium text-[#04201d] hover:bg-[var(--teal-bright)]"
          >
            Start free
          </Link>
        </nav>
      </header>
      <main className="relative z-10 flex-1">{children}</main>
      <footer className="relative z-10 border-t border-[var(--line)] px-6 py-10 text-sm text-[var(--fog)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-[family-name:var(--font-syne)] text-lg text-white">
            ExitProof
          </p>
          <p>
            Mid-market personnel-termination evidence for FedRAMP, CMMC, and SOC
            audits.
          </p>
        </div>
      </footer>
    </div>
  );
}
