/**
 * Re-balances a case so that its expected payout (RTP) hits a target while the
 * ride stays smooth: most opens return a sensible share of the price, a solid
 * minority return the price or more, and only a thin tail is a jackpot.
 *
 * Drops are grouped by value relative to the case price. Each group gets a
 * share of the probability; a single dial (theta) slides the shares between a
 * "lean" and a "rich" profile until the expected value matches the target.
 * Inside a group cheaper drops are slightly more likely.
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
  /** Share of opens that return at least the case price. */
  winShare: number;
  /** Value (as a multiple of price) that half of all opens reach or beat. */
  medianReturn: number;
}

/** Upper bounds of each group as a multiple of price: junk, low, near, high, then jackpot. */
const EDGES = [0.25, 0.75, 1.6, 6];
/** Probability shares per group (junk, low, near, high); each row sums to 1. */
const LEAN = [0.12, 0.62, 0.22, 0.04];
const RICH = [0.04, 0.36, 0.36, 0.24];
/** Probability reserved for jackpot drops (> 6x price). */
const JACKPOT_SHARE = 0.005;
/** Every item stays droppable, however expensive it is. */
const MIN_PROBABILITY = 1e-5;

function group(ratio: number): number {
  const i = EDGES.findIndex((edge) => ratio < edge);
  return i === -1 ? 4 : i;
}

function distribution(values: number[], price: number, theta: number): number[] {
  const groups = values.map((v) => group(v / price));
  const shares = [0, 0, 0, 0, 0];
  for (let g = 0; g < 4; g++) shares[g] = (LEAN[g] * (1 - theta) + RICH[g] * theta) * (1 - JACKPOT_SHARE);
  shares[4] = JACKPOT_SHARE;

  // An empty group hands its share to the nearest group that has drops.
  const present = [0, 1, 2, 3, 4].filter((g) => groups.includes(g));
  const mass = [0, 0, 0, 0, 0];
  for (let g = 0; g < 5; g++) {
    const target = present.reduce((best, p) => (Math.abs(p - g) < Math.abs(best - g) ? p : best), present[0]);
    mass[target] += shares[g];
  }
  const inverse = values.map((v) => 1 / v);
  const groupTotal = [0, 0, 0, 0, 0];
  values.forEach((_, i) => (groupTotal[groups[i]] += inverse[i]));
  const eps = MIN_PROBABILITY;
  return values.map((_, i) => (mass[groups[i]] * inverse[i]) / groupTotal[groups[i]] * (1 - values.length * eps) + eps);
}

const ev = (values: number[], p: number[]) => values.reduce((s, v, i) => s + v * p[i], 0);
const roundTo = (n: number, step: number) => Math.max(step, Math.round(n / step) * step);

export function balanceCase(input: BalanceInput, targetRtp = 0.9): BalanceResult {
  const { valuesMinor: values, priceStepMinor: step } = input;
  if (values.length === 0 || values.some((v) => !(v > 0))) throw new Error("Cannot balance a case with invalid drops");

  let price = Math.max(input.priceMinor, step);
  let theta = 0;
  for (let attempt = 0; attempt < 8; attempt++) {
    const lean = ev(values, distribution(values, price, 0));
    const rich = ev(values, distribution(values, price, 1));
    const target = targetRtp * price;
    if (target < lean || target > rich) {
      // The drops cannot hit the target at this price: move the price instead.
      const reachable = target < lean ? lean : rich;
      const next = roundTo(reachable / targetRtp, step);
      if (next === price) {
        theta = target < lean ? 0 : 1;
        break;
      }
      price = next;
      continue;
    }
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 100; i++) {
      const mid = (lo + hi) / 2;
      if (ev(values, distribution(values, price, mid)) < target) lo = mid;
      else hi = mid;
    }
    theta = (lo + hi) / 2;
    break;
  }

  const p = distribution(values, price, theta);
  const order = values.map((v, i) => i).sort((a, b) => values[a] - values[b]);
  let cumulative = 0;
  let median = values[order[order.length - 1]];
  for (const i of order) {
    cumulative += p[i];
    if (cumulative >= 0.5) {
      median = values[i];
      break;
    }
  }
  return {
    priceMinor: price,
    probabilities: p,
    rtp: ev(values, p) / price,
    winShare: values.reduce((s, v, i) => (v >= price ? s + p[i] : s), 0),
    medianReturn: median / price,
  };
}
