import { formatMinor } from "../lib/money";
import { useCountUp } from "../lib/useCountUp";

/** A price or balance that counts to its new value when it changes. */
export function Money({ minor, currency = "RUB" }: { minor: string | number; currency?: string }) {
  const shown = useCountUp(Number(minor));
  return <span className="dz-figure">{formatMinor(Math.round(shown), currency)}</span>;
}
