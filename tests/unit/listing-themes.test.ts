import { describe, expect, it } from "vitest";
import {
  LISTING_THEMES,
  isListingTheme,
  listingTheme,
  listingThemeStyle,
} from "@/lib/listing-themes";

describe("listing-themes", () => {
  it("accepts known themes and falls back to gallery", () => {
    expect(LISTING_THEMES).toContain("editorial");
    expect(isListingTheme("coastal")).toBe(true);
    expect(isListingTheme("neon")).toBe(false);
    expect(listingTheme("editorial")).toBe("editorial");
    expect(listingTheme(null)).toBe("gallery");
  });

  it("maps tokens onto CSS custom properties", () => {
    const style = listingThemeStyle("editorial");
    expect(style.color).toBe("#f4f1ec");
    expect(style["--accent"]).toBe("#c8a45c");
    expect(String(style.background)).toMatch(/linear-gradient/);
  });
});
