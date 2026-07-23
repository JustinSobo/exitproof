import type { CaseDirectoryStatus } from "@/lib/connectors/ad";

/**
 * Case strip: AD account status + hybrid mismatch alert
 * (cloud disabled / on-prem still enabled). Demo data OK.
 */
export function CaseDirectoryStatusPanel({
  status,
}: {
  status: CaseDirectoryStatus | null;
}) {
  if (!status) return null;

  return (
    <section
      className="ep-panel space-y-3 px-4 py-4"
      aria-label="Directory account status"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-[family-name:var(--font-syne)] text-lg font-600 text-white">
          Directory status
        </h2>
        <p className="text-xs text-[var(--fog)]">
          Hybrid AD Audit · read-only snapshots
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--fog)]">
            Cloud
          </p>
          <p
            className={`mt-1 text-sm ${
              status.cloud.account_enabled === false
                ? "text-[var(--teal-bright)]"
                : status.cloud.account_enabled === true
                  ? "text-[var(--amber)]"
                  : "text-[var(--fog)]"
            }`}
          >
            {status.cloud.label}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--fog)]">
            On-prem AD
          </p>
          <p
            className={`mt-1 text-sm ${
              status.ad.account_enabled === true
                ? "text-[var(--amber)]"
                : status.ad.account_enabled === false
                  ? "text-[var(--teal-bright)]"
                  : "text-[var(--fog)]"
            }`}
          >
            {status.ad.label}
          </p>
          {status.ad.sam_account_name ? (
            <p className="mt-1 text-xs text-[var(--fog)]">
              sAMAccountName: {status.ad.sam_account_name}
              {status.ad.connector_hostname
                ? ` · via ${status.ad.connector_hostname}`
                : ""}
            </p>
          ) : null}
          {status.ad.last_logon_at ? (
            <p className="text-xs text-[var(--fog)]">
              Last logon: {new Date(status.ad.last_logon_at).toLocaleString()}
            </p>
          ) : null}
        </div>
      </div>

      {status.hybrid_mismatch && status.mismatch_message ? (
        <div
          role="alert"
          className="border border-[var(--amber)]/40 bg-[var(--amber)]/10 px-3 py-2 text-sm text-[var(--amber)]"
        >
          <p className="font-medium">Hybrid mismatch</p>
          <p className="mt-1 text-[var(--fog)]">{status.mismatch_message}</p>
        </div>
      ) : null}

      {status.ad.member_of.length > 0 ? (
        <details className="text-xs text-[var(--fog)]">
          <summary className="cursor-pointer hover:text-white">
            AD groups ({status.ad.member_of.length})
          </summary>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {status.ad.member_of.slice(0, 12).map((g) => (
              <li key={g} className="truncate">
                {g}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
