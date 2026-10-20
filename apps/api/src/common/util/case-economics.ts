/**
 * Enforce pricing safety at the point where money or inventory can change.
 * All computations use integer minor units and micro-weight units.
 * These checks do NOT select drops or modify provably-fair outcomes.
 */
type PricedDrop = { valueMinor: bigint; weight: number };

export function assessCaseEconomics(items: readonly PricedDrop[], priceMinor: bigint) {
  if (priceMinor <= 0n || !items.length) return { canOpen: false, canBattle: false };
  if (items.some((item) => !Number.isFinite(item.weight) || item.weight < 0 || item.valueMinor < 0n)) {
    return { canOpen: false, canBattle: false };
  }
  const pool = items.map((item) => ({ value: item.valueMinor, weight: BigInt(Math.round(item.weight * 1_000_000)) }))
    .filter((item) => item.weight > 0n);
  const total = pool.reduce((sum, item) => sum + item.weight, 0n);
  if (total === 0n) return { canOpen: false, canBattle: false };

  const openValue = pool.reduce((sum, item) => sum + item.value * item.weight, 0n);
  let battleValue = 0n;
  for (const player of pool) {
    for (const bot of pool) {
      // Same winner-takes-all rule as GamesService: player wins ties.
      if (player.value >= bot.value) {
        battleValue += (player.value + bot.value) * player.weight * bot.weight;
      }
    }
  }
  // Guard against positive expected payout and allow 2% extra cushion
  // for case battles. Actual pricing targets are configured separately.
  return {
    canOpen: openValue < priceMinor * total,
    canBattle: battleValue * 100n < priceMinor * total * total * 98n,
  };
}
