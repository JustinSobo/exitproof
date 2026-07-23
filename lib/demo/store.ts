import { randomUUID } from "crypto";
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
    entra_tenant_id: null,
    onboarding_completed_at: new Date().toISOString(),
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
      status: step.sort_order === 1 ? "done" : "pending",
      notes: step.sort_order === 1 ? "Completed in demo seed." : null,
      ticket_url: null,
      completed_at: step.sort_order === 1 ? new Date().toISOString() : null,
      completed_by: step.sort_order === 1 ? user.email : null,
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
      assertCanCompleteItem(
        item,
        state.evidence.filter((e) => e.case_id === c.id),
        patch.ticket_url,
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
};
