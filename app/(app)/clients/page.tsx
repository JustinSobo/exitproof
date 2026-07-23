import { redirect } from "next/navigation";
import { createClientOrgAction } from "@/lib/actions/cases";
import { getCurrentOrg } from "@/lib/auth";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";

export const metadata = { title: "Client orgs" };

export default async function ClientsPage() {
  const ctx = await getCurrentOrg();
  if (!ctx) redirect("/auth/login");

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

      {!isAgency ? (
        <div className="rounded-xl border border-[var(--amber)]/40 bg-[var(--amber)]/10 px-4 py-3 text-sm">
          Upgrade to Agency ($249/mo) to create client organizations.{" "}
          <a href="/billing" className="text-[var(--amber)] underline">
            Billing
          </a>
        </div>
      ) : null}

      {isAgency ? (
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
        {clients.length === 0 ? (
          <li className="text-[var(--fog)]">No client orgs yet.</li>
        ) : null}
      </ul>
    </div>
  );
}
