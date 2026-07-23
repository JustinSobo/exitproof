import { NextResponse } from "next/server";
import { getCurrentOrg, isOrgAdminRole, ORG_ADMIN_REQUIRED_MESSAGE } from "@/lib/auth";
import { getAppUrl, hasStripe, isDemoMode } from "@/lib/env";

export async function POST() {
  const ctx = await getCurrentOrg();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isOrgAdminRole(ctx.member.role)) {
    return NextResponse.json(
      { error: ORG_ADMIN_REQUIRED_MESSAGE },
      { status: 403 },
    );
  }

  if (!hasStripe() || isDemoMode()) {
    return NextResponse.json({
      demo: true,
      url: `${getAppUrl()}/billing?portal=demo`,
      message: isDemoMode()
        ? "Demo mode: Customer Portal is simulated."
        : "Stripe not configured.",
    });
  }

  if (!ctx.org.stripe_customer_id) {
    return NextResponse.json(
      { error: "No Stripe customer on this organization yet." },
      { status: 400 },
    );
  }

  const { requireStripe } = await import("@/lib/stripe");
  const stripe = requireStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: ctx.org.stripe_customer_id,
    return_url: `${getAppUrl()}/billing`,
  });

  return NextResponse.json({ url: session.url });
}
