import { describe, expect, it } from "vitest";
import { mysteryIndex, mysteryPriceBounds } from "./mystery-odds";

describe("mystery upgrade server constraints", () => {
  it("uses exact integer-price boundaries for all bands", () => {
    expect(mysteryPriceBounds(10001n,1.5)).toEqual({from:15002n,to:20002n,min:1.5,max:2});
    expect(mysteryPriceBounds(10000n,2)).toEqual({from:20000n,to:30000n,min:2,max:3});
    expect(mysteryPriceBounds(10000n,3)).toEqual({from:30000n,to:50000n,min:3,max:5});
    expect(mysteryPriceBounds(10000n,5)).toEqual({from:50000n,to:80000n,min:5,max:8});
  });
  it("rejects invalid ranges and non-positive sources", () => {
    expect(() => mysteryPriceBounds(100n,4)).toThrow();
    expect(() => mysteryPriceBounds(0n,2)).toThrow();
  });
  it("maps a uniform seeded selection roll within the candidate array", () => {
    expect(mysteryIndex(0,4)).toBe(0);
    expect(mysteryIndex(.749999,4)).toBe(2);
    expect(mysteryIndex(.999999999,4)).toBe(3);
    expect(() => mysteryIndex(1,4)).toThrow();
    expect(() => mysteryIndex(.5,0)).toThrow();
  });
});
