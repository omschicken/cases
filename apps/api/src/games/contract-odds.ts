/**
 * Transparent two-outcome contract reward construction.
 * The average return targets 90% of submitted item value, NOT a maximum prize.
 * Every contract has a possible profitable outcome. Selection is determined
 * only by the precommitted roll, never by account history or prior losses.
 */
export function selectContractOutcomes<T extends { id: string; valueMinor: bigint }>(
  items: readonly T[], stake: bigint,
): { low: T; high: T; highChance: number; expectedReturnMinor: bigint } | null {
  if (stake <= 0n) return null;
  const target = stake * 90n / 100n;
  const pool = [...items].filter(i => i.valueMinor > 0n).sort((a,b) => a.valueMinor === b.valueMinor ? a.id.localeCompare(b.id) : a.valueMinor < b.valueMinor ? -1 : 1);
  const lows = pool.filter(i => i.valueMinor < target && i.valueMinor >= stake * 25n / 100n);
  const highs = pool.filter(i => i.valueMinor > stake && i.valueMinor <= stake * 5n);
  if (!lows.length || !highs.length) return null;
  const lowTarget = stake * 60n / 100n;
  const highTarget = stake * 2n;
  const abs = (x: bigint) => x < 0n ? -x : x;
  const low = lows.reduce((best,item) => abs(item.valueMinor-lowTarget) < abs(best.valueMinor-lowTarget) ? item : best);
  const high = highs.reduce((best,item) => abs(item.valueMinor-highTarget) < abs(best.valueMinor-highTarget) ? item : best);
  const numerator = target-low.valueMinor;
  const denominator = high.valueMinor-low.valueMinor;
  if (numerator <= 0n || denominator <= 0n) return null;
  const highChance = Number(numerator * 1_000_000n / denominator) / 1_000_000;
  if (!(highChance > 0 && highChance < 1)) return null;
  return { low, high, highChance, expectedReturnMinor: target };
}
