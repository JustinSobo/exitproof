# ExitProof Azure IaC (Phase 1 skeleton)

Bicep modules for the GridLogic-managed Azure platform. **Not yet deployed** — stubs define the target topology from `docs/CHARTER.md` / ADR-001.

## Layout

```
infra/
  main.bicep                 # Shared platform composition (stub)
  modules/
    platform/                # Shared control plane placeholders
      container-apps.bicep   # Web + API (Container Apps or App Service)
      azure-sql.bicep        # Platform / shared SQL
      blob.bicep             # Evidence storage account
      key-vault.bicep        # Secrets + per-tenant CMK refs
      front-door.bicep       # WAF / CDN edge
    tenant-standard/         # Shared-platform customer data plane
      main.bicep
    tenant-dedicated/        # Isolated RG per customer (high-assurance SKU)
      main.bicep
  params/
    platform.dev.bicepparam
    tenant-standard.example.bicepparam
    tenant-dedicated.example.bicepparam
```

## SKUs

| SKU | Module | Isolation |
|-----|--------|-----------|
| **Standard** | `modules/tenant-standard` | Shared app + SQL; schema/prefix `tenants/{tenant_id}/`; CMK in shared Key Vault |
| **Dedicated** | `modules/tenant-dedicated` | Per-customer resource group: optional app, SQL, storage, Key Vault |

## Prerequisites (when wiring deploy)

- Azure CLI (`az`) + Bicep
- Subscription with Owner/Contributor on target RGs
- Entra app registration for GridLogic multi-tenant consent (Phase 3)

## Dry-run (future)

```bash
# Shared platform (not wired yet — parameters are placeholders)
az deployment sub create \
  --location eastus \
  --template-file infra/main.bicep \
  --parameters infra/params/platform.dev.bicepparam \
  --what-if
```

Tenant provision checklist is also available via the app CLI stub:

```bash
npx tsx scripts/provision-customer.ts --dry-run \
  --name "Acme Corp" \
  --sku standard \
  --entra-tenant-id "<customer-entra-guid>"
```

## Phase 1 status

| Piece | Status |
|-------|--------|
| Module stubs + param files | **Stubbed** |
| Private endpoints / WAF rules | Placeholders only |
| Live Azure deploy | Blocked on credentials / subscription |
| App `tenant_id` + JIT harden | Wired in app (see migration `006`) |

## Non-goals (this phase)

Graph connector, Hybrid AD agent, operator UI — Phases 2–4.
