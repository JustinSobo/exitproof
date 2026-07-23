import { describe, expect, it } from "vitest";
import {
  accountEnabledFromUac,
  AD_UAC_ACCOUNTDISABLE,
  assertNoForbiddenAttributes,
  detectHybridMismatch,
} from "@/lib/connectors/ad";
import { stubCollectAdAutoEvidence } from "@/lib/connectors/ad-auto-evidence";
import {
  hashRegistrationToken,
  normalizeThumbprint,
  verifyTokenHash,
} from "@/lib/connectors/ad-auth";

describe("detectHybridMismatch", () => {
  it("flags cloud disabled + AD enabled", () => {
    expect(detectHybridMismatch(false, true)).toBe(true);
  });

  it("does not flag when both disabled", () => {
    expect(detectHybridMismatch(false, false)).toBe(false);
  });

  it("does not flag when cloud still enabled", () => {
    expect(detectHybridMismatch(true, true)).toBe(false);
  });

  it("needs both sides", () => {
    expect(detectHybridMismatch(null, true)).toBe(false);
    expect(detectHybridMismatch(false, null)).toBe(false);
  });
});

describe("accountEnabledFromUac", () => {
  it("reads ACCOUNTDISABLE bit", () => {
    expect(accountEnabledFromUac(0x200)).toBe(true);
    expect(accountEnabledFromUac(0x200 | AD_UAC_ACCOUNTDISABLE)).toBe(false);
  });
});

describe("assertNoForbiddenAttributes", () => {
  it("rejects password hash attrs", () => {
    expect(() =>
      assertNoForbiddenAttributes({ unicodePwd: "x" }),
    ).toThrow(/Forbidden/);
  });

  it("allows safe attrs", () => {
    expect(() =>
      assertNoForbiddenAttributes({ sAMAccountName: "jlee" }),
    ).not.toThrow();
  });
});

describe("connector auth helpers", () => {
  it("hashes and verifies registration tokens", () => {
    const token = "demo-connector-token";
    const hash = hashRegistrationToken(token);
    expect(verifyTokenHash(token, hash)).toBe(true);
    expect(verifyTokenHash("wrong", hash)).toBe(false);
  });

  it("normalizes thumbprints", () => {
    expect(normalizeThumbprint("AB:CD:EF")).toBe("abcdef");
  });
});

describe("stubCollectAdAutoEvidence", () => {
  it("skips when disabled", () => {
    const r = stubCollectAdAutoEvidence(null, false);
    expect(r.status).toBe("skipped");
  });
});
