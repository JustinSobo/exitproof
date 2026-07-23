/** Framework slugs used in org.selected_frameworks and export ?framework= */

export type FrameworkSlug =
  | "fedramp"
  | "nist-800-53"
  | "cmmc-l1"
  | "cmmc-l2"
  | "nist-800-171"
  | "soc2"
  | "soc1"
  | "iso-27001"
  | "hipaa"
  | "nist-csf";

export type FrameworkDef = {
  slug: FrameworkSlug;
  name: string;
  version: string;
  description: string;
  sort: number;
};

export const FRAMEWORKS: FrameworkDef[] = [
  {
    slug: "fedramp",
    name: "FedRAMP",
    version: "Rev 5 (via NIST SP 800-53)",
    description:
      "Personnel termination and account management evidence supporting FedRAMP Moderate/High baselines (AC/IA/PS family).",
    sort: 10,
  },
  {
    slug: "nist-800-53",
    name: "NIST SP 800-53",
    version: "Rev 5",
    description:
      "Access control, identification/authentication, and personnel security controls relevant to offboarding.",
    sort: 20,
  },
  {
    slug: "cmmc-l1",
    name: "CMMC Level 1",
    version: "2.0",
    description:
      "Foundational FCI practices: authorized users and basic access control evidence for leavers.",
    sort: 30,
  },
  {
    slug: "cmmc-l2",
    name: "CMMC Level 2",
    version: "2.0",
    description:
      "CUI access practices mapped from NIST SP 800-171 for account disable, authenticator revoke, and device recovery.",
    sort: 40,
  },
  {
    slug: "nist-800-171",
    name: "NIST SP 800-171",
    version: "Rev 2",
    description:
      "Protecting CUI in nonfederal systems — AC/IA practices used as the CMMC L2 spine.",
    sort: 50,
  },
  {
    slug: "soc2",
    name: "SOC 2",
    version: "TSC 2017",
    description:
      "Trust Services Criteria CC6 logical access — provisioning, modification, and removal.",
    sort: 60,
  },
  {
    slug: "soc1",
    name: "SOC 1",
    version: "Org-defined CCOs",
    description:
      "User provisioning/deprovisioning and privileged access removal control objectives.",
    sort: 70,
  },
  {
    slug: "iso-27001",
    name: "ISO/IEC 27001",
    version: "2022 Annex A",
    description:
      "Access control, identity, authentication, and termination-or-change-of-employment controls.",
    sort: 80,
  },
  {
    slug: "hipaa",
    name: "HIPAA Security Rule",
    version: "45 CFR 164",
    description:
      "Workforce clearance/termination and access control safeguards for ePHI environments.",
    sort: 90,
  },
  {
    slug: "nist-csf",
    name: "NIST CSF",
    version: "2.0",
    description:
      "PR.AA identity, authentication, and access control outcomes for executive evidence packs.",
    sort: 100,
  },
];

export const FRAMEWORK_SLUGS = FRAMEWORKS.map((f) => f.slug);

export function getFramework(slug: string): FrameworkDef | undefined {
  return FRAMEWORKS.find((f) => f.slug === slug);
}

export function isFrameworkSlug(value: string): value is FrameworkSlug {
  return FRAMEWORK_SLUGS.includes(value as FrameworkSlug);
}

/** Export query param values (includes "all"). */
export type ExportFrameworkFilter = FrameworkSlug | "all";

export function parseExportFramework(
  value: string | null | undefined,
): ExportFrameworkFilter {
  if (!value || value === "all") return "all";
  return isFrameworkSlug(value) ? value : "all";
}
