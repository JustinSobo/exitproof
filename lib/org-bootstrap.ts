import { createAdminClient } from "@/lib/supabase/admin";
import {
  isDomainJitAllowed,
  isGridLogicManaged,
} from "@/lib/env";

/** Domains that must never JIT-join an org (personal inboxes). */
const CONSUMER_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "ymail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "mail.com",
  "gmx.com",
  "gmx.net",
]);

export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain || null;
}

export function isConsumerEmailDomain(domain: string): boolean {
  return CONSUMER_EMAIL_DOMAINS.has(domain.toLowerCase());
}

function orgNameForBootstrap(email: string, fullName: string | null): string {
  const domain = emailDomain(email);
  if (domain && !isConsumerEmailDomain(domain)) {
    return domain;
  }
  const label = fullName?.trim() || email.split("@")[0] || "Workspace";
  return `${label}'s Organization`;
}

/**
 * Extract customer Entra directory (tenant) ID from OAuth claims / user metadata.
 * Supabase Azure provider may surface this as `custom_claims.tid` or `tid`.
 */
export function entraTenantIdFromUserMetadata(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  if (!metadata) return null;
  const direct = metadata.tid ?? metadata.tenant_id;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const claims = metadata.custom_claims;
  if (claims && typeof claims === "object" && !Array.isArray(claims)) {
    const tid = (claims as Record<string, unknown>).tid;
    if (typeof tid === "string" && tid.trim()) return tid.trim();
  }
  return null;
}

/**
 * After OAuth / magic-link session exchange: if the user has no membership,
 * resolve org via Entra tenant bind (GridLogic), optional domain JIT (legacy),
 * or bootstrap a new trial org (self-serve only — refused when GRIDLOGIC_MANAGED).
 */
export async function ensureOrgMembershipAfterAuth(params: {
  userId: string;
  email: string;
  fullName: string | null;
  /** Entra directory ID from IdP token (required path under GridLogic). */
  entraTenantId?: string | null;
}): Promise<"existing" | "joined" | "created"> {
  const email = params.email.trim().toLowerCase();
  if (!email) {
    throw new Error("Authenticated user has no email address.");
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("organization_members")
    .select("id")
    .eq("user_id", params.userId)
    .limit(1)
    .maybeSingle();

  if (existing) return "existing";

  const entraTenantId = params.entraTenantId?.trim() || null;

  // GridLogic / Entra-bound path: join the single org provisioned for this Entra tenant.
  if (entraTenantId && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = createAdminClient();
      const { data: orgs, error } = await admin
        .from("organizations")
        .select("id, entra_tenant_id, tenant_id")
        .eq("entra_tenant_id", entraTenantId)
        .limit(2);

      if (!error && orgs && orgs.length === 1) {
        const { error: joinError } = await admin
          .from("organization_members")
          .insert({
            org_id: orgs[0].id,
            user_id: params.userId,
            role: "member",
            email,
            full_name: params.fullName,
          });
        if (!joinError) return "joined";
        const { data: raced } = await supabase
          .from("organization_members")
          .select("id")
          .eq("user_id", params.userId)
          .limit(1)
          .maybeSingle();
        if (raced) return "joined";
      }
    } catch (err) {
      console.error("Entra tenant join failed", err);
    }
  }

  if (isGridLogicManaged()) {
    if (!entraTenantId) {
      throw new Error(
        "GridLogic mode requires an Entra tenant ID on the sign-in token. This workspace must be provisioned by GridLogic with entra_tenant_id bound — self-serve org bootstrap is disabled.",
      );
    }
    throw new Error(
      "No ExitProof tenant is provisioned for your Entra directory. Ask GridLogic to run provision-customer and bind entra_tenant_id before signing in.",
    );
  }

  // Legacy domain JIT — OFF by default; enable with ALLOW_DOMAIN_JIT=true only.
  const domain = emailDomain(email);
  if (
    isDomainJitAllowed() &&
    domain &&
    !isConsumerEmailDomain(domain) &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    try {
      const admin = createAdminClient();
      const { data: rows, error: lookupError } = await admin
        .from("organization_members")
        .select("org_id")
        .ilike("email", `%@${domain}`);

      if (!lookupError) {
        const orgIds = [
          ...new Set((rows ?? []).map((r) => r.org_id as string)),
        ];
        if (orgIds.length === 1) {
          const { error: joinError } = await admin
            .from("organization_members")
            .insert({
              org_id: orgIds[0],
              user_id: params.userId,
              role: "member",
              email,
              full_name: params.fullName,
            });
          if (!joinError) return "joined";
          // Unique race: another request may have inserted — treat as joined/existing.
          const { data: raced } = await supabase
            .from("organization_members")
            .select("id")
            .eq("user_id", params.userId)
            .limit(1)
            .maybeSingle();
          if (raced) return "joined";
        }
      }
    } catch (err) {
      console.error("Domain JIT join failed; falling back to bootstrap", err);
    }
  }

  const { error: orgError } = await supabase.rpc("bootstrap_organization", {
    p_name: orgNameForBootstrap(email, params.fullName),
    p_stack: "m365",
    p_full_name: params.fullName,
    p_email: email,
  });

  if (orgError) throw new Error(orgError.message);
  return "created";
}
