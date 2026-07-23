import type { Organization, SessionUser } from "@/lib/types";

export type JitGrantStatus = "requested" | "active" | "revoked" | "expired";

export interface OperatorStaff {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  active: boolean;
  created_at: string;
}

export interface JitAccessGrant {
  id: string;
  org_id: string;
  tenant_id: string;
  staff_user_id: string;
  staff_email: string;
  ticket_id: string;
  reason: string | null;
  status: JitGrantStatus;
  requested_at: string;
  activated_at: string | null;
  expires_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  created_at: string;
}

/** Graph consent health (Phase 3) — mapped from organizations.graph_consent_status. */
export type ConsentHealthStatus =
  | "not_configured"
  | "pending"
  | "healthy"
  | "revoked"
  | "error";

/** Placeholder until Phase 4 Hybrid AD connector. */
export type ConnectorHealthStatus =
  | "not_installed"
  | "pending"
  | "healthy"
  | "stale"
  | "revoked"
  | "error";

export interface TenantHealthPlaceholders {
  graph_consent: ConsentHealthStatus;
  ad_connector: ConnectorHealthStatus;
  note: string;
}

export interface OperatorTenantSummary {
  org: Organization;
  health: TenantHealthPlaceholders;
  active_jit: JitAccessGrant | null;
}

export interface OperatorContext {
  user: SessionUser;
  staff: OperatorStaff;
  /** Cookie-selected org for operator console (audited on change). */
  activeOrgId: string | null;
  activeOrg: Organization | null;
  activeGrant: JitAccessGrant | null;
}

export const OPERATOR_ACTIVE_ORG_COOKIE = "ep_operator_org";

export const DEFAULT_JIT_HOURS = 4;
export const MAX_JIT_HOURS = 72;
