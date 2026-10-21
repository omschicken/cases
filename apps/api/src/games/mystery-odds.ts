/** Server-authoritative hidden-target price bands in integer minor currency units. */
const BANDS: Record<string, readonly [bigint, bigint]> = {
  "1.5": [150n, 200n], "2": [200n, 300n], "3": [300n, 500n], "5": [500n, 800n],
};
export function mysteryPriceBounds(sourceMinor: bigint, multiplier: number) {
  const factors = BANDS[String(multiplier)];
  if (!factors || sourceMinor <= 0n) throw new RangeError("Invalid mystery multiplier or source price");
  const [lo, hi] = factors;
  const from = (sourceMinor * lo + 99n) / 100n;
  const to = sourceMinor * hi / 100n;
  return { from, to, min: Number(lo) / 100, max: Number(hi) / 100 };
}
export function mysteryIndex(roll: number, count: number) {
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1 || !Number.isSafeInteger(count) || count < 1) {
    throw new RangeError("Invalid mystery roll or candidate count");
  }
  return Math.min(count - 1, Math.floor(roll * count));
}
