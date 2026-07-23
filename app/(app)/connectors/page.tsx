import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getAdminConsentUrlForOrg,
  markGraphConsentAction,
  setAutoEvidenceAction,
  setEntraTenantIdAction,
} from "@/lib/actions/connectors";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentOrg, isOrgAdminRole, sessionTenantId } from "@/lib/auth";
import { GRAPH_ADMIN_CONSENT_SCOPES, graphCredsSecretRef } from "@/lib/connectors/graph";
import { isDemoMode } from "@/lib/env";
import type { GraphConsentStatus } from "@/lib/types";

export const metadata = { title: "Connectors" };

const STATUS_LABEL: Record<GraphConsentStatus, string> = {
  not_started: "Not started",
  pending: "Pending consent",
  healthy: "Healthy",
  revoked: "Revoked",
  error: "Error",
};

export default async function ConnectorsPage({
  searchParams,
}: {
  searchParams: Promise<{
    consented?: string;
    saved?: string;
    error?: string;
    status?: string;
    consent?: string;
  }>;
}) {
  const ctx = await getCurrentOrg();
  if (!ctx) redirect("/auth/login");

  const params = await searchParams;
  const canManage = isOrgAdminRole(ctx.member.role);
  const consentStatus =
    ctx.org.graph_consent_status ?? ("not_started" as GraphConsentStatus);
  const consentUrl = await getAdminConsentUrlForOrg();
  const tenantId = sessionTenantId(ctx.org);
  const secretRef = graphCredsSecretRef(tenantId);

  return (
    <div className="mx-auto max-w-xl space-y-10">
      <PageHeader
        title="Directory connectors"
        description="Microsoft Graph read-only audit for Entra account state. No write or disable scopes in this phase."
      />

      {params.error ? <Alert variant="danger">{params.error}</Alert> : null}
      {params.consented || params.consent ? (
        <Alert variant="success">
          {isDemoMode()
            ? "Consent recorded (demo). Directory snapshots use the mock Graph client."
            : "Consent return received. Confirm status is Healthy after Graph validates the Enterprise Application."}
        </Alert>
      ) : null}
      {params.saved ? (
        <Alert variant="success">Connector settings saved.</Alert>
      ) : null}

      {!canManage ? (
        <Alert variant="info">
          Only owners and admins can grant consent or change connector settings.
        </Alert>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-syne)] text-xl font-600 text-white">
          Graph consent health
        </h2>
        <div className="rounded-xl border border-[var(--line)] bg-white/[0.03] px-4 py-3 text-sm">
          <p className="font-medium text-white">
            Status: {STATUS_LABEL[consentStatus]}
          </p>
          <p className="mt-1 text-[var(--fog)]">
            Entra directory:{" "}
            {ctx.org.entra_tenant_id ?? "not bound — set below"}
          </p>
          {ctx.org.graph_consented_at ? (
            <p className="mt-1 text-xs text-[var(--fog)]">
              Consented{" "}
              {new Date(ctx.org.graph_consented_at).toLocaleString()}
            </p>
          ) : null}
          {ctx.org.graph_last_sync_at ? (
            <p className="mt-1 text-xs text-[var(--fog)]">
              Last snapshot{" "}
              {new Date(ctx.org.graph_last_sync_at).toLocaleString()}
            </p>
          ) : (
            <p className="mt-1 text-xs text-[var(--fog)]">
              No directory snapshot yet — open a case and refresh Graph status.
            </p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-syne)] text-xl font-600 text-white">
          Admin consent
        </h2>
        <p className="text-sm text-[var(--fog)]">
          Customer Global Admin consents to GridLogic&apos;s multi-tenant app.
          Application permissions (read-only):
        </p>
        <ul className="list-inside list-disc text-xs text-[var(--fog)]">
          {GRAPH_ADMIN_CONSENT_SCOPES.map((s) => (
            <li key={s} className="font-mono text-[11px]">
              {s.replace("https://graph.microsoft.com/", "")}
            </li>
          ))}
        </ul>

        {canManage ? (
          <div className="space-y-3">
            <form action={setEntraTenantIdAction} className="space-y-2">
              <label className="block text-sm">
                <span className="text-[var(--fog)]">Customer Entra tenant ID</span>
                <input
                  name="entra_tenant_id"
                  defaultValue={ctx.org.entra_tenant_id ?? ""}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="mt-1 w-full rounded-md border border-[var(--line)] bg-black/20 px-3 py-2 font-mono text-sm text-white outline-none focus:border-[var(--teal)]"
                />
              </label>
              <button
                type="submit"
                className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--fog)] hover:bg-white/5 hover:text-white"
              >
                Save Entra tenant ID
              </button>
            </form>

            {consentUrl.url ? (
              <a
                href={consentUrl.url}
                className="inline-flex rounded-md bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-[#04201d]"
              >
                Open admin consent
              </a>
            ) : (
              <p className="text-sm text-[var(--amber)]">{consentUrl.reason}</p>
            )}

            {isDemoMode() ? (
              <form action={markGraphConsentAction}>
                <input type="hidden" name="status" value="healthy" />
                <button
                  type="submit"
                  className="rounded-md border border-[var(--teal)]/50 px-4 py-2 text-sm font-medium text-[var(--teal-bright)] hover:bg-[var(--teal)]/10"
                >
                  Simulate consent (demo)
                </button>
              </form>
            ) : (
              <form action={markGraphConsentAction} className="flex flex-wrap gap-2">
                <input type="hidden" name="status" value="healthy" />
                <button
                  type="submit"
                  className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--fog)] hover:bg-white/5"
                >
                  Mark consent healthy
                </button>
              </form>
            )}
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-syne)] text-xl font-600 text-white">
          Auto-evidence
        </h2>
        <p className="text-sm text-[var(--fog)]">
          When enabled, directory snapshots attach a hashed JSON evidence file to
          the IdP disable checklist step (labeled system-collected). Critical
          steps still need human attest.
        </p>
        {canManage ? (
          <form action={setAutoEvidenceAction} className="flex items-center gap-3">
            <input type="hidden" name="enabled" value="false" />
            <label className="flex items-center gap-2 text-sm text-white">
              <input
                type="checkbox"
                name="enabled"
                value="true"
                defaultChecked={Boolean(ctx.org.auto_evidence_enabled)}
              />
              Enable Graph auto-evidence
            </label>
            <button
              type="submit"
              className="rounded-md bg-[var(--teal)] px-3 py-1.5 text-sm font-semibold text-[#04201d]"
            >
              Save
            </button>
          </form>
        ) : (
          <p className="text-sm text-[var(--fog)]">
            Auto-evidence:{" "}
            {ctx.org.auto_evidence_enabled ? "enabled" : "disabled"}
          </p>
        )}
      </section>

      <section className="space-y-2 text-xs text-[var(--fog)]">
        <h2 className="font-[family-name:var(--font-syne)] text-sm font-600 text-white">
          Key Vault secret reference
        </h2>
        <p>
          Live Graph client credentials are never stored in the database. Workers
          resolve{" "}
          <code className="text-[var(--mist)]">{secretRef.secretName}</code> from{" "}
          <code className="text-[var(--mist)]">{secretRef.vaultUri}</code> via
          managed identity.
        </p>
        <p>
          See README → Microsoft Graph read-only connector, and{" "}
          <Link href="/settings" className="text-[var(--teal-bright)] hover:underline">
            Settings
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
