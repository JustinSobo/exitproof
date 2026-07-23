import { GOOGLE_SMB } from "@/lib/templates/google-smb";
import { HYBRID_SAAS } from "@/lib/templates/hybrid-saas";
import { M365_SMB } from "@/lib/templates/m365-smb";
import type { OffboardingTemplate, StackProfile, TemplateStep } from "@/lib/types";

/** SQL seed UUIDs from `003_seed_templates.sql` — source of truth for live FK. */
export const TEMPLATE_IDS = {
  m365: "11111111-1111-1111-1111-111111111101",
  google: "11111111-1111-1111-1111-111111111102",
  hybrid: "11111111-1111-1111-1111-111111111103",
} as const;

/** Legacy TS slug ids kept for lookup compatibility. */
const LEGACY_ALIASES: Record<string, string> = {
  "tpl-m365-smb": TEMPLATE_IDS.m365,
  "tpl-google-smb": TEMPLATE_IDS.google,
  "tpl-hybrid-saas": TEMPLATE_IDS.hybrid,
};

const SEEDS = [M365_SMB, GOOGLE_SMB, HYBRID_SAAS];

export function getSeedTemplates(): OffboardingTemplate[] {
  return SEEDS.map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    stack: t.stack,
    description: t.description,
    steps: t.steps.map((s, i) => ({
      id: `${t.id}-step-${i + 1}`,
      ...s,
      sort_order: s.sort_order || i + 1,
    })) as TemplateStep[],
  }));
}

export function getTemplateById(id: string): OffboardingTemplate | undefined {
  const resolved = LEGACY_ALIASES[id] ?? id;
  return getSeedTemplates().find(
    (t) => t.id === resolved || t.slug === id || t.slug === resolved,
  );
}

export function getTemplatesForStack(
  stack: StackProfile,
): OffboardingTemplate[] {
  const all = getSeedTemplates();
  if (stack === "hybrid") return all;
  return all.filter((t) => t.stack === stack || t.stack === "hybrid");
}

export function defaultTemplateForStack(
  stack: StackProfile,
): OffboardingTemplate {
  const preferred =
    stack === "m365"
      ? TEMPLATE_IDS.m365
      : stack === "google"
        ? TEMPLATE_IDS.google
        : TEMPLATE_IDS.hybrid;
  return getTemplateById(preferred) ?? getSeedTemplates()[0];
}
