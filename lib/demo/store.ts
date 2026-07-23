import { createHash, randomUUID } from "crypto";
import { canCreateClientOrg, canCreateOffboard, normalizeMonthlyUsage } from "@/lib/billing/gates";
import { PLANS } from "@/lib/billing/plans";
import {
  assertCanCloseCase,
  assertCanCompleteItem,
} from "@/lib/cases/evidence-rules";
import {
  defaultTemplateForStack,
  getSeedTemplates,
  getTemplateById,
  templateStepsForOrg,
} from "@/lib/templates";
import {
  detectHybridMismatch,
  type AdConnector,
  type AdDirectorySnapshot,
  type CaseDirectoryStatus,
  hybridMismatchMessage,
} from "@/lib/connectors/ad";
import { hashRegistrationToken } from "@/lib/connectors/ad-auth";
import { buildAdEvidenceCsv } from "@/lib/connectors/ad-auto-evidence";
import { mapAdAutoEvidenceTarget, mapSignalToChecklistItem } from "@/lib/evidence/auto-map";
import { resolveAutoEvidencePolicy } from "@/lib/evidence/policy";
import { effectiveJitStatus } from "@/lib/operator/jit";
import type { JitAccessGrant, OperatorStaff } from "@/lib/operator/types";
import type {
  AuditEvent,
  CaseStatus,
  ChecklistItem,
  ChecklistItemStatus,
  EvidenceFile,
  OffboardingCase,
  Organization,
  OrgMember,
  PlanId,
  SessionUser,
  StackProfile,
} from "@/lib/types";

/**
 * In-memory demo store for DEMO_MODE / missing Supabase.
 * Process-local: fine for local demos; resets on server restart.
 */

/** Well-known demo connector credentials (CI / local agent). */
export const DEMO_AD_CONNECTOR_ID = "demo-ad-connector-1";
export const DEMO_AD_CERT_THUMBPRINT =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
export const DEMO_AD_REGISTRATION_TOKEN = "demo-connector-token";

interface DemoState {
  orgs: Organization[];
  members: OrgMember[];
  cases: OffboardingCase[];
  items: ChecklistItem[];
  evidence: EvidenceFile[];
  audits: AuditEvent[];
  users: SessionUser[];
  passwords: Record<string, string>; // email -> password (demo only)
  sessions: Record<string, string>; // token -> userId
  adConnectors: AdConnector[];
  adConnectorTokenHashes: Record<string, string>; // connectorId -> sha256 hex
  adSnapshots: AdDirectorySnapshot[];
  /** Phase 2: GridLogic operator registry + JIT grants */
  operatorStaff: OperatorStaff[];
  jitGrants: JitAccessGrant[];
}

declare global {
  var __exitproofDemo: DemoState | undefined;
}

function monthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function emptyState(): DemoState {
  return {
    orgs: [],
    members: [],
    cases: [],
    items: [],
    evidence: [],
    audits: [],
    users: [],
    passwords: {},
    sessions: {},
    adConnectors: [],
    adConnectorTokenHashes: {},
    adSnapshots: [],
    operatorStaff: [],
    jitGrants: [],
  };
}

