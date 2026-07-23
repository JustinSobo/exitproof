import { NextResponse } from "next/server";
import { getCurrentOrg, isOrgAdminRole, ORG_ADMIN_REQUIRED_MESSAGE } from "@/lib/auth";
import { getStripePriceId } from "@/lib/billing/plans";
import { demoStore } from "@/lib/demo/store";
import { getAppUrl, hasStripe, isDemoMode } from "@/lib/env";
import type { PlanId } from "@/lib/types";

export async function POST(request: Request) {
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

  const body = (await request.json()) as { plan?: PlanId };
  const plan = body.plan;
  if (!plan || !["team", "growth", "agency"].includes(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  if (!hasStripe() || isDemoMode()) {
    // Demo: instantly upgrade so billing UI is demoable without Stripe keys
    if (isDemoMode()) {
      demoStore.setPlan(ctx.org.id, plan, "demo_cus", "demo_sub");
      return NextResponse.json({
        demo: true,
        url: `${getAppUrl()}/billing?upgraded=${plan}`,
      });
    }
    return NextResponse.json(
      { error: "Stripe is not configured. Set STRIPE_SECRET_KEY and price IDs." },
      { status: 503 },
    );
  }

  const priceId = getStripePriceId(plan);
  if (!priceId) {
    return NextResponse.json(
      { error: `Missing Stripe price env for plan ${plan}` },
      { status: 503 },
    );
  }

  const { requireStripe } = await import("@/lib/stripe");
  const stripe = requireStripe();

  let customerId = ctx.org.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: ctx.user.email,
      name: ctx.org.name,
      metadata: { org_id: ctx.org.id },
    });
    customerId = customer.id;

    if (isDemoMode()) {
      demoStore.updateOrg(ctx.org.id, { stripe_customer_id: customerId });
    } else {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      await supabase
        .from("organizations")
        .update({ stripe_customer_id: customerId })
        .eq("id", ctx.org.id);
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${getAppUrl()}/billing?success=1`,
    cancel_url: `${getAppUrl()}/billing?canceled=1`,
    metadata: { org_id: ctx.org.id, plan },
    subscription_data: {
      metadata: { org_id: ctx.org.id, plan },
    },
  });

  return NextResponse.json({ url: session.url });
}
