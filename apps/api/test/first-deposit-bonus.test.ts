import { describe, expect, it } from "vitest";
import { firstDepositBonusMinor } from "../src/wallet/wallet.service";

describe("firstDepositBonusMinor", () => {
  it("is 10% of the deposit", () => {
    expect(firstDepositBonusMinor(100_000n)).toBe(10_000n); // 1000 RUB -> 100 RUB
  });
  it("is capped at 500 RUB", () => {
    expect(firstDepositBonusMinor(5_000_000n)).toBe(50_000n); // 50 000 RUB -> 500 RUB
    expect(firstDepositBonusMinor(500_000n)).toBe(50_000n); // exactly at the cap
  });
  it("rounds down and is zero for dust deposits", () => {
    expect(firstDepositBonusMinor(19n)).toBe(1n);
    expect(firstDepositBonusMinor(9n)).toBe(0n);
  });
});
