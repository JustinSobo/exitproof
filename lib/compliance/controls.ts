import type { FrameworkSlug } from "@/lib/compliance/frameworks";

export type ControlDef = {
  /** Stable key: `${framework}:${controlId}` */
  key: string;
  framework: FrameworkSlug;
  controlId: string;
  title: string;
  /** Assessor plain-English guidance */
  guidance: string;
  evidenceExamples: string[];
};

function c(
  framework: FrameworkSlug,
  controlId: string,
  title: string,
  guidance: string,
  evidenceExamples: string[],
): ControlDef {
  return {
    key: `${framework}:${controlId}`,
    framework,
    controlId,
    title,
    guidance,
    evidenceExamples,
  };
}

/**
 * Curated offboarding-only control library (~55).
 * Supports evidence for listed controls — does not guarantee certification.
 */
export const CONTROLS: ControlDef[] = [
  // —— FedRAMP (via 800-53 family) ——
  c(
    "fedramp",
    "AC-2",
    "Account Management",
    "Disable or remove accounts aligned with termination; FedRAMP notify windows commonly expect prompt disable (e.g. 8h terminate / 24h unused where baseline applies).",
    [
      "Admin screenshot of disabled/blocked sign-in",
      "Directory audit log export showing disable timestamp",
    ],
  ),
  c(
    "fedramp",
    "AC-2(3)",
    "Disable Accounts",
    "Accounts are disabled after a defined period of inactivity or upon termination per organizational policy.",
    ["Account status export showing Disabled", "Ticket noting disable time"],
  ),
  c(
    "fedramp",
    "AC-3",
    "Access Enforcement",
    "Enforce approved authorizations for logical access; removing group/role grants on exit supports enforcement.",
    ["Group membership before/after export", "RBAC role removal screenshot"],
  ),
  c(
    "fedramp",
    "AC-6",
    "Least Privilege",
    "Revoke excess privileges on exit so remaining access reflects least privilege for active workforce only.",
    ["Privileged role removal evidence", "Admin role audit export"],
  ),
  c(
    "fedramp",
    "IA-4",
    "Identifier Management",
    "Manage identifiers for users; disable or reclaim identifiers so former employees cannot authenticate.",
    ["User principal status screenshot", "Identifier disable audit event"],
  ),
  c(
    "fedramp",
    "IA-5",
    "Authenticator Management",
    "Revoke or reset authenticators (passwords, MFA factors, tokens) on termination.",
    ["MFA method removal screenshot", "Password reset / authenticator revoke log"],
  ),
  c(
    "fedramp",
    "PS-4",
    "Personnel Termination",
    "Disable system access, revoke authenticators, recover property, and retain organizational access to former employee data as required.",
    [
      "Completed offboarding checklist with timestamps",
      "Device return / wipe record",
      "Mailbox/drive ownership transfer evidence",
    ],
  ),
  c(
    "fedramp",
    "PS-5",
    "Personnel Transfer",
    "When role changes (not full exit), modify access promptly to match the new position.",
    ["Access change ticket", "Before/after group membership export"],
  ),
  c(
    "fedramp",
    "PS-7",
    "External Personnel Security",
    "Apply equivalent termination/access revocation for contractors and external personnel.",
    ["Contractor offboarding ticket", "Vendor account disable evidence"],
  ),

  // —— NIST SP 800-53 ——
  c(
    "nist-800-53",
    "AC-2",
    "Account Management",
    "Manage system accounts including establishing, enabling, modifying, disabling, and removing accounts.",
    ["Disabled account screenshot", "Account lifecycle audit export"],
  ),
  c(
    "nist-800-53",
    "AC-2(3)",
    "Disable Accounts",
    "Disable accounts within a defined time period after inactivity or termination.",
    ["Disable timestamp evidence", "Policy citation + completion record"],
  ),
  c(
    "nist-800-53",
    "AC-3",
    "Access Enforcement",
    "Enforce approved authorizations for logical access to information and system resources.",
    ["Access removal evidence", "Authorization matrix update"],
  ),
  c(
    "nist-800-53",
    "AC-6",
    "Least Privilege",
    "Employ least privilege; remove unnecessary privileges when employment ends.",
    ["Privileged access removal log", "Role assignment export"],
  ),
  c(
    "nist-800-53",
    "IA-4",
    "Identifier Management",
    "Manage identifiers by receiving authorization, selecting, assigning, preventing reuse, and disabling.",
    ["Identifier disable record", "Directory object status"],
  ),
  c(
    "nist-800-53",
    "IA-5",
    "Authenticator Management",
    "Manage authenticators including initial distribution, lost/compromised handling, and revocation.",
    ["MFA revoke evidence", "Credential rotation record"],
  ),
  c(
    "nist-800-53",
    "PS-4",
    "Personnel Termination",
    "Upon termination: disable access, terminate/revoke authenticators, retrieve property, retain access to organizational information.",
    ["Termination checklist pack", "Property recovery form", "Access disable evidence"],
  ),
  c(
    "nist-800-53",
    "PS-5",
    "Personnel Transfer",
    "Review and modify logical and physical access following personnel transfers.",
    ["Transfer access review ticket"],
  ),
  c(
    "nist-800-53",
    "PS-7",
    "External Personnel Security",
    "Establish personnel security requirements for third-party providers including termination procedures.",
    ["Third-party offboarding evidence"],
  ),

  // —— CMMC L1 ——
  c(
    "cmmc-l1",
    "AC.L1-3.1.1",
    "Authorized Access Control",
    "Limit information system access to authorized users — offboarding log and account export show access was removed.",
    ["Offboarding case export", "Account status list excluding leaver"],
  ),
  c(
    "cmmc-l1",
    "AC.L1-b.1.i",
    "Authorized Users (FAR 52.204-21)",
    "Limit access to authorized users; termination evidence supports that unauthorized users are excluded.",
    ["User access roster", "Disable confirmation"],
  ),
  c(
    "cmmc-l1",
    "IA.L1-3.5.1",
    "Identification",
    "Identify information system users — identifiers for leavers are disabled or removed.",
    ["User identifier disable screenshot"],
  ),
  c(
    "cmmc-l1",
    "IA.L1-3.5.2",
    "Authentication",
    "Authenticate users before allowing access — revoke authenticators so leavers cannot authenticate.",
    ["Session revoke + MFA removal evidence"],
  ),

  // —— CMMC L2 ——
  c(
    "cmmc-l2",
    "AC.L2-3.1.1",
    "Limit System Access",
    "Limit system access to authorized users, processes, and devices — disable leaver accounts promptly.",
    ["Account disable evidence", "Access control list export"],
  ),
  c(
    "cmmc-l2",
    "AC.L2-3.1.2",
    "Transaction & Function Control",
    "Limit system access to types of transactions and functions authorized — remove role/group grants on exit.",
    ["Role/group removal evidence"],
  ),
  c(
    "cmmc-l2",
    "AC.L2-3.1.5",
    "Least Privilege",
    "Employ least privilege — strip elevated roles on termination.",
    ["Privileged role removal screenshot"],
  ),
  c(
    "cmmc-l2",
    "AC.L2-3.1.6",
    "Non-Privileged Account Use",
    "Use non-privileged accounts when accessing nonsecurity functions — ensure admin accounts for leavers are disabled.",
    ["Admin account disable evidence"],
  ),
  c(
    "cmmc-l2",
    "AC.L2-3.1.20",
    "External Connections / Remote Access",
    "Verify and control remote access connections — disable VPN/remote accounts on exit.",
    ["VPN account disable evidence", "Remote access roster update"],
  ),
  c(
    "cmmc-l2",
    "IA.L2-3.5.1",
    "Identify System Users",
    "Identify information system users, processes, and devices.",
    ["Directory user status export"],
  ),
  c(
    "cmmc-l2",
    "IA.L2-3.5.2",
    "Authenticate Users",
    "Authenticate identity of users before allowing access.",
    ["Authenticator revoke evidence"],
  ),
  c(
    "cmmc-l2",
    "IA.L2-3.5.3",
    "Multifactor Authentication",
    "Use multifactor authentication for local and network access to privileged accounts and network access to non-privileged accounts — remove MFA enrollments on exit.",
    ["MFA method removal screenshot"],
  ),
  c(
    "cmmc-l2",
    "MP.L2-3.8.3",
    "Sanitize / Media Control",
    "Sanitize or destroy media containing CUI before disposal or reuse — reclaim/wipe endpoints on exit.",
    ["Device wipe confirmation", "Asset return checklist"],
  ),
  c(
    "cmmc-l2",
    "PE.L2-3.10.1",
    "Limit Physical Access",
    "Limit physical access to organizational systems — deactivate badges and recover access tokens.",
    ["Badge deactivation record", "Physical access log update"],
  ),

  // —— NIST SP 800-171 ——
  c(
    "nist-800-171",
    "3.1.1",
    "Limit System Access",
    "Limit information system access to authorized users, processes acting on behalf of authorized users, or devices.",
    ["Account disable evidence"],
  ),
  c(
    "nist-800-171",
    "3.1.2",
    "Limit Transaction Types",
    "Limit information system access to the types of transactions and functions that authorized users are permitted to execute.",
    ["Permission/group removal evidence"],
  ),
  c(
    "nist-800-171",
    "3.1.5",
    "Least Privilege",
    "Employ the principle of least privilege, including for specific security functions and privileged accounts.",
    ["Privileged access removal"],
  ),
  c(
    "nist-800-171",
    "3.1.6",
    "Non-Privileged Accounts",
    "Use non-privileged accounts or roles when accessing nonsecurity functions.",
    ["Admin account disable"],
  ),
  c(
    "nist-800-171",
    "3.1.20",
    "Control Remote Access",
    "Verify and control/limit connections to and use of external information systems / remote access.",
    ["VPN/remote disable evidence"],
  ),
  c(
    "nist-800-171",
    "3.5.1",
    "Identify Users",
    "Identify information system users, processes acting on behalf of users, or devices.",
    ["User identification disable record"],
  ),
  c(
    "nist-800-171",
    "3.5.2",
    "Authenticate Users",
    "Authenticate (or verify) the identities of those users, processes, or devices as a prerequisite to allowing access.",
    ["Session/authenticator revoke"],
  ),
  c(
    "nist-800-171",
    "3.5.3",
    "Multifactor Authentication",
    "Use multifactor authentication for local and network access to privileged accounts and for network access to non-privileged accounts.",
    ["MFA enrollment removal"],
  ),
  c(
    "nist-800-171",
    "3.8.3",
    "Sanitize Media",
    "Sanitize or destroy information system media containing CUI before disposal or release for reuse.",
    ["Endpoint wipe / media sanitize record"],
  ),
  c(
    "nist-800-171",
    "3.10.1",
    "Limit Physical Access",
    "Limit physical access to organizational information systems, equipment, and the respective operating environments to authorized individuals.",
    ["Badge/access token recovery"],
  ),

  // —— SOC 2 ——
  c(
    "soc2",
    "CC6.1",
    "Logical Access Security",
    "The entity implements logical access security software, infrastructure, and architectures over protected information assets.",
    ["IdP disable evidence", "Access control configuration screenshot"],
  ),
  c(
    "soc2",
    "CC6.2",
    "Access Provisioning / Removal",
    "Prior to issuing credentials, and upon modification or removal of access, the entity registers and authorizes new access / removes access for terminations.",
    ["Termination access removal ticket + evidence", "Checklist completion timestamps"],
  ),
  c(
    "soc2",
    "CC6.3",
    "Role Change / Access Removal",
    "The entity authorizes, modifies, or removes access to data, software, functions, and other protected information assets based on roles and responsibilities.",
    ["Group/role membership before/after", "Privileged access removal"],
  ),

  // —— SOC 1 ——
  c(
    "soc1",
    "CCO-UP-1",
    "User Provisioning / Deprovisioning",
    "Controls provide reasonable assurance that user accounts are provisioned and deprovisioned based on authorized requests (termination triggers disable).",
    ["Authorized offboarding request", "Account disable confirmation"],
  ),
  c(
    "soc1",
    "CCO-PA-1",
    "Privileged Access Removal",
    "Controls provide reasonable assurance that privileged access is removed or modified when job responsibilities change or employment ends.",
    ["Privileged role removal evidence", "Admin audit export"],
  ),

  // —— ISO 27001:2022 ——
  c(
    "iso-27001",
    "A.5.15",
    "Access Control",
    "Rules to control physical and logical access to information and other associated assets are established and implemented.",
    ["Access removal evidence pack"],
  ),
  c(
    "iso-27001",
    "A.5.16",
    "Identity Management",
    "The full life cycle of identities is managed — including deactivation on termination.",
    ["Identity disable record"],
  ),
  c(
    "iso-27001",
    "A.5.17",
    "Authentication Information",
    "Allocation and management of authentication information is controlled — revoke secrets/MFA on exit.",
    ["Authenticator revoke evidence"],
  ),
  c(
    "iso-27001",
    "A.5.18",
    "Access Rights",
    "Access rights to information and assets are provisioned, reviewed, modified and removed.",
    ["Access rights removal evidence"],
  ),
  c(
    "iso-27001",
    "A.6.5",
    "Responsibilities After Termination",
    "Information security responsibilities and duties that remain valid after termination or change of employment are defined and enforced.",
    ["Termination checklist", "NDA/continuing obligations note if applicable"],
  ),
  c(
    "iso-27001",
    "A.6.1",
    "Screening",
    "Background verification of candidates is carried out (context for workforce trust; offboarding closes the lifecycle).",
    ["HR ticket linking hire→exit lifecycle"],
  ),
  c(
    "iso-27001",
    "A.6.2",
    "Terms and Conditions of Employment",
    "Employment agreements state information security responsibilities — exit confirms revocation of access granted under those terms.",
    ["Exit confirmation / ticket"],
  ),
  c(
    "iso-27001",
    "A.6.3",
    "Information Security Awareness",
    "Personnel and relevant interested parties receive awareness — exit process is part of operational security practice.",
    ["Completed offboarding process record"],
  ),
  c(
    "iso-27001",
    "A.8.2",
    "Privileged Access Rights",
    "The allocation and use of privileged access rights is restricted and managed — revoke on exit.",
    ["Privileged access removal"],
  ),
  c(
    "iso-27001",
    "A.8.3",
    "Information Access Restriction",
    "Access to information and other associated assets is restricted in accordance with the access control policy.",
    ["Data repository access removal", "Drive/mailbox transfer evidence"],
  ),

  // —— HIPAA ——
  c(
    "hipaa",
    "164.308(a)(3)(ii)(C)",
    "Termination Procedures",
    "Implement procedures for terminating access to electronic protected health information when employment ends.",
    ["Workforce termination access checklist", "Account disable timestamp"],
  ),
  c(
    "hipaa",
    "164.308(a)(3)(ii)(A)",
    "Authorization and/or Supervision",
    "Implement procedures for authorization and/or supervision of workforce members who work with ePHI.",
    ["Access authorization record closed on exit"],
  ),
  c(
    "hipaa",
    "164.312(a)(2)(i)",
    "Unique User Identification",
    "Assign a unique name and/or number for identifying and tracking user identity — disable unique IDs on exit.",
    ["Unique user ID disable evidence"],
  ),
  c(
    "hipaa",
    "164.312(d)",
    "Person or Entity Authentication",
    "Implement procedures to verify that a person or entity seeking access is the one claimed — revoke authenticators.",
    ["MFA/password revoke evidence"],
  ),

  // —— NIST CSF 2.0 ——
  c(
    "nist-csf",
    "PR.AA-01",
    "Identities Managed",
    "Identities and credentials for authorized users are managed — including revocation on departure.",
    ["Identity lifecycle evidence"],
  ),
  c(
    "nist-csf",
    "PR.AA-02",
    "Identities Proofed / Asserted",
    "Identities are proofed and bound to credentials based on risk — revoke asserted credentials on exit.",
    ["Credential revoke evidence"],
  ),
  c(
    "nist-csf",
    "PR.AA-03",
    "Users Authenticated",
    "Users are authenticated commensurate with risk — prevent authentication after termination.",
    ["Session revoke + account disable"],
  ),
  c(
    "nist-csf",
    "PR.AA-04",
    "Identity Assertions Protected",
    "Identity assertions are protected, conveyed, and verified — invalidate sessions/tokens.",
    ["Token/session invalidation evidence"],
  ),
  c(
    "nist-csf",
    "PR.AA-05",
    "Access Permissions Managed",
    "Access permissions, entitlements, and authorizations are defined and managed — remove on exit.",
    ["Entitlement removal evidence"],
  ),
  c(
    "nist-csf",
    "PR.AA-06",
    "Physical Access Managed",
    "Physical access to assets is managed — recover badges and deactivate physical access.",
    ["Badge deactivation evidence"],
  ),
];

