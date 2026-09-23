/** Formats an integer-minor-units string (e.g. cents, as sent by the API) as a display amount. */
export function formatMinor(minor: string | number, currency = "USD", decimals = 2): string {
  const value = Number(minor) / 10 ** decimals;
  return `${value.toFixed(decimals)} ${currency}`;
}
