import Link from "next/link";
import { redirect } from "next/navigation";
import { OperatorSwitcher } from "@/components/operator/operator-switcher";
import { signOutAction } from "@/lib/actions/auth";
import { getSessionUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/env";
import {
  getOperatorContext,
  listOperatorTenants,
  requireOperator,
} from "@/lib/operator/auth";

const links = [
  { href: "/operator", label: "Tenants" },
  { href: "/operator/onboard", label: "Onboard" },
  { href: "/operator/docs", label: "Provision docs" },
];

export default async function OperatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");

  try {
    await requireOperator();
  } catch {
    redirect("/dashboard?error=operator");
  }

  const opCtx = await getOperatorContext();
  const tenants = opCtx
    ? await listOperatorTenants(opCtx.user.id)
    : [];

  return (
    <div className="ep-atmosphere min-h-screen text-[var(--mist)]">
      <div className="mx-auto flex min-h-screen max-w-7xl">
        <aside className="hidden w-56 shrink-0 border-r border-[var(--line)] px-4 py-6 md:block">
          <Link
            href="/operator"
            className="font-[family-name:var(--font-syne)] text-xl font-800 text-white"
          >
            Exit<span className="text-[var(--teal-bright)]">Proof</span>
          </Link>
          <p className="mt-2 text-xs uppercase tracking-wider text-[var(--amber)]">
            GridLogic operator
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
            <Link
              href="/dashboard"
              className="block rounded-md px-3 py-2 text-[var(--fog)] hover:bg-white/5 hover:text-white"
            >
              Customer app
            </Link>
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-[var(--fog)]">{user.email}</p>
                <p className="md:hidden text-xs uppercase tracking-wider text-[var(--amber)]">
                  Operator
                </p>
              </div>
              {opCtx ? (
                <OperatorSwitcher
                  tenants={tenants.map((t) => ({
                    id: t.org.id,
                    name: t.org.name,
                  }))}
                  activeOrgId={opCtx.activeOrgId}
                />
              ) : null}
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
          <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
