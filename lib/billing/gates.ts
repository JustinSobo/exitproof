import { PLANS } from "@/lib/billing/plans";
import type { Organization, PlanId } from "@/lib/types";

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function normalizeMonthlyUsage(org: Organization): Organization {
  const key = currentMonthKey();
  if (org.offboards_month_key === key) return org;
  return {
    ...org,
    offboards_month_key: key,
    offboards_this_month: 0,
  };
}

export function canCreateOffboard(org: Organization): {
  allowed: boolean;
  reason?: string;
} {
  const normalized = normalizeMonthlyUsage(org);
  const plan = PLANS[normalized.plan as PlanId] ?? PLANS.trial;

  if (normalized.plan === "trial") {
    if (normalized.trial_offboards_used >= 3) {
      return {
        allowed: false,
        reason:
          "Trial includes 3 free offboards. Upgrade to Team, Growth, or Agency to continue.",
      };
    }
    return { allowed: true };
  }

  if (plan.offboardLimit !== null) {
    if (normalized.offboards_this_month >= plan.offboardLimit) {
      return {
        allowed: false,
        reason: `${plan.name} allows ${plan.offboardLimit} offboards per month. Upgrade to Growth for unlimited.`,
      };
    }
  }

  return { allowed: true };
}

export function canCreateClientOrg(org: Organization): {
  allowed: boolean;
  reason?: string;
} {
  if (org.plan !== "agency") {
    return {
      allowed: false,
      reason: "Client organizations require the Agency plan.",
    };
  }
  return { allowed: true };
}
