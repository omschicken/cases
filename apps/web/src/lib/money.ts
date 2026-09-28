/** Formats an integer-minor-units string (e.g. cents/kopecks, as sent by the API) as a
 * locale-correct display amount — "5 000,00 ₽" for RUB, "127,50 $" for a legacy
 * USD-tagged case, etc. Always formatted in the site's ru-RU default locale
 * (matching its fallback language), regardless of the active UI language. */
export function formatMinor(minor: string | number, currency = "RUB", decimals = 2): string {
  const value = Number(minor) / 10 ** decimals;
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    // Unknown/malformed currency code — fall back to a plain numeric label.
    return `${value.toFixed(decimals)} ${currency}`;
  }
}
