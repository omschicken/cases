import { describe, expect, it } from "vitest";
import { allocateBattlePrizePool } from "../src/games/battle-settlement";

describe("allocateBattlePrizePool", () => {
  it("awards every round drop to the sole highest-scoring player", () => {
    const drops = ["p1-r1", "p1-r2", "p2-r1", "p2-r2"];
    const result = allocateBattlePrizePool([120n, 80n], drops);
    expect(result.winnerIndexes).toEqual([0]);
    expect(result.awards).toEqual([drops, []]);
  });

  it("splits a tied prize pool between leaders without losing or duplicating drops", () => {
    const drops = ["a", "b", "c", "d", "e"];
    const result = allocateBattlePrizePool([100n, 100n, 40n], drops);
    expect(result.winnerIndexes).toEqual([0, 1]);
    expect(result.awards).toEqual([["a", "c", "e"], ["b", "d"], []]);
    expect(result.awards.flat().sort()).toEqual([...drops].sort());
  });

  it("treats an all-tie as an even round-robin allocation", () => {
    const result = allocateBattlePrizePool([50n, 50n, 50n], [1, 2, 3]);
    expect(result.winnerIndexes).toEqual([0, 1, 2]);
    expect(result.awards).toEqual([[1], [2], [3]]);
  });
});
