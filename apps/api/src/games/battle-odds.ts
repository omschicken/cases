/** Exact chance of the player winning a one-round case battle.
 * Both drops use the same weighted pool, and ties are awarded to the player.
 * This is analytical metadata only: never used to draw the outcome. */
export function battleWinChance(items: ReadonlyArray<{ valueMinor: bigint; weight: number }>): number {
  const valid = items.filter((item) => Number.isFinite(item.weight) && item.weight > 0);
  const total = valid.reduce((sum, item) => sum + item.weight, 0);
  if (!(total > 0)) return 0;
  let winWeight = 0;
  for (const player of valid) {
    for (const bot of valid) {
      if (player.valueMinor >= bot.valueMinor) winWeight += (player.weight / total) * (bot.weight / total);
    }
  }
  return Math.max(0, Math.min(1, winWeight));
}