function seedDemoIfNeeded(state: DemoState) {
  if (state.orgs.length > 0) return;

  const user: SessionUser = {
    id: "demo-user-1",
    email: "demo@exitproof.app",
    full_name: "Alex Rivera",
  };
  state.users.push(user);
  state.passwords[user.email] = "demo1234";

  const org: Organization = {
    id: "demo-org-1",
    tenant_id: "demo-org-1",
    name: "Northwind IT",
    stack_profile: "hybrid",
    plan: "trial",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    parent_org_id: null,
    retention_days: PLANS.trial.retentionDays,
    offboards_this_month: 1,
    offboards_month_key: monthKey(),
    trial_offboards_used: 1,
    created_at: new Date().toISOString(),
    selected_frameworks: ["fedramp", "cmmc-l2", "soc2"],
    entra_tenant_id: "11111111-2222-3333-4444-555555555501",
    sso_enforced: false,
    onboarding_completed_at: new Date().toISOString(),
    graph_consent_status: "healthy",
    graph_consented_at: new Date().toISOString(),
    graph_last_sync_at: null,
    auto_evidence_enabled: true,
    hybrid_ad_enabled: true,
    ad_auto_evidence_enabled: true,
    require_human_attest_on_critical: true,
  };
  state.orgs.push(org);
  state.members.push({
    id: "demo-member-1",
    org_id: org.id,
    user_id: user.id,
    role: "owner",
    email: user.email,
    full_name: user.full_name ?? null,
  });

  // GridLogic operator staff (demo user doubles as ops) + second tenant for JIT demos
  state.operatorStaff.push({
    id: "demo-ops-staff-1",
    user_id: user.id,
    email: user.email,
    full_name: user.full_name ?? null,
    active: true,
    created_at: new Date().toISOString(),
  });

  const contoso: Organization = {
    id: "demo-org-contoso",
    tenant_id: "demo-org-contoso",
    name: "Contoso Energy",
    stack_profile: "m365",
    plan: "growth",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    parent_org_id: null,
    retention_days: PLANS.growth.retentionDays,
    offboards_this_month: 0,
    offboards_month_key: monthKey(),
    trial_offboards_used: 0,
    created_at: new Date().toISOString(),
    selected_frameworks: ["cmmc-l2", "soc2"],
    entra_tenant_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    sso_enforced: true,
    onboarding_completed_at: new Date().toISOString(),
    graph_consent_status: "not_started",
    graph_consented_at: null,
    graph_last_sync_at: null,
    auto_evidence_enabled: false,
    hybrid_ad_enabled: false,
    ad_auto_evidence_enabled: false,
    require_human_attest_on_critical: true,
  };
  state.orgs.push(contoso);

  const template = defaultTemplateForStack("hybrid");
  const steps = templateStepsForOrg(template, org.selected_frameworks);
  const caseId = "demo-case-1";
  const due = new Date();
  due.setDate(due.getDate() + 2);

  state.cases.push({
    id: caseId,
    org_id: org.id,
    employee_name: "Jordan Lee",
    employee_email: "jordan.lee@northwind.example",
    status: "in_progress",
    assignee_email: user.email,
    due_date: due.toISOString().slice(0, 10),
    template_id: template.id,
    template_name: template.name,
    created_by: user.id,
    created_at: new Date().toISOString(),
    closed_at: null,
    notes: "Seeded demo offboarding case.",
  });

  for (const step of steps) {
    state.items.push({
      id: randomUUID(),
      case_id: caseId,
      template_step_id: step.id,
      title: step.title,
      description: step.description,
      requires_evidence: step.requires_evidence,
      is_critical: step.is_critical,
      // Phase 5: leave critical IdP step pending — system evidence alone cannot close it.
      status: "pending",
      notes: null,
      ticket_url: null,
      completed_at: null,
      completed_by: null,
      sort_order: step.sort_order,
      category: step.category,
      evidence_hint: step.evidenceHint ?? null,
      control_refs: [...(step.controlRefs ?? [])],
      notified_at: null,
    });
  }

  state.audits.push({
    id: randomUUID(),
    org_id: org.id,
    case_id: caseId,
    actor_id: user.id,
    actor_email: user.email,
    event_type: "case.created",
    payload: { employee_name: "Jordan Lee", demo: true },
    created_at: new Date().toISOString(),
  });

  // Phase 4: mock Hybrid Connector + AD snapshot showing hybrid mismatch
  // (cloud disabled / on-prem still enabled) for the seeded case.
  const connector: AdConnector = {
    id: DEMO_AD_CONNECTOR_ID,
    tenant_id: org.tenant_id!,
    org_id: org.id,
    display_name: "Northwind DC01 Connector",
    hostname: "dc01.northwind.example",
    cert_thumbprint: DEMO_AD_CERT_THUMBPRINT,
    status: "active",
    ou_scopes: ["OU=Users,DC=northwind,DC=example"],
    last_heartbeat_at: new Date().toISOString(),
    agent_version: "0.1.0-demo",
    created_at: new Date().toISOString(),
    revoked_at: null,
  };
  state.adConnectors.push(connector);
  state.adConnectorTokenHashes[connector.id] = hashRegistrationToken(
    DEMO_AD_REGISTRATION_TOKEN,
  );

  const cloudAccountEnabled = false; // Entra/cloud disabled (Phase 4 hybrid mismatch demo)
  const adEnabled = true; // on-prem AD still enabled → hybrid mismatch
  const mismatch = detectHybridMismatch(cloudAccountEnabled, adEnabled);
  state.adSnapshots.push({
    id: "demo-ad-snapshot-1",
    tenant_id: org.tenant_id!,
    org_id: org.id,
    connector_id: connector.id,
    case_id: caseId,
    directory_key: "jordan.lee@northwind.example",
    sam_account_name: "jlee",
    user_principal_name: "jordan.lee@northwind.example",
    object_guid: "11111111-2222-3333-4444-555555555555",
    account_enabled: adEnabled,
    user_account_control: 0x200, // NORMAL_ACCOUNT, not disabled
    last_logon_at: new Date(Date.now() - 86400000).toISOString(),
    member_of: [
      "CN=Domain Users,CN=Users,DC=northwind,DC=example",
      "CN=VPN-Users,OU=Groups,DC=northwind,DC=example",
    ],
    distinguished_name:
      "CN=Jordan Lee,OU=Users,DC=northwind,DC=example",
    cloud_account_enabled: cloudAccountEnabled,
    hybrid_mismatch: mismatch,
    collected_at: new Date().toISOString(),
  });

  if (mismatch) {
    state.audits.push({
      id: randomUUID(),
      org_id: org.id,
      case_id: caseId,
      actor_id: null,
      actor_email: "system",
      event_type: "directory.hybrid_mismatch",
      payload: {
        cloud_account_enabled: cloudAccountEnabled,
        ad_account_enabled: adEnabled,
        demo: true,
      },
      created_at: new Date().toISOString(),
    });
  }

  // Phase 5 DEMO: attach system-collected Graph + AD evidence on auto-mapped
  // critical steps — leave steps pending so human attest policy is visible.
  const caseItems = state.items.filter((i) => i.case_id === caseId);
  const frameworks = org.selected_frameworks ?? [];
  const graphTarget = mapSignalToChecklistItem(
    "graph_directory_snapshot",
    caseItems,
    { selectedFrameworks: frameworks },
  );
  if (graphTarget) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const graphBody = {
      kind: "system_collected_graph_snapshot",
      label: "System-collected directory snapshot (Microsoft Graph read-only)",
      disclaimer:
        "This evidence is a point-in-time read of directory state. It does not certify that access was revoked.",
      capturedAt: new Date().toISOString(),
      source: "demo",
      queriedEmail: "jordan.lee@northwind.example",
      accountStillEnabled: true,
      note: "DEMO_MODE Phase 5: system-collected; human attest still required.",
    };
    const graphBytes = Buffer.from(JSON.stringify(graphBody, null, 2), "utf8");
    const graphHash = createHash("sha256").update(graphBytes).digest("hex");
    const graphFile = `graph-snapshot-${stamp}.json`;
    state.evidence.push({
      id: "demo-ev-graph-1",
      checklist_item_id: graphTarget.id,
      case_id: caseId,
      org_id: org.id,
      file_name: graphFile,
      storage_path: `tenants/${org.id}/graph-auto/${caseId}/${graphFile}`,
      uploaded_by: "system:graph",
      created_at: new Date().toISOString(),
      content_hash: graphHash,
      mime_type: "application/json",
      byte_size: graphBytes.byteLength,
      collection_source: "system:graph",
    });
    graphTarget.notes =
      "DEMO: System-collected Graph snapshot attached — human attest (ticket or upload) still required before Mark done.";
    state.audits.push({
      id: randomUUID(),
      org_id: org.id,
      case_id: caseId,
      actor_id: null,
      actor_email: "system",
      event_type: "evidence.auto_collected",
      payload: {
        item_id: graphTarget.id,
        file_name: graphFile,
        content_hash: graphHash,
        source: "graph",
        label: "system-collected snapshot",
        demo: true,
        phase: 5,
      },
      created_at: new Date().toISOString(),
    });
  }

  const adTarget = mapAdAutoEvidenceTarget(caseItems, {
    selectedFrameworks: frameworks,
  });
  const adSnap = state.adSnapshots[state.adSnapshots.length - 1];
  if (adTarget && adSnap) {
    const built = buildAdEvidenceCsv(adSnap);
    state.evidence.push({
      id: "demo-ev-ad-1",
      checklist_item_id: adTarget.id,
      case_id: caseId,
      org_id: org.id,
      file_name: built.file_name,
      storage_path: `tenants/${org.id}/ad-auto/${caseId}/${built.file_name}`,
      uploaded_by: "system:ad",
      created_at: new Date().toISOString(),
      content_hash: built.content_hash,
      mime_type: built.mimeType,
      byte_size: built.bytes.byteLength,
      collection_source: "system:ad",
    });
    if (!adTarget.notes) {
      adTarget.notes =
        "DEMO: System-collected AD export attached — human attest still required on this critical step.";
    }
    state.audits.push({
      id: randomUUID(),
      org_id: org.id,
      case_id: caseId,
      actor_id: null,
      actor_email: "system",
      event_type: "evidence.auto_collected",
      payload: {
        item_id: adTarget.id,
        file_name: built.file_name,
        content_hash: built.content_hash,
        source: "ad",
        label: "system-collected snapshot",
        demo: true,
        phase: 5,
      },
      created_at: new Date().toISOString(),
    });
  }
}

