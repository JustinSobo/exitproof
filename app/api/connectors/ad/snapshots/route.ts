import { NextResponse } from "next/server";
import { z } from "zod";
import {
  assertNoForbiddenAttributes,
  detectHybridMismatch,
} from "@/lib/connectors/ad";
import {
  normalizeThumbprint,
  parseConnectorAuth,
  verifyTokenHash,
} from "@/lib/connectors/ad-auth";
import { demoStore } from "@/lib/demo/store";
import { isDemoMode } from "@/lib/env";

/**
 * POST /api/connectors/ad/snapshots
 *
 * Ingest read-only AD account snapshot(s). Rejects forbidden attributes
 * (password hashes). Tenant scope from authenticated connector only.
 */

const snapshotSchema = z.object({
  case_id: z.string().nullable().optional(),
  directory_key: z.string().min(1).max(320),
  sam_account_name: z.string().max(256).nullable().optional(),
  user_principal_name: z.string().max(320).nullable().optional(),
  object_guid: z.string().max(64).nullable().optional(),
  account_enabled: z.boolean(),
  user_account_control: z.number().int().nullable().optional(),
  last_logon_at: z.string().datetime().nullable().optional(),
  member_of: z.array(z.string().max(1024)).max(200).optional(),
  distinguished_name: z.string().max(1024).nullable().optional(),
  cloud_account_enabled: z.boolean().nullable().optional(),
  raw_attributes: z.record(z.string(), z.unknown()).optional(),
});

const bodySchema = z.object({
  tenant_id: z.string().min(1),
  snapshots: z.array(snapshotSchema).min(1).max(100),
});

export async function POST(request: Request) {
  const auth = parseConnectorAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  for (const snap of parsed.data.snapshots) {
    if (snap.raw_attributes) {
      try {
        assertNoForbiddenAttributes(snap.raw_attributes);
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Forbidden attributes" },
          { status: 400 },
        );
      }
    }
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

    const ingested = [];
    try {
      for (const snap of parsed.data.snapshots) {
        ingested.push(
          demoStore.ingestAdSnapshot({
            tenant_id: parsed.data.tenant_id,
            connector_id: auth.connectorId,
            case_id: snap.case_id,
            directory_key: snap.directory_key,
            sam_account_name: snap.sam_account_name,
            user_principal_name: snap.user_principal_name,
            object_guid: snap.object_guid,
            account_enabled: snap.account_enabled,
            user_account_control: snap.user_account_control,
            last_logon_at: snap.last_logon_at,
            member_of: snap.member_of,
            distinguished_name: snap.distinguished_name,
            cloud_account_enabled: snap.cloud_account_enabled,
          }),
        );
      }
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Ingest failed" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      mode: "demo",
      count: ingested.length,
      snapshots: ingested.map((s) => ({
        id: s.id,
        directory_key: s.directory_key,
        account_enabled: s.account_enabled,
        hybrid_mismatch: s.hybrid_mismatch,
      })),
    });
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

  const rows = parsed.data.snapshots.map((snap) => {
    const cloud = snap.cloud_account_enabled ?? null;
    return {
      tenant_id: parsed.data.tenant_id,
      org_id: connector.org_id,
      connector_id: connector.id,
      case_id: snap.case_id ?? null,
      directory_key: snap.directory_key,
      sam_account_name: snap.sam_account_name ?? null,
      user_principal_name: snap.user_principal_name ?? null,
      object_guid: snap.object_guid ?? null,
      account_enabled: snap.account_enabled,
      user_account_control: snap.user_account_control ?? null,
      last_logon_at: snap.last_logon_at ?? null,
      member_of: snap.member_of ?? [],
      distinguished_name: snap.distinguished_name ?? null,
      cloud_account_enabled: cloud,
      hybrid_mismatch: detectHybridMismatch(cloud, snap.account_enabled),
      raw_attributes: snap.raw_attributes ?? {},
      collected_at: new Date().toISOString(),
    };
  });

  const { data: inserted, error } = await admin
    .from("ad_directory_snapshots")
    .insert(rows)
    .select("id, directory_key, account_enabled, hybrid_mismatch");

  if (error) {
    return NextResponse.json(
      { error: error.message, hint: "Apply migration 009_ad_connector.sql" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    mode: "live",
    count: inserted?.length ?? 0,
    snapshots: inserted,
  });
}
