import { planFromStripePriceId } from "@/lib/billing/plans";
import type { PlanId } from "@/lib/types";

const PAID_PLANS: PlanId[] = ["team", "growth", "agency"];

export function parsePlanId(value: unknown): PlanId | null {
  if (typeof value !== "string") return null;
  if (value === "trial" || PAID_PLANS.includes(value as PlanId)) {
    return value as PlanId;
  }
  return null;
}

/**
 * Resolve plan consistently across Checkout Session and Subscription payloads.
 * Prefer explicit metadata.plan; fall back to Stripe price env mapping.
 */
export function resolvePlanId(input: {
  metadataPlan?: unknown;
  priceIds?: Array<string | null | undefined>;
}): PlanId | null {
  const fromMeta = parsePlanId(input.metadataPlan);
  if (fromMeta && fromMeta !== "trial") return fromMeta;

  for (const priceId of input.priceIds ?? []) {
    if (!priceId) continue;
    const fromPrice = planFromStripePriceId(priceId);
    if (fromPrice) return fromPrice;
  }

  return fromMeta;
}

export function collectPriceIdsFromSubscriptionItems(items: unknown): string[] {
  if (!items || typeof items !== "object") return [];
  const data = (items as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];
  const ids: string[] = [];
  for (const entry of data) {
    if (!entry || typeof entry !== "object") continue;
    const price = (entry as { price?: unknown }).price;
    if (typeof price === "string") ids.push(price);
    else if (price && typeof price === "object" && "id" in price) {
      const id = (price as { id?: unknown }).id;
      if (typeof id === "string") ids.push(id);
    }
  }
  return ids;
}
