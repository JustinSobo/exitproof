import { NextResponse } from "next/server";
import { z } from "zod";
import {
  normalizeThumbprint,
  parseConnectorAuth,
  verifyTokenHash,
} from "@/lib/connectors/ad-auth";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";

/**
 * POST /api/connectors/ad/heartbeat
 *
 * Outbound agent heartbeat. Auth: client cert thumbprint + registration token
 * (mTLS stub headers). Tenant scope comes from the registered connector row.
 */

const bodySchema = z.object({
  tenant_id: z.string().min(1),
  agent_version: z.string().max(64).optional(),
  hostname: z.string().max(255).optional(),
  metrics: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const auth = parseConnectorAuth(request);
  if (!auth) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        hint: "Require X-ExitProof-Connector-Id, X-ExitProof-Cert-Thumbprint, Authorization: Bearer <token>",
      },
      { status: 401 },
    );
  }

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

  if (isDemoMode()) {
    const connector = demoStore.getAdConnector(auth.connectorId);
    const tokenHash = demoStore.getAdConnectorTokenHash(auth.connectorId);
    if (
      !connector ||
      !tokenHash ||
      connector.cert_thumbprint !==
        normalizeThumbprint(auth.certThumbprint) ||
      !verifyTokenHash(auth.registrationToken, tokenHash)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (connector.tenant_id !== parsed.data.tenant_id) {
      return NextResponse.json(
        { error: "tenant_id mismatch" },
        { status: 403 },
      );
    }
    if (connector.status === "revoked") {
      return NextResponse.json(
        { error: "Certificate revoked", stop: true },
        { status: 403 },
      );
    }
    try {
      const updated = demoStore.heartbeatAdConnector(auth.connectorId, {
        agent_version: parsed.data.agent_version,
        hostname: parsed.data.hostname,
        metrics: parsed.data.metrics,
      });
      return NextResponse.json({
        mode: "demo",
        ok: true,
        last_heartbeat_at: updated.last_heartbeat_at,
        status: updated.status,
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Heartbeat failed" },
        { status: 403 },
      );
    }
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data: connector } = await admin
    .from("ad_connectors")
    .select("*")
    .eq("id", auth.connectorId)
    .maybeSingle();

  if (
    !connector ||
    connector.cert_thumbprint !== normalizeThumbprint(auth.certThumbprint) ||
    !verifyTokenHash(auth.registrationToken, connector.registration_token_hash)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (connector.tenant_id !== parsed.data.tenant_id) {
    return NextResponse.json({ error: "tenant_id mismatch" }, { status: 403 });
  }
  if (connector.status === "revoked" || connector.revoked_at) {
    return NextResponse.json(
      { error: "Certificate revoked", stop: true },
      { status: 403 },
    );
  }

  const { data: updated, error } = await admin
    .from("ad_connectors")
    .update({
      last_heartbeat_at: new Date().toISOString(),
      last_heartbeat_payload: parsed.data,
      agent_version: parsed.data.agent_version ?? connector.agent_version,
      hostname: parsed.data.hostname ?? connector.hostname,
      status: "active",
    })
    .eq("id", connector.id)
    .select("last_heartbeat_at, status")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    mode: "live",
    ok: true,
    last_heartbeat_at: updated.last_heartbeat_at,
    status: updated.status,
  });
}
