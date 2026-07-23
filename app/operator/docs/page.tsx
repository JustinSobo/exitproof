import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOperator } from "@/lib/operator/auth";

export const metadata = { title: "Provision docs · Operator" };

export default async function OperatorDocsPage() {
  try {
    await requireOperator();
  } catch {
    redirect("/auth/login");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-[var(--amber)]">
          Operator runbook
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-syne)] text-3xl font-700 text-white">
          Provision customer CLI
        </h1>
        <p className="mt-2 text-[var(--fog)]">
          Prefer the{" "}
          <Link href="/operator/onboard" className="text-[var(--teal-bright)] underline">
            onboard wizard
          </Link>{" "}
          for app metadata + owner invite. Use the CLI for Azure data-plane
          checklist (SKU, blob prefix, CMK name) before live deploy is wired.
        </p>
      </div>

      <pre className="overflow-x-auto rounded-xl border border-[var(--line)] bg-black/40 p-4 text-xs text-[var(--mist)]">
{`npm run provision -- --dry-run \\
  --name "Acme Corp" \\
  --sku standard \\
  --entra-tenant-id "<customer-entra-directory-guid>"`}
      </pre>

      <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--fog)]">
        <li>
          Script: <code className="text-[var(--mist)]">scripts/provision-customer.ts</code>
        </li>
        <li>
          Azure stubs:{" "}
          <code className="text-[var(--mist)]">infra/README.md</code> (
          <code>tenant-standard</code> / <code>tenant-dedicated</code>)
        </li>
        <li>
          Phase 1 dry-run only — <code>--apply</code> is reserved until Azure
          deploy lands (Phase 1 follow-up / H5)
        </li>
        <li>
          After CLI checklist: complete{" "}
          <Link href="/operator/onboard" className="underline">
            operator onboard
          </Link>{" "}
          (SSO, frameworks, owner invite) then Graph consent (Phase 3)
        </li>
      </ul>
    </div>
  );
}
