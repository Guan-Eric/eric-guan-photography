/** Currencies studios can charge agents in (packages, quotes, galleries). */

export const DEFAULT_STUDIO_CURRENCY = "CAD";

/** @deprecated Prefer string; kept for call-site compatibility. */
export type StudioCurrencyCode = string;

const FALLBACK_CURRENCIES = [
  "AED",
  "AUD",
  "BRL",
  "CAD",
  "CHF",
  "CNY",
  "DKK",
  "EUR",
  "GBP",
  "HKD",
  "INR",
  "JPY",
  "KRW",
  "MXN",
  "NOK",
  "NZD",
  "PLN",
  "SEK",
  "SGD",
  "USD",
  "ZAR",
] as const;

let cachedCodes: Set<string> | null = null;

function supportedCurrencyCodes(): Set<string> {
  if (cachedCodes) return cachedCodes;
  try {
    if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
      cachedCodes = new Set(Intl.supportedValuesOf("currency"));
      return cachedCodes;
    }
  } catch {
    /* fall through */
  }
  cachedCodes = new Set(FALLBACK_CURRENCIES);
  return cachedCodes;
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

/** Full ISO 4217 set from the runtime when available. */
export function listStudioCurrencies(): Array<{ code: string; label: string }> {
  return [...supportedCurrencyCodes()]
    .map((code) => {
      const name = currencyDisplayName(code);
      return {
        code,
        label: name === code ? code : `${name} (${code})`,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "en"));
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
