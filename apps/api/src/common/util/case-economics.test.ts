import { describe, expect, it } from "vitest";
import { assessCaseEconomics } from "./case-economics";

describe("case economic guardrails", () => {
  it("blocks a case whose expected opening payout exceeds its price", () => {
    expect(assessCaseEconomics([{ valueMinor: 111n, weight: 1 }], 100n))
      .toEqual({ canOpen: false, canBattle: false });
  });
  it("blocks a battle with positive expected payout despite a safe opening", () => {
    expect(assessCaseEconomics([{ valueMinor: 90n, weight: 1 }], 100n))
      .toEqual({ canOpen: true, canBattle: false });
  });
  it("permits a conservatively priced case and battle", () => {
    expect(assessCaseEconomics([{ valueMinor: 35n, weight: 2 }, { valueMinor: 45n, weight: 1 }], 100n))
      .toEqual({ canOpen: true, canBattle: true });
  });
  it("rejects invalid prices and pools", () => {
    expect(assessCaseEconomics([], 100n).canOpen).toBe(false);
    expect(assessCaseEconomics([{ valueMinor: 10n, weight: 0 }], 100n).canBattle).toBe(false);
    expect(assessCaseEconomics([{ valueMinor: 10n, weight: Number.NaN }], 100n).canOpen).toBe(false);
  });
});
