/**
 * Unit tests for Phase 3 Graph RO connector (no network).
 */
import { describe, expect, it } from "vitest";
import {
  DemoGraphClient,
  attachGraphAutoEvidence,
  buildAdminConsentUrl,
  buildGraphSnapshotEvidencePayload,
  entraAccountMismatch,
  graphCredsSecretName,
  graphCredsSecretRef,
  pickAutoEvidenceTarget,
  runDirectorySnapshot,
} from "@/lib/connectors/graph";
import type { ChecklistItem, EvidenceFile, SessionUser } from "@/lib/types";

describe("buildAdminConsentUrl", () => {
  it("builds tenant-scoped adminconsent URL", () => {
    const url = buildAdminConsentUrl({
      clientId: "app-client-id",
      customerEntraTenantId: "cust-tid-guid",
      redirectUri: "http://localhost:3000/connectors?consent=1",
      state: "ep-tenant-1",
    });
    expect(url).toContain(
      "https://login.microsoftonline.com/cust-tid-guid/adminconsent?",
    );
    expect(url).toContain("client_id=app-client-id");
    expect(url).toContain(
      encodeURIComponent("http://localhost:3000/connectors?consent=1"),
    );
    expect(url).toContain("state=ep-tenant-1");
  });

  it("rejects empty client or tenant", () => {
    expect(() =>
      buildAdminConsentUrl({
        clientId: "",
        customerEntraTenantId: "x",
      }),
    ).toThrow(/clientId/);
    expect(() =>
      buildAdminConsentUrl({
        clientId: "x",
        customerEntraTenantId: "  ",
      }),
    ).toThrow(/customerEntraTenantId/);
  });
});

describe("Key Vault secret ref", () => {
  it("names secrets per tenant", () => {
    expect(graphCredsSecretName("demo-org-1")).toBe("graph-creds-demo-org-1");
    const ref = graphCredsSecretRef("abc", {
      vaultUri: "https://kv.example.vault.azure.net/",
    });
    expect(ref.secretName).toBe("graph-creds-abc");
    expect(ref.vaultUri).toBe("https://kv.example.vault.azure.net");
  });
});

describe("DemoGraphClient + snapshot", () => {
  it("marks seeded leaver as still enabled", async () => {
    const client = new DemoGraphClient();
    const user = await client.getUserByEmail("jordan.lee@northwind.example");
    expect(user?.accountEnabled).toBe(true);

    const snap = await runDirectorySnapshot({
      tenantId: "demo-org-1",
      customerEntraTenantId: "demo-entra-tid",
      consentStatus: "healthy",
      leaverEmail: "jordan.lee@northwind.example",
      client,
    });
    expect(snap.accountStillEnabled).toBe(true);
    expect(entraAccountMismatch(snap).mismatch).toBe(true);
  });

  it("treats disabled* emails as disabled", async () => {
    const snap = await runDirectorySnapshot({
      tenantId: "t1",
      customerEntraTenantId: "tid",
      consentStatus: "healthy",
      leaverEmail: "disabled.user@example.com",
      client: new DemoGraphClient(),
    });
    expect(snap.accountStillEnabled).toBe(false);
    expect(entraAccountMismatch(snap).mismatch).toBe(false);
  });

  it("skips snapshot work when consent not started", async () => {
    const snap = await runDirectorySnapshot({
      tenantId: "t1",
      customerEntraTenantId: null,
      consentStatus: "not_started",
      leaverEmail: "a@b.com",
    });
    expect(snap.user).toBeNull();
    expect(snap.note).toMatch(/consent not started/i);
  });
});

describe("auto-evidence", () => {
  const actor: SessionUser = {
    id: "u1",
    email: "demo@exitproof.app",
  };

  const items: ChecklistItem[] = [
    {
      id: "item-disable",
      case_id: "c1",
      template_step_id: null,
      title: "Disable primary IdP account (Entra / Google / Okta)",
      description: "Disable",
      requires_evidence: true,
      is_critical: true,
      status: "pending",
      notes: null,
      ticket_url: null,
      completed_at: null,
      completed_by: null,
      sort_order: 1,
      category: "Identity",
    },
  ];

  it("picks disable identity step", () => {
    expect(pickAutoEvidenceTarget(items)?.id).toBe("item-disable");
  });

  it("hashes snapshot JSON and persists when flag on", async () => {
    const snap = await runDirectorySnapshot({
      tenantId: "t1",
      customerEntraTenantId: "tid",
      consentStatus: "healthy",
      leaverEmail: "jordan.lee@northwind.example",
      client: new DemoGraphClient(),
    });
    const payload = buildGraphSnapshotEvidencePayload(snap);
    expect(payload.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(payload.mimeType).toBe("application/json");

    const result = await attachGraphAutoEvidence({
      items,
      existingEvidence: [],
      snapshot: snap,
      autoEvidenceEnabled: true,
      actor,
      orgId: "org-1",
      caseId: "c1",
      persist: async (input) =>
        ({
          id: "ev-1",
          checklist_item_id: input.itemId,
          case_id: "c1",
          org_id: "org-1",
          file_name: input.fileName,
          storage_path: input.storagePath,
          uploaded_by: actor.email,
          created_at: new Date().toISOString(),
          content_hash: input.contentHash,
          mime_type: input.mimeType,
          byte_size: input.byteSize,
        }) satisfies EvidenceFile,
    });

    expect(result.attached).toBe(true);
    expect(result.contentHash).toBe(payload.contentHash);
    expect(result.evidence?.file_name.startsWith("graph-snapshot-")).toBe(true);
  });

  it("skips when auto_evidence_enabled is false", async () => {
    const snap = await runDirectorySnapshot({
      tenantId: "t1",
      customerEntraTenantId: "tid",
      consentStatus: "healthy",
      leaverEmail: "a@b.com",
      client: new DemoGraphClient(),
    });
    const result = await attachGraphAutoEvidence({
      items,
      existingEvidence: [],
      snapshot: snap,
      autoEvidenceEnabled: false,
      actor,
      orgId: "org-1",
      caseId: "c1",
      persist: async () => {
        throw new Error("should not persist");
      },
    });
    expect(result.attached).toBe(false);
    expect(result.skippedReason).toMatch(/auto_evidence_enabled/);
  });
});
