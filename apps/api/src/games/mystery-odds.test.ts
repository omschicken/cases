import { describe, expect, it } from "vitest";
import { MYSTERY_REWARDS, mysteryBandIndex, mysteryBounds, mysteryIndex } from "./mystery-odds";

describe("mystery upgrade fixed payouts", () => {
 it("has precisely 100 percent weight and a 50 percent central band", () => {
  expect(MYSTERY_REWARDS.map(x=>x.weight)).toEqual([20,15,50,10,5]);
  expect(MYSTERY_REWARDS.reduce((s,b)=>s+b.weight,0)).toBe(100);
 });
 it("maps band cutoffs exactly", () => {
  expect(mysteryBandIndex(0)).toBe(0);
  expect(mysteryBandIndex(.199)).toBe(0);
  expect(mysteryBandIndex(.2)).toBe(1);
  expect(mysteryBandIndex(.35)).toBe(2);
  expect(mysteryBandIndex(.849)).toBe(2);
  expect(mysteryBandIndex(.85)).toBe(3);
  expect(mysteryBandIndex(.95)).toBe(4);
  expect(() => mysteryBandIndex(1)).toThrow();
 });
 it("rounds currency limits inward to respect advertised ranges", () => {
  expect(mysteryBounds(10001n,30,60)).toEqual({from:3001n,to:6000n});
  expect(mysteryBounds(10001n,90,110)).toEqual({from:9001n,to:11001n});
  expect(mysteryBounds(10001n,150,200)).toEqual({from:15002n,to:20002n});
 });
 it("picks only within item pool and disallows empty pools", () => {
  expect(mysteryIndex(0,4)).toBe(0);
  expect(mysteryIndex(.9999999,4)).toBe(3);
  expect(() => mysteryIndex(.2,0)).toThrow();
 });
});