function getState(): DemoState {
  if (!globalThis.__exitproofDemo) {
    globalThis.__exitproofDemo = emptyState();
  }
  seedDemoIfNeeded(globalThis.__exitproofDemo);
  return globalThis.__exitproofDemo;
}

function appendAudit(
  state: DemoState,
  partial: Omit<AuditEvent, "id" | "created_at">,
) {
  state.audits.push({
    ...partial,
    id: randomUUID(),
    created_at: new Date().toISOString(),
  });
}

/** Session org + agency child orgs — mirrors live `user_org_ids()`. */
function accessibleOrgIds(state: DemoState, sessionOrgId: string): Set<string> {
  const childIds = state.orgs
    .filter((o) => o.parent_org_id === sessionOrgId)
    .map((o) => o.id);
  return new Set([sessionOrgId, ...childIds]);
}

function caseInScope(
  state: DemoState,
  caseId: string,
  sessionOrgId: string,
): OffboardingCase | null {
  const c = state.cases.find((x) => x.id === caseId) ?? null;
  if (!c) return null;
  if (!accessibleOrgIds(state, sessionOrgId).has(c.org_id)) return null;
  return c;
}

export const demoStore = {
  accessibleOrgIds(sessionOrgId: string): Set<string> {
    return accessibleOrgIds(getState(), sessionOrgId);
  },

  isOrgAccessible(sessionOrgId: string, targetOrgId: string): boolean {
    return accessibleOrgIds(getState(), sessionOrgId).has(targetOrgId);
  },
  listTemplates() {
    return getSeedTemplates();
  },

  signup(email: string, password: string, fullName: string, orgName: string) {
    const state = getState();
    if (state.users.some((u) => u.email === email)) {
      throw new Error("An account with that email already exists.");
    }
    const user: SessionUser = {
      id: randomUUID(),
      email,
      full_name: fullName,
    };
    state.users.push(user);
    state.passwords[email] = password;

    const orgId = randomUUID();
    const org: Organization = {
      id: orgId,
      tenant_id: orgId,
      name: orgName || `${fullName}'s Organization`,
      stack_profile: "m365",
      plan: "trial",
      stripe_customer_id: null,
      stripe_subscription_id: null,
      parent_org_id: null,
      retention_days: PLANS.trial.retentionDays,
      offboards_this_month: 0,
      offboards_month_key: monthKey(),
      trial_offboards_used: 0,
      created_at: new Date().toISOString(),
      selected_frameworks: [],
      entra_tenant_id: null,
      onboarding_completed_at: null,
    };
    state.orgs.push(org);
    state.members.push({
      id: randomUUID(),
      org_id: org.id,
      user_id: user.id,
      role: "owner",
      email,
      full_name: fullName,
    });

    const token = randomUUID();
    state.sessions[token] = user.id;
    return { user, token, org };
  },

  login(email: string, password: string) {
    const state = getState();
    const user = state.users.find((u) => u.email === email);
    if (!user || state.passwords[email] !== password) {
      throw new Error("Invalid email or password.");
    }
    const token = randomUUID();
    state.sessions[token] = user.id;
    return { user, token };
  },

  magicLink(email: string) {
    const state = getState();
    let user = state.users.find((u) => u.email === email);
    if (!user) {
      user = { id: randomUUID(), email, full_name: email.split("@")[0] };
      state.users.push(user);
      state.passwords[email] = "magic";
      const orgId = randomUUID();
      const org: Organization = {
        id: orgId,
        tenant_id: orgId,
        name: `${user.full_name}'s Organization`,
        stack_profile: "m365",
        plan: "trial",
        stripe_customer_id: null,
        stripe_subscription_id: null,
        parent_org_id: null,
        retention_days: 90,
        offboards_this_month: 0,
        offboards_month_key: monthKey(),
        trial_offboards_used: 0,
        created_at: new Date().toISOString(),
        selected_frameworks: [],
        entra_tenant_id: null,
        onboarding_completed_at: null,
      };
      state.orgs.push(org);
      state.members.push({
        id: randomUUID(),
        org_id: org.id,
        user_id: user.id,
        role: "owner",
        email,
        full_name: user.full_name ?? null,
      });
    }
    const token = randomUUID();
    state.sessions[token] = user.id;
    return { user, token };
  },

  getUserByToken(token: string | undefined | null): SessionUser | null {
    if (!token) return null;
    const state = getState();
    const userId = state.sessions[token];
    if (!userId) return null;
    return state.users.find((u) => u.id === userId) ?? null;
  },

  logout(token: string | undefined | null) {
    if (!token) return;
    delete getState().sessions[token];
  },

  getMembership(userId: string): { org: Organization; member: OrgMember } | null {
    const state = getState();
    const member = state.members.find((m) => m.user_id === userId);
    if (!member) return null;
    const org = state.orgs.find((o) => o.id === member.org_id);
    if (!org) return null;
    return { org: normalizeMonthlyUsage(org), member };
  },

  listClientOrgs(parentOrgId: string): Organization[] {
    return getState().orgs.filter((o) => o.parent_org_id === parentOrgId);
  },

  listMembers(orgId: string): OrgMember[] {
    return getState().members.filter((m) => m.org_id === orgId);
  },

  updateOrg(
    orgId: string,
    patch: Partial<
      Pick<
        Organization,
        | "name"
        | "stack_profile"
        | "plan"
        | "stripe_customer_id"
        | "stripe_subscription_id"
        | "retention_days"
        | "selected_frameworks"
        | "onboarding_completed_at"
        | "entra_tenant_id"
        | "sso_enforced"
        | "graph_consent_status"
        | "graph_consented_at"
        | "graph_last_sync_at"
        | "auto_evidence_enabled"
        | "hybrid_ad_enabled"
        | "ad_auto_evidence_enabled"
        | "require_human_attest_on_critical"
      >
    >,
  ) {
    const state = getState();
    const org = state.orgs.find((o) => o.id === orgId);
    if (!org) throw new Error("Organization not found");
    Object.assign(org, patch);
    if (patch.plan) {
      org.retention_days = PLANS[patch.plan].retentionDays;
    }
    if (patch.selected_frameworks) {
      org.selected_frameworks = [...patch.selected_frameworks];
    }
    return org;
  },

  createClientOrg(parentOrgId: string, name: string, stack: StackProfile) {
    const state = getState();
    const parent = state.orgs.find((o) => o.id === parentOrgId);
    if (!parent) throw new Error("Parent org not found");
    const gate = canCreateClientOrg(parent);
    if (!gate.allowed) throw new Error(gate.reason);
    const clients = state.orgs.filter((o) => o.parent_org_id === parentOrgId);
    if (clients.length >= PLANS.agency.maxClientOrgs) {
      throw new Error("Agency plan allows up to 25 client organizations.");
    }
    const orgId = randomUUID();
    const org: Organization = {
      id: orgId,
      tenant_id: orgId,
      name,
      stack_profile: stack,
      plan: parent.plan,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      parent_org_id: parentOrgId,
      retention_days: parent.retention_days,
      offboards_this_month: 0,
      offboards_month_key: monthKey(),
      trial_offboards_used: 0,
      created_at: new Date().toISOString(),
      selected_frameworks: [...(parent.selected_frameworks ?? [])],
      entra_tenant_id: null,
      onboarding_completed_at: null,
    };
    state.orgs.push(org);
    return org;
  },

  listCases(orgId: string): OffboardingCase[] {
    const state = getState();
    const ids = accessibleOrgIds(state, orgId);
    return state.cases
      .filter((c) => ids.has(c.org_id))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  getCase(caseId: string, sessionOrgId: string): OffboardingCase | null {
    return caseInScope(getState(), caseId, sessionOrgId);
  },

  getItems(caseId: string, sessionOrgId: string): ChecklistItem[] {
    const state = getState();
    if (!caseInScope(state, caseId, sessionOrgId)) return [];
    return state.items
      .filter((i) => i.case_id === caseId)
      .sort((a, b) => a.sort_order - b.sort_order);
  },

  getEvidence(caseId: string, sessionOrgId: string): EvidenceFile[] {
    const state = getState();
    if (!caseInScope(state, caseId, sessionOrgId)) return [];
    return state.evidence.filter((e) => e.case_id === caseId);
  },

  getAudits(caseId: string, sessionOrgId: string): AuditEvent[] {
    const state = getState();
    if (!caseInScope(state, caseId, sessionOrgId)) return [];
    return state.audits
      .filter((a) => a.case_id === caseId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },

  createCase(input: {
    /** Caller's current org — never trust client-supplied org alone. */
    sessionOrgId: string;
    /** Target org for the case; must be session org or an agency child. */
    orgId?: string;
    user: SessionUser;
    employeeName: string;
    employeeEmail: string;
    templateId: string;
    assigneeEmail?: string;
    dueDate?: string;
    notes?: string;
  }) {
    const state = getState();
    const targetOrgId = input.orgId || input.sessionOrgId;
    if (!accessibleOrgIds(state, input.sessionOrgId).has(targetOrgId)) {
      throw new Error("Organization not found");
    }
    const org = state.orgs.find((o) => o.id === targetOrgId);
    if (!org) throw new Error("Organization not found");
    const normalized = normalizeMonthlyUsage(org);
    Object.assign(org, normalized);

    const gate = canCreateOffboard(org);
    if (!gate.allowed) throw new Error(gate.reason);

    const template =
      getTemplateById(input.templateId) ??
      defaultTemplateForStack(org.stack_profile);
    const steps = templateStepsForOrg(template, org.selected_frameworks);

    const caseId = randomUUID();
    const offboarding: OffboardingCase = {
      id: caseId,
      org_id: org.id,
      employee_name: input.employeeName,
      employee_email: input.employeeEmail,
      status: "open",
      assignee_email: input.assigneeEmail || input.user.email,
      due_date: input.dueDate || null,
      template_id: template.id,
      template_name: template.name,
      created_by: input.user.id,
      created_at: new Date().toISOString(),
      closed_at: null,
      notes: input.notes || null,
    };
    state.cases.push(offboarding);

    for (const step of steps) {
      state.items.push({
        id: randomUUID(),
        case_id: caseId,
        template_step_id: step.id,
        title: step.title,
        description: step.description,
        requires_evidence: step.requires_evidence,
        is_critical: step.is_critical,
        status: "pending",
        notes: null,
        ticket_url: null,
        completed_at: null,
        completed_by: null,
        sort_order: step.sort_order,
        category: step.category,
        evidence_hint: step.evidenceHint ?? null,
        control_refs: [...(step.controlRefs ?? [])],
        notified_at: null,
      });
    }

    org.offboards_this_month += 1;
    if (org.plan === "trial") org.trial_offboards_used += 1;

    appendAudit(state, {
      org_id: org.id,
      case_id: caseId,
      actor_id: input.user.id,
      actor_email: input.user.email,
      event_type: "case.created",
      payload: {
        employee_name: input.employeeName,
        template_id: template.id,
      },
    });

    return offboarding;
  },

  updateCaseStatus(
    caseId: string,
    status: CaseStatus,
    user: SessionUser,
    sessionOrgId: string,
  ) {
    const state = getState();
    const c = caseInScope(state, caseId, sessionOrgId);
    if (!c) throw new Error("Case not found");
    if (status === "closed") {
      assertCanCloseCase(state.items.filter((i) => i.case_id === caseId));
    }
    c.status = status;
    if (status === "closed") c.closed_at = new Date().toISOString();
    appendAudit(state, {
      org_id: c.org_id,
      case_id: caseId,
      actor_id: user.id,
      actor_email: user.email,
      event_type: "case.status_changed",
      payload: { status },
    });
    return c;
  },

  updateChecklistItem(
    itemId: string,
    patch: {
      status?: ChecklistItemStatus;
      notes?: string;
      ticket_url?: string;
    },
    user: SessionUser,
    sessionOrgId: string,
  ) {
    const state = getState();
    const item = state.items.find((i) => i.id === itemId);
    if (!item) throw new Error("Checklist item not found");
    const c = caseInScope(state, item.case_id, sessionOrgId);
    if (!c) throw new Error("Case not found");

    if (patch.status === "done") {
      const org = state.orgs.find((o) => o.id === c.org_id);
      const policy = resolveAutoEvidencePolicy(org ?? {});
      assertCanCompleteItem(
        item,
        state.evidence.filter((e) => e.case_id === c.id),
        {
          ticketUrlOverride: patch.ticket_url,
          requireHumanAttestOnCritical: policy.requireHumanAttestOnCritical,
        },
      );
    }

    if (patch.status) {
      item.status = patch.status;
      if (patch.status === "done") {
        item.completed_at = new Date().toISOString();
        item.completed_by = user.email;
      } else {
        item.completed_at = null;
        item.completed_by = null;
      }
    }
    if (patch.notes !== undefined) item.notes = patch.notes;
    if (patch.ticket_url !== undefined) item.ticket_url = patch.ticket_url;

    if (c.status === "open") c.status = "in_progress";

    appendAudit(state, {
      org_id: c.org_id,
      case_id: c.id,
      actor_id: user.id,
      actor_email: user.email,
      event_type: "checklist.updated",
      payload: { item_id: itemId, ...patch },
    });

    return item;
  },

  addEvidence(
    itemId: string,
    fileName: string,
    storagePath: string,
    user: SessionUser,
    sessionOrgId: string,
    meta?: {
      contentHash?: string | null;
      mimeType?: string | null;
      byteSize?: number | null;
    },
  ) {
    const state = getState();
    const item = state.items.find((i) => i.id === itemId);
    if (!item) throw new Error("Checklist item not found");
    const c = caseInScope(state, item.case_id, sessionOrgId);
    if (!c) throw new Error("Case not found");

    const evidence: EvidenceFile = {
      id: randomUUID(),
      checklist_item_id: itemId,
      case_id: c.id,
      org_id: c.org_id,
      file_name: fileName,
      storage_path: storagePath,
      uploaded_by: user.email,
      created_at: new Date().toISOString(),
      content_hash: meta?.contentHash ?? null,
      mime_type: meta?.mimeType ?? null,
      byte_size: meta?.byteSize ?? null,
      collection_source: "human",
    };
    state.evidence.push(evidence);

    appendAudit(state, {
      org_id: c.org_id,
      case_id: c.id,
      actor_id: user.id,
      actor_email: user.email,
      event_type: "evidence.uploaded",
      payload: {
        item_id: itemId,
        file_name: fileName,
        content_hash: evidence.content_hash,
        mime_type: evidence.mime_type,
        size: evidence.byte_size,
      },
    });

    return evidence;
  },

  /** System-collected Graph/AD snapshot evidence (audit: evidence.auto_collected). */
  addAutoCollectedEvidence(
    itemId: string,
    fileName: string,
    storagePath: string,
    user: SessionUser,
    sessionOrgId: string,
    meta: {
      contentHash: string;
      mimeType: string;
      byteSize: number;
      source: "graph" | "ad";
    },
  ) {
    const state = getState();
    const item = state.items.find((i) => i.id === itemId);
    if (!item) throw new Error("Checklist item not found");
    const c = caseInScope(state, item.case_id, sessionOrgId);
    if (!c) throw new Error("Case not found");

    const evidence: EvidenceFile = {
      id: randomUUID(),
      checklist_item_id: itemId,
      case_id: c.id,
      org_id: c.org_id,
      file_name: fileName,
      storage_path: storagePath,
      uploaded_by: `system:${meta.source}`,
      created_at: new Date().toISOString(),
      content_hash: meta.contentHash,
      mime_type: meta.mimeType,
      byte_size: meta.byteSize,
      collection_source: meta.source === "graph" ? "system:graph" : "system:ad",
    };
    state.evidence.push(evidence);

    appendAudit(state, {
      org_id: c.org_id,
      case_id: c.id,
      actor_id: user.id,
      actor_email: user.email,
      event_type: "evidence.auto_collected",
      payload: {
        item_id: itemId,
        file_name: fileName,
        content_hash: evidence.content_hash,
        mime_type: evidence.mime_type,
        size: evidence.byte_size,
        source: meta.source,
        label: "system-collected snapshot",
      },
    });

    return evidence;
  },

  getEvidenceById(evidenceId: string, sessionOrgId: string): EvidenceFile | null {
    const state = getState();
    const evidence = state.evidence.find((e) => e.id === evidenceId);
    if (!evidence) return null;
    if (!caseInScope(state, evidence.case_id, sessionOrgId)) return null;
    return evidence;
  },

  recordEvidenceDownload(
    evidenceId: string,
    user: SessionUser,
    sessionOrgId: string,
  ) {
    const evidence = this.getEvidenceById(evidenceId, sessionOrgId);
    if (!evidence) return;
    const state = getState();
    appendAudit(state, {
      org_id: evidence.org_id,
      case_id: evidence.case_id,
      actor_id: user.id,
      actor_email: user.email,
      event_type: "evidence.downloaded",
      payload: {
        evidence_id: evidenceId,
        file_name: evidence.file_name,
        content_hash: evidence.content_hash,
        demo: true,
      },
    });
  },

  setPlan(orgId: string, plan: PlanId, stripeCustomerId?: string, subId?: string) {
    const state = getState();
    const org = state.orgs.find((o) => o.id === orgId);
    if (!org) throw new Error("Organization not found");
    org.plan = plan;
    org.retention_days = PLANS[plan].retentionDays;
    if (stripeCustomerId) org.stripe_customer_id = stripeCustomerId;
    if (subId) org.stripe_subscription_id = subId;
    appendAudit(state, {
      org_id: orgId,
      case_id: null,
      actor_id: null,
      actor_email: "stripe",
      event_type: "billing.plan_updated",
      payload: { plan },
    });
    return org;
  },

  listOverdueCritical() {
    const state = getState();
    const today = new Date().toISOString().slice(0, 10);
    const results: Array<{
      case: OffboardingCase;
      item: ChecklistItem;
      org: Organization;
    }> = [];

    for (const c of state.cases) {
      if (c.status === "closed") continue;
      if (!c.due_date || c.due_date >= today) continue;
      const org = state.orgs.find((o) => o.id === c.org_id);
      if (!org) continue;
      for (const item of state.items.filter((i) => i.case_id === c.id)) {
        if (
          item.is_critical &&
          item.status !== "done" &&
          !item.notified_at
        ) {
          results.push({ case: c, item, org });
        }
      }
    }
    return results;
  },

  markItemNotified(itemId: string, at = new Date().toISOString()) {
    const state = getState();
    const item = state.items.find((i) => i.id === itemId);
    if (!item) return null;
    item.notified_at = at;
    return item;
  },

  inviteMember(
    orgId: string,
    email: string,
    role: "admin" | "member" = "member",
  ): OrgMember {
    const state = getState();
    const org = state.orgs.find((o) => o.id === orgId);
    if (!org) throw new Error("Organization not found");
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes("@")) throw new Error("Valid email required");

    const existing = state.members.find(
      (m) => m.org_id === orgId && m.email.toLowerCase() === normalized,
    );
    if (existing) throw new Error("That email is already a member");

    let user = state.users.find((u) => u.email.toLowerCase() === normalized);
    if (!user) {
      user = {
        id: randomUUID(),
        email: normalized,
        full_name: null,
      };
      state.users.push(user);
      state.passwords[normalized] = "demo1234";
    }

    const member: OrgMember = {
      id: randomUUID(),
      org_id: orgId,
      user_id: user.id,
      role,
      email: normalized,
      full_name: user.full_name ?? null,
    };
    state.members.push(member);

    appendAudit(state, {
      org_id: orgId,
      case_id: null,
      actor_id: null,
      actor_email: "system",
      event_type: "member.invited",
      payload: { email: normalized, role },
    });

    return member;
  },

  removeMember(orgId: string, memberId: string, actorUserId: string) {
    const state = getState();
    const member = state.members.find(
      (m) => m.id === memberId && m.org_id === orgId,
    );
    if (!member) throw new Error("Member not found");
    if (member.user_id === actorUserId) {
      throw new Error("You cannot remove yourself");
    }
    if (member.role === "owner") {
      const owners = state.members.filter(
        (m) => m.org_id === orgId && m.role === "owner",
      );
      if (owners.length <= 1) {
        throw new Error("Cannot remove the last owner");
      }
    }

    state.members = state.members.filter((m) => m.id !== memberId);
    appendAudit(state, {
      org_id: orgId,
      case_id: null,
      actor_id: actorUserId,
      actor_email: state.users.find((u) => u.id === actorUserId)?.email ?? null,
      event_type: "member.removed",
      payload: { member_id: memberId, email: member.email, role: member.role },
    });
  },

  /**
   * Purge closed cases (and related rows) past the org retention window.
   * Returns purged case ids for audit/response.
   */
  purgeExpiredCases(now = new Date()): Array<{
    orgId: string;
    caseId: string;
    closedAt: string;
    retentionDays: number;
  }> {
    const state = getState();
    const purged: Array<{
      orgId: string;
      caseId: string;
      closedAt: string;
      retentionDays: number;
    }> = [];

    for (const org of state.orgs) {
      const cutoff = new Date(now);
      cutoff.setUTCDate(cutoff.getUTCDate() - org.retention_days);
      const cutoffIso = cutoff.toISOString();

      const expired = state.cases.filter(
        (c) =>
          c.org_id === org.id &&
          c.status === "closed" &&
          c.closed_at &&
          c.closed_at < cutoffIso,
      );

      for (const c of expired) {
        purged.push({
          orgId: org.id,
          caseId: c.id,
          closedAt: c.closed_at!,
          retentionDays: org.retention_days,
        });
        state.evidence = state.evidence.filter((e) => e.case_id !== c.id);
        state.items = state.items.filter((i) => i.case_id !== c.id);
        state.cases = state.cases.filter((x) => x.id !== c.id);
        appendAudit(state, {
          org_id: org.id,
          case_id: null,
          actor_id: null,
          actor_email: "system",
          event_type: "retention.purged",
          payload: {
            case_id: c.id,
            closed_at: c.closed_at,
            retention_days: org.retention_days,
          },
        });
      }
    }

    return purged;
  },

  // --- Phase 4: Hybrid AD connector ---

  listAdConnectors(tenantId: string): AdConnector[] {
    return getState().adConnectors.filter((c) => c.tenant_id === tenantId);
  },

  getAdConnector(connectorId: string): AdConnector | null {
    return (
      getState().adConnectors.find((c) => c.id === connectorId) ?? null
    );
  },

  getAdConnectorTokenHash(connectorId: string): string | null {
    return getState().adConnectorTokenHashes[connectorId] ?? null;
  },

  registerAdConnector(input: {
    tenant_id: string;
    org_id: string;
    display_name?: string;
    hostname?: string | null;
    cert_thumbprint: string;
    registration_token: string;
    ou_scopes?: string[];
    agent_version?: string | null;
  }): AdConnector {
    const state = getState();
    const org = state.orgs.find(
      (o) => o.id === input.org_id && (o.tenant_id ?? o.id) === input.tenant_id,
    );
    if (!org) {
      throw new Error("Unknown tenant/org for connector registration.");
    }
    const thumb = input.cert_thumbprint.replace(/[:\s]/g, "").toLowerCase();
    const existing = state.adConnectors.find(
      (c) => c.tenant_id === input.tenant_id && c.cert_thumbprint === thumb,
    );
    if (existing) {
      if (existing.status === "revoked") {
        throw new Error("Certificate thumbprint was revoked; issue a new cert.");
      }
      state.adConnectorTokenHashes[existing.id] = hashRegistrationToken(
        input.registration_token,
      );
      existing.hostname = input.hostname ?? existing.hostname;
      existing.display_name = input.display_name ?? existing.display_name;
      existing.ou_scopes = input.ou_scopes ?? existing.ou_scopes;
      existing.agent_version = input.agent_version ?? existing.agent_version;
      existing.status = "active";
      return existing;
    }
    const connector: AdConnector = {
      id: randomUUID(),
      tenant_id: input.tenant_id,
      org_id: input.org_id,
      display_name: input.display_name ?? "ExitProof Hybrid Connector",
      hostname: input.hostname ?? null,
      cert_thumbprint: thumb,
      status: "active",
      ou_scopes: input.ou_scopes ?? [],
      last_heartbeat_at: null,
      agent_version: input.agent_version ?? null,
      created_at: new Date().toISOString(),
      revoked_at: null,
    };
    state.adConnectors.push(connector);
    state.adConnectorTokenHashes[connector.id] = hashRegistrationToken(
      input.registration_token,
    );
    appendAudit(state, {
      org_id: input.org_id,
      case_id: null,
      actor_id: null,
      actor_email: "system",
      event_type: "connector.ad.registered",
      payload: {
        connector_id: connector.id,
        cert_thumbprint: thumb,
        hostname: connector.hostname,
      },
    });
    return connector;
  },

  heartbeatAdConnector(
    connectorId: string,
    payload: Record<string, unknown>,
  ): AdConnector {
    const state = getState();
    const connector = state.adConnectors.find((c) => c.id === connectorId);
    if (!connector) throw new Error("Unknown connector.");
    if (connector.status === "revoked") {
      throw new Error("Connector certificate revoked.");
    }
    connector.last_heartbeat_at = new Date().toISOString();
    connector.status = "active";
    if (typeof payload.agent_version === "string") {
      connector.agent_version = payload.agent_version;
    }
    return connector;
  },

  revokeAdConnector(connectorId: string, tenantId: string): AdConnector {
    const state = getState();
    const connector = state.adConnectors.find(
      (c) => c.id === connectorId && c.tenant_id === tenantId,
    );
    if (!connector) throw new Error("Unknown connector.");
    connector.status = "revoked";
    connector.revoked_at = new Date().toISOString();
    appendAudit(state, {
      org_id: connector.org_id,
      case_id: null,
      actor_id: null,
      actor_email: "system",
      event_type: "connector.ad.revoked",
      payload: { connector_id: connectorId },
    });
    return connector;
  },

  ingestAdSnapshot(input: {
    tenant_id: string;
    connector_id: string;
    case_id?: string | null;
    directory_key: string;
    sam_account_name?: string | null;
    user_principal_name?: string | null;
    object_guid?: string | null;
    account_enabled: boolean;
    user_account_control?: number | null;
    last_logon_at?: string | null;
    member_of?: string[];
    distinguished_name?: string | null;
    cloud_account_enabled?: boolean | null;
  }): AdDirectorySnapshot {
    const state = getState();
    const connector = state.adConnectors.find(
      (c) => c.id === input.connector_id && c.tenant_id === input.tenant_id,
    );
    if (!connector) throw new Error("Unknown connector for tenant.");
    if (connector.status === "revoked") {
      throw new Error("Connector certificate revoked.");
    }
    if (input.case_id) {
      const c = caseInScope(state, input.case_id, connector.org_id);
      if (!c) throw new Error("Case not in connector tenant scope.");
    }
    const cloud = input.cloud_account_enabled ?? null;
    const mismatch = detectHybridMismatch(cloud, input.account_enabled);
    const snapshot: AdDirectorySnapshot = {
      id: randomUUID(),
      tenant_id: input.tenant_id,
      org_id: connector.org_id,
      connector_id: connector.id,
      case_id: input.case_id ?? null,
      directory_key: input.directory_key,
      sam_account_name: input.sam_account_name ?? null,
      user_principal_name: input.user_principal_name ?? null,
      object_guid: input.object_guid ?? null,
      account_enabled: input.account_enabled,
      user_account_control: input.user_account_control ?? null,
      last_logon_at: input.last_logon_at ?? null,
      member_of: input.member_of ?? [],
      distinguished_name: input.distinguished_name ?? null,
      cloud_account_enabled: cloud,
      hybrid_mismatch: mismatch,
      collected_at: new Date().toISOString(),
    };
    state.adSnapshots.push(snapshot);
    appendAudit(state, {
      org_id: connector.org_id,
      case_id: snapshot.case_id,
      actor_id: null,
      actor_email: "system",
      event_type: mismatch
        ? "directory.hybrid_mismatch"
        : "directory.ad.snapshot",
      payload: {
        snapshot_id: snapshot.id,
        directory_key: snapshot.directory_key,
        account_enabled: snapshot.account_enabled,
        cloud_account_enabled: cloud,
        hybrid_mismatch: mismatch,
      },
    });
    return snapshot;
  },

  getLatestAdSnapshotForCase(
    caseId: string,
    sessionOrgId: string,
  ): AdDirectorySnapshot | null {
    const state = getState();
    if (!caseInScope(state, caseId, sessionOrgId)) return null;
    const rows = state.adSnapshots
      .filter((s) => s.case_id === caseId)
      .sort((a, b) => b.collected_at.localeCompare(a.collected_at));
    return rows[0] ?? null;
  },

  getCaseDirectoryStatus(
    caseId: string,
    sessionOrgId: string,
  ): CaseDirectoryStatus | null {
    const state = getState();
    const c = caseInScope(state, caseId, sessionOrgId);
    if (!c) return null;
    const snap = this.getLatestAdSnapshotForCase(caseId, sessionOrgId);
    const connector = snap
      ? state.adConnectors.find((x) => x.id === snap.connector_id)
      : null;

    // Demo / Phase 3 stub: prefer snapshot cloud side, else assume unknown
    const cloudEnabled = snap?.cloud_account_enabled ?? null;
    const adEnabled = snap?.account_enabled ?? null;
    const mismatch = detectHybridMismatch(cloudEnabled, adEnabled);

    return {
      employee_email: c.employee_email,
      cloud: {
        source: snap ? "demo" : "unknown",
        account_enabled: cloudEnabled,
        label:
          cloudEnabled == null
            ? "Cloud status unknown"
            : cloudEnabled
              ? "Cloud (Entra): Enabled"
              : "Cloud (Entra): Disabled",
      },
      ad: {
        source: snap ? "demo" : "none",
        account_enabled: adEnabled,
        sam_account_name: snap?.sam_account_name ?? null,
        last_logon_at: snap?.last_logon_at ?? null,
        member_of: snap?.member_of ?? [],
        collected_at: snap?.collected_at ?? null,
        connector_hostname: connector?.hostname ?? null,
        label:
          adEnabled == null
            ? "On-prem AD: No snapshot"
            : adEnabled
              ? "On-prem AD: Enabled"
              : "On-prem AD: Disabled",
      },
      hybrid_mismatch: mismatch,
      mismatch_message: mismatch
        ? hybridMismatchMessage(c.employee_email)
        : null,
    };
  },

  // --- Phase 2: GridLogic operator console ---

  getOperatorStaff(userId: string): OperatorStaff | null {
    const state = getState();
    return (
      state.operatorStaff.find((s) => s.user_id === userId && s.active) ?? null
    );
  },

  listAllOrgs(): Organization[] {
    return getState()
      .orgs.filter((o) => !o.parent_org_id)
      .map((o) => normalizeMonthlyUsage(o))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  getOrgById(orgId: string): Organization | null {
    const org = getState().orgs.find((o) => o.id === orgId) ?? null;
    return org ? normalizeMonthlyUsage(org) : null;
  },

  listJitGrantsForStaff(staffUserId: string): JitAccessGrant[] {
    const state = getState();
    const now = new Date();
    return state.jitGrants
      .filter((g) => g.staff_user_id === staffUserId)
      .map((g) => {
        const status = effectiveJitStatus(g, now);
        if (status !== g.status) g.status = status;
        return g;
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  listJitGrantsForOrg(orgId: string): JitAccessGrant[] {
    const state = getState();
    const now = new Date();
    return state.jitGrants
      .filter((g) => g.org_id === orgId)
      .map((g) => {
        const status = effectiveJitStatus(g, now);
        if (status !== g.status) g.status = status;
        return g;
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  createJitGrant(input: {
    org: Organization;
    staffUserId: string;
    staffEmail: string;
    ticketId: string;
    reason: string | null;
    expiresAt: string;
    activate: boolean;
  }): JitAccessGrant {
    const state = getState();
    const now = new Date().toISOString();
    const grant: JitAccessGrant = {
      id: randomUUID(),
      org_id: input.org.id,
      tenant_id: input.org.tenant_id ?? input.org.id,
      staff_user_id: input.staffUserId,
      staff_email: input.staffEmail,
      ticket_id: input.ticketId,
      reason: input.reason,
      status: input.activate ? "active" : "requested",
      requested_at: now,
      activated_at: input.activate ? now : null,
      expires_at: input.expiresAt,
      revoked_at: null,
      revoked_by: null,
      created_at: now,
    };
    state.jitGrants.push(grant);
    return grant;
  },

  revokeJitGrant(grantId: string, actorUserId: string): JitAccessGrant {
    const state = getState();
    const grant = state.jitGrants.find((g) => g.id === grantId);
    if (!grant) throw new Error("JIT grant not found");
    grant.status = "revoked";
    grant.revoked_at = new Date().toISOString();
    grant.revoked_by = actorUserId;
    return grant;
  },

  appendOperatorAudit(
    partial: Omit<AuditEvent, "id" | "created_at">,
  ): void {
    appendAudit(getState(), partial);
  },

  provisionCustomer(input: {
    name: string;
    entraTenantId: string;
    stack: StackProfile;
    ssoEnforced: boolean;
    frameworks: string[];
    ownerEmail: string;
    actor: SessionUser;
  }): Organization {
    const state = getState();
    const orgId = randomUUID();
    const org: Organization = {
      id: orgId,
      tenant_id: orgId,
      name: input.name,
      stack_profile: input.stack,
      plan: "growth",
      stripe_customer_id: null,
      stripe_subscription_id: null,
      parent_org_id: null,
      retention_days: PLANS.growth.retentionDays,
      offboards_this_month: 0,
      offboards_month_key: monthKey(),
      trial_offboards_used: 0,
      created_at: new Date().toISOString(),
      selected_frameworks: [...input.frameworks],
      entra_tenant_id: input.entraTenantId,
      sso_enforced: input.ssoEnforced,
      onboarding_completed_at: new Date().toISOString(),
      graph_consent_status: "not_started",
      graph_consented_at: null,
      graph_last_sync_at: null,
      auto_evidence_enabled: false,
      hybrid_ad_enabled: false,
      ad_auto_evidence_enabled: false,
      require_human_attest_on_critical: true,
    };
    state.orgs.push(org);

    // Owner invite (demo: create user + membership)
    this.inviteMember(org.id, input.ownerEmail, "admin");
    const member = state.members.find(
      (m) =>
        m.org_id === org.id &&
        m.email.toLowerCase() === input.ownerEmail.toLowerCase(),
    );
    if (member) member.role = "owner";

    appendAudit(state, {
      org_id: org.id,
      case_id: null,
      actor_id: input.actor.id,
      actor_email: input.actor.email,
      event_type: "operator.customer_onboarded",
      payload: {
        entra_tenant_id: input.entraTenantId,
        sso_enforced: input.ssoEnforced,
        owner_email: input.ownerEmail,
      },
    });

    return org;
  },
};

