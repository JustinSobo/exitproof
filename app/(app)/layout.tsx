import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { OnboardingBanner } from "@/components/app/onboarding-banner";
import { signOutAction } from "@/lib/actions/auth";
import { getCurrentOrg } from "@/lib/auth";
import { isDemoMode } from "@/lib/env";
import { needsOnboarding } from "@/lib/onboarding/questionnaire";

/** Primary IA — New offboard is a Cases page CTA, not a nav item. */
const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/cases", label: "Cases" },
  { href: "/compliance", label: "Compliance" },
  { href: "/settings", label: "Settings" },
  { href: "/billing", label: "Billing" },
  { href: "/clients", label: "Clients" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getCurrentOrg();
  if (!ctx) redirect("/auth/login");

  const headerList = await headers();
  const pathname = headerList.get("x-pathname") ?? "";
  const onOnboarding =
    pathname === "/onboarding" || pathname.startsWith("/onboarding/");

  // New orgs must finish /onboarding; demo seed org already has onboarding_completed_at.
  if (needsOnboarding(ctx.org) && !onOnboarding) {
    redirect("/onboarding");
  }

  return (
    <div className="ep-atmosphere min-h-screen text-[var(--mist)]">
      <div className="mx-auto flex min-h-screen max-w-7xl">
        <aside className="hidden w-56 shrink-0 border-r border-[var(--line)] px-4 py-6 md:block">
          <Link
            href="/dashboard"
            className="font-[family-name:var(--font-syne)] text-xl font-800 text-white"
          >
            Exit<span className="text-[var(--teal-bright)]">Proof</span>
          </Link>
          <p className="mt-2 truncate text-xs text-[var(--fog)]">{ctx.org.name}</p>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-[var(--teal-bright)]">
            {ctx.org.plan} plan
            {isDemoMode() ? " · demo" : ""}
          </p>
          <nav className="mt-8 space-y-1 text-sm">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="block rounded-md px-3 py-2 text-[var(--fog)] hover:bg-white/5 hover:text-white"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <form action={signOutAction} className="mt-8">
            <button
              type="submit"
              className="w-full rounded-md border border-[var(--line)] px-3 py-2 text-left text-sm text-[var(--fog)] hover:bg-white/5"
            >
              Sign out
            </button>
          </form>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-[var(--line)] px-4 py-4 md:px-8">
            <div className="flex items-center justify-between gap-3">
              <div className="md:hidden">
                <Link
                  href="/dashboard"
                  className="font-[family-name:var(--font-syne)] text-lg font-800"
                >
                  ExitProof
                </Link>
              </div>
              <p className="hidden text-sm text-[var(--fog)] md:block">
                {ctx.user.email}
              </p>
              <form action={signOutAction} className="md:hidden">
                <button
                  type="submit"
                  className="text-xs text-[var(--fog)] hover:text-white"
                >
                  Sign out
                </button>
              </form>
            </div>
            <nav className="-mx-1 mt-3 flex gap-1 overflow-x-auto pb-1 text-xs md:hidden">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="shrink-0 rounded-md px-2.5 py-1.5 text-[var(--fog)] hover:bg-white/5 hover:text-white"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </header>
          <main className="flex-1 px-4 py-6 md:px-8">
            {!onOnboarding ? <OnboardingBanner org={ctx.org} /> : null}
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
