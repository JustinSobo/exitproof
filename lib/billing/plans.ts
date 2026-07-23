import type { PlanId } from "@/lib/types";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  priceMonthly: number | null;
  tagline: string;
  features: string[];
  offboardLimit: number | null; // null = unlimited
  maxClientOrgs: number;
  retentionDays: number;
  priceEnvKey?: string;
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  trial: {
    id: "trial",
    name: "Trial",
    priceMonthly: null,
    tagline: "3 free offboards to prove the workflow",
    features: [
      "3 offboards total while unpaid",
      "Stack-aware checklists",
      "Evidence upload & audit trail",
      "PDF / CSV Evidence Pack export",
    ],
    offboardLimit: 3,
    maxClientOrgs: 0,
    retentionDays: 90,
  },
  team: {
    id: "team",
    name: "Team",
    priceMonthly: 79,
    tagline: "For a single IT team that needs audit-ready exits",
    features: [
      "1 organization",
      "25 offboards / month",
      "Evidence Pack PDF + CSV",
      "Overdue critical-step alerts",
      "90-day retention",
    ],
    offboardLimit: 25,
    maxClientOrgs: 0,
    retentionDays: 90,
    priceEnvKey: "STRIPE_PRICE_TEAM",
  },
  growth: {
    id: "growth",
    name: "Growth",
    priceMonthly: 149,
    tagline: "Unlimited offboards with longer evidence retention",
    features: [
      "1 organization",
      "Unlimited offboards",
      "365-day retention flag",
      "Priority checklist templates",
      "Customer portal billing",
    ],
    offboardLimit: null,
    maxClientOrgs: 0,
    retentionDays: 365,
    priceEnvKey: "STRIPE_PRICE_GROWTH",
  },
  agency: {
    id: "agency",
    name: "Agency",
    priceMonthly: 249,
    tagline: "MSP / agency multi-tenant with client orgs",
    features: [
      "Parent org + up to 25 client orgs",
      "Unlimited offboards across clients",
      "Per-client isolation (RLS)",
      "365-day retention",
      "Agency billing portal",
    ],
    offboardLimit: null,
    maxClientOrgs: 25,
    retentionDays: 365,
    priceEnvKey: "STRIPE_PRICE_AGENCY",
  },
};

export function getStripePriceId(plan: PlanId): string | null {
  const def = PLANS[plan];
  if (!def.priceEnvKey) return null;
  return process.env[def.priceEnvKey] || null;
}

export function planFromStripePriceId(priceId: string): PlanId | null {
  for (const plan of Object.values(PLANS)) {
    if (!plan.priceEnvKey) continue;
    if (process.env[plan.priceEnvKey] === priceId) return plan.id;
  }
  return null;
}
