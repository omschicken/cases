import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearOpening, loadOpening, saveOpening } from "./openingRecovery";

describe("opening receipt recovery", () => {
  let values: Map<string, string>;
  beforeEach(() => {
    values = new Map();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
  });
  it("recovers a pending opening only for the same account and case", () => {
    const receipt = { startedAt: Date.now() };
    saveOpening("a", "case", receipt);
    expect(loadOpening("a", "case")).toEqual(receipt);
    expect(loadOpening("b", "case")).toBeNull();
    expect(loadOpening("a", "other")).toBeNull();
    clearOpening("a", "case");
    expect(loadOpening("a", "case")).toBeNull();
  });
  it("rejects broken, expired and malformed receipts", () => {
    saveOpening("a", "case", { startedAt: Date.now() - 86_400_001 });
    expect(loadOpening("a", "case")).toBeNull();
    values.set("casecrow.opening.v1:a:case", "{broken");
    expect(loadOpening("a", "case")).toBeNull();
    values.set("casecrow.opening.v1:a:case", JSON.stringify({startedAt:Date.now(), result:{}}));
    expect(loadOpening("a", "case")).toBeNull();
  });
  it("does not block opening when storage is unavailable", () => {
    vi.stubGlobal("sessionStorage", { getItem() { throw Error(); }, setItem() { throw Error(); }, removeItem() { throw Error(); } });
    expect(() => saveOpening("a", "case", {startedAt:Date.now()})).not.toThrow();
    expect(loadOpening("a", "case")).toBeNull();
    expect(() => clearOpening("a", "case")).not.toThrow();
  });
});
