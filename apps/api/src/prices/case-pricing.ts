// The market value of drops must not exceed the price of opening a case on
// average. Keep the existing sticker price when it is already higher.
const TARGET_PAYOUT_RATIO = 0.9;

export function marketCasePrice(
  items: ReadonlyArray<{ weight: number; valueMinor: number }>,
  minimumMinor: number,
): number {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0 || items.some((item) => item.weight <= 0 || item.valueMinor <= 0)) {
    throw new Error("Cannot price a case with invalid drops");
  }
  const expectedValue = items.reduce((sum, item) => sum + item.weight * item.valueMinor, 0) / totalWeight;
  const price = Math.max(minimumMinor, Math.ceil(expectedValue / TARGET_PAYOUT_RATIO));
  if (!Number.isSafeInteger(price)) throw new Error("Case price exceeds safe integer range");
  return price;
}
