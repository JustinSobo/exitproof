#!/usr/bin/env npx tsx
/**
 * GridLogic operator CLI stub — Provision Customer checklist (Phase 1).
 *
 * Dry-run by default: prints the runbook steps and metadata that would be
 * created. Does NOT call Azure or mutate the database yet.
 *
 * Usage:
 *   npm run provision -- --dry-run --name "Acme Corp" --sku standard \
 *     --entra-tenant-id "11111111-1111-1111-1111-111111111111"
 *
 *   npm run provision -- --help
 */

import { randomUUID } from "node:crypto";

type Sku = "standard" | "dedicated";

interface Args {
  dryRun: boolean;
  name: string | null;
  sku: Sku;
  entraTenantId: string | null;
  slug: string | null;
  help: boolean;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    dryRun: true,
    name: null,
    sku: "standard",
    entraTenantId: null,
    slug: null,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--apply") out.dryRun = false;
    else if (a === "--name") out.name = argv[++i] ?? null;
    else if (a === "--sku") {
      const v = (argv[++i] ?? "").toLowerCase();
      if (v !== "standard" && v !== "dedicated") {
        throw new Error(`Invalid --sku ${v}; use standard|dedicated`);
      }
      out.sku = v;
    } else if (a === "--entra-tenant-id") out.entraTenantId = argv[++i] ?? null;
    else if (a === "--slug") out.slug = argv[++i] ?? null;
    else if (a.startsWith("-")) {
      throw new Error(`Unknown flag: ${a}`);
    }
  }
  return out;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20) || "customer";
}

function printHelp(): void {
  console.log(`ExitProof — provision-customer (Phase 1 stub)

Creates tenant metadata checklist for GridLogic operators.
Default is --dry-run (no Azure / DB writes).

Options:
  --name <string>              Customer display name (required)
  --sku standard|dedicated     Isolation SKU (default: standard)
  --entra-tenant-id <guid>     Customer Entra directory ID (required)
  --slug <string>              Short slug for dedicated RG names
  --dry-run                    Print checklist only (default)
  --apply                      Reserved — not implemented in Phase 1
  --help                       Show this help
`);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!args.name?.trim()) {
    console.error("Error: --name is required\n");
    printHelp();
    process.exit(1);
  }
  if (!args.entraTenantId?.trim()) {
    console.error(
      "Error: --entra-tenant-id is required (replaces insecure domain JIT)\n",
    );
    printHelp();
    process.exit(1);
  }

  if (!args.dryRun) {
    console.error(
      "Error: --apply is not implemented in Phase 1. Use --dry-run and execute IaC/runbook manually.",
    );
    process.exit(1);
  }

  const tenantId = randomUUID();
  const slug = args.slug?.trim() || slugify(args.name);
  const blobPrefix = `tenants/${tenantId}/`;
  const cmkName = `cmk-${tenantId}`;
  const schemaName = `tenant_${tenantId.replace(/-/g, "_")}`;
  const bicepModule =
    args.sku === "dedicated"
      ? "infra/modules/tenant-dedicated"
      : "infra/modules/tenant-standard";

  const checklist = {
    mode: "dry-run",
    generated_at: new Date().toISOString(),
    tenant: {
      tenant_id: tenantId,
      name: args.name.trim(),
      sku: args.sku,
      entra_tenant_id: args.entraTenantId.trim(),
      customer_slug: slug,
      blob_prefix: blobPrefix,
      cmk_name: cmkName,
      sql_schema: schemaName,
    },
    steps: [
      {
        step: 1,
        title: "Create platform metadata row",
        detail: `Insert organizations row with tenant_id=${tenantId}, entra_tenant_id=${args.entraTenantId}, name=${args.name}`,
        status: "pending_manual",
      },
      {
        step: 2,
        title: "Allocate data plane",
        detail:
          args.sku === "standard"
            ? `Shared platform: schema ${schemaName}, blob prefix ${blobPrefix}, Key Vault key ${cmkName}`
            : `Dedicated RG rg-exitproof-${slug}: SQL + storage + Key Vault (see ${bicepModule})`,
        status: "pending_manual",
        iac: bicepModule,
      },
      {
        step: 3,
        title: "Issue tenant CMK",
        detail: `Create Key Vault key ${cmkName}; encrypt evidence blobs under ${blobPrefix}`,
        status: "pending_manual",
      },
      {
        step: 4,
        title: "Bind Entra tenant",
        detail: `Set organizations.entra_tenant_id=${args.entraTenantId} (required; domain JIT disabled under GRIDLOGIC_MANAGED)`,
        status: "pending_manual",
      },
      {
        step: 5,
        title: "Break-glass + owner invite",
        detail:
          "Create time-boxed GridLogic JIT admin (Phase 2) + invite customer owner",
        status: "pending_phase2",
      },
      {
        step: 6,
        title: "Onboarding checklist",
        detail:
          "Emit: Graph app consent (Phase 3), optional Hybrid Connector (Phase 4), SSO enforce",
        status: "pending_later_phase",
      },
    ],
  };

  console.log(JSON.stringify(checklist, null, 2));
  console.log("\n# Operator summary");
  console.log(`Tenant ID:        ${tenantId}`);
  console.log(`Customer:         ${args.name}`);
  console.log(`SKU:              ${args.sku}`);
  console.log(`Entra tenant:     ${args.entraTenantId}`);
  console.log(`Blob prefix:      ${blobPrefix}`);
  console.log(`Bicep module:     ${bicepModule}`);
  console.log(
    "\nDry-run complete. Apply migration 006, then wire Azure deploy + DB insert in a later phase.",
  );
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
