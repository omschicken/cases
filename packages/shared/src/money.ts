/**
 * All money is stored and transmitted as integer minor units (cents) to
 * avoid floating point drift in balances. Never use `number` with decimals
 * for currency amounts anywhere in the wallet/ledger path.
 */

export type MinorUnits = number; // integer, e.g. cents

export function toMinorUnits(amount: number, decimals = 2): MinorUnits {
  return Math.round(amount * 10 ** decimals);
}

export function fromMinorUnits(minor: MinorUnits, decimals = 2): number {
  return minor / 10 ** decimals;
}

export function formatMinorUnits(minor: MinorUnits, currency: string, decimals = 2): string {
  return `${fromMinorUnits(minor, decimals).toFixed(decimals)} ${currency}`;
}
