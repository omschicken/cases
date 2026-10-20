/**
 * Re-balances a case so that its expected payout (RTP) hits a target.
 *
 * Drop chance falls with value as p_i ∝ value_i^-alpha; alpha is solved so the
 * expected value equals target * price. If the cheapest drop is already too
 * valuable for the price (it would make the target impossible), the price is
 * raised; if the pool is too cheap for the price, the price is lowered.
 */
export interface BalanceInput {
  priceMinor: number;
  valuesMinor: number[];
  /** Smallest price increment, e.g. 1000 = 10 RUB. */
  priceStepMinor: number;
}

export interface BalanceResult {
  priceMinor: number;
  /** Drop probabilities, same order as the input values; they sum to 1. */
  probabilities: number[];
  rtp: number;
  alpha: number;
}

/** Every item stays droppable, however expensive it is. */
const MIN_PROBABILITY = 1e-5;
/** The cheapest drop may cost at most this share of the case price. */
const MAX_FLOOR_SHARE = 0.35;
const ALPHA_MIN = -3;
const ALPHA_MAX = 12;

function probabilities(values: number[], alpha: number): number[] {
  const vmin = Math.min(...values);
  const raw = values.map((v) => Math.pow(v / vmin, -alpha));
  const total = raw.reduce((a, b) => a + b, 0);
  const eps = MIN_PROBABILITY;
  return raw.map((r) => (r / total) * (1 - values.length * eps) + eps);
}

function expectedValue(values: number[], alpha: number): number {
  const p = probabilities(values, alpha);
  return values.reduce((sum, v, i) => sum + v * p[i], 0);
}

const roundUp = (n: number, step: number) => Math.ceil(n / step) * step;

export function balanceCase(input: BalanceInput, targetRtp = 0.8): BalanceResult {
  const { valuesMinor: values, priceStepMinor: step } = input;
  if (values.length === 0 || values.some((v) => !(v > 0))) throw new Error("Cannot balance a case with invalid drops");

  let price = Math.max(input.priceMinor, step);
  const floor = Math.min(...values);
  if (floor > MAX_FLOOR_SHARE * price) price = roundUp(floor / MAX_FLOOR_SHARE, step);

  let target = targetRtp * price;
  if (expectedValue(values, ALPHA_MIN) < target) {
    // Pool is too cheap for this price even at the most generous odds.
    price = Math.max(step, Math.floor(expectedValue(values, ALPHA_MIN) / targetRtp / step) * step);
    target = targetRtp * price;
  }

  let lo = ALPHA_MIN;
  let hi = ALPHA_MAX;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (expectedValue(values, mid) > target) lo = mid;
    else hi = mid;
  }
  const alpha = (lo + hi) / 2;
  const p = probabilities(values, alpha);
  return { priceMinor: price, probabilities: p, rtp: expectedValue(values, alpha) / price, alpha };
}
