import { NextResponse } from "next/server";
import {
  collectPriceIdsFromSubscriptionItems,
  parsePlanId,
  resolvePlanId,
} from "@/lib/billing/resolve-plan";
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
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as {
        id: string;
        metadata?: { org_id?: string; plan?: string };
        customer?: string | { id?: string } | null;
        subscription?: string | { id?: string } | null;
      };

      const orgId = session.metadata?.org_id;
      const priceIds: string[] = [];
      let metadataPlan: string | undefined = session.metadata?.plan;

      try {
        const lineItems = await stripe.checkout.sessions.listLineItems(
          session.id,
          { limit: 5 },
        );
        for (const item of lineItems.data) {
          const price = item.price;
          if (price && typeof price === "object" && price.id) {
            priceIds.push(price.id);
          }
        }
      } catch (err) {
        console.warn("Could not list checkout line items", err);
      }

      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;

      if (subscriptionId) {
        try {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          metadataPlan = metadataPlan || sub.metadata?.plan;
          priceIds.push(...collectPriceIdsFromSubscriptionItems(sub.items));
        } catch (err) {
          console.warn("Could not retrieve subscription for checkout", err);
        }
      }

      const plan = resolvePlanId({ metadataPlan, priceIds });
      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id;

      if (orgId && plan) {
        await applyPlan(orgId, plan, customerId, subscriptionId);
      }
    }

    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as {
        metadata?: { org_id?: string; plan?: string };
        customer?: string | { id?: string } | null;
        id?: string;
        items?: unknown;
      };

      const orgId = sub.metadata?.org_id;
      const plan = resolvePlanId({
        metadataPlan: sub.metadata?.plan,
        priceIds: collectPriceIdsFromSubscriptionItems(sub.items),
      });
      const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

      if (orgId && plan) {
        await applyPlan(orgId, plan, customerId, sub.id);
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as {
        metadata?: { org_id?: string };
        customer?: string | { id?: string } | null;
      };
      let orgId = sub.metadata?.org_id;
      if (!orgId) {
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        if (customerId) {
          orgId = (await findOrgIdByCustomer(customerId)) ?? undefined;
        }
      }
      if (orgId) {
        await applyPlan(orgId, "trial");
      }
    }
  } catch (err) {
    console.error("Webhook handler error", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function findOrgIdByCustomer(customerId: string): Promise<string | null> {
  if (isDemoMode()) return null;
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data } = await admin
    .from("organizations")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.id ?? null;
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

// Re-export helpers for tests / clarity
export { parsePlanId, resolvePlanId };
