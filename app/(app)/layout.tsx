import { OnboardingBanner } from "@/components/app/onboarding-banner";
import { AppSidebar, MobileNav, type AppNavLink } from "@/components/app/app-nav";
import { getCurrentOrg, getSessionUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/env";
import { isOperatorUser } from "@/lib/operator/auth";
import { needsOnboarding } from "@/lib/onboarding/questionnaire";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

/** Primary IA — New offboard is a Cases page CTA, not a nav item. */
const links: AppNavLink[] = [
  { href: "/dashboard", label: "Dashboard", group: "Workspace" },
  { href: "/cases", label: "Cases", group: "Workspace" },
  { href: "/compliance", label: "Compliance", group: "Workspace" },
  { href: "/connectors", label: "Connectors", group: "Workspace" },
  { href: "/clients", label: "Clients", group: "Workspace" },
  { href: "/settings", label: "Settings", group: "Account" },
  { href: "/billing", label: "Billing", group: "Account" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");

  const ctx = await getCurrentOrg();
  if (!ctx) {
    if (await isOperatorUser(user)) redirect("/operator");
    redirect("/auth/login");
  }

  const showOperator = await isOperatorUser(ctx.user);

  const headerList = await headers();
  const pathname = headerList.get("x-pathname") ?? "";
  const onOnboarding =
    pathname === "/onboarding" || pathname.startsWith("/onboarding/");

  // New orgs must finish /onboarding; demo seed org already has onboarding_completed_at.
  if (needsOnboarding(ctx.org) && !onOnboarding) {
    redirect("/onboarding");
  }

  const navLinks: AppNavLink[] = showOperator
    ? [...links, { href: "/operator", label: "Operator", group: "Account" }]
    : links;

  const planLabel = `${ctx.org.plan} plan${isDemoMode() ? " · demo" : ""}`;

  return (
    <div className="ep-atmosphere min-h-screen text-[var(--mist)]">
      <div className="mx-auto flex min-h-screen max-w-7xl">
        <AppSidebar
          links={navLinks}
          orgName={ctx.org.name}
          planLabel={planLabel}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <MobileNav links={navLinks} userEmail={ctx.user.email} />
          <main className="ep-rise flex-1 px-4 py-6 md:px-8">
            {!onOnboarding ? <OnboardingBanner org={ctx.org} /> : null}
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
