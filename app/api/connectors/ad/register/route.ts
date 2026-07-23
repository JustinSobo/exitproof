import { NextResponse } from "next/server";
import { z } from "zod";
import {
  hashRegistrationToken,
  normalizeThumbprint,
} from "@/lib/connectors/ad-auth";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";

/**
 * POST /api/connectors/ad/register
 *
 * GridLogic / bootstrap issues a registration payload to the Windows agent.
 * Production path: mTLS client cert + registration token minted at provision.
 * Demo: accepts body and stores in-memory connector (tenant-scoped).
 *
 * SECURITY: tenant_id must match an existing org; never invent cross-tenant rows.
 */

const bodySchema = z.object({
  tenant_id: z.string().min(1),
  org_id: z.string().min(1),
  display_name: z.string().min(1).max(200).optional(),
  hostname: z.string().max(255).nullable().optional(),
  cert_thumbprint: z.string().min(16).max(128),
  registration_token: z.string().min(16).max(256),
  ou_scopes: z.array(z.string().max(512)).max(50).optional(),
  agent_version: z.string().max(64).nullable().optional(),
  /** Bootstrap secret for first registration (GridLogic ops). */
  provision_secret: z.string().optional(),
});

function authorizeProvision(request: Request, bodySecret?: string): boolean {
  const header = request.headers.get("authorization");
  const secret = process.env.CONNECTOR_PROVISION_SECRET;
  if (isDemoMode() && !secret) return true;
  if (!secret) return false;
  const bearer =
    header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
  return bearer === secret || bodySecret === secret;
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (!authorizeProvision(request, parsed.data.provision_secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (parsed.data.tenant_id !== parsed.data.org_id && !isDemoMode()) {
    // Soft check: live path should verify org.tenant_id === body.tenant_id via DB.
  }

  const thumb = normalizeThumbprint(parsed.data.cert_thumbprint);

  if (isDemoMode()) {
    try {
      const connector = demoStore.registerAdConnector({
        tenant_id: parsed.data.tenant_id,
        org_id: parsed.data.org_id,
        display_name: parsed.data.display_name,
        hostname: parsed.data.hostname,
        cert_thumbprint: thumb,
        registration_token: parsed.data.registration_token,
        ou_scopes: parsed.data.ou_scopes,
        agent_version: parsed.data.agent_version,
      });
      return NextResponse.json({
        mode: "demo",
        connector: {
          id: connector.id,
          tenant_id: connector.tenant_id,
          status: connector.status,
          cert_thumbprint: connector.cert_thumbprint,
          ou_scopes: connector.ou_scopes,
        },
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Register failed" },
        { status: 400 },
      );
    }
  }

  // Live stub: persist via admin client when migration 009 applied.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("id, tenant_id")
    .eq("id", parsed.data.org_id)
    .maybeSingle();

  if (orgErr || !org) {
    return NextResponse.json({ error: "Unknown org" }, { status: 404 });
  }
  if ((org.tenant_id ?? org.id) !== parsed.data.tenant_id) {
    return NextResponse.json(
      { error: "tenant_id mismatch for org" },
      { status: 403 },
    );
  }

  const tokenHash = hashRegistrationToken(parsed.data.registration_token);
  const { data: row, error } = await admin
    .from("ad_connectors")
    .upsert(
      {
        tenant_id: parsed.data.tenant_id,
        org_id: parsed.data.org_id,
        display_name: parsed.data.display_name ?? "ExitProof Hybrid Connector",
        hostname: parsed.data.hostname ?? null,
        cert_thumbprint: thumb,
        registration_token_hash: tokenHash,
        status: "active",
        ou_scopes: parsed.data.ou_scopes ?? [],
        agent_version: parsed.data.agent_version ?? null,
        revoked_at: null,
      },
      { onConflict: "tenant_id,cert_thumbprint" },
    )
    .select("id, tenant_id, status, cert_thumbprint, ou_scopes")
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message, hint: "Apply migration 009_ad_connector.sql" },
      { status: 500 },
    );
  }

  return NextResponse.json({ mode: "live", connector: row });
}
