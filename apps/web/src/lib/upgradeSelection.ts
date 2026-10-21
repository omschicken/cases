import type { CaseItem } from "./types";

/** Choose the closest eligible market item, breaking equal-distance ties by price. */
export function nearestUpgradeTarget(items: CaseItem[], sourceMinor: string, ratio: number): CaseItem | undefined {
  const base = BigInt(sourceMinor);
  if (base <= 0n) return undefined;
  const desired = base * BigInt(Math.round(ratio * 100)) / 100n;
  return items.filter(item => {
    const price = BigInt(item.valueMinor);
    return price > base && price <= base * 90n;
  }).reduce<CaseItem | undefined>((best, item) => {
    if (!best) return item;
    const a = BigInt(item.valueMinor), b = BigInt(best.valueMinor);
    const da = a > desired ? a - desired : desired - a;
    const db = b > desired ? b - desired : desired - b;
    return da < db || (da === db && a < b) ? item : best;
  }, undefined);
}
