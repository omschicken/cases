/** Exact integer arithmetic used by GamesService.createUpgrade. The POST response is authoritative. */
export function upgradeChance(sourceMinor: string, targetMinor: string): number | null {
  const source = BigInt(sourceMinor), target = BigInt(targetMinor);
  if (source <= 0n || target <= source) return null;
  return Number(source * 1_000_000_000_000n / target) / 1_000_000_000_000;
}
