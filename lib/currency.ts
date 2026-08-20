/** Currencies studios can charge agents in (packages, quotes, galleries). */

export const DEFAULT_STUDIO_CURRENCY = "CAD";

/** @deprecated Prefer string; kept for call-site compatibility. */
export type StudioCurrencyCode = string;

/** Fixed dropdown set — Intl.supportedValuesOf differs between Node and browsers (hydration). */
const STUDIO_CURRENCY_CODES = [
  "AED",
  "ARS",
  "AUD",
  "BRL",
  "CAD",
  "CHF",
  "CLP",
  "CNY",
  "COP",
  "CZK",
  "DKK",
  "EGP",
  "EUR",
  "GBP",
  "HKD",
  "HUF",
  "IDR",
  "ILS",
  "INR",
  "ISK",
  "JPY",
  "KRW",
  "MXN",
  "MYR",
  "NOK",
  "NZD",
  "PHP",
  "PLN",
  "RON",
  "SAR",
  "SEK",
  "SGD",
  "THB",
  "TRY",
  "TWD",
  "USD",
  "UYU",
  "VND",
  "ZAR",
] as const;

let cachedValidCodes: Set<string> | null = null;

function supportedCurrencyCodes(): Set<string> {
  if (cachedValidCodes) return cachedValidCodes;
  try {
    if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
      cachedValidCodes = new Set(Intl.supportedValuesOf("currency"));
      return cachedValidCodes;
    }
  } catch {
    /* fall through */
  }
  cachedValidCodes = new Set(STUDIO_CURRENCY_CODES);
  return cachedValidCodes;
}

function currencyDisplayName(code: string): string {
  try {
    return (
      new Intl.DisplayNames(["en"], { type: "currency" }).of(code) ?? code
    );
  } catch {
    return code;
  }
}

/** Stable option list for selects (same on server and client). */
export function listStudioCurrencies(): Array<{ code: string; label: string }> {
  return STUDIO_CURRENCY_CODES.map((code) => {
    const name = currencyDisplayName(code);
    return {
      code,
      label: name === code ? code : `${name} (${code})`,
    };
  }).sort((a, b) => a.label.localeCompare(b.label, "en"));
}

/** @deprecated Use listStudioCurrencies() — kept for older imports. */
export const STUDIO_CURRENCIES = listStudioCurrencies();

export function isStudioCurrency(value: string): boolean {
  const code = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) && supportedCurrencyCodes().has(code);
}

/** Normalize user/API input to a valid ISO 4217 currency code. */
export function normalizeStudioCurrency(
  value: unknown,
  fallback: string = DEFAULT_STUDIO_CURRENCY,
): string {
  if (typeof value !== "string") {
    return isStudioCurrency(fallback)
      ? fallback.toUpperCase()
      : DEFAULT_STUDIO_CURRENCY;
  }
  const code = value.trim().toUpperCase();
  if (isStudioCurrency(code)) return code;
  return isStudioCurrency(fallback)
    ? fallback.toUpperCase()
    : DEFAULT_STUDIO_CURRENCY;
}

export function studioCurrencyLabel(code: string): string {
  const normalized = normalizeStudioCurrency(code);
  const name = currencyDisplayName(normalized);
  return name === normalized ? normalized : `${name} (${normalized})`;
}
