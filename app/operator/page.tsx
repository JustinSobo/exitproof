import Link from "next/link";
import { redirect } from "next/navigation";
import {
  listOperatorTenants,
  requireOperator,
} from "@/lib/operator/auth";
import { tenantIdOf } from "@/lib/tenancy";

export const metadata = { title: "Operator console" };

export default async function OperatorHomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  let staffUserId: string;
  try {
    const { user } = await requireOperator();
    staffUserId = user.id;
  } catch {
    redirect("/auth/login");
  }

  const params = await searchParams;
  const tenants = await listOperatorTenants(staffUserId);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-[var(--amber)]">
            GridLogic control plane
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-syne)] text-3xl font-700 text-white">
            Operator console
          </h1>
          <p className="mt-2 max-w-2xl text-[var(--fog)]">
            List customer tenants, request ticketed JIT access, and run the
            onboard wizard. Agency parent/child is a legacy commercial option —
            this operator model is the security source of truth for GridLogic
            managed packages.
          </p>
        </div>
        <Link
          href="/operator/onboard"
          className="rounded-md bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-[#04201d]"
        >
          Onboard customer
        </Link>
      </div>

      {params.error ? (
        <div className="rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3 text-sm">
          {params.error}
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Tenants</h2>
        {tenants.length === 0 ? (
          <p className="text-sm text-[var(--fog)]">
            No tenants yet.{" "}
            <Link href="/operator/onboard" className="text-[var(--teal-bright)] underline">
              Onboard a customer
            </Link>{" "}
            or use{" "}
            <Link href="/operator/docs" className="text-[var(--teal-bright)] underline">
              provision CLI docs
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">
            {tenants.map(({ org, health, active_jit }) => (
              <li key={org.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Link
                      href={`/operator/tenants/${org.id}`}
                      className="font-medium text-white hover:underline"
                    >
                      {org.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-[var(--fog)]">
                      tenant {tenantIdOf(org).slice(0, 8)}… ·{" "}
                      {org.entra_tenant_id
                        ? `Entra ${org.entra_tenant_id.slice(0, 8)}…`
                        : "Entra unbound"}
                      {org.sso_enforced ? " · SSO enforced" : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wider">
                    <span className="rounded border border-[var(--line)] px-2 py-0.5 text-[var(--fog)]">
                      Graph: {health.graph_consent}
                    </span>
                    <span className="rounded border border-[var(--line)] px-2 py-0.5 text-[var(--fog)]">
                      AD: {health.ad_connector}
                    </span>
                    <span
                      className={`rounded border px-2 py-0.5 ${
                        active_jit
                          ? "border-[var(--teal)]/50 text-[var(--teal-bright)]"
                          : "border-[var(--line)] text-[var(--fog)]"
                      }`}
                    >
                      JIT: {active_jit ? "active" : "none"}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-[var(--fog)]">
        Prefer CLI for infrastructure allocation? See{" "}
        <Link href="/operator/docs" className="underline">
          provision docs
        </Link>
        .
      </p>
    </div>
  );
}
