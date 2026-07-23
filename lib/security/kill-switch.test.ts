import { describe, expect, it } from "vitest";
import {
  areConnectorsDisabled,
  isKillSwitchActive,
  isLoginFrozen,
  killSwitchOf,
} from "@/lib/security/kill-switch";

describe("kill-switch helpers", () => {
  it("defaults to inactive", () => {
    expect(killSwitchOf({ login_frozen: false, connectors_disabled: false })).toEqual({
      login_frozen: false,
      connectors_disabled: false,
    });
    expect(isKillSwitchActive({ login_frozen: false, connectors_disabled: false })).toBe(
      false,
    );
  });

  it("detects login freeze", () => {
    expect(isLoginFrozen({ login_frozen: true })).toBe(true);
    expect(isKillSwitchActive({ login_frozen: true, connectors_disabled: false })).toBe(
      true,
    );
  });

  it("detects connectors disabled", () => {
    expect(areConnectorsDisabled({ connectors_disabled: true })).toBe(true);
    expect(
      isKillSwitchActive({ login_frozen: false, connectors_disabled: true }),
    ).toBe(true);
  });
});
