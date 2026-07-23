import { describe, expect, it } from "vitest";
import {
  computeCoverage,
  filterItemsByFramework,
  filterRefsByFramework,
  refsFor,
  validateCrosswalk,
} from "@/lib/compliance";
import { sha256Hex } from "@/lib/evidence/hash";
import { isOrgAdminRole } from "@/lib/auth/roles";
import type { ChecklistItem, EvidenceFile } from "@/lib/types";

describe("crosswalk", () => {
  it("resolves every theme ref to a seeded control", () => {
    expect(validateCrosswalk()).toEqual([]);
  });

  it("maps disableAccount across FedRAMP and CMMC", () => {
    const refs = refsFor("disableAccount");
    expect(refs).toContain("fedramp:AC-2");
    expect(refs).toContain("fedramp:PS-4");
    expect(refs).toContain("cmmc-l1:AC.L1-3.1.1");
    expect(refs).toContain("soc2:CC6.2");
  });

  it("filters refs by framework slug", () => {
    const refs = ["fedramp:AC-2", "soc2:CC6.2", "iso-27001:A.6.5"];
    expect(filterRefsByFramework(refs, "fedramp")).toEqual(["fedramp:AC-2"]);
    expect(filterRefsByFramework(refs, "all")).toEqual(refs);
  });
});

describe("coverage", () => {
  const baseItem = (over: Partial<ChecklistItem>): ChecklistItem => ({
    id: "item-1",
    case_id: "case-1",
    template_step_id: null,
    title: "Disable Entra user",
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
    control_refs: ["fedramp:AC-2", "soc2:CC6.2"],
    ...over,
  });

  it("marks open when step incomplete", () => {
    const summary = computeCoverage({
      items: [baseItem({})],
      evidence: [],
      framework: "fedramp",
    });
    expect(summary.total).toBe(1);
    expect(summary.open).toBe(1);
    expect(summary.covered).toBe(0);
  });

  it("marks covered when done with evidence", () => {
    const evidence: EvidenceFile[] = [
      {
        id: "ev-1",
        checklist_item_id: "item-1",
        case_id: "case-1",
        org_id: "org-1",
        file_name: "disable.png",
        storage_path: "x",
        uploaded_by: "a@b.com",
        created_at: new Date().toISOString(),
        content_hash: "abc",
      },
    ];
    const summary = computeCoverage({
      items: [baseItem({ status: "done" })],
      evidence,
      framework: "all",
    });
    expect(summary.covered).toBe(2);
    expect(summary.open).toBe(0);
  });

  it("filters checklist items by framework", () => {
    const items = [
      baseItem({ id: "a", control_refs: ["fedramp:AC-2"] }),
      baseItem({ id: "b", control_refs: ["soc2:CC6.2"] }),
    ];
    expect(filterItemsByFramework(items, "fedramp").map((i) => i.id)).toEqual([
      "a",
    ]);
  });
});

describe("evidence hash", () => {
  it("hashes bytes with sha256 hex", () => {
    const digest = sha256Hex(Buffer.from("exitproof"));
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).toBe(sha256Hex(Buffer.from("exitproof")));
  });
});

describe("roles", () => {
  it("treats owner and admin as org admins", () => {
    expect(isOrgAdminRole("owner")).toBe(true);
    expect(isOrgAdminRole("admin")).toBe(true);
    expect(isOrgAdminRole("member")).toBe(false);
  });
});
