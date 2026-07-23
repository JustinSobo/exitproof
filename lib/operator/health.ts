import type { Organization } from "@/lib/types";
import type {
  ConsentHealthStatus,
  TenantHealthPlaceholders,
} from "@/lib/operator/types";

/**
 * Map org Graph consent (Phase 3) into operator health.
 * AD connector remains Phase 4 placeholder unless wired.
 */
export function tenantHealthFromOrg(
  org: Pick<
    Organization,
    "graph_consent_status" | "hybrid_ad_enabled"
  >,
): TenantHealthPlaceholders {
  return {
    graph_consent: mapGraphConsent(org.graph_consent_status),
    ad_connector: org.hybrid_ad_enabled ? "not_installed" : "not_installed",
    note: "Graph consent from organizations.graph_consent_status (Phase 3). AD connector health lands in Phase 4.",
  };
}

function mapGraphConsent(
  status: Organization["graph_consent_status"],
): ConsentHealthStatus {
  switch (status) {
    case "healthy":
      return "healthy";
    case "pending":
      return "pending";
    case "revoked":
      return "revoked";
    case "error":
      return "error";
    case "not_started":
    default:
      return "not_configured";
  }
}

/**
 * Phase 2 placeholders — prefer tenantHealthFromOrg when org row is available.
 */
export function placeholderTenantHealth(): TenantHealthPlaceholders {
  return {
    graph_consent: "not_configured",
    ad_connector: "not_installed",
    note: "Consent and connector health land in Phase 3 (Graph) and Phase 4 (Hybrid AD). Values here are placeholders only.",
  };
}
