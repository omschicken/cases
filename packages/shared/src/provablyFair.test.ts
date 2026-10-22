import { describe, it, expect } from "vitest";
import {
  generateServerSeed,
  hashServerSeed,
  computeRoll,
  pickWeightedItem,
  rollCase,
  verifyRoll,
  ProvablyFairError,
} from "./provablyFair";

describe("hashServerSeed", () => {
  it("is deterministic", () => {
    const seed = "abc123";
    expect(hashServerSeed(seed)).toBe(hashServerSeed(seed));
  });

  it("changes when the seed changes", () => {
    expect(hashServerSeed("a")).not.toBe(hashServerSeed("b"));
  });
});

describe("computeRoll", () => {
  it("is deterministic for the same inputs", () => {
    const a = computeRoll("server", "client", 1);
    const b = computeRoll("server", "client", 1);
    expect(a).toBe(b);
  });

  it("is in [0, 1)", () => {
    for (let nonce = 0; nonce < 200; nonce++) {
      const roll = computeRoll("server", "client", nonce);
      expect(roll).toBeGreaterThanOrEqual(0);
      expect(roll).toBeLessThan(1);
    }
  });

  it("changes with nonce", () => {
    const rolls = new Set<number>();
    for (let nonce = 0; nonce < 50; nonce++) rolls.add(computeRoll("server", "client", nonce));
    expect(rolls.size).toBe(50);
  });

  it("changes with client seed", () => {
    expect(computeRoll("server", "client-a", 0)).not.toBe(computeRoll("server", "client-b", 0));
  });
});

describe("pickWeightedItem", () => {
  const items = [
    { id: "common", weight: 80 },
    { id: "rare", weight: 15 },
    { id: "legendary", weight: 5 },
  ];

  it("picks the first bucket for roll 0", () => {
    expect(pickWeightedItem(items, 0).id).toBe("common");
  });

  it("picks the last bucket just under roll 1", () => {
    expect(pickWeightedItem(items, 0.999999).id).toBe("legendary");
  });

  it("respects cumulative weight boundaries", () => {
    // total weight 100: [0,80) common, [80,95) rare, [95,100) legendary
    expect(pickWeightedItem(items, 0.79999).id).toBe("common");
    expect(pickWeightedItem(items, 0.80001).id).toBe("rare");
    expect(pickWeightedItem(items, 0.94999).id).toBe("rare");
    expect(pickWeightedItem(items, 0.95001).id).toBe("legendary");
  });

  it("throws on empty item list", () => {
    expect(() => pickWeightedItem([], 0.5)).toThrow(ProvablyFairError);
  });

  it("throws on zero total weight", () => {
    expect(() => pickWeightedItem([{ id: "x", weight: 0 }], 0.5)).toThrow(ProvablyFairError);
  });

  it("distribution roughly matches weights over many rolls", () => {
    const counts: Record<string, number> = { common: 0, rare: 0, legendary: 0 };
    const trials = 20000;
    for (let nonce = 0; nonce < trials; nonce++) {
      const roll = computeRoll("dist-seed", "dist-client", nonce);
      counts[pickWeightedItem(items, roll).id]++;
    }
    expect(counts.common / trials).toBeGreaterThan(0.75);
    expect(counts.common / trials).toBeLessThan(0.85);
    expect(counts.legendary / trials).toBeGreaterThan(0.03);
    expect(counts.legendary / trials).toBeLessThan(0.07);
  });
});

describe("rollCase + verifyRoll round trip", () => {
  const items = [
    { id: "common", weight: 80 },
    { id: "rare", weight: 15 },
    { id: "legendary", weight: 5 },
  ];

  it("verifies a genuine roll as valid", () => {
    const serverSeed = generateServerSeed();
    const serverSeedHash = hashServerSeed(serverSeed);
    const clientSeed = "player-chosen-seed";
    const nonce = 7;

    const { item } = rollCase(items, serverSeed, clientSeed, nonce);

    const result = verifyRoll({
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce,
      items,
      expectedItemId: item.id,
    });

    expect(result.valid).toBe(true);
    expect(result.hashMatches).toBe(true);
    expect(result.itemMatches).toBe(true);
  });

  it("detects a tampered server seed (hash mismatch)", () => {
    const serverSeed = generateServerSeed();
    const serverSeedHash = hashServerSeed(serverSeed);
    const { item } = rollCase(items, serverSeed, "c", 1);

    const result = verifyRoll({
      serverSeed: generateServerSeed(), // wrong seed presented
      serverSeedHash,
      clientSeed: "c",
      nonce: 1,
      items,
      expectedItemId: item.id,
    });

    expect(result.hashMatches).toBe(false);
    expect(result.valid).toBe(false);
  });

  it("detects a claimed item that does not match the recomputed roll", () => {
    const serverSeed = generateServerSeed();
    const serverSeedHash = hashServerSeed(serverSeed);

    const result = verifyRoll({
      serverSeed,
      serverSeedHash,
      clientSeed: "c",
      nonce: 1,
      items,
      expectedItemId: "not-the-real-outcome",
    });

    expect(result.hashMatches).toBe(true);
    expect(result.itemMatches).toBe(false);
    expect(result.valid).toBe(false);
  });
});
