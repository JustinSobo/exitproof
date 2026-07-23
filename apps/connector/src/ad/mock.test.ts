import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MockAdReader } from "./mock.js";
import { FORBIDDEN_AD_ATTRS } from "./query.js";

describe("MockAdReader", () => {
  it("returns seeded enabled account for jordan.lee", async () => {
    const reader = new MockAdReader();
    const rows = await reader.queryUsers({
      ouScopes: ["OU=Users,DC=northwind,DC=example"],
      identity: "jordan.lee@northwind.example",
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.accountEnabled, true);
    assert.ok(!("unicodePwd" in rows[0]!.rawAttributes));
  });
});

describe("forbidden attrs list", () => {
  it("includes unicodePwd", () => {
    assert.ok(FORBIDDEN_AD_ATTRS.includes("unicodePwd"));
  });
});
