import { NextResponse } from "next/server";
import { planFromStripePriceId } from "@/lib/billing/plans";
import { demoStore } from "@/lib/demo/store";
import { hasStripe, isDemoMode } from "@/lib/env";
import type { PlanId } from "@/lib/types";

export async function POST(request: Request) {
  if (!hasStripe()) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 503 },
    );
  }

  const { requireStripe } = await import("@/lib/stripe");
  const stripe = requireStripe();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // Fail closed: never accept unsigned webhook payloads.
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET not configured" },
      { status: 503 },
    );
  }
  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  const rawBody = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "customer.subscription.updated"
    ) {
      const obj = event.data.object as {
        metadata?: { org_id?: string; plan?: string };
        customer?: string;
        subscription?: string;
        items?: { data?: Array<{ price?: { id?: string } }> };
      };

      let plan = (obj.metadata?.plan as PlanId | undefined) ?? undefined;
      const orgId = obj.metadata?.org_id;
      const priceId = obj.items?.data?.[0]?.price?.id;
      if (!plan && priceId) {
        plan = planFromStripePriceId(priceId) ?? undefined;
      }

      if (orgId && plan) {
        await applyPlan(
          orgId,
          plan,
          typeof obj.customer === "string" ? obj.customer : undefined,
          typeof obj.subscription === "string" ? obj.subscription : undefined,
        );
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const obj = event.data.object as {
        metadata?: { org_id?: string };
      };
      if (obj.metadata?.org_id) {
        await applyPlan(obj.metadata.org_id, "trial");
      }
    }
  } catch (err) {
    console.error("Webhook handler error", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function applyPlan(
  orgId: string,
  plan: PlanId,
  customerId?: string,
  subscriptionId?: string,
) {
  if (isDemoMode()) {
    demoStore.setPlan(orgId, plan, customerId, subscriptionId);
    return;
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { PLANS } = await import("@/lib/billing/plans");
  await admin
    .from("organizations")
    .update({
      plan,
      retention_days: PLANS[plan].retentionDays,
      ...(customerId ? { stripe_customer_id: customerId } : {}),
      ...(subscriptionId ? { stripe_subscription_id: subscriptionId } : {}),
    })
    .eq("id", orgId);

  await admin.from("audit_events").insert({
    org_id: orgId,
    case_id: null,
    actor_id: null,
    actor_email: "stripe",
    event_type: "billing.plan_updated",
    payload: { plan, customerId, subscriptionId },
  });
}