const BY_KEY = new Map(CONTROLS.map((ctrl) => [ctrl.key, ctrl]));

export function getControl(key: string): ControlDef | undefined {
  return BY_KEY.get(key);
}

export function getControlsByFramework(framework: FrameworkSlug): ControlDef[] {
  return CONTROLS.filter((ctrl) => ctrl.framework === framework);
}

export function resolveControlRefs(refs: string[]): ControlDef[] {
  const out: ControlDef[] = [];
  for (const ref of refs) {
    const ctrl = BY_KEY.get(ref);
    if (ctrl) out.push(ctrl);
  }
  return out;
}

export function controlLabel(ctrl: ControlDef): string {
  return `${ctrl.controlId}`;
}

export function controlChipLabel(ctrl: ControlDef): string {
  const shortFw: Record<FrameworkSlug, string> = {
    fedramp: "FedRAMP",
    "nist-800-53": "800-53",
    "cmmc-l1": "CMMC L1",
    "cmmc-l2": "CMMC L2",
    "nist-800-171": "800-171",
    soc2: "SOC 2",
    soc1: "SOC 1",
    "iso-27001": "ISO",
    hipaa: "HIPAA",
    "nist-csf": "CSF",
  };
  return `${shortFw[ctrl.framework]} ${ctrl.controlId}`;
}
