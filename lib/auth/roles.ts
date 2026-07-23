import type { MemberRole } from "@/lib/types";

/** Owners and admins can manage org settings, billing, clients, and members. */
export function isOrgAdminRole(role: MemberRole): boolean {
  return role === "owner" || role === "admin";
}

export const ORG_ADMIN_REQUIRED_MESSAGE =
  "Only organization owners and admins can perform this action.";
