import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/app/empty-state";
import { createClientOrgAction } from "@/lib/actions/cases";
import { getCurrentOrg, isOrgAdminRole } from "@/lib/auth";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";

export const metadata = { title: "Client orgs" };

export default async function ClientsPage() {
  const ctx = await getCurrentOrg();
  if (!ctx) redirect("/auth/login");

  const canManage = isOrgAdminRole(ctx.member.role);

  let clients = [];
  if (isDemoMode()) {
    clients = demoStore.listClientOrgs(ctx.org.id);
  } else {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data } = await supabase
      .from("organizations")
      .select("*")
      .eq("parent_org_id", ctx.org.id)
      .order("created_at", { ascending: false });
    clients = data ?? [];
  }

  const isAgency = ctx.org.plan === "agency";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-syne)] text-3xl font-700 text-white">
          Client organizations
        </h1>
        <p className="mt-2 text-[var(--fog)]">
          Agency plan: parent org managing up to 25 client tenants with RLS
          isolation.
        </p>
      </div>

      {!canManage ? (
        <p className="rounded-md border border-[var(--line)] bg-white/[0.03] px-4 py-3 text-sm text-[var(--fog)]">
          Only owners and admins can create client organizations.
        </p>
      ) : null}

      {!isAgency ? (
        <div className="rounded-xl border border-[var(--amber)]/40 bg-[var(--amber)]/10 px-4 py-3 text-sm">
          Upgrade to Agency ($249/mo) to create client organizations.{" "}
          <Link href="/billing" className="text-[var(--amber)] underline">
            Billing
          </Link>
        </div>
      ) : null}

      {isAgency && canManage ? (
        <form action={createClientOrgAction} className="max-w-md space-y-3">
          <label className="block text-sm">
            <span className="text-[var(--fog)]">Client name</span>
            <input
              name="name"
              required
              className="mt-1 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 py-2 text-white"
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--fog)]">Stack</span>
            <select
              name="stack_profile"
              className="mt-1 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 py-2 text-white"
            >
              <option value="hybrid">Hybrid</option>
              <option value="m365">Microsoft 365</option>
              <option value="google">Google Workspace</option>
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-[#04201d]"
          >
            Add client org
          </button>
        </form>
      ) : null}

      {clients.length === 0 ? (
        <EmptyState
          title="No client orgs yet"
          body={
            isAgency
              ? canManage
                ? "Add a client tenant to run isolated offboarding cases under your agency parent."
                : "Ask an owner or admin to add client tenants."
              : "Client orgs are available on the Agency plan for MSPs and multi-tenant IT teams."
          }
          actionHref={isAgency || !canManage ? undefined : "/billing"}
          actionLabel={isAgency || !canManage ? undefined : "View billing"}
        />
      ) : (
        <ul className="space-y-2">
          {clients.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-[var(--line)] px-4 py-3 text-sm"
            >
              <span className="text-white">{c.name}</span>
              <span className="text-[var(--fog)]"> · {c.stack_profile}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
