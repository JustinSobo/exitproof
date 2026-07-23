import { randomUUID } from "crypto";
import { canCreateClientOrg, canCreateOffboard, normalizeMonthlyUsage } from "@/lib/billing/gates";
import { PLANS } from "@/lib/billing/plans";
import { defaultTemplateForStack, getSeedTemplates, getTemplateById } from "@/lib/templates";
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

  for (const step of template.steps) {
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

export const demoStore = {
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

    const org: Organization = {
      id: randomUUID(),
      name: orgName || `${fullName}'s Organization`,
      stack_profile: "hybrid",
      plan: "trial",
      stripe_customer_id: null,
      stripe_subscription_id: null,
      parent_org_id: null,
      retention_days: PLANS.trial.retentionDays,
      offboards_this_month: 0,
      offboards_month_key: monthKey(),
      trial_offboards_used: 0,
      created_at: new Date().toISOString(),
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
      const org: Organization = {
        id: randomUUID(),
        name: `${user.full_name}'s Organization`,
        stack_profile: "hybrid",
        plan: "trial",
        stripe_customer_id: null,
        stripe_subscription_id: null,
        parent_org_id: null,
        retention_days: 90,
        offboards_this_month: 0,
        offboards_month_key: monthKey(),
        trial_offboards_used: 0,
        created_at: new Date().toISOString(),
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

  updateOrg(
    orgId: string,
    patch: Partial<Pick<Organization, "name" | "stack_profile" | "plan" | "stripe_customer_id" | "stripe_subscription_id" | "retention_days">>,
  ) {
    const state = getState();
    const org = state.orgs.find((o) => o.id === orgId);
    if (!org) throw new Error("Organization not found");
    Object.assign(org, patch);
    if (patch.plan) {
      org.retention_days = PLANS[patch.plan].retentionDays;
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
    const org: Organization = {
      id: randomUUID(),
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
    };
    state.orgs.push(org);
    return org;
  },

  listCases(orgId: string): OffboardingCase[] {
    const state = getState();
    const childIds = state.orgs
      .filter((o) => o.parent_org_id === orgId)
      .map((o) => o.id);
    const ids = new Set([orgId, ...childIds]);
    return state.cases
      .filter((c) => ids.has(c.org_id))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  getCase(caseId: string): OffboardingCase | null {
    return getState().cases.find((c) => c.id === caseId) ?? null;
  },

  getItems(caseId: string): ChecklistItem[] {
    return getState()
      .items.filter((i) => i.case_id === caseId)
      .sort((a, b) => a.sort_order - b.sort_order);
  },

  getEvidence(caseId: string): EvidenceFile[] {
    return getState().evidence.filter((e) => e.case_id === caseId);
  },

  getAudits(caseId: string): AuditEvent[] {
    return getState()
      .audits.filter((a) => a.case_id === caseId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },

  createCase(input: {
    orgId: string;
    user: SessionUser;
    employeeName: string;
    employeeEmail: string;
    templateId: string;
    assigneeEmail?: string;
    dueDate?: string;
    notes?: string;
  }) {
    const state = getState();
    const org = state.orgs.find((o) => o.id === input.orgId);
    if (!org) throw new Error("Organization not found");
    const normalized = normalizeMonthlyUsage(org);
    Object.assign(org, normalized);

    const gate = canCreateOffboard(org);
    if (!gate.allowed) throw new Error(gate.reason);

    const template =
      getTemplateById(input.templateId) ??
      defaultTemplateForStack(org.stack_profile);

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

    for (const step of template.steps) {
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
  ) {
    const state = getState();
    const c = state.cases.find((x) => x.id === caseId);
    if (!c) throw new Error("Case not found");
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
  ) {
    const state = getState();
    const item = state.items.find((i) => i.id === itemId);
    if (!item) throw new Error("Checklist item not found");
    const c = state.cases.find((x) => x.id === item.case_id);
    if (!c) throw new Error("Case not found");

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
  ) {
    const state = getState();
    const item = state.items.find((i) => i.id === itemId);
    if (!item) throw new Error("Checklist item not found");
    const c = state.cases.find((x) => x.id === item.case_id);
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
    };
    state.evidence.push(evidence);

    appendAudit(state, {
      org_id: c.org_id,
      case_id: c.id,
      actor_id: user.id,
      actor_email: user.email,
      event_type: "evidence.uploaded",
      payload: { item_id: itemId, file_name: fileName },
    });

    return evidence;
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
        if (item.is_critical && item.status !== "done") {
          results.push({ case: c, item, org });
        }
      }
    }
    return results;
  },
};
