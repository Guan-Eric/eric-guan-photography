import { describe, expect, it } from "vitest";
import {
  DEFAULT_STUDIO_CURRENCY,
  isStudioCurrency,
  listStudioCurrencies,
  normalizeStudioCurrency,
  studioCurrencyLabel,
} from "@/lib/currency";

describe("studio currency", () => {
  it("defaults to CAD", () => {
    expect(normalizeStudioCurrency(undefined)).toBe(DEFAULT_STUDIO_CURRENCY);
    expect(normalizeStudioCurrency("")).toBe("CAD");
    expect(normalizeStudioCurrency("xyz")).toBe("CAD");
  });

  it("accepts worldwide ISO codes case-insensitively", () => {
    expect(normalizeStudioCurrency("usd")).toBe("USD");
    expect(normalizeStudioCurrency("Gbp")).toBe("GBP");
    expect(normalizeStudioCurrency("jpy")).toBe("JPY");
    expect(normalizeStudioCurrency("BRL")).toBe("BRL");
    expect(normalizeStudioCurrency("inr")).toBe("INR");
    expect(normalizeStudioCurrency("zar")).toBe("ZAR");
  });

  it("labels known currencies", () => {
    expect(studioCurrencyLabel("CAD").toLowerCase()).toContain("canadian");
    expect(studioCurrencyLabel("usd").toLowerCase()).toContain("us");
  });

  it("lists a broad set from Intl", () => {
    const list = listStudioCurrencies();
    expect(list.length).toBeGreaterThan(50);
    expect(list.some((item) => item.code === "CAD")).toBe(true);
    expect(list.some((item) => item.code === "JPY")).toBe(true);
    expect(isStudioCurrency("EUR")).toBe(true);
  });
});
