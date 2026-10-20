import { describe, expect, it } from "vitest";
import { upgradeChance } from "./editorialGameRules";

describe("upgrade preview matches the audited server pricing rules", () => {
  it("keeps integer truncation at the server's precision", () => {
    expect(upgradeChance("8500", "24500")).toBe(0.31224);
    expect(upgradeChance("10000", "30000")).toBe(0.3);
  });
  it("applies the server's lower and upper limits", () => {
    expect(upgradeChance("1", "90")).toBe(0.01);
    expect(upgradeChance("1", "91")).toBeNull();
    expect(upgradeChance("10000", "10001")).toBe(0.75);
  });
  it("rejects an invalid source or a target that is not more valuable", () => {
    expect(upgradeChance("0", "200")).toBeNull();
    expect(upgradeChance("200", "200")).toBeNull();
    expect(upgradeChance("300", "200")).toBeNull();
  });
  it("does not lose integer precision on large prices", () => {
    expect(upgradeChance("100000000000000000000", "200000000000000000000")).toBe(0.45);
  });
});
