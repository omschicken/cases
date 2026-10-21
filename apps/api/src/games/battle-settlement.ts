/** Highest aggregate item value wins the room; tied leaders split the pool in
 * stable participant/round order so every paid drop is awarded exactly once. */
export function allocateBattlePrizePool<T>(scores: readonly bigint[], drops: readonly T[]) {
  if (!scores.length) throw new Error("A battle needs at least one participant");
  const highScore = scores.reduce((best, score) => score > best ? score : best, scores[0]);
  const winnerIndexes = scores.flatMap((score, index) => score === highScore ? [index] : []);
  const awards = scores.map(() => [] as T[]);
  drops.forEach((drop, index) => awards[winnerIndexes[index % winnerIndexes.length]].push(drop));
  return { highScore, winnerIndexes, awards };
}
