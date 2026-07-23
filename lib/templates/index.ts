import { GOOGLE_SMB } from "@/lib/templates/google-smb";
import { HYBRID_SAAS } from "@/lib/templates/hybrid-saas";
import { M365_SMB } from "@/lib/templates/m365-smb";
import type { OffboardingTemplate, StackProfile, TemplateStep } from "@/lib/types";

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
  return getSeedTemplates().find((t) => t.id === id || t.slug === id);
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
      ? "tpl-m365-smb"
      : stack === "google"
        ? "tpl-google-smb"
        : "tpl-hybrid-saas";
  return getTemplateById(preferred) ?? getSeedTemplates()[0];
}
