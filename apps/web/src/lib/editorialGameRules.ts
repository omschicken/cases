/** Exact integer arithmetic used by GamesService.createUpgrade. The POST response is authoritative. */
export function upgradeChance(sourceMinor: string, targetMinor: string): number | null {
  const source = BigInt(sourceMinor), target = BigInt(targetMinor);
  if (source <= 0n || target <= source || target > source * 90n) return null;
  return Math.max(0.01, Math.min(0.75, Number(source * 90_000n / target) / 100_000));
}
