import Link from "next/link";
import { redirect } from "next/navigation";
import {
  requestJitAccessAction,
  revokeJitAccessAction,
  switchOperatorTenantAction,
} from "@/lib/actions/operator";
import {
  getOperatorOrg,
  listJitGrantsForOrg,
  requireOperator,
} from "@/lib/operator/auth";
import { tenantHealthFromOrg } from "@/lib/operator/health";
import { isGrantActive } from "@/lib/operator/jit";
import { DEFAULT_JIT_HOURS } from "@/lib/operator/types";
import { tenantIdOf } from "@/lib/tenancy";

export const metadata = { title: "Tenant · Operator" };

export default async function OperatorTenantPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    jit?: string;
    revoked?: string;
    onboarded?: string;
  }>;
}) {
  let user;
  try {
    ({ user } = await requireOperator());
  } catch {
    redirect("/auth/login");
  }

  const { id } = await params;
  const q = await searchParams;
  const org = await getOperatorOrg(id);
  if (!org) redirect("/operator?error=Tenant%20not%20found");

  const grants = await listJitGrantsForOrg(org.id);
  const myActive = grants.find(
    (g) => g.staff_user_id === user.id && isGrantActive(g),
  );
  const health = tenantHealthFromOrg(org);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/operator" className="text-xs text-[var(--fog)] hover:underline">
          ← Tenants
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-syne)] text-3xl font-700 text-white">
          {org.name}
        </h1>
        <p className="mt-2 text-sm text-[var(--fog)]">
          tenant_id <code className="text-[var(--mist)]">{tenantIdOf(org)}</code>
          {org.entra_tenant_id ? (
            <>
              {" "}
              · Entra <code className="text-[var(--mist)]">{org.entra_tenant_id}</code>
            </>
          ) : null}
        </p>
      </div>

      {q.error ? (
        <div className="rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3 text-sm">
          {q.error}
        </div>
      ) : null}
      {q.onboarded ? (
        <div className="rounded-xl border border-[var(--teal)]/40 bg-[var(--teal)]/10 px-4 py-3 text-sm">
          Customer onboarded. Owner invite recorded; request JIT if you need
          time-boxed staff access.
        </div>
      ) : null}
      {q.jit ? (
        <div className="rounded-xl border border-[var(--teal)]/40 bg-[var(--teal)]/10 px-4 py-3 text-sm">
          JIT access activated. Ticket and expiry are audited.
        </div>
      ) : null}
      {q.revoked ? (
        <div className="rounded-xl border border-[var(--line)] bg-white/[0.03] px-4 py-3 text-sm">
          JIT access revoked.
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Connector health</h2>
        <p className="text-xs text-[var(--fog)]">{health.note}</p>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-[var(--line)] px-4 py-3">
            <dt className="text-xs uppercase tracking-wider text-[var(--fog)]">
              Graph consent
            </dt>
            <dd className="mt-1 text-white">{health.graph_consent}</dd>
          </div>
          <div className="rounded-lg border border-[var(--line)] px-4 py-3">
            <dt className="text-xs uppercase tracking-wider text-[var(--fog)]">
              Hybrid AD connector
            </dt>
            <dd className="mt-1 text-white">{health.ad_connector}</dd>
          </div>
        </dl>
        <p className="text-xs text-[var(--fog)]">
          SSO enforce:{" "}
          <span className="text-white">
            {org.sso_enforced ? "on" : "off"}
          </span>
          {" · "}
          Frameworks:{" "}
          <span className="text-white">
            {(org.selected_frameworks ?? []).join(", ") || "none"}
          </span>
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-white">JIT staff access</h2>
        <p className="text-sm text-[var(--fog)]">
          Standing global admin is forbidden. Request time-boxed access with a
          ticket ID; every grant/revoke is append-only audited.
        </p>

        {myActive ? (
          <div className="rounded-xl border border-[var(--teal)]/40 bg-[var(--teal)]/10 px-4 py-3 text-sm">
            <p>
              Active until{" "}
              <strong className="text-white">
                {new Date(myActive.expires_at).toLocaleString()}
              </strong>{" "}
              · ticket <code>{myActive.ticket_id}</code>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={switchOperatorTenantAction}>
                <input type="hidden" name="org_id" value={org.id} />
                <input
                  type="hidden"
                  name="return_to"
                  value={`/operator/tenants/${org.id}`}
                />
                <button
                  type="submit"
                  className="rounded-md bg-[var(--teal)] px-3 py-1.5 text-xs font-semibold text-[#04201d]"
                >
                  Set as active tenant
                </button>
              </form>
              <form action={revokeJitAccessAction}>
                <input type="hidden" name="grant_id" value={myActive.id} />
                <input type="hidden" name="org_id" value={org.id} />
                <button
                  type="submit"
                  className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--fog)] hover:bg-white/5"
                >
                  Revoke now
                </button>
              </form>
            </div>
          </div>
        ) : (
          <form
            action={requestJitAccessAction}
            className="max-w-md space-y-3 rounded-xl border border-[var(--line)] px-4 py-4"
          >
            <input type="hidden" name="org_id" value={org.id} />
            <label className="block text-sm">
              <span className="text-[var(--fog)]">Ticket ID</span>
              <input
                name="ticket_id"
                required
                placeholder="GL-12345 / PSA ticket"
                className="mt-1 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 py-2 text-white"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--fog)]">Duration (hours)</span>
              <input
                name="hours"
                type="number"
                min={1}
                max={72}
                defaultValue={DEFAULT_JIT_HOURS}
                className="mt-1 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 py-2 text-white"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--fog)]">Reason (optional)</span>
              <input
                name="reason"
                placeholder="Break-glass / support"
                className="mt-1 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 py-2 text-white"
              />
            </label>
            <button
              type="submit"
              className="rounded-md bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-[#04201d]"
            >
              Request JIT access
            </button>
          </form>
        )}

        {grants.length > 0 ? (
          <div>
            <h3 className="mb-2 text-xs uppercase tracking-wider text-[var(--fog)]">
              Grant history
            </h3>
            <ul className="space-y-2 text-sm">
              {grants.slice(0, 8).map((g) => (
                <li
                  key={g.id}
                  className="rounded-md border border-[var(--line)] px-3 py-2 text-[var(--fog)]"
                >
                  <span className="text-white">{g.status}</span> · {g.ticket_id} ·{" "}
                  {g.staff_email} · expires{" "}
                  {new Date(g.expires_at).toLocaleString()}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
