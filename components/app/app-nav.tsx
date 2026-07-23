"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { signOutAction } from "@/lib/actions/auth";
import { cn } from "@/components/ui/cn";

export type AppNavLink = { href: string; label: string; group?: string };

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({
  links,
  pathname,
  onNavigate,
}: {
  links: AppNavLink[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const groups = links.reduce<Record<string, AppNavLink[]>>((acc, link) => {
    const key = link.group ?? "Workspace";
    (acc[key] ??= []).push(link);
    return acc;
  }, {});

  return (
    <nav className="space-y-5 text-sm" aria-label="App">
      {Object.entries(groups).map(([group, items]) => (
        <div key={group}>
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--fog)]/80">
            {group}
          </p>
          <div className="space-y-0.5">
            {items.map((l) => {
              const active = isActive(pathname, l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className="ep-nav-link"
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function AppSidebar({
  links,
  orgName,
  planLabel,
}: {
  links: AppNavLink[];
  orgName: string;
  planLabel: string;
}) {
  const pathname = usePathname() ?? "";

  return (
    <aside className="hidden w-56 shrink-0 border-r border-[var(--line)] px-4 py-6 md:flex md:flex-col">
      <Link
        href="/dashboard"
        className="font-[family-name:var(--font-syne)] text-xl font-800 text-white"
      >
        Exit<span className="text-[var(--teal-bright)]">Proof</span>
      </Link>
      <p className="mt-2 truncate text-xs text-[var(--fog)]" title={orgName}>
        {orgName}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-[var(--teal-bright)]">
        {planLabel}
      </p>
      <div className="mt-8 flex-1">
        <NavLinks links={links} pathname={pathname} />
      </div>
      <form action={signOutAction} className="mt-6">
        <button
          type="submit"
          className="ep-btn w-full rounded-md border border-[var(--line)] px-3 py-2 text-left text-sm text-[var(--fog)] transition-colors hover:bg-white/5 hover:text-white"
        >
          Sign out
        </button>
      </form>
    </aside>
  );
}

export function MobileNav({
  links,
  userEmail,
}: {
  links: AppNavLink[];
  userEmail: string;
}) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const [navPath, setNavPath] = useState(pathname);
  const titleId = useId();

  if (pathname !== navPath) {
    setNavPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <header className="border-b border-[var(--line)] px-4 py-3 md:px-8 md:py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 md:hidden">
          <button
            type="button"
            className="ep-btn inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--line)] text-white hover:bg-white/5"
            aria-expanded={open}
            aria-controls="mobile-drawer"
            onClick={() => setOpen(true)}
          >
            <span className="sr-only">Open menu</span>
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <Link
            href="/dashboard"
            className="font-[family-name:var(--font-syne)] text-lg font-800 text-white"
          >
            Exit<span className="text-[var(--teal-bright)]">Proof</span>
          </Link>
        </div>
        <p className="hidden truncate text-sm text-[var(--fog)] md:block">
          {userEmail}
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

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden" id="mobile-drawer">
          <button
            type="button"
            className="ep-drawer-backdrop absolute inset-0 bg-black/55"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={cn(
              "ep-drawer-panel absolute inset-y-0 left-0 flex w-[min(18rem,88vw)] flex-col border-r border-[var(--line)] bg-[#0b2430] px-4 py-5 shadow-2xl",
            )}
          >
            <div className="mb-6 flex items-center justify-between gap-2">
              <p
                id={titleId}
                className="font-[family-name:var(--font-syne)] text-lg font-700 text-white"
              >
                Menu
              </p>
              <button
                type="button"
                className="ep-btn rounded-md border border-[var(--line)] px-2.5 py-1.5 text-xs text-[var(--fog)] hover:bg-white/5"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <p className="mb-4 truncate px-1 text-xs text-[var(--fog)]">
              {userEmail}
            </p>
            <NavLinks
              links={links}
              pathname={pathname}
              onNavigate={() => setOpen(false)}
            />
            <form action={signOutAction} className="mt-auto pt-8">
              <button
                type="submit"
                className="ep-btn w-full rounded-md border border-[var(--line)] px-3 py-2 text-left text-sm text-[var(--fog)] hover:bg-white/5"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </header>
  );
}
