import { redirect } from "next/navigation";
import { BillingActions } from "@/components/app/billing-actions";
import { getCurrentOrg, isOrgAdminRole } from "@/lib/auth";
import { PLANS } from "@/lib/billing/plans";
import { isDemoMode } from "@/lib/env";

export const metadata = { title: "Billing" };

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; upgraded?: string; portal?: string }>;
}) {
  const ctx = await getCurrentOrg();
  if (!ctx) redirect("/auth/login");
  const params = await searchParams;
  const plan = PLANS[ctx.org.plan];
  const canManage = isOrgAdminRole(ctx.member.role);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-syne)] text-3xl font-700 text-white">
          Billing
        </h1>
        <p className="mt-2 text-[var(--fog)]">
          Current plan: <span className="text-white capitalize">{ctx.org.plan}</span>{" "}
          — {plan.tagline}
        </p>
        {isDemoMode() ? (
          <p className="mt-2 text-sm text-[var(--amber)]">
            Demo mode upgrades instantly without Stripe keys. Wire{" "}
            <code>STRIPE_*</code> env vars for live Checkout.
          </p>
        ) : null}
      </div>

      {params.success || params.upgraded ? (
        <p className="rounded-md border border-[var(--teal)]/40 bg-[var(--teal)]/10 px-3 py-2 text-sm text-[var(--teal-bright)]">
          Plan updated{params.upgraded ? `: ${params.upgraded}` : ""}.
        </p>
      ) : null}
      {params.portal === "demo" ? (
        <p className="text-sm text-[var(--fog)]">
          Customer Portal is simulated in demo mode.
        </p>
      ) : null}

      {canManage ? (
        <BillingActions currentPlan={ctx.org.plan} />
      ) : (
        <p className="rounded-md border border-[var(--line)] bg-white/[0.03] px-4 py-3 text-sm text-[var(--fog)]">
          Only organization owners and admins can change billing. Ask an admin
          if you need a plan upgrade.
        </p>
      )}
    </div>
  );
}
