export type StackProfile = "m365" | "google" | "hybrid";

export type PlanId = "trial" | "team" | "growth" | "agency";

export type CaseStatus = "open" | "in_progress" | "blocked" | "closed";

export type MemberRole = "owner" | "admin" | "member";

export type ChecklistItemStatus = "pending" | "done" | "skipped" | "blocked";

export interface Organization {
  id: string;
  name: string;
  stack_profile: StackProfile;
  plan: PlanId;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  parent_org_id: string | null;
  retention_days: number;
  offboards_this_month: number;
  offboards_month_key: string;
  trial_offboards_used: number;
  created_at: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: MemberRole;
  email: string;
  full_name: string | null;
}

export interface TemplateStep {
  id: string;
  title: string;
  description: string;
  sort_order: number;
  requires_evidence: boolean;
  is_critical: boolean;
  category: string;
}

export interface OffboardingTemplate {
  id: string;
  slug: string;
  name: string;
  stack: StackProfile;
  description: string;
  steps: TemplateStep[];
}

export interface OffboardingCase {
  id: string;
  org_id: string;
  employee_name: string;
  employee_email: string;
  status: CaseStatus;
  assignee_email: string | null;
  due_date: string | null;
  template_id: string;
  template_name: string;
  created_by: string;
  created_at: string;
  closed_at: string | null;
  notes: string | null;
}

export interface ChecklistItem {
  id: string;
  case_id: string;
  template_step_id: string | null;
  title: string;
  description: string;
  requires_evidence: boolean;
  is_critical: boolean;
  status: ChecklistItemStatus;
  notes: string | null;
  ticket_url: string | null;
  completed_at: string | null;
  completed_by: string | null;
  sort_order: number;
  category: string;
}

export interface EvidenceFile {
  id: string;
  checklist_item_id: string;
  case_id: string;
  org_id: string;
  file_name: string;
  storage_path: string;
  uploaded_by: string;
  created_at: string;
}

export interface AuditEvent {
  id: string;
  org_id: string;
  case_id: string | null;
  actor_id: string | null;
  actor_email: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface SessionUser {
  id: string;
  email: string;
  full_name?: string | null;
}
