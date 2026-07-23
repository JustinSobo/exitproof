/**
 * Per-tenant incident kill switch (Phase 6).
 * @see docs/security/kill-switch.md
 */

import type { Organization } from "@/lib/types";

export type KillSwitchFlags = {
  login_frozen: boolean;
  connectors_disabled: boolean;
};

export const LOGIN_FROZEN_MESSAGE =
  "This workspace is temporarily frozen by GridLogic. Contact your administrator.";

export const CONNECTORS_DISABLED_MESSAGE =
  "Connectors disabled for this tenant (kill switch).";

export function killSwitchOf(
  org: Pick<Organization, "login_frozen" | "connectors_disabled">,
): KillSwitchFlags {
  return {
    login_frozen: Boolean(org.login_frozen),
    connectors_disabled: Boolean(org.connectors_disabled),
  };
}

export function isLoginFrozen(
  org: Pick<Organization, "login_frozen"> | null | undefined,
): boolean {
  return Boolean(org?.login_frozen);
}

export function areConnectorsDisabled(
  org: Pick<Organization, "connectors_disabled"> | null | undefined,
): boolean {
  return Boolean(org?.connectors_disabled);
}

/** True when either kill-switch flag is on. */
export function isKillSwitchActive(
  org: Pick<Organization, "login_frozen" | "connectors_disabled"> | null | undefined,
): boolean {
  if (!org) return false;
  return isLoginFrozen(org) || areConnectorsDisabled(org);
}
