import {
  FRAMEWORKS,
  type FrameworkSlug,
  isFrameworkSlug,
} from "@/lib/compliance/frameworks";
import type { StackProfile } from "@/lib/types";

/** Entra / M365-centric defaults for mid-market onboarding. */
export const DEFAULT_ONBOARDING_FRAMEWORKS: FrameworkSlug[] = [
  "fedramp",
  "cmmc-l2",
  "soc2",
];

export const DEFAULT_STACK_PROFILE: StackProfile = "m365";

export type StackAnswerId =
  | "identity_provider"
  | "productivity_suite"
  | "device_mdm"
  | "extra_saas"
  | "contractors"
  | "privileged_access"
  | "remote_access"
  | "org_size";

export type StackQuestion = {
  id: StackAnswerId;
  prompt: string;
  help?: string;
  options: { value: string; label: string }[];
  defaultValue: string;
};

/** ≤8 stack questions — Entra/M365-first defaults. */
export const STACK_QUESTIONS: StackQuestion[] = [
  {
    id: "identity_provider",
    prompt: "Primary identity provider",
    help: "Where employee accounts are created and disabled.",
    options: [
      { value: "entra", label: "Microsoft Entra ID" },
      { value: "google", label: "Google Workspace" },
      { value: "both", label: "Both Entra and Google" },
    ],
    defaultValue: "entra",
  },
  {
    id: "productivity_suite",
    prompt: "Primary productivity suite",
    options: [
      { value: "m365", label: "Microsoft 365" },
      { value: "google", label: "Google Workspace" },
      { value: "mixed", label: "Mixed / both" },
    ],
    defaultValue: "m365",
  },
  {
    id: "device_mdm",
    prompt: "Do you manage devices with Intune or another MDM?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No / not in scope" },
    ],
    defaultValue: "yes",
  },
  {
    id: "extra_saas",
    prompt: "Do leavers also have access to SaaS apps beyond the IdP?",
    help: "GitHub, Salesforce, AWS consoles, VPN portals, etc.",
    options: [
      { value: "yes", label: "Yes — multiple SaaS apps" },
      { value: "no", label: "Mostly IdP / suite only" },
    ],
    defaultValue: "yes",
  },
  {
    id: "contractors",
    prompt: "Do you regularly offboard contractors or external personnel?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "Rarely / employees only" },
    ],
    defaultValue: "no",
  },
  {
    id: "privileged_access",
    prompt: "Are privileged or break-glass accounts in scope for offboarding?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "Standard users only" },
    ],
    defaultValue: "yes",
  },
  {
    id: "remote_access",
    prompt: "Do you run VPN, bastion, or other remote-access systems?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
    defaultValue: "yes",
  },
  {
    id: "org_size",
    prompt: "Approximate organization size",
    options: [
      { value: "smb", label: "Under 200" },
      { value: "mid", label: "200 – 2,000" },
      { value: "large", label: "Over 2,000" },
    ],
    defaultValue: "mid",
  },
];

export type StackAnswers = Record<StackAnswerId, string>;

export function defaultStackAnswers(): StackAnswers {
  return Object.fromEntries(
    STACK_QUESTIONS.map((q) => [q.id, q.defaultValue]),
  ) as StackAnswers;
}

/** Map questionnaire answers → org stack_profile. Entra/M365-centric. */
export function deriveStackProfile(answers: Partial<StackAnswers>): StackProfile {
  const idp = answers.identity_provider ?? "entra";
  const suite = answers.productivity_suite ?? "m365";
  const extraSaas = answers.extra_saas === "yes";

  if (idp === "both" || suite === "mixed" || extraSaas) {
    return "hybrid";
  }
  if (idp === "google" && suite === "google") {
    return "google";
  }
  if (idp === "entra" || suite === "m365") {
    return "m365";
  }
  return DEFAULT_STACK_PROFILE;
}

export function parseFrameworkSelections(
  values: string[] | FormDataEntryValue[],
): FrameworkSlug[] {
  const slugs = values
    .map((v) => String(v))
    .filter(isFrameworkSlug);
  // Dedupe, preserve FRAMEWORKS sort order
  const set = new Set(slugs);
  return FRAMEWORKS.map((f) => f.slug).filter((s) => set.has(s));
}

export function needsOnboarding(org: {
  onboarding_completed_at?: string | null;
}): boolean {
  return !org.onboarding_completed_at;
}
