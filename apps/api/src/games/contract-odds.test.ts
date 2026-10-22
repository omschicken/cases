import { describe, expect, it } from "vitest";
import { selectContractOutcomes } from "./contract-odds";

const market = [
  { id:"low",valueMinor:6000n },
  { id:"upper",valueMinor:20000n },
  { id:"other",valueMinor:45000n },
];
describe("transparent contract odds",()=>{
  it("allows winnings above the input stake while expected return is 90%",()=>{
    const q = selectContractOutcomes(market,10000n)!;
    expect(q.low.id).toBe("low");
    expect(q.high.id).toBe("upper");
    expect(q.expectedReturnMinor).toBe(9000n);
    expect(q.highChance).toBeCloseTo(3/14,5);
    expect(q.high.valueMinor).toBeGreaterThan(10000n);
  });
  it("can provide better-than-even profitable odds with an audited 90% average",()=>{
    const q = selectContractOutcomes([
      { id: "ordinary", valueMinor: 3500n },
      { id: "profit", valueMinor: 14000n },
      { id: "other", valueMinor: 25000n },
    ],10000n)!;
    expect(q.high.valueMinor).toBe(14000n);
    expect(q.highChance).toBeGreaterThan(0.5);
    const expected = Number(q.low.valueMinor) * (1-q.highChance) + Number(q.high.valueMinor) * q.highChance;
    expect(expected).toBeCloseTo(9000,0);
  });
  it("rejects impossible and one-sided reward markets",()=>{
    expect(selectContractOutcomes([{id:"a",valueMinor:5000n}],10000n)).toBeNull();
    expect(selectContractOutcomes([{id:"a",valueMinor:20000n}],10000n)).toBeNull();
    expect(selectContractOutcomes([],10000n)).toBeNull();
  });
});
