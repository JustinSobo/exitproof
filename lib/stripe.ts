import Stripe from "stripe";
import { hasStripe } from "@/lib/env";

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!hasStripe()) return null;
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return stripeSingleton;
}

export function requireStripe(): Stripe {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY.");
  }
  return stripe;
}
