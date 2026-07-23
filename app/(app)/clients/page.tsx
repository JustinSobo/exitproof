import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
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
      <PageHeader
        title="Client organizations"
        description="Legacy Agency plan: parent org can manage up to 25 client tenants (still works). For GridLogic managed packages, /operator + hard tenant_id isolation is the security source of truth — not Agency parent/child."
      />

      {!canManage ? (
        <Alert variant="info">
          Only owners and admins can create client organizations.
        </Alert>
      ) : null}

      {!isAgency ? (
        <Alert variant="warning">
          Upgrade to Agency ($249/mo) to create client organizations.{" "}
          <Link href="/billing" className="font-semibold text-[var(--amber)] hover:underline">
            Billing
          </Link>
        </Alert>
      ) : null}

      {isAgency && canManage ? (
        <form action={createClientOrgAction} className="ep-panel max-w-md space-y-3 p-5">
          <p className="text-sm font-medium text-white">Add client tenant</p>
          <FieldLabel>
            Client name
            <Input name="name" required />
          </FieldLabel>
          <FieldLabel>
            Stack
            <Select name="stack_profile" defaultValue="hybrid">
              <option value="hybrid">Hybrid</option>
              <option value="m365">Microsoft 365</option>
              <option value="google">Google Workspace</option>
            </Select>
          </FieldLabel>
          <Button type="submit">Add client org</Button>
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
            <li key={c.id} className="ep-panel px-4 py-3 text-sm">
              <span className="text-white">{c.name}</span>
              <span className="text-[var(--fog)]"> · {c.stack_profile}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
