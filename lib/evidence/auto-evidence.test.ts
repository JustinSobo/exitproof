import { describe, expect, it } from "vitest";
import {
  assertCanCompleteItem,
  itemHasHumanAttestProof,
} from "@/lib/cases/evidence-rules";
import {
  mapAdAutoEvidenceTarget,
  mapSignalToChecklistItem,
} from "@/lib/evidence/auto-map";
import {
  isSystemCollectedEvidence,
  partitionEvidenceBySource,
} from "@/lib/evidence/collection-source";
import {
  retentionPolicyNote,
  resolveAutoEvidencePolicy,
} from "@/lib/evidence/policy";
import type { ChecklistItem, EvidenceFile } from "@/lib/types";

function item(partial: Partial<ChecklistItem> & Pick<ChecklistItem, "id" | "title">): ChecklistItem {
  return {
    case_id: "c1",
    template_step_id: null,
    description: "",
    requires_evidence: true,
    is_critical: true,
    status: "pending",
    notes: null,
    ticket_url: null,
    completed_at: null,
    completed_by: null,
    sort_order: 1,
    category: "Identity",
    control_refs: [],
    ...partial,
  };
}

function evidence(
  partial: Partial<EvidenceFile> & Pick<EvidenceFile, "id" | "checklist_item_id">,
): EvidenceFile {
  return {
    case_id: "c1",
    org_id: "o1",
    file_name: "shot.png",
    storage_path: "tenants/o1/human/shot.png",
    uploaded_by: "alex@example.com",
    created_at: new Date().toISOString(),
    ...partial,
  };
}

describe("auto-map Graph/AD → checklist", () => {
  const items: ChecklistItem[] = [
    item({
      id: "disable",
      title: "Disable primary IdP account (Entra / Google / Okta)",
      category: "Identity",
      sort_order: 1,
      control_refs: ["fedramp:AC-2", "fedramp:PS-4", "cmmc-l2:AC.L2-3.1.1"],
    }),
    item({
      id: "ad-groups",
      title: "Remove from privileged AD / LDAP groups",
      category: "Access",
      sort_order: 3,
      control_refs: ["fedramp:AC-6", "cmmc-l2:AC.L2-3.1.5"],
    }),
  ];

  it("maps Graph snapshot to FedRAMP/CMMC disable-account step", () => {
    const target = mapSignalToChecklistItem("graph_directory_snapshot", items, {
      selectedFrameworks: ["fedramp", "cmmc-l2"],
    });
    expect(target?.id).toBe("disable");
  });

  it("maps AD group membership to privileged AD step", () => {
    expect(mapAdAutoEvidenceTarget(items)?.id).toBe("ad-groups");
  });
});

describe("attest-on-critical policy", () => {
  const critical = item({
    id: "i1",
    title: "Disable primary IdP account",
    is_critical: true,
    requires_evidence: true,
  });

  it("blocks done when only system-collected evidence exists", () => {
    const sys = evidence({
      id: "e1",
      checklist_item_id: "i1",
      file_name: "graph-snapshot-x.json",
      storage_path: "tenants/o1/graph-auto/c1/graph-snapshot-x.json",
      uploaded_by: "system:graph",
      collection_source: "system:graph",
    });
    expect(() =>
      assertCanCompleteItem(critical, [sys], {
        requireHumanAttestOnCritical: true,
      }),
    ).toThrow(/human attestation/i);
  });

  it("allows done with ticket URL alongside system evidence", () => {
    const sys = evidence({
      id: "e1",
      checklist_item_id: "i1",
      file_name: "graph-snapshot-x.json",
      storage_path: "tenants/o1/graph-auto/c1/x.json",
      uploaded_by: "system:graph",
      collection_source: "system:graph",
    });
    expect(() =>
      assertCanCompleteItem(critical, [sys], {
        ticketUrlOverride: "https://tickets.example/1",
        requireHumanAttestOnCritical: true,
      }),
    ).not.toThrow();
  });

  it("allows done with human-attached file", () => {
    const human = evidence({
      id: "e2",
      checklist_item_id: "i1",
      collection_source: "human",
    });
    expect(() =>
      assertCanCompleteItem(critical, [human], {
        requireHumanAttestOnCritical: true,
      }),
    ).not.toThrow();
  });

  it("allows system-only for non-critical requires_evidence", () => {
    const nonCritical = item({
      id: "i2",
      title: "Revoke SaaS licenses",
      is_critical: false,
      requires_evidence: true,
    });
    const sys = evidence({
      id: "e3",
      checklist_item_id: "i2",
      uploaded_by: "system:graph",
      file_name: "graph-snapshot-y.json",
      collection_source: "system:graph",
    });
    expect(() =>
      assertCanCompleteItem(nonCritical, [sys], {
        requireHumanAttestOnCritical: true,
      }),
    ).not.toThrow();
  });

  it("itemHasHumanAttestProof ignores system files", () => {
    const sys = evidence({
      id: "e1",
      checklist_item_id: "i1",
      uploaded_by: "system:ad",
      collection_source: "system:ad",
    });
    expect(itemHasHumanAttestProof(critical, [sys])).toBe(false);
    expect(
      itemHasHumanAttestProof(
        { ...critical, ticket_url: "https://t.example/1" },
        [sys],
      ),
    ).toBe(true);
  });
});

describe("Evidence Pack v3 partitioning", () => {
  it("splits system vs human", () => {
    const files = [
      evidence({
        id: "s",
        checklist_item_id: "i1",
        uploaded_by: "system:graph",
        collection_source: "system:graph",
      }),
      evidence({
        id: "h",
        checklist_item_id: "i1",
        uploaded_by: "a@b.com",
        collection_source: "human",
      }),
    ];
    expect(isSystemCollectedEvidence(files[0])).toBe(true);
    const parts = partitionEvidenceBySource(files);
    expect(parts.systemCollected.map((e) => e.id)).toEqual(["s"]);
    expect(parts.humanAttached.map((e) => e.id)).toEqual(["h"]);
  });
});

describe("org policy + retention note", () => {
  it("defaults requireHumanAttestOnCritical to true", () => {
    expect(resolveAutoEvidencePolicy({}).requireHumanAttestOnCritical).toBe(
      true,
    );
    expect(
      resolveAutoEvidencePolicy({
        require_human_attest_on_critical: false,
      }).requireHumanAttestOnCritical,
    ).toBe(false);
  });

  it("aligns retention copy with GridLogic SKUs", () => {
    expect(
      retentionPolicyNote({ retention_days: 90, plan: "team" }),
    ).toMatch(/Standard/);
    expect(
      retentionPolicyNote({ retention_days: 365, plan: "growth" }),
    ).toMatch(/Dedicated/);
  });
});
