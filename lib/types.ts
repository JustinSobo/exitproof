export type StackProfile = "m365" | "google" | "hybrid";

export type PlanId = "trial" | "team" | "growth" | "agency";

export type CaseStatus = "open" | "in_progress" | "blocked" | "closed";

export type MemberRole = "owner" | "admin" | "member";

export type ChecklistItemStatus = "pending" | "done" | "skipped" | "blocked";

/** Entra admin consent health for GridLogic Graph RO multi-tenant app (Phase 3). */
export type GraphConsentStatus =
  | "not_started"
  | "pending"
  | "healthy"
  | "revoked"
  | "error";

export interface Organization {
  id: string;
  name: string;
  /**
   * Immutable tenant isolation key (Phase 1). Defaults to `id` when backfilled.
   * ALWAYS resolve from session (getCurrentOrg), never from client body alone.
   * @see lib/tenancy.ts
   */
  tenant_id?: string;
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
  /** Framework slugs the org targets (FedRAMP, CMMC, SOC 2, …). */
  selected_frameworks?: string[];
  /** Customer Entra directory ID — required under GRIDLOGIC_MANAGED. */
  entra_tenant_id?: string | null;
  /**
   * When true, customer workspace expects Entra SSO (GridLogic onboard wizard).
   * Password login remains break-glass until fully enforced.
   */
  sso_enforced?: boolean;
  onboarding_completed_at?: string | null;
  /** Graph RO connector consent health (migration 007). */
  graph_consent_status?: GraphConsentStatus;
  graph_consented_at?: string | null;
  graph_last_sync_at?: string | null;
  /** When true, Graph snapshots may attach hashed system-collected evidence. */
  auto_evidence_enabled?: boolean;
  /** SKU add-on: Hybrid AD Audit (Phase 4). */
  hybrid_ad_enabled?: boolean;
  /** Optional system-collected AD evidence jobs (Phase 4 stub). */
  ad_auto_evidence_enabled?: boolean;
  /**
   * Phase 5: when true (default), critical checklist steps cannot be marked
   * done on system-collected evidence alone — human file or ticket required.
   */
  require_human_attest_on_critical?: boolean;
}

export type {
  AdConnector,
  AdConnectorStatus,
  AdDirectorySnapshot,
  CaseDirectoryStatus,
} from "@/lib/connectors/ad";

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
  /** Control keys like `soc2:CC6.2` — see lib/compliance. */
  controlRefs: string[];
  evidenceHint: string;
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
  /** Copied from template at case create. */
  evidence_hint?: string | null;
  /** Snapshot of control keys at case create (immutable for the case). */
  control_refs?: string[];
  /** Overdue notification dedupe (Phase E / B7). */
  notified_at?: string | null;
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
  content_hash?: string | null;
  mime_type?: string | null;
  byte_size?: number | null;
  /**
   * Evidence Pack v3 provenance. Prefer this when set; otherwise derive from
   * uploaded_by / path (`lib/evidence/collection-source`).
   */
  collection_source?: "human" | "system:graph" | "system:ad" | "system" | null;
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
