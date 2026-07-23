import Link from "next/link";
import { redirect } from "next/navigation";
import { BillingActions } from "@/components/app/billing-actions";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
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
      <PageHeader
        title="Billing"
        description={
          <>
            Current plan:{" "}
            <span className="capitalize text-white">{ctx.org.plan}</span> —{" "}
            {plan.tagline}
          </>
        }
      />

      {isDemoMode() ? (
        <Alert variant="warning">
          Demo mode upgrades instantly without Stripe keys. Wire{" "}
          <code className="text-white">STRIPE_*</code> env vars for live Checkout.
        </Alert>
      ) : null}

      {params.success || params.upgraded ? (
        <Alert variant="success">
          Plan updated{params.upgraded ? `: ${params.upgraded}` : ""}.
        </Alert>
      ) : null}
      {params.portal === "demo" ? (
        <Alert variant="info">Customer Portal is simulated in demo mode.</Alert>
      ) : null}

      {canManage ? (
        <BillingActions currentPlan={ctx.org.plan} />
      ) : (
        <Alert variant="info">
          Only organization owners and admins can change billing. Ask an admin
          if you need a plan upgrade.{" "}
          <Link href="/settings" className="text-[var(--teal-bright)] hover:underline">
            Settings
          </Link>
        </Alert>
      )}
    </div>
  );
}
